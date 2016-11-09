var express = require('express');
var async = require('async');
var moment = require('moment');
var router = express.Router();

var skip_fields = [ '@timestamp', 'type', 'host' ];

/**
 * @api {get} /energy/:workflowID/:experimentID 1. Return energy data for the given experiment ID
 * @apiVersion 1.0.0
 * @apiName GetEnergy
 * @apiGroup Energy
 *
 * @apiParam {String} workflowID identifier for a workflow, e.g. 'ms2'
 * @apiParam {String} experimentID identifier for an experiment, e.g. 'AVQa1RU0GMPeuCn4_2S_'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/energy/ms2/AVQa1RU0GMPeuCn4_2S_
 *
 * @apiSuccess {Array}  taskID identifier for a task of the given workflow
 * @apiSuccess {String} taskID.timestamp timestamp when the measurement was taken
 * @apiSuccess {String} taskID.type group identifier (equals plug-in name)
 * @apiSuccess {String} taskID.metric value sampled for the given metric
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "T2.1": [
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292211",
 *              "type": "pwm",
 *              "ATX12V_node01": 19,
 *              "CPU1_node01": 111,
 *              "CPU2_node01": 113,
 *              "GPU_node01": 15
 *           },
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292611",
 *              "type": "pwm",
 *              "ATX12V_node01": 19,
 *              "CPU2_node01": 110,
 *              "CPU1_node01": 115,
 *              "GPU_node01": 15
 *           },
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292111",
 *              "type": "pwm",
 *              "GPU_node01": 15,
 *              "CPU1_node01": 110,
 *              "ATX12V_node01": 19,
 *              "CPU2_node01": 113
 *           },
 *           ...
 *        ],
 *        "T2.2": [
 *           {
 *              "@timestamp": "2016-04-15T18:52:08.4293011",
 *              "type": "pwm",
 *              "CPU1_node01": 118,
 *              "GPU_node01": 15,
 *              "CPU2_node01": 112,
 *              "ATX12V_node01": 19
 *           },
 *           ...
 *        ]
 *     }
 *
 * @apiError NotFound The given workflow ID cannot be found in the database.
 * @apiError DatabaseError Elasticsearch specific error message.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Given workflow ID does not exist."
 *     }
 */
