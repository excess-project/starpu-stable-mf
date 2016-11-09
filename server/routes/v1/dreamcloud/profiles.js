var express = require('express');
var router = express.Router();
var async = require('async');

/**
 * @api {get} /profiles/:workflowID 1. Get a list of profiled tasks associated with the given workflow ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesWorkflow
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2
 *
 * @apiSuccess {Object} taskID identifier of a registered task
 * @apiSuccess {Object} taskID.experimentID identifier of an experiment
 * @apiSuccess {String} taskID.experimentID.href link to the experiment
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "t2.5": {
 *           "AVYoZ31mLeaeU4rxUm0O": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.5/AVYoZ31mLeaeU4rxUm0O"
 *           },
 *           "AVVuCj1kLeaeU4rxxT4d": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.5/AVVuCj1kLeaeU4rxxT4d"
 *           }
 *        },
 *        "t2.4": {
 *           "AVQtI20EGMPeuCn4A_V3": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.4/AVQtI20EGMPeuCn4A_V3"
 *           },
 *           "AVQ-HJxhGMPeuCn4E_u6": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.4/AVQ-HJxhGMPeuCn4E_u6"
 *           }
 *        },
 *        ...
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
router.get('/:workflowID', function(req, res, next) {
    var wID = req.params.workflowID;
    res.redirect('/v1/mf/profiles/' + wID + '?dreamcloud');
});

/**
 * @api {get} /profiles/:workflowID/:taskID 2. Get a list of experiments by workflow and task ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesTask
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a registered task
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1
 *
 * @apiSuccess {Object} date date, when the task is registered
 * @apiSuccess {Object} date.experimentID identifier of an experiment
 * @apiSuccess {String} date.experimentID.href link to the experiment
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "2016-06-17": {
 *           "AVVe9xN-LeaeU4rxxTaT": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVe9xN-LeaeU4rxxTaT"
 *           },
 *           "AVVejDH1LeaeU4rxwuw-": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVejDH1LeaeU4rxwuw-"
 *           },
 *           "AVVeiND0LeaeU4rxwtIV": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVeiND0LeaeU4rxwtIV"
 *           },
 *           "AVVeQmcUenoRsEhyFlHu": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVeQmcUenoRsEhyFlHu"
 *           },
 *           "AVVeQANeenoRsEhyFjlu": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVeQANeenoRsEhyFjlu"
 *           },
 *           "AVVeX5NRenoRsEhyF4We": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVVeX5NRenoRsEhyF4We"
 *           }
 *        },
 *        "2016-04-14": {
 *           "AVQUiW67GMPeuCn47XpS": {
 *              "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVQUiW67GMPeuCn47XpS"
 *           }
 *        },
 *        ...
 *     }
 *
 * @apiError InternalSeverError No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Sever Error
 *     {
 *       "error": "no such index."
 *     }
 */
router.get('/:workflowID/:taskID', function(req, res, next) {
    var wID = req.params.workflowID,
        tID = req.params.taskID;
    res.redirect('/v1/mf/profiles/' + wID + '/' + tID + '?dreamcloud');
});

/**
 * @api {get} /profiles/:workflowID/:taskID/:experimentID 3. Get profiles by workflow, task and experiment ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesExperiment
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a registered task
 * @apiParam {String} experimentID identifier of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/profiles/ms2/t2.1/AVQ-MczMGMPeuCn4FHqi
 *
 * @apiSuccess {Object} Metrics measurements based on a system
 * @apiSuccess {String} Metrics.timestamp timestamp, when the metric data is collected
 * @apiSuccess {String} Metrics.host hostname of the system
 * @apiSuccess {String} Metrics.task task identifier
 * @apiSuccess {String} Metrics.type metrics type
 * @apiSuccess {Number} Metrics.metric value of the specific metric
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *           "@timestamp": "2016-04-22T15:43:19.614",
 *           "host": "node02.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "progress",
 *           "value": "68"
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
 *        ...
 *     ]
 *
 * @apiError NotFound No results found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFound
 *     {
 *       "error": "No results found."
 *     }
 */
router.get('/:workflowID/:taskID/:experimentID', function(req, res, next) {
    var wID = req.params.workflowID,
        tID = req.params.taskID,
        eID = req.params.experimentID;
    res.redirect('/v1/mf/profiles/' + wID + '/' + tID + '/' + eID);
});

module.exports = router;