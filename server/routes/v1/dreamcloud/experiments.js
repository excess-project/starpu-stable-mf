var express = require('express');
var dateFormat = require('dateformat');
var router = express.Router();

/**
 * @api {get} /experiments 1. Returns a list of all experiment IDs
 * @apiVersion 1.0.0
 * @apiName GetExperiments
 * @apiGroup Experiments
 *
 * @apiParam {Boolean} [details] if set, more detailed information for each experiment is given
 * @apiParam {String} [workflows] filters results by the given workflow, e.g. 'ms2'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/experiments
 *
 * @apiSuccess {Array}  taskID identifier for a task of the given workflow
 * @apiSuccess {String} taskID.timestamp timestamp when the measurement was taken
 * @apiSuccess {String} taskID.type group identifier (equals plug-in name)
 * @apiSuccess {String} taskID.metric value sampled for the given metric
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "AVZ-ll9FGYwmTvCuSnjW": {
 *          "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVZ-ll9FGYwmTvCuSnjW?workflow=ms2"
 *       },
 *       "AVZ-kZTjGYwmTvCuSnZV": {
 *          "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVZ-kZTjGYwmTvCuSnZV?workflow=ms2"
 *       },
 *       "AVZ-j2hEGYwmTvCuSnVE": {
 *          "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVZ-j2hEGYwmTvCuSnVE?workflow=ms2"
 *       },
 *       ...
 *     }
 *
 * @apiError DatabaseError Elasticsearch specific error message.
 */
