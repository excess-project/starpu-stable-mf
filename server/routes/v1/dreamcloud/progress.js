var express = require('express');
var router = express.Router();

/**
 * @api {get} /progress/:workflowID/:taskID/:experimentID 1. Get progress information for a given experiment
 * @apiVersion 1.0.0
 * @apiName GetProgress
 * @apiGroup Progress
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a registered task
 * @apiParam {String} experimentID identifier of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/progress/ms2/t2.1/AVQ-MczMGMPeuCn4FHqi
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/progress/ms2/t2.1/AVQ-MczMGMPeuCn4FHqi?latest
 *
 * @apiSuccess {Object} progress measurements based on a system
 * @apiSuccess {String} progress.timestamp timestamp, when the progress information was collected
 * @apiSuccess {String} progress.host hostname of the system
 * @apiSuccess {String} progress.task task identifier
 * @apiSuccess {String} progress.type metrics type
 * @apiSuccess {Number} progress.value progress in percentage
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *           "@timestamp": "2016-04-22T15:41:20.409",
 *           "host": "node02.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "progress",
 *           "value": "0"
 *        },
 *        {
 *           "@timestamp": "2016-04-22T15:41:28.732",
 *           "host": "node02.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "progress",
 *           "value": "2"
 *        },
 *        {
 *           "@timestamp": "2016-04-22T15:41:36.406",
 *           "host": "node02.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "progress",
 *           "value": "6"
 *        },
 *
 *        ...
 *
 *        {
 *           "@timestamp": "2016-04-22T15:44:13.668",
 *           "host": "node02.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "progress",
 *           "value": "100"
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
router.get('/:workflowID/:taskID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflowID.toLowerCase(),
      task = req.params.taskID.toLowerCase(),
      experiment = req.params.experimentID,
      latest = req.query.latest,
      size = 2000,
      sort = [ "@timestamp:asc" ];

    var index = workflow + "_" + task;

    if (is_defined(latest)) {
        size = 1;
        sort = [ "@timestamp:desc" ];
    }

    return client.search({
        index: index,
        type: experiment,
        size: size,
        body: { "query": { "term": { "type": "progress" } } },
        sort: sort,
    }, function(err, result) {
        if (result.hits !== undefined){
            var only_results = result.hits.hits;
            var es_result = [];
            var keys = Object.keys(only_results);
            keys.forEach(function(key){
                es_result.push(only_results[key]._source);
            });
            res.send(es_result);
        } else {
            res.send('{ error: "No data found in the database." }');
        }
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

module.exports = router;
