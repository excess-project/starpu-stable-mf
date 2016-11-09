var express = require('express');
var router = express.Router();
var async = require('async');
var dateFormat = require('dateformat');

/**
 * @api {get} /summary/:workflowID/:taskID/:platformID 2. Get summary including statistics
 * @apiVersion 1.0.0
 * @apiName GetSummary
 * @apiGroup Reports
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} platformID identifier for a given platform, e.g. 'excesscluster' or 'laptop'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/summary/ms2/t2.1/excesscluster
 *
 * @apiSuccess {String} experiment_id identifier for an experiment
 * @apiSuccess {String} workflow_id identifier for the workflow
 * @apiSuccess {String} task_id identifier of a task
 * @apiSuccess {String} deployment_id identifier (here: hashvalue) of a deployment plan
 * @apiSuccess {Object} runtime runtime information
 * @apiSuccess {String} runtime.start_time time when the first task started its execution
 * @apiSuccess {String} runtime.end_time time when the last task finished execution
 * @apiSuccess {Number} runtime.actual_time total execution time in seconds
 * @apiSuccess {Number} runtime.predicted_time predicted total execution time (data filled by heuristic manager)
 * @apiSuccess {Object} energy energy-related information for the workflow
 * @apiSuccess {Object} energy.node energy data for a given target platform (cluster node)
 * @apiSuccess {Number} energy.node.avg_watt_consumption average Watt consumption
 * @apiSuccess {Number} energy.node.total_energy_consumption total energy consumption
 * @apiSuccess {Object} metrics list of individual metric-related statistics
 * @apiSuccess {Object} metrics.metric statistics on a given metric (metric equals name of counter)
 * @apiSuccess {Number} metrics.metric.count number of metric values available
 * @apiSuccess {Number} metrics.metric.min minimum value obtained
 * @apiSuccess {Number} metrics.metric.max maximum value obtained
 * @apiSuccess {Number} metrics.metric.avg average value based on number of values
 * @apiSuccess {Number} metrics.metric.sum sum of all obtained data points
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *           "experiment_id": "AVZVoX2SGYwmTvCu75Mo",
 *           "workflow_id": "ms2",
 *           "task_id": "t2.1",
 *           "deployment_id": "79f2e72501da8a8bcff9d6cd711b44a0fe8174a751e897c51ef7a7d110b925d8",
 *           "runtime": {
 *              "start_time": "2016-08-04T14:59:38.755",
 *              "end_time": "2016-08-04T15:38:23.667",
 *              "actual_time": 2324.912,
 *              "predicted_time": 0
 *           },
 *           "energy": {
 *              "NODE01": {
 *                 "avg_watt_consumption": 153.34391120137695,
 *                 "total_energy_consumption": 356511.0992790157
 *              },
 *              "NODE02": {
 *                 "avg_watt_consumption": 140.82331453872632,
 *                 "total_energy_consumption": 327401.81385085924
 *              },
 *              "NODE03": {
 *                 "avg_watt_consumption": 123.82224931497417,
 *                 "total_energy_consumption": 287875.8332993752
 *              }
 *           },
 *           "metrics": {
 *              "PP0_ENERGY:PACKAGE1": {
 *                 "count": 25,
 *                 "min": 2.9063,
 *                 "max": 71.1607,
 *                 "avg": 45.523972,
 *                 "sum": 1138.0993
 *              },
 *              "CPU0::PAPI_FP_INS": {
 *                 "count": 24,
 *                 "min": 869,
 *                 "max": 565864880,
 *                 "avg": 219248143.20833334,
 *                 "sum": 5261955437
 *              },
 *              ...
 *        }
 *     ]
 *
 *
 * @apiError NotFound No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFound
 *     {
 *       "error": "No data found in the database."
 *     }
 */
