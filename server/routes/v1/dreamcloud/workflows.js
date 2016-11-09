var express = require('express');
var router = express.Router();
var async = require('async');
var dateFormat = require('dateformat');

/**
 * @api {get} /workflows 3. Request a list of registered workflows
 * @apiVersion 1.0.0
 * @apiName GetWorkflows
 * @apiGroup Workflows
 *
 * @apiSuccess {Object} :workflowID       References a registered workflow by its ID
 * @apiSuccess {String} :workflowID.href  Resource location of the given workflow
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "hpcdhopp": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcdhopp"
 *       },
 *       "hpcdkhab": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcdkhab"
 *       },
 *       "hpcfapix": {
 *         "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/hpcfapix"
 *       }
 *     }
 *
 * @apiError WorkflowsNotAvailable No workflows found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "No workflows found."
 *     }
 */
router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
        mf_server = req.app.get('mf_server'),
        details = req.query.details,
        excess = req.query.users,
        size = 1000,
        json = {};

    if (is_defined(excess)) {
        mf_server = mf_server + '/mf';
    } else {
        mf_server = mf_server + '/dreamcloud/mf';
    }

    client.search({
        index: 'mf',
        type: 'workflows',
        searchType: 'count'
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        if (response.hits !== undefined) {
            size = response.hits.total;
        }
        if (size === 0) {
            res.status(404);
            json.error = "No workflows found.";
            res.json(json);
            return;
        }

        client.search({
            index: 'mf',
            type: 'workflows',
            size: size
        }, function(error, response) {
            if (error) {
                res.status(500);
                return next(error);
            }
            if (response.hits !== undefined) {
                var results = response.hits.hits;
                if (is_defined(details)) {
                    json = get_details(results);
                } else {
                    json = get_workflows(results, mf_server, excess);
                }
            }
            res.json(json);
        });
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function get_details(results) {
    var keys = Object.keys(results),
        response = {};
    keys.forEach(function(key) {
        var source = results[key]._source,
            item = JSON.parse(JSON.stringify(source));
        if (is_defined(source.tasks)) {
            item.tasks = [];
            for (var i in source.tasks) {
                item.tasks.push(source.tasks[i].name);
            }
        }
        response[results[key]._id] = item;
    });
    return response;
}

function get_workflows(results, mf_server, excess) {
    var keys = Object.keys(results),
        workflow = '',
        response = {},
        path = 'workflows';
    if (is_defined(excess)) {
        path = 'users';
    }
    keys.forEach(function(key) {
        workflow = results[key]._id;
        var json = {};
        json.href = mf_server + '/' + path + '/' + workflow;
        response[workflow] = json;
    });
    return response;
}

/**
 * @api {get} /workflows/:workflowID 2. Get information about a specific workflow
 * @apiVersion 1.0.0
 * @apiName GetWorkflow
 * @apiGroup Workflows
 *
 * @apiParam {String} workflowID Unique workflow identifier
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2
 *
 * @apiSuccess (body) {String} wf_id   References a registered workflow by its ID
 * @apiSuccess (body) {String} author  Author name if provided while registering a new workflow
 * @apiSuccess (body) {String} optimization    Optimization criterium: time, energy, balanced
 * @apiSuccess (body) {Array}  tasks   List of individual tasks the workflow is composed of
 * @apiSuccess (body) {String} tasks.name  ID of the given task (:taskID)
 * @apiSuccess (body) {String} tasks.exec  Executable for the given task
 * @apiSuccess (body) {String} tasks.cores_nr  Range of CPU cores used for executing the task on
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiError WorkflowNotAvailable Given ID does not refer to a workflow.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Workflow with the ID ':workflowID' not found."
 *     }
 */
router.get('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        client = req.app.get('elastic'),
        json = {};

    client.get({
        index: 'mf',
        type: 'workflows',
        id: id
    }, function(error, response) {
        if (response.found) {
            json = response._source;
        } else {
            json.error = "Workflow with the ID '" + id + "' not found.";
        }
        res.json(json);
    });
});

/**
 * @api {put} /workflows/:workflowID 1. Register a new workflow with a custom ID
 * @apiVersion 1.0.0
 * @apiName PutWorkflowID
 * @apiGroup Workflows
 *
 * @apiParam {String} workflowID Unique workflow identifier
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiParam {String} [wf_id]   References a registered workflow by its ID
 * @apiParam {String} [author]  Author name if provided while registering a new workflow
 * @apiParam {String} [optimization]    Optimization criterium: time, energy, balanced
 * @apiParam {Array}  [tasks]   List of individual tasks the workflow is composed of
 * @apiParam {String} [tasks.name]  ID of the given task (:taskID)
 * @apiParam {String} [tasks.exec]  Executable for the given task
 * @apiParam {String} [tasks.cores_nr]  Range of CPU cores used for executing the task on
 *
 * @apiSuccess {String} href Link to the stored workflow resource
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2",
 *     }
 *
 * @apiError StorageError Given workflow could not be stored.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Resource could not be stored"
 *     }
 */
router.put('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        mf_server = req.app.get('mf_server'),
        client = req.app.get('elastic'),
        json = {};

    client.index({
        index: 'mf',
        type: 'workflows',
        id: id,
        body: req.body
    }, function(error, response) {
        if (error !== 'undefined') {
            json.href = mf_server + '/dreamcloud/mf/workflows/' + id;
        } else {
            res.status(500);
            json.error = "Resource could not be stored.";
            console.log(error);
        }

        res.json(json);
    });
});