router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      details = req.query.details,
      workflows = req.query.workflows,
      json = {},
      query = '',
      size = 1000;

    query = '{ "query": { "match_all": {} } }';
    if (typeof workflows !== 'undefined') {
        query = '{ "query": { "term": { "_parent": "' + workflows + '" } } }';
    }

    client.search({
        index: 'mf',
        type: 'experiments',
        searchType: 'count'
    }, function(error, response) {
        if (response.hits !== undefined) {
            size = response.hits.total;
        }

        client.search({
            index: 'mf',
            type: 'experiments',
            fields: '_parent,_source',
            body: query,
            size: size,
            sort: '@timestamp:desc'
        }, function(error, response) {
            if (response.hits !== undefined) {
                var results = response.hits.hits;
                if (is_defined(details)) {
                    json = get_details(results);
                } else {
                    json = get_workflows(mf_server, results);
                }
            } else {
                json.error = error;
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
      item = {},
      response = {};
    keys.forEach(function(key) {
        item = results[key]._source;
        if (typeof item.timestamp !== 'undefined') {
            item.date = item.timestamp.split('-')[0];
            item.date = item.date.replace(/\./g, '-');
            item.started = item.timestamp;
            var secs = item.started.split('-');
            if (secs.length == 2) {
                secs[0] = secs[0].replace(/\./g, '-');
                secs[1] = secs[1].replace(/\./g, ':');
                item.started = secs.join('T');
            }
            delete item.timestamp;
        }
        item.workflow = results[key]._parent;
        response[results[key]._id] = item;
    });
    return response;
}

function get_workflows(mf_server, results) {
    var keys = Object.keys(results),
      experimentID = '',
      workflow = '',
      response = {};
    keys.forEach(function(key) {
        experimentID = results[key]._id;
        workflow = results[key]._parent;
        var json = {};
        json.href = mf_server + '/dreamcloud/mf/experiments/' + experimentID + '?workflow=' + workflow;
        response[experimentID] = json;
    });
    return response;
}

/**
 * @api {get} /experiments/:experimentID 2. Request a registered experiment with given experiment ID
 * @apiVersion 1.0.0
 * @apiName GetExperimentsID
 * @apiGroup Experiments
 *
 * @apiParam {String} experimentID identifier of an experiment
 * @apiParam {String} workflow the name of the workflow the given experiment is associated with, e.g. 'ms2'
 * @apiParam {Boolean} [extends] returns detailed information about tasks, if present
 *
 * @apiSuccess {String} [wf_id] the workflow identifier, e.g., 'ms2'
 * @apiSuccess {String} [author] name of the author of the workflow
 * @apiSuccess {String} [optimization] optimization criterium, e.g., 'Time' or 'Performance'
 * @apiSuccess {String} [valueCurve] a value curve to be used by heuristics
 * @apiSuccess {Array}  [tasks] array of individal task data
 * @apiSuccess {String} [tasks.name] the task ID
 * @apiSuccess {String} [tasks.exec] pointer to the executable of the task
 * @apiSuccess {String} [tasks.cores_nr] dynamic range of CPU cores to be used for execution
 * @apiSuccess {String} [application] name of the workflow (for compatibility with EXCESS GUI)
 * @apiSuccess {String} [task] task name equals the workflow ID (for compatibility with EXCESS GUI)
 * @apiSuccess {String} [user] equals to author (for compatibility with EXCESS GUI)
 * @apiSuccess {String} timestamp the timestamp when the workflow was registered
 * @apiSuccess {String} [jobid] equals the experiment ID (for compatibility with EXCESS GUI)
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/experiments/AVZ-ll9FGYwmTvCuSnjW?workflow=ms2
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "wf_id": "MS2",
 *        "author": "Me",
 *        "optimization": "Time",
 *        "valueCurve": "[1000:100,2000:50,3000:10]",
 *        "tasks": [
 *           {
 *              "name": "T1",
 *              "exec": "/nas_home/hpcochep/DreamCloud/WFM/Apps/TestEmpty/T1.sh",
 *              "cores_nr": "1-40"
 *           },
 *           {
 *              "name": "T2.1",
 *              "exec": "/nas_home/hpcochep/DreamCloud/WFM/Apps/TestEmpty/T2.1.sh",
 *              "previous": "T1",
 *              "cores_nr": "1-40"
 *           },
 *           {
 *              "name": "T2.2",
 *              "exec": "/nas_home/hpcochep/DreamCloud/WFM/Apps/TestEmpty/T2.2.sh",
 *              "previous": "T1",
 *              "cores_nr": "1-40"
 *           },
 *           {
 *              "name": "T2.3",
 *              "exec": "/nas_home/hpcochep/DreamCloud/WFM/Apps/TestEmpty/T2.3.sh",
 *              "previous": "T1",
 *              "cores_nr": "1-40"
 *           },
 *           {
 *              "name": "T3",
 *              "exec": "/nas_home/hpcochep/DreamCloud/WFM/Apps/TestEmpty/T3.sh",
 *              "previous": "T2.1&&T2.2&&T2.3",
 *              "cores_nr": "1-40"
 *           }
 *        ],
 *        "application": "ms2",
 *        "task": "ms2",
 *        "user": "me",
 *        "@timestamp": "2016-08-12T13:49:59",
 *        "job_id": "AVZ-ll9FGYwmTvCuSnjW"
 *     }
 *
 * @apiError DatabaseError Elasticsearch specific error message.
 */
router.get('/:id', function(req, res, next) {
    var client = req.app.get('elastic'),
      id = req.params.id,
      workflow = req.query.workflow,
      extend = req.query.extends,
      json = {},
      size = 1000;

    workflow = workflow.toLowerCase();

    if (typeof workflow == 'undefined') {
        json.error = "URL parameter 'workflow' is missing";
        res.json(json);
        return;
    }

    client.get({
        index: 'mf',
        type: 'experiments',
        id: id,
        parent: workflow
    }, function(error, response) {
        if (response.found) {
            json = response._source;
            if (json['@timestamp'] !== 'undefined') {
                delete json.timestamp;
            }
            if (is_defined(extend)) {
                client.get({
                    index: 'mf',
                    type: 'workflows',
                    id: workflow
                }, function(error, response) {
                    if (response.found) {
                        var source = response._source;
                        json.tasks = [];
                        for (var i in source.tasks) {
                            json.tasks.push(source.tasks[i].name);
                        }
                    } else {
                        json.error = error;
                    }
                    res.json(json);
                });
            } else {
                res.json(json);
            }
        } else {
            res.json(error);
        }
    });
});

/**
 * @api {post} /experiments/:workflowID 3. Create a new experiment with given workflow ID
 * @apiVersion 1.0.0
 * @apiName PostExperiments
 * @apiGroup Experiments
 *
 * @apiParam {String} workflowID identifier for the workflow for which the experiment shall be created, e.g. 'ms2'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/experiments/ms2
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "application": "vector_scal01",
 *       "host": "fe.excess-project.eu",
 *       "user": "hpcfapix",
 *       "@timestamp": "2016-02-15T12:42:22.000",
 *       "job_id": "143249.fe.excess-project.eu"
 *     }
 *
 * @apiParam {String} [application] application name, provided while registering a new experiment
 * @apiParam {String} [host] hostname of the system
 * @apiParam {String} [user] username, like who is registering the experiment
 * @apiParam {String} timestamp timestamp, when the experiment is registered
 * @apiParam {String} [job_id] job identifier, provided while registering a new experiment
 *
 * @apiSuccess {Object} experimentID identifier of an experiment
 * @apiSuccess {String} experimentID.href link to the experiment
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "AVXt3coOz5chEwIt8_Ma": {
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVXt3coOz5chEwIt8_Ma?workflow=ms2"
 *       }
 *     }
 *
 */
router.post('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
      mf_server = req.app.get('mf_server'),
      client = req.app.get('elastic');

    var body = req.body;
    var now = new Date();
    now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
    body['@timestamp'] = now;

    client.index({
        index: 'mf',
        type: 'experiments',
        parent: id,
        body: body
    },function(error, response) {
        if (error) {
            res.json(error);
        } else {
            var json = {};
            json[response._id] = {};
            json[response._id].href = mf_server + '/dreamcloud/mf/experiments/' + response._id + '?workflow=' + id;
            res.json(json);
        }
    });
});

module.exports = router;