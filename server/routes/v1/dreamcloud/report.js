var express = require('express');
var async = require('async');
var dateFormat = require('dateformat');
var router = express.Router();

/**
 * @api {get} /report/:workflowID/:experimentID 1. Get experiment report
 * @apiVersion 1.0.0
 * @apiName GetReport
 * @apiGroup Reports
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} experimentID identifier of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/report/ms2/AVQ-MczMGMPeuCn4FHqi
 *
 * @apiSuccess {Object} workflow report for a given workflow
 * @apiSuccess {String} workflow.id workflow identifier
 * @apiSuccess {Object} workflow.runtime aggregates runtime information for the whole workflow
 * @apiSuccess {String} workflow.runtime.start time when the first task started its execution
 * @apiSuccess {String} workflow.runtime.stop time when the last task finished execution
 * @apiSuccess {Number} workflow.runtime.seconds total execution time in seconds
 * @apiSuccess {Object} workflow.energy energy-related information for the workflow
 * @apiSuccess {Object} workflow.energy.node energy data for a given target platform (cluster node)
 * @apiSuccess {Number} workflow.energy.node.avg_watt_consumption average Watt consumption
 * @apiSuccess {Number} workflow.energy.node.total_energy_consumption total energy consumption
 * @apiSuccess {Object} tasks list of individual task-related reports
 * @apiSuccess {Object} tasks.task specific task information (key = workflowID_taskID)
 * @apiSuccess {String} tasks.task.host hostname on which the task was executed
 * @apiSuccess {Object} tasks.task.runtime aggregates runtime information for the whole workflow
 * @apiSuccess {String} tasks.task.runtime.start time when the first task started its execution
 * @apiSuccess {String} tasks.task.runtime.stop time when the last task finished execution
 * @apiSuccess {Number} tasks.task.runtime.seconds total execution time in seconds
 * @apiSuccess {Object} tasks.task.energy energy-related information for the workflow
 * @apiSuccess {Object} tasks.task.energy.node energy data for a given target platform (cluster node)
 * @apiSuccess {Number} tasks.task.energy.node.avg_watt_consumption average Watt consumption
 * @apiSuccess {Number} tasks.task.energy.node.total_energy_consumption total energy consumption
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "workflow": {
 *           "id": "ms2",
 *           "runtime": {
 *              "start": "2016-04-22T15:39:48.496",
 *              "end": "2016-04-22T16:10:34.883",
 *              "seconds": 1846.387
 *           },
 *           "energy": {
 *              "NODE01": {
 *                 "avg_watt_consumption": 358.6157820189599,
 *                 "total_energy_consumption": 662143.5179146413
 *              },
 *              "NODE02": {
 *                 "avg_watt_consumption": 250.0514119089924,
 *                 "total_energy_consumption": 461691.67628040875
 *              },
 *              "NODE03": {
 *                 "avg_watt_consumption": 267.59218242524383,
 *                 "total_energy_consumption": 494078.7269315987
 *              }
 *           }
 *        },
 *        "tasks": {
 *           "ms2_t2.4": {
 *              "host": "node02.excess-project.eu",
 *              "runtime": {
 *                 "start": "2016-04-22T15:41:55.661",
 *                 "end": "2016-04-22T15:46:29.116",
 *                 "seconds": 273.455
 *              },
 *              "energy": {
 *                 "NODE01": {
 *                    "avg_watt_consumption": 363.7616224652014,
 *                    "total_energy_consumption": 99472.43447122164
 *                 },
 *                 "NODE02": {
 *                    "avg_watt_consumption": 445.1300451245421,
 *                    "total_energy_consumption": 121723.03648953166
 *                 },
 *                 "NODE03": {
 *                    "avg_watt_consumption": 336.11323218681315,
 *                    "total_energy_consumption": 91911.84390764499
 *                 }
 *              }
 *           },
 *           ...
 *        }
 *     }
 *
 * @apiError NotFound No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFound
 *     {
 *       "error": "No data found in the database."
 *     }
 */