/**
 * @api {put} /workflows 4. Register a new workflow and create a new experiment
 * @apiVersion 1.0.0
 * @apiName PutWorkflow
 * @apiGroup Workflows
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiParam {String} wf_id   References a registered workflow by its ID
 * @apiParam {String} [author]  Author name if provided while registering a new workflow
 * @apiParam {String} [optimization]    Optimization criterium: time, energy, balanced
 * @apiParam {Array}  [tasks]   List of individual tasks the workflow is composed of
 * @apiParam {String} [tasks.name]  ID of the given task (:taskID)
 * @apiParam {String} [tasks.exec]  Executable for the given task
 * @apiParam {String} [tasks.cores_nr]  Range of CPU cores used for executing the task on
 *
 * @apiSuccess {Object} workflow Workflow-related information
 * @apiSuccess {String} workflow.id Unique ID of a given workflow
 * @apiSuccess {String} workflow.href Link to the workflow resource
 * @apiSuccess {Object} experiment Experiment-related information
 * @apiSuccess {String} experiment.id Unique ID of the experiment associated with the workflow
 * @apiSuccess {String} experiment.href Link to the experiment resource
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "workflow": {
 *         "id":   "ms2",
 *         "href": "http://mf.excess-project.eu:3030/v1/workflows/ms2"
 *       },
 *       "experiment": {
 *         "id":   "AVXotMWFA9kSggr_MSq2",
 *         "href": "http://mf.excess-project.eu:3030/v1/experiments/AVXotMWFA9kSggr_MSq2?workflow=ms2"
 *       }
 *     }
 *
 * @apiError StorageError Given workflow could not be stored.
 * @apiError WorkflowIDMissing The key wf_id is missing
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Resource could not be stored"
 *     }
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "error": "The parameter 'wf_id' to reference a workflow ID is missing."
 *     }
 */
router.put('/', function(req, res, next) {
    var mf_server = req.app.get('mf_server'),
        client = req.app.get('elastic');

    var workflow = req.body;
    if (workflow.wf_id === undefined) {
        var message = {};
        message.error = "The parameter 'wf_id' to reference a workflow ID is missing";
        res.status(400);
        res.json(message);
        return;
    }

    /* ensure compatibility with excess front-end */
    workflow.application = workflow.wf_id.toLowerCase();
    workflow.task = workflow.application;
    var id = workflow.application;
    if (is_defined(workflow.author)) {
        workflow.user = workflow.author.toLowerCase();
    } else {
        var error_message = {};
        error_message.error = "Please provide a user name (author).";
        res.status(500);
        return next(error_message);
    }

    var workflow_response = {};

    async.waterfall([
        /* REGISTER WORKFLOW */
        function(series_callback) {
            client.index({
                index: 'mf',
                type: 'workflows',
                id: id,
                body: workflow
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }

                workflow_response.workflow = {};
                workflow_response.workflow.id = id;
                workflow_response.workflow.href = mf_server + '/dreamcloud/mf/workflows/' + id;
                series_callback(null);
            });
        },
        /* CREATE EXPERIMENT ID */
        function(series_callback) {
            var now = new Date();
            now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
            workflow['@timestamp'] = now;

            client.index({
                index: 'mf',
                type: 'experiments',
                parent: id,
                body: workflow
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }
                workflow_response.experiment = {};
                workflow_response.experiment.id = response._id;
                workflow_response.experiment.href = mf_server +
                    '/dreamcloud/mf/experiments/' + response._id + '?workflow=' + id;
                series_callback(null, response._id);
            });
        },
        /* ADD JOB_ID */
        function(experiment_id, series_callback) {
            client.update({
                index: 'mf',
                type: 'experiments',
                id: experiment_id,
                parent: id,
                body: {
                    'doc': {
                      'job_id': experiment_id
                    }
                }
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }
                series_callback(null);
            });
        },
    ], function(error) {
        if (error) {
            res.status(500);
            return next(error);
        }
        res.json(workflow_response);
    });
});

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
       return true;
    }
}