router.get('/:workflowID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      workflow = req.params.workflowID.toLowerCase(),
      experiment = req.params.experimentID,
      dreamcloud_pwm_idx = req.app.get('pwm_idx'),
      json = {};

    client.get({
        index: 'mf',
        type: 'workflows',
        id: workflow
    }, function (error, result) {
        if (error) {
            var message = {};
            message.error = 'Given workflow ID does not exist.';
            res.status(404);
            return next(message);
        }
        if (result !== undefined) {
            var es_result = {},
                ranges = {};
            es_result.workflow = workflow;
            var tasks = result._source.tasks;
            es_result.tasks = [];

            /* FOR EACH TASK */
            async.each(tasks, function(task, callback) {
                task = task.name;
                var resource = workflow + "_" + task;
                resource = resource.toLowerCase();
                ranges[task] = {};

                async.series([
                    /* GET START DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:asc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results),
                                    start = 0;
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    start = metric_data['@timestamp'];
                                    start = start.replace(/\s/g, '0');
                                });

                                ranges[task].start = start;
                                series_callback(null);
                            }
                        });
                    },
                    /* GET END DATE OF TASK */
                    function(series_callback) {
                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: [ "@timestamp:desc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits,
                                    keys = Object.keys(only_results),
                                    end = 0;
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    end = metric_data['@timestamp'];
                                    end = end.replace(/\s/g, '0');
                                });

                                ranges[task].end = end;
                                series_callback(null);
                            }
                        });
                    },
                    function(series_callback) {
                        client.search({
                            index: dreamcloud_pwm_idx,
                            body: {
                                query: {
                                    constant_score: {
                                        filter: {
                                            range: {
                                                "@timestamp": {
                                                    "gte": ranges[task].start.toString(),
                                                    "lte": ranges[task].end.toString()
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            searchType: 'count'
                        }, function(error, response) {
                            if (error) {
                                return series_callback(error);
                            }
                            if (response.hits !== undefined) {
                                size = response.hits.total;
                                ranges[task].size = size;
                            }

                            series_callback(null);
                        });
                    },
                    /* ENERGY RANGE QUERY */
                    function(series_callback) {
                        client.search({
                            index: dreamcloud_pwm_idx,
                            body: {
                                query: {
                                    constant_score: {
                                        filter: {
                                            range: {
                                                "@timestamp": {
                                                    "gte": ranges[task].start.toString(),
                                                    "lte": ranges[task].end.toString()
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            size: ranges[task].size,
                            sort: [ "@timestamp:asc" ],
                        }, function(error, result) {
                            if (error) {
                                return series_callback(error);
                            }

                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits;
                                var es_result = [];
                                var keys = Object.keys(only_results);
                                var power_result = {};

                                keys.forEach(function(key) {
                                    var data = only_results[key]._source;
                                    if (data.type != "power") {
                                        es_result.push(data);
                                        return;
                                    }
                                    var processed = false;
                                    for (key in data) {
                                        if (processed)
                                            return;
                                        if (data.hasOwnProperty(key)) {
                                            if (skip_fields.indexOf(key) > -1 || key === '')
                                                continue;
                                            var value = parseInt(data[key]);
                                            var time = data['@timestamp'];
                                            var metrics = power_result[time];
                                            if (!metrics) {
                                                metrics = {};
                                                metrics['@timestamp'] = time;
                                                metrics.type = "pwm";
                                            }
                                            metrics[key] = value;
                                            power_result[time] = metrics;
                                            processed = true;
                                        }
                                    }
                                });
                                for (var key in power_result) {
                                    es_result.push(power_result[key]);
                                }
                                json[task] = es_result;
                            } else {
                                var message = {};
                                message.error = "No data found";
                                json[task] = message;
                            }

                            series_callback(null);
                        });
                    }
                ], function(error) {
                    if (error) {
                        return callback();
                    }
                    json = json;
                    callback(null);
                });
            }, function(error) {
                if (error) {
                    res.status(500);
                    return next(error);
                }
                res.json(json);
            });
        }
    });
});

/**
 * @api {get} /energy/:workflowID/:taskID/:experimentID 2. Return energy data filtered by task ID
 * @apiVersion 1.0.0
 * @apiName GetEnergyByTask
 * @apiGroup Energy
 *
 * @apiParam {String} workflowID identifier for a workflow, e.g. 'ms2'
 * @apiParam {String} taskID identifier for a task, e.g. 't2.1'
 * @apiParam {String} experimentID identifier for an experiment, e.g. 'AVX'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/energy/ms2/t2.1/AVQa1RU0GMPeuCn4_2S_
 *
 * @apiSuccess {Array}  taskID identifier for a task of the given workflow
 * @apiSuccess {String} taskID.timestamp timestamp when the measurement was taken
 * @apiSuccess {String} taskID.type group identifier (equals plug-in name)
 * @apiSuccess {String} taskID.metric value sampled for the given metric
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "t2.1": [
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292211",
 *              "type": "pwm",
 *              "ATX12V_node01": 19,
 *              "CPU1_node01": 111,
 *              "CPU2_node01": 113,
 *              "GPU_node01": 15
 *           },
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292611",
 *              "type": "pwm",
 *              "ATX12V_node01": 19,
 *              "CPU2_node01": 110,
 *              "CPU1_node01": 115,
 *              "GPU_node01": 15
 *           },
 *           {
 *              "@timestamp": "2016-04-15T18:51:07.4292111",
 *              "type": "pwm",
 *              "GPU_node01": 15,
 *              "CPU1_node01": 110,
 *              "ATX12V_node01": 19,
 *              "CPU2_node01": 113
 *           },
 *           ...
 *        ]
 *     }
 *
 * @apiError NotFound No data for given task is stored.
 * @apiError DatabaseError Elasticsearch specific error message.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Data unavailable."
 *     }
 */
router.get('/:workflowID/:taskID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      workflow = req.params.workflowID.toLowerCase(),
      task = req.params.taskID.toLowerCase(),
      experiment = req.params.experimentID,
      dreamcloud_pwm_idx = req.app.get('pwm_idx'),
      json = {};

    var es_result = {},
        ranges = {};
    es_result.workflow = workflow;
    es_result.tasks = [];

    /* FOR EACH TASK */
    async.each([ task ], function(task, callback) {
        var resource = workflow + "_" + task;
        resource = resource.toLowerCase();
        ranges[task] = {};

        async.series([
            /* GET START DATE OF TASK */
            function(series_callback) {
                client.search({
                    index: resource,
                    type: experiment,
                    size: 1,
                    sort: [ "@timestamp:asc" ],
                }, function(error, result) {
                    if (error) {
                        var message = {};
                        message.error = 'Data unavailable.';
                        return series_callback(message);
                    }
                    if (result.hits !== undefined) {
                        var only_results = result.hits.hits,
                            keys = Object.keys(only_results),
                            start = 0;
                        keys.forEach(function(key) {
                            var metric_data = only_results[key]._source;
                            start = metric_data['@timestamp'];
                            start = start.replace(/\s/g, '0');
                        });

                        ranges[task].start = start;
                        series_callback(null);
                    }
                });
            },
            /* GET END DATE OF TASK */
            function(series_callback) {
                client.search({
                    index: resource,
                    type: experiment,
                    size: 1,
                    sort: [ "@timestamp:desc" ],
                }, function(error, result) {
                    if (error) {
                        return series_callback(error);
                    }
                    if (result.hits !== undefined) {
                        var only_results = result.hits.hits,
                            keys = Object.keys(only_results),
                            end = 0;
                        keys.forEach(function(key) {
                            var metric_data = only_results[key]._source;
                            end = metric_data['@timestamp'];
                            end = end.replace(/\s/g, '0');
                        });

                        ranges[task].end = end;
                        series_callback(null);
                    }
                });
            },
            function(series_callback) {
                client.search({
                    index: dreamcloud_pwm_idx,
                    body: {
                        query: {
                            constant_score: {
                                filter: {
                                    range: {
                                        "@timestamp": {
                                            "gte": ranges[task].start.toString(),
                                            "lte": ranges[task].end.toString()
                                        }
                                    }
                                }
                            }
                        }
                    },
                    searchType: 'count'
                }, function(error, response) {
                    if (error) {
                        return series_callback(error);
                    }
                    if (response.hits !== undefined) {
                        size = response.hits.total;
                        ranges[task].size = size;
                    }

                    series_callback(null);
                });
            },
            /* ENERGY RANGE QUERY */
            function(series_callback) {
                client.search({
                    index: dreamcloud_pwm_idx,
                    body: {
                        query: {
                            constant_score: {
                                filter: {
                                    range: {
                                        "@timestamp": {
                                            "gte": ranges[task].start.toString(),
                                            "lte": ranges[task].end.toString()
                                        }
                                    }
                                }
                            }
                        }
                    },
                    size: ranges[task].size,
                    sort: [ "@timestamp:asc" ],
                }, function(error, result) {
                    if (error) {
                        return series_callback(error);
                    }

                    if (result.hits !== undefined) {
                        var only_results = result.hits.hits;
                        var es_result = [];
                        var keys = Object.keys(only_results);
                        var power_result = {};

                        keys.forEach(function(key) {
                            var data = only_results[key]._source;
                            if (data.type != "power") {
                                es_result.push(data);
                                return;
                            }
                            var processed = false;
                            for (key in data) {
                                if (processed)
                                    return;
                                if (data.hasOwnProperty(key)) {
                                    if (skip_fields.indexOf(key) > -1 || key === '')
                                        continue;

                                    var value = parseInt(data[key]);
                                    var time = data['@timestamp'];
                                    var metrics = power_result[time];
                                    if (!metrics) {
                                        metrics = {};
                                        metrics['@timestamp'] = time;
                                        metrics.type = "pwm";
                                    }
                                    metrics[key] = value;
                                    power_result[time] = metrics;
                                    processed = true;
                                }
                            }
                        });
                        for (var key in power_result) {
                            es_result.push(power_result[key]);
                        }
                        json[task] = es_result;
                    } else {
                        var message = {};
                        message.error = "No data found";
                        json[task] = message;
                    }

                    series_callback(null);
                });
            }
        ], function(error) {
            if (error) {
                res.status(500);
                return next(error);
            }
            res.json(json);
        });
    });
});

module.exports = router;