router.get('/:workflowID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
        workflow = req.params.workflowID,
        experiment = req.params.experimentID,
        dreamcloud_pwm_idx = req.app.get('pwm_idx'),
        json = {};

    workflow = workflow.toLowerCase();
    json.workflow = {};
    json.workflow.id = workflow;
    json.workflow.runtime = {};
    json.tasks = {};

    client.indices.getAliases({
        index: workflow + '*',
    }, function(error, response) {
        if (error) {
            var message = {};
            message.error = 'No data found in the database.';
            res.status(404);
            return next(message);
        }
        if (response !== undefined) {
            var earliest_start = "2200-01-01T00:00:00.000";
            var latest_end = 0;

            var tasks = Object.keys(response);
            async.each(tasks, function(task, callback) {
                var index = task;
                var type = experiment;

                client.search({
                    index: index,
                    type: type,
                    size: 1,
                    sort: ["@timestamp:asc"],
                }, function(err, result) {
                    var start;
                    var end;

                    if (err) {
                        json.tasks[task] = "Task to be scheduled";
                        callback(null);
                        return;
                    }
                    if (result.hits !== undefined) {
                        var only_results = result.hits.hits;
                        var keys = Object.keys(only_results);
                        keys.forEach(function(key) {
                            var metric_data = only_results[key]._source;
                            start = metric_data['@timestamp'];
                            start = start.replace(/\s/g, '0');
                            if ((new Date(start)) < (new Date(earliest_start))) {
                                earliest_start = start;
                            }
                        });
                    }

                    client.search({
                        index: index,
                        type: type,
                        size: 1,
                        sort: ["@timestamp:desc"],
                    }, function(err, result) {
                        var hostname;

                        if (err) {
                            json.tasks[task] = "Task to be scheduled";
                            callback(null);
                            return;
                        }
                        if (result.hits !== undefined) {
                            var only_results = result.hits.hits;
                            var keys = Object.keys(only_results);
                            keys.forEach(function(key) {
                                var metric_data = only_results[key]._source;
                                hostname = metric_data.host;
                                end = metric_data['@timestamp'];
                                end = end.replace(/\s/g, '0');
                                if (new Date(end) > new Date(latest_end)) {
                                    latest_end = end;
                                }
                            });
                        }

                        if (!is_defined(start) || !is_defined(end)) {
                            callback(null);
                            return;
                        }

                        json.tasks[task] = {};
                        json.tasks[task].host = hostname;
                        json.tasks[task].runtime = {};
                        json.tasks[task].runtime.start = start;
                        json.tasks[task].runtime.end = end;
                        json.tasks[task].runtime.seconds = (new Date(end) - new Date(start)) / 1000;
                        if (!json.tasks[task].runtime.seconds) {
                            json.tasks[task].runtime.seconds = 0;
                        }

                        var body = compute_average_on("NODE01", "NODE02", "NODE03", start, end);

                        client.search({
                            index: dreamcloud_pwm_idx,
                            searchType: 'count',
                            body: body
                        }, function(error, response) {
                            if (error) {
                                return next(error);
                            }
                            var answer = {},
                                aggs = response.aggregations;

                            json.tasks[task].energy = {};

                            var power_data = {};
                            var average = aggs.power_metrics.NODE01.value;
                            json.tasks[task].energy = {};
                            json.tasks[task].energy.NODE01 = {};
                            json.tasks[task].energy.NODE01.avg_watt_consumption = average;
                            var duration = (new Date(end) - new Date(start)) / 1000;
                            var joule = average * duration;
                            json.tasks[task].energy.NODE01.total_energy_consumption = joule;

                            average = aggs.power_metrics.NODE02.value;
                            json.tasks[task].energy.NODE02 = {};
                            json.tasks[task].energy.NODE02.avg_watt_consumption = average;
                            joule = average * duration;
                            json.tasks[task].energy.NODE02.total_energy_consumption = joule;

                            average = aggs.power_metrics.NODE03.value;
                            json.tasks[task].energy.NODE03 = {};
                            json.tasks[task].energy.NODE03.avg_watt_consumption = average;
                            joule = average * duration;
                            json.tasks[task].energy.NODE03.total_energy_consumption = joule;

                            callback(null);
                        });
                    });
                });

            }, function(error) {
                if (error) {
                    res.status(500);
                    return next(error);
                }

                json.workflow.runtime.start = earliest_start;
                json.workflow.runtime.end = latest_end;
                json.workflow.runtime.seconds = (new Date(latest_end) - new Date(earliest_start)) / 1000;

                var body = compute_average_on("NODE01", "NODE02", "NODE03", earliest_start, latest_end);

                client.search({
                    index: dreamcloud_pwm_idx,
                    searchType: 'count',
                    body: body
                }, function(error, response) {
                    if (error) {
                        return next(error);
                    }
                    var answer = {},
                        aggs = response.aggregations;

                    json.workflow.energy = {};
                    var power_data = {};
                    var average = aggs.power_metrics.NODE01.value;
                    json.workflow.energy.NODE01 = {};
                    json.workflow.energy.NODE01.avg_watt_consumption = average;
                    var duration = (new Date(latest_end) - new Date(earliest_start)) / 1000;
                    var joule = average * duration;
                    json.workflow.energy.NODE01.total_energy_consumption = joule;

                    average = aggs.power_metrics.NODE02.value;
                    json.workflow.energy.NODE02 = {};
                    json.workflow.energy.NODE02.avg_watt_consumption = average;
                    joule = average * duration;
                    json.workflow.energy.NODE02.total_energy_consumption = joule;

                    average = aggs.power_metrics.NODE03.value;
                    json.workflow.energy.NODE03 = {};
                    json.workflow.energy.NODE03.avg_watt_consumption = average;
                    joule = average * duration;
                    json.workflow.energy.NODE03.total_energy_consumption = joule;

                    res.json(json);
                });
            });
        }
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
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

module.exports = router;