/**
 * @api {put} /workflows/:workflowID/:experimentID 5. Register a new workflow and experiment using custom IDs
 * @apiVersion 1.0.0
 * @apiName PutWorkflowIDExperimentID
 * @apiGroup Workflows
 *
 * @apiParam {String} workflowID Unique workflow identifier
 * @apiParam {String} experimentID Unique experiment identifier
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2/myUniqueID
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "wf_id": "ms2",
 *       "author": "Random Guy",
 *       "optimization": "Time",
 *       "tasks": [
 *         {
 *           "name": "T1",
 *           "exec": "/home/ubuntu/ms2/t1.sh",
 *           "cores_nr": "1-2"
 *         },
 *         {
 *           "name": "T2.1",
 *           "exec": "/home/ubuntu/ms2/t21.sh",
 *           "previous": "T1",
 *           "cores_nr": "1-2"
 *          }
 *       ]
 *     }
 *
 * @apiParam {String} [wf_id]   References a registered workflow by its ID
 * @apiParam {String} [author]  Author name if provided while registering a new workflow
 * @apiParam {String} [optimization]    Optimization criterium: time, energy, balanced
 * @apiParam {Array}  [tasks]   List of individual tasks the workflow is composed of
 * @apiParam {String} [tasks.name]  ID of the given task (:taskID)
 * @apiParam {String} [tasks.exec]  Executable for the given task
 * @apiParam {String} [tasks.cores_nr]  Range of CPU cores used for executing the task on
 *
 * @apiSuccess {Object} workflow Workflow-related information
 * @apiSuccess {String} workflow.id Unique ID of a given workflow
 * @apiSuccess {String} workflow.href Link to the workflow resource
 * @apiSuccess {Object} experiment Experiment-related information
 * @apiSuccess {String} experiment.id Unique ID of the experiment associated with the workflow
 * @apiSuccess {String} experiment.href Link to the experiment resource
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "workflow": {
 *         "id":   "ms2",
 *         "href": "http://mf.excess-project.eu:3030/v1/workflows/ms2"
 *       },
 *       "experiment": {
 *         "id":   "myUniqueID",
 *         "href": "http://mf.excess-project.eu:3030/v1/experiments/myUniqueID?workflow=ms2"
 *       }
 *     }
 *
 * @apiError StorageError Given workflow could not be stored.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Resource could not be stored"
 *     }
 */
router.put('/:workflowID/:experimentID', function(req, res, next) {
    var mf_server = req.app.get('mf_server'),
        client = req.app.get('elastic'),
        workflowID = req.params.workflowID.toLowerCase(),
        experimentID = req.params.experimentID,
        workflow_response = {},
        data = {};

    /* set the body message */
    if (!Object.keys(req.body).length) {
        data.wf_id = workflowID;
    } else {
        data = req.body;
    }

    /* ensure compatibility with front-end: experiments table */
    data.user = workflowID;
    if (is_defined(data.task)) {
        data.application = data.task;
    }

    async.series([
        /* register the given workflow */
        function(series_callback) {
            client.index({
                index: 'mf',
                type: 'workflows',
                id: workflowID,
                body: data
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }

                workflow_response.workflow = {};
                workflow_response.workflow.id = workflowID;
                workflow_response.workflow.href = mf_server +
                    '/dreamcloud/mf/workflows/' + workflowID;

                series_callback(null);
            });
        },
        /* create new experiment using an existing id */
        function(series_callback) {
            var now = new Date();
            now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
            data['@timestamp'] = now;
            data.job_id = experimentID;

            client.index({
                index: 'mf',
                type: 'experiments',
                parent: workflowID,
                id: experimentID,
                body: data
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }

                var json = {};
                workflow_response.experiment = {};
                workflow_response.experiment.id = response._id;
                workflow_response.experiment.href = mf_server +
                    '/dreamcloud/mf/experiments/' + response._id + '?workflow=' + workflowID;

                series_callback(null);
            });
        },
    ], function(error) {
        if (error) {
            var json = {};
            json.error = "Resource could not be stored".
            console.log(error);
            res.status(500);
            res.json(json);
            return;
        }
        res.json(workflow_response);
    });
});

module.exports = router;
