var express = require('express');
var async = require('async');
var router = express.Router();

/**
 * @api {get} /runtime/:workflowID/:taskID/:experimentID 1. Get the runtime of a specific task
 * @apiVersion 1.0.0
 * @apiName GetRuntime
 * @apiGroup Runtime
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} experimentID Experiment identifer of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/runtime/ms2/t2.1/AVZ-5cqVGYwmTvCuSqZC
 *
 * @apiSuccess {String} start start timestamp of the experiment
 * @apiSuccess {String} end end timestamp of the experiment
 * @apiSuccess {String} runtime duration of the experiment in seconds
 * @apiSuccess {String} [host] hostname of the system
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "start": "2016-08-12T15:20:40.631",
 *        "end": "2016-08-12T15:21:22.205",
 *        "runtime": 41.573999881744385,
 *        "host": "node02.excess-project.eu"
 *     }
 *
 * @apiError InternalServerError No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "No results found."
 *     }
 */
router.get('/:workID/:taskID/:expID', function(req, res, next) {
    var wID = req.params.workID,
        tID = req.params.taskID,
        eID = req.params.expID;
    res.redirect('/v1/mf/runtime/' + wID + '/' + tID + '/' + eID);
});

/**
 * @api {get} /runtime/:workflowID/:experimentID 2. Get runtime information of an entire experiment
 * @apiVersion 1.0.0
 * @apiName GetRuntimeByExperiment
 * @apiGroup Runtime
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} experimentID Experiment identifer of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/runtime/ms2/AVZ-5cqVGYwmTvCuSqZC
 *
 * @apiSuccess {String} start start timestamp of the experiment
 * @apiSuccess {String} end end timestamp of the experiment
 * @apiSuccess {String} total_runtime duration of the total experiment in seconds
 * @apiSuccess {Array}  tasks array of task-specific runtime information
 * @apiSuccess {String} tasks.task identifier of the task
 * @apiSuccess {Object} tasks.data object holding runtime data
 * @apiSuccess {String} start start timestamp of the task
 * @apiSuccess {String} end end timestamp of the stop
 * @apiSuccess {String} runtime duration of the task in seconds
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "workflow": "ms2",
 *        "tasks": [
 *           ...
 *           {
 *              "task": "T2.1",
 *              "data": {
 *                 "start": "2016-08-12T15:20:40.631",
 *                 "end": "2016-08-12T15:21:22.205",
 *                 "runtime": 41.574
 *              }
 *           },
 *           {
 *              "task": "T2.2",
 *              "data": {
 *                 "start": "2016-08-12T15:21:46.975",
 *                 "end": "2016-08-12T15:22:25.983",
 *                 "runtime": 39.008
 *              }
 *           },
 *           ...
 *        ],
 *        "start": "2016-08-12T15:17:46.731",
 *        "end": "2016-08-12T15:25:30.452",
 *        "total_runtime": 463.721
 *     }
 *
 * @apiError InternalServerError No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "No results found."
 *     }
 */
router.get('/:workID/:expID', function(req, res, next) {
    var client = req.app.get('elastic'),
        workflow = req.params.workID,
        experiment = req.params.expID,
        size = 1000,
        json = [];

    workflow = workflow.toLowerCase();

    client.get({
        index: 'mf',
        type: 'workflows',
        id: workflow
    }, function(err, result) {
        if (err) {
            res.status(500);
            return next(err);
        }
        if (result !== undefined) {
            var es_result = {};
            es_result.workflow = workflow;
            var earliest_start = "2200-01-01T00:00:00.000";
            var latest_end = 0;

            var tasks = result._source.tasks;
            es_result.tasks = [];
            async.each(tasks, function(task, callback) {
                    task = task.name;
                    var resource = workflow + "_" + task;
                    resource = resource.toLowerCase();

                    client.search({
                        index: resource,
                        type: experiment,
                        size: 1,
                        sort: ["@timestamp:asc"],
                    }, function(err, result) {
                        var start;
                        var end;

                        if (err) {
                            res.status(500);
                            return next(err);
                        } else {
                            if (result.hits !== undefined) {
                                var only_results = result.hits.hits;
                                var keys = Object.keys(only_results);
                                keys.forEach(function(key) {
                                    var metric_data = only_results[key]._source;
                                    start = metric_data['@timestamp'];
                                    start = start.replace(/\s/g, '0');
                                    if (new Date(start) < new Date(earliest_start)) {
                                        earliest_start = start;
                                    }
                                });
                            }
                        }

                        client.search({
                            index: resource,
                            type: experiment,
                            size: 1,
                            sort: ["@timestamp:desc"],
                        }, function(err, result) {
                            var hostname;

                            if (err) {
                                res.status(500);
                                return next(err);
                            } else {
                                if (result.hits !== undefined) {
                                    var only_results = result.hits.hits;
                                    var keys = Object.keys(only_results);
                                    keys.forEach(function(key) {
                                        var metric_data = only_results[key]._source;
                                        host = metric_data.host;
                                        end = metric_data['@timestamp'];
                                        end = end.replace(/\s/g, '0');
                                        if (new Date(end) > new Date(latest_end)) {
                                            latest_end = end;
                                        }
                                    });
                                }
                            }

                            var json = {};
                            json.task = task;
                            json.host = hostname;
                            json.data = {};
                            json.data.start = start;
                            json.data.end = end;
                            json.data.runtime = ((new Date(end) - new Date(start))) / 1000;
                            if (!json.data.runtime) {
                                json.data.runtime = 0;
                            }
                            es_result.tasks.push(json);

                            callback();
                        });
                    });
                },
                function(err) {
                    var total_runtime = ((new Date(latest_end) - new Date(earliest_start))) / 1000;
                    es_result.start = earliest_start;
                    es_result.end = latest_end;
                    es_result.total_runtime = total_runtime;
                    res.send(es_result);
                }
            );
        } else {
            res.status(500);
            return next(err);
        }
    });
});

module.exports = router;
