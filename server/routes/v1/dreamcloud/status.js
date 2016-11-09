var express = require('express');
var dateFormat = require('dateformat');
var router = express.Router();

/**
 * @api {get} /runtime/:workflowID/:experimentID 1. Get status report
 * @apiVersion 1.0.0
 * @apiName GetStatus
 * @apiGroup Status
 *
 * @apiDescription Returns available data that was previously stored in the database. The body of the response is user-specific, and can represent any valid JSON document.
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} experimentID Experiment identifer of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/ms2/AVZ_VlqVGYwmTvCuTZLX
 *
 * @apiParamExample {json} JSON-Request:
 *     {
 *        "Status": "completed",
 *        "tasks": [
 *           {
 *              "name": "T1",
 *              "status": "completed",
 *              "startTime": "2016-08-12T17:20:01.844",
 *              "endTime": "2016-08-12T17:21:28.46",
 *              "nr_cores": 40,
 *              "progress": 100,
 *              "deploymentPlan": {
 *                 "estimatedTime": 1111,
 *                 "node": {
 *                    "id": "node01",
 *                    "cpus": [
 *                       {
 *                          "id": "cpu0",
 *                          "cores": [
 *                             {
 *                                "id": "core0",
 *                                "pwMode": 0
 *                             },
 *                             ...
 *                          ]
 *                       }
 *                    ]
 *                 }
 *              }
 *           },
 *           {
 *              "name": "t2.1",
 *              ...
 *           },
 *           ...
 *        ]
 *     }
 *
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "Status": "completed",
 *        "tasks": [
 *           {
 *              "name": "T1",
 *              "status": "completed",
 *              "startTime": "2016-08-12T17:20:01.844",
 *              "endTime": "2016-08-12T17:21:28.46",
 *              "nr_cores": 40,
 *              "progress": 100,
 *              "deploymentPlan": {
 *                 "estimatedTime": 1111,
 *                 "node": {
 *                    "id": "node01",
 *                    "cpus": [
 *                       {
 *                          "id": "cpu0",
 *                          "cores": [
 *                             {
 *                                "id": "core0",
 *                                "pwMode": 0
 *                             },
 *                             ...
 *                          ]
 *                       }
 *                    ]
 *                 }
 *              }
 *           },
 *           {
 *              "name": "t2.1",
 *              ...
 *           },
 *           ...
 *        ]
 *     }
 *
 * @apiError NotFound No status report found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFund
 *     {
 *       "error": "No status report available."
 *     }
 */
router.get('/:workflowID/:experimentID', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflowID.toLowerCase(),
      experiment = req.params.experimentID;
      json = {};

    var documentId = workflow + '_' + experiment;

    client.get({
        index: 'mf',
        type: 'status',
        id: documentId
    }, function(error, response) {
    	if (error) {
            res.status(404);
    	    json.error = 'No status report available.';
            return next(json);
        }
        if (response.found) {
            json = response._source;
        } else {
            json.error = 'No status report available.';
        }
        res.json(json);
    });
});

/**
 * @api {put} /runtime/:workflowID/:experimentID 1. Create/Update status report
 * @apiVersion 1.0.0
 * @apiName PutStatus
 * @apiGroup Status
 *
 * @apiDescription Create or update a status report for the given workflow and experiment. The body of the request is user-specific, and can include any valid JSON document.
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} experimentID Experiment identifer of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/status/ms2/AVZ_VlqVGYwmTvCuTZLX
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/ms2/AVZ_VlqVGYwmTvCuTZLX"
 *     }
 *
 * @apiError DatabaseError Cannot store submitted content.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 InternalServerError
 *     {
 *       "error": "Elasticsearch-specific error message"
 *     }
 */
router.put('/:workflowID/:experimentID', function(req, res, next) {
    var mf_server = req.app.get('mf_server') + '/dreamcloud/mf',
      workflow = req.params.workflowID.toLowerCase(),
      experiment = req.params.experimentID,
      client = req.app.get('elastic');

    var documentId = workflow + '_' + experiment;

    var now = new Date();
    now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
    req.body['@timestamp'] = now;

    client.index({
        index: 'mf',
        type: 'status',
        id: documentId,
        body: req.body
    },function(error, response) {
    	if (error) {
    		res.status(500);
    		return next(error);
    	}
        var json = {};
        json.href = mf_server + '/status/' + workflow + '/' + experiment;
        res.json(json);
    });
});

module.exports = router;
