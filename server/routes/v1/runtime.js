var express = require('express');
var async = require('async');
var router = express.Router();

/**
 * @api {get} /runtime/:workflowID/:taskID/:experimentID 1. Request the runtime of an experiment with given workflow ID, task ID and experiment ID
 * @apiVersion 1.0.0
 * @apiName GetRuntime
 * @apiGroup Runtime
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} expID Experiment identifer of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/runtime/hpcfapix/vector_scal01/AVSbT0ChGMPeuCn4QYjq
 *
 * @apiSuccess {String} start start timestamp of the experiment
 * @apiSuccess {String} end end timestamp of the experiment
 * @apiSuccess {String} runtime duration of the experiment in seconds
 * @apiSuccess {String} host hostname of the system
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          "start":"2016-05-10T17:35:49.125",
 *          "end":"2016-05-10T17:36:01.749",
 *          "runtime":12.624000072479248,
 *          "host":"node01.excess-project.eu"
 *     }
 *
 * @apiError InternalSeverError No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Sever Error
 *     {
 *       "error": "No results found."
 *     }
 */
router.get('/:workID/:taskID/:expID', function(req, res, next) {
    var client = req.app.get('elastic'),
        workflow = req.params.workID.toLowerCase(),
        task = req.params.taskID.toLowerCase(),
        experiment = req.params.expID;

    var index = workflow + '_' + task;

    return client.search({
        index: index,
        type: experiment,
        size: 1,
        sort: ["@timestamp:asc"],
    }, function(err, result) {
        var start;
        var end;
        var start_original;
        var end_original;

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
                    start_original = start;
                    start = start.replace(/\s/g, '0');
                    start = new Date(start);
                    start = start.getTime() / 1000;
                });
            }
        }

        client.search({
            index: index,
            type: experiment,
            size: 1,
            sort: ["@timestamp:desc"],
        }, function(err, result) {
            var host;
            var response;
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
                        end_original = end;
                        end = end.replace(/\s/g, '0');
                        end = new Date(end);
                        end = end.getTime() / 1000;
                    });
                }
            }

            response = {};
            response.start = start_original;
            response.end = end_original;
            response.runtime = (end - start);
            response.host = host;
            res.send(response);
        });
    });
});

module.exports = router;