router.get('/:workflow/:task/:platform', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflow.toLowerCase(),
      task = req.params.task.toLowerCase(),
      platform = req.params.platform.toLowerCase(),
      deployment = req.params.deployment, // we keep the original case
      mf_server = req.app.get('mf_server'),
      dreamcloud_pwm_idx = req.app.get('pwm_idx'),
      expand = req.query.expand,
      experiments = [],
      predicted_execution_time = 0,
      json = [];

    client.search({
        index: 'deployment_on_' + platform,
        type: workflow + '_' + task,
        searchType: 'count'
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }

        if (response.hits !== undefined) {
            size = response.hits.total;
        }

        client.search({
            index: 'deployment_on_' + platform,
            type: workflow + '_' + task,
            size: size,
        }, function(error, response) {
            if (error) {
                res.status(500);
                return next(error);
            }
            if (response.hits !== undefined) {
                var results = response.hits.hits;
                async.each(results, function(deployment, outer_callback) {
                    deployment = deployment._id;

                    /* (1) get deployment plan for the given hashvalue */
                    client.get({
                        index: 'deployment_on_' + platform,
                        type: workflow + '_' + task,
                        id: deployment
                    }, function(error, response) {
                        if (error) {
                            return next(error);
                        }

                        /* parse all experiments that use this deployment plan */
                        if (response.found) {
                            var source = response._source;
                            experiments = source.experiments;
                            predicted_execution_time = source.estimatedTime;
                        } else {
                            var message = {};
                            message.error = "Could not find deployment plan in the database";
                            res.json(message);
                            return;
                        }

                        var index = workflow + '_' + task;
                        async.forEachOf(experiments, function(value, experiment, callback) {

                            /* get start of experiment */
                            client.search({
                                index: index,
                                type: experiment,
                                size: 1,
                                sort: ['@timestamp:asc']
                            }, function(error, response) {
                                var data = {};
                                if (error) {
                                    callback(null);
                                    return;
                                }
                                var start, end;
                                if (response.hits !== undefined) {
                                    var only_results = response.hits.hits;
                                    var keys = Object.keys(only_results);
                                    keys.forEach(function(key) {
                                        var metric_data = only_results[key]._source;
                                        start = metric_data['@timestamp'];
                                        start = start.replace(/\s/g, '0');
                                    });
                                }

                                /* get end of experiment */
                                client.search({
                                    index: index,
                                    type: experiment,
                                    size: 1,
                                    sort: ['@timestamp:desc']
                                }, function(error, response) {
                                    if (error) {
                                        callback(null);
                                        return;
                                    }
                                    if (response.hits !== undefined) {
                                        var only_results = response.hits.hits;
                                        var keys = Object.keys(only_results);
                                        keys.forEach(function(key) {
                                            var metric_data = only_results[key]._source;
                                            end = metric_data['@timestamp'];
                                            end = end.replace(/\s/g, '0');
                                        });
                                    }

                                    if (!is_defined(start) || !is_defined(end)) {
                                        callback(null);
                                        return;
                                    }

                                    /* add runtime statistics to response object */
                                    data.experiment_id = experiment;
                                    data.workflow_id = workflow;
                                    data.task_id = task;
                                    data.deployment_id = deployment;
                                    data.runtime = {};
                                    data.runtime.start_time = start;
                                    data.runtime.end_time = end;
                                    data.runtime.actual_time = (new Date(end) - new Date(start)) / 1000;
                                    data.runtime.predicted_time = predicted_execution_time;
                                    if (!data.runtime.actual_time) {
                                        data.runtime.actual_time = 0;
                                    }

                                    /* get energy measurments */
                                    var body = compute_average_on("NODE01", "NODE02", "NODE03", start, end);
                                    client.search({
                                        index: dreamcloud_pwm_idx,
                                        searchType: 'count',
                                        body: body
                                    }, function(error, response) {
                                        if (error) {
                                            // do nothing
                                        } else {
                                            var answer = {},
                                                aggs = response.aggregations;

                                            data.energy = {};
                                            var power_data = {};
                                            var average = aggs.power_metrics.NODE01.value;
                                            data.energy.NODE01 = {};
                                            data.energy.NODE01.avg_watt_consumption = average;
                                            var duration = (new Date(end) - new Date(start)) / 1000;
                                            var joule = average * duration;
                                            data.energy.NODE01.total_energy_consumption = joule;

                                            average = aggs.power_metrics.NODE02.value;
                                            data.energy.NODE02 = {};
                                            data.energy.NODE02.avg_watt_consumption = average;
                                            joule = average * duration;
                                            data.energy.NODE02.total_energy_consumption = joule;

                                            average = aggs.power_metrics.NODE03.value;
                                            data.energy.NODE03 = {};
                                            data.energy.NODE03.avg_watt_consumption = average;
                                            joule = average * duration;
                                            data.energy.NODE03.total_energy_consumption = joule;

                                            /* no energy measurements available */
                                            if (!is_defined(average) || average === null) {
                                                data.energy = [];
                                            }
                                        }

                                        /* retrieve all metric counters as a set */
                                        var index = workflow + '_' + task;
                                        var metric_keys = {};
                                        data.metrics = {};
                                        client.search({
                                            index: index,
                                            type: experiment,
                                            size: 20 /* should be enough results to capture all metrics */
                                        }, function(error, response) {
                                            if (error) {
                                                callback(null);
                                                return;
                                            }
                                            if (response.hits !== undefined) {
                                                var results = response.hits.hits,
                                                  keys = Object.keys(results),
                                                  items = {};
                                                /* filter keys like @timestamp, host, task, and type */
                                                keys.forEach(function(key) {
                                                    items = results[key]._source;
                                                    if (items.type == 'progress') {
                                                        return;
                                                    }
                                                    delete items['@timestamp'];
                                                    delete items.host;
                                                    delete items.task;
                                                    delete items.type;
                                                    delete items.platform;
                                                    items = deleteKeysByPrefix(items, "info_");
                                                    for (var item in items) {
                                                        metric_keys[item] = item;
                                                    }
                                                });

                                                /* compute statistics for each identified metric */
                                                async.each(metric_keys, function(metric, inner_callback) {
                                                    client.search({
                                                        index: index,
                                                        type: experiment,
                                                        searchType: 'count',
                                                        body: aggregation_by(metric)
                                                    }, function(error, response) {
                                                        if (error) {
                                                            inner_callback(null);
                                                        }
                                                        var aggs = response.aggregations;
                                                        data.metrics[metric] = aggs[metric + '_Stats'];
                                                        inner_callback(null);
                                                    });
                                                }, function(error) {
                                                    json.push(data);
                                                    /* finished */
                                                    callback(null);
                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        }, function(error) {
                            if (error) {
                                return next(error);
                            }

                            //json.push(plan);
                            outer_callback(null);
                        });
                    });
                }, function(error) {
                    res.json(json);
                });
            } else {
                var message = {};
                message = 'No deployment plans available';
                res.json(message);
            }
        });
    });
});

/**
 * @api {get} /summary/:workflowID/:taskID/:platformID/:deploymentID 3. Get summary filtered by deployment ID
 * @apiVersion 1.0.0
 * @apiName GetSummaryByID
 * @apiGroup Reports
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} platformID identifier for a given platform, e.g. 'excesscluster' or 'laptop'
 * @apiParam {String} deploymentID identifier (= hashvalue) of a given deployment plan
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/summary/ms2/t2.1/test_cluster/4e165a82309000fd5a6ab20c097b2e9f2ba5216d
 *
 * @apiSuccess {String} experiment_id identifier for an experiment
 * @apiSuccess {String} workflow_id identifier for the workflow
 * @apiSuccess {String} task_id identifier of a task
 * @apiSuccess {String} deployment_id identifier (here: hashvalue) of a deployment plan
 * @apiSuccess {Object} runtime runtime information
 * @apiSuccess {String} runtime.start_time time when the first task started its execution
 * @apiSuccess {String} runtime.end_time time when the last task finished execution
 * @apiSuccess {Number} runtime.actual_time total execution time in seconds
 * @apiSuccess {Number} runtime.predicted_time predicted total execution time (data filled by heuristic manager)
 * @apiSuccess {Object} energy energy-related information for the workflow
 * @apiSuccess {Object} energy.node energy data for a given target platform (cluster node)
 * @apiSuccess {Number} energy.node.avg_watt_consumption average Watt consumption
 * @apiSuccess {Number} energy.node.total_energy_consumption total energy consumption
 * @apiSuccess {Object} metrics list of individual metric-related statistics
 * @apiSuccess {Object} metrics.metric statistics on a given metric (metric equals name of counter)
 * @apiSuccess {Number} metrics.metric.count number of metric values available
 * @apiSuccess {Number} metrics.metric.min minimum value obtained
 * @apiSuccess {Number} metrics.metric.max maximum value obtained
 * @apiSuccess {Number} metrics.metric.avg average value based on number of values
 * @apiSuccess {Number} metrics.metric.sum sum of all obtained data points
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *           "experiment_id": "AVRMbxnvGMPeuCn4HOiA",
 *           "workflow_id": "ms2",
 *           "task_id": "t2.1",
 *           "deployment_id": "4e165a82309000fd5a6ab20c097b2e9f2ba5216d",
 *           "runtime": {
 *              "start_time": "2016-04-25T10:02:07.103",
 *              "end_time": "2016-04-25T10:04:55.274",
 *              "actual_time": 168.171,
 *              "predicted_time": 2015
 *           },
 *           "energy":  [ .. ],
 *           "metrics": { .. }
 *        },
 *        {
 *           "experiment_id": "AVS_GvCNGMPeuCn4T-pC",
 *           "workflow_id": "ms2",
 *           "task_id": "t2.1",
 *           "deployment_id": "4e165a82309000fd5a6ab20c097b2e9f2ba5216d",
 *           "runtime": {
 *              "start_time": "2016-05-17T16:25:47.122",
 *              "end_time": "2016-05-17T16:26:22.296",
 *              "actual_time": 35.174,
 *              "predicted_time": 2015
 *           },
 *           "energy":  [ .. ],
 *           "metrics": { .. }
 *        }
 *     ]
 *
 * @apiError NotFound No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFound
 *     {
 *       "error": "No data found in the database."
 *     }
 */
router.get('/:workflow/:task/:platform/:deployment', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflow.toLowerCase(),
      task = req.params.task.toLowerCase(),
      platform = req.params.platform.toLowerCase(),
      deployment = req.params.deployment, // we keep the original case
      mf_server = req.app.get('mf_server'),
      dreamcloud_pwm_idx = req.app.get('pwm_idx'),
      expand = req.query.expand,
      experiments = [],
      predicted_execution_time = 0,
      json = [];

    /* (1) get deployment plan for the given hashvalue */
    client.get({
        index: 'deployment_on_' + platform,
        type: workflow + '_' + task,
        id: deployment
    }, function(error, response) {
        if (error) {
            return next(error);
        }
        /* parse all experiments that use this deployment plan */
        if (response.found) {
            var source = response._source;
            experiments = source.experiments;
            predicted_execution_time = source.estimatedTime;
        } else {
            var message = {};
            message.error = "Could not find deployment plan in the database";
            res.json(message);
            return;
        }

        var index = workflow + '_' + task;
        async.forEachOf(experiments, function(value, experiment, callback) {
            /* get start of experiment */
            client.search({
                index: index,
                type: experiment,
                size: 1,
                sort: ['@timestamp:asc']
            }, function(error, response) {
                if (error) {
                    callback(null);
                    return;
                }
                var start, end;
                if (response.hits !== undefined) {
                    var only_results = response.hits.hits;
                    var keys = Object.keys(only_results);
                    keys.forEach(function(key) {
                        var metric_data = only_results[key]._source;
                        start = metric_data['@timestamp'];
                        start = start.replace(/\s/g, '0');
                    });
                }

                /* get end of experiment */
                client.search({
                    index: index,
                    type: experiment,
                    size: 1,
                    sort: ['@timestamp:desc']
                }, function(error, response) {
                    if (error) {
                        callback(null);
                        return;
                    }
                    if (response.hits !== undefined) {
                        var only_results = response.hits.hits;
                        var keys = Object.keys(only_results);
                        keys.forEach(function(key) {
                            var metric_data = only_results[key]._source;
                            end = metric_data['@timestamp'];
                            end = end.replace(/\s/g, '0');
                        });
                    }

                    var data = {};
                    data.experiment_id = experiment;
                    data.workflow_id = workflow;
                    data.task_id = task;
                    data.deployment_id = deployment;

                    if (!is_defined(start) || !is_defined(end)) {
                        json.push(data);
                        callback(null);
                        return;
                    }

                    /* add runtime statistics to response object */
                    data.runtime = {};
                    data.runtime.start_time = start;
                    data.runtime.end_time = end;
                    data.runtime.actual_time = (new Date(end) - new Date(start)) / 1000;
                    data.runtime.predicted_time = predicted_execution_time;
                    if (!data.runtime.actual_time) {
                        data.runtime.actual_time = 0;
                    }

                    /* get energy measurments */
                    var body = compute_average_on("NODE01", "NODE02", "NODE03", start, end);
                    client.search({
                        index: dreamcloud_pwm_idx,
                        searchType: 'count',
                        body: body
                    }, function(error, response) {
                        if (error) {
                            callback(null);
                            return;
                        }
                        var answer = {},
                            aggs = response.aggregations;

                        data.energy = {};
                        var power_data = {};
                        var average = aggs.power_metrics.NODE01.value;
                        data.energy.NODE01 = {};
                        data.energy.NODE01.avg_watt_consumption = average;
                        var duration = (new Date(end) - new Date(start)) / 1000;
                        var joule = average * duration;
                        data.energy.NODE01.total_energy_consumption = joule;

                        average = aggs.power_metrics.NODE02.value;
                        data.energy.NODE02 = {};
                        data.energy.NODE02.avg_watt_consumption = average;
                        joule = average * duration;
                        data.energy.NODE02.total_energy_consumption = joule;

                        average = aggs.power_metrics.NODE03.value;
                        data.energy.NODE03 = {};
                        data.energy.NODE03.avg_watt_consumption = average;
                        joule = average * duration;
                        data.energy.NODE03.total_energy_consumption = joule;

                        /* no energy measurements available */
                        if (!is_defined(average) || average === null) {
                            data.energy = [];
                        }

                        /* retrieve all metric counters as a set */
                        var index = workflow + '_' + task;
                        var metric_keys = {};
                        data.metrics = {};
                        client.search({
                            index: index,
                            type: experiment,
                            size: 20 /* should be enough results to capture all metrics */
                        }, function(error, response) {
                            if (error) {
                                callback(null);
                                return;
                            }
                            if (response.hits !== undefined) {
                                var results = response.hits.hits,
                                  keys = Object.keys(results),
                                  items = {};
                                /* filter keys like @timestamp, host, task, and type */
                                keys.forEach(function(key) {
                                    items = results[key]._source;
                                    if (items.type == 'progress') {
                                        return;
                                    }
                                    delete items['@timestamp'];
                                    delete items.host;
                                    delete items.task;
                                    delete items.type;
                                    delete items.platform;
                                    items = deleteKeysByPrefix(items, "info_");
                                    for (var item in items) {
                                        metric_keys[item] = item;
                                    }
                                });

                                /* compute statistics for each identified metric */
                                async.each(metric_keys, function(metric, inner_callback) {
                                    client.search({
                                        index: index,
                                        type: experiment,
                                        searchType: 'count',
                                        body: aggregation_by(metric)
                                    }, function(error, response) {
                                        if (error) {
                                            inner_callback(null);
                                        }
                                        var aggs = response.aggregations;
                                        data.metrics[metric] = aggs[metric + '_Stats'];
                                        inner_callback(null);
                                    });
                                }, function(error) {
                                    json.push(data);
                                    /* finished */
                                    callback(null);
                                });
                            }
                        });
                    });
                });
            });
        }, function(error) {
            if (error) {
                return next(error);
            }

            res.json(json);
        });
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function deleteKeysByPrefix(object, prefix) {
    var newObject = {};
    for (var property in object) {
        if (object.hasOwnProperty(property) && property.toString().indexOf(prefix) !== 0) {
            console.log("add " + property);
            newObject[property] = object[property];
        }
    }
    return newObject;
}

function compute_average_on(metric_name_a, metric_name_b, metric_name_c, from, to) {
    var query = {
        "aggs": {
            "power_metrics": {
                "filter": {
                    "and": [{
                        "or": [{
                            "exists": {
                                "field": metric_name_a
                            }
                        }, {
                            "exists": {
                                "field": metric_name_b
                            }
                        }, {
                            "exists": {
                                "field": metric_name_c
                            }
                        }]
                    }, {
                        "range": {
                            "@timestamp": {
                                "gte": from.toString(),
                                "lte": to.toString()
                            }
                        }
                    }]
                },
                "aggs": {
                    "NODE01": {
                        "avg": {
                            "field": metric_name_a
                        }
                    },
                    "NODE02": {
                        "avg": {
                            "field": metric_name_b
                        }
                    },
                    "NODE03": {
                        "avg": {
                            "field": metric_name_c
                        }
                    }
                }
            }
        }
    };
    return query;
}


function aggregation_by(field_name) {
    return '{' +
        '"aggs": {' +
            '"' + field_name + '_Stats" : {' +
                '"stats" : {' +
                    '"field" : "' + field_name + '"' +
                '}' +
            '},' +
            '"Minimum_' + field_name + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + field_name + '": {' +
                                '"order": "asc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '},' +
            '"Maximum_' + field_name + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + field_name + '": {' +
                                '"order": "desc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '}' +
        '}' +
    '}';
}

module.exports = router;
