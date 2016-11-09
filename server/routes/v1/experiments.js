var express = require('express');
var dateFormat = require('dateformat');
var router = express.Router();

/**
 * @api {get} /experiments 1. Request a list of registered experiments
 * @apiVersion 1.0.0
 * @apiName GetExperiments
 * @apiGroup Experiments
 *
 * @apiSuccess {Object} experimentID identifier of an experiment
 * @apiSuccess {String} experimentID.href link to the experiment
 *
 * @apiParam {Boolean} [details] if set, more detailed information for each experiment is given
 * @apiParam {String} [workflow] filters results by the given user, e.g. 'hpcfapix'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/experiments
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/experiments?workflow=hpcfapix&details
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "AVUWoIRDGMPeuCn4l-cl": {
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVUWoIRDGMPeuCn4l-cl?workflow=hpcfapix"
 *       },
 *       "AVNXMbaBGMPeuCn4bMfv": {
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVNXMbaBGMPeuCn4bMfv?workflow=hoppe"
 *       },
 *       "AVNXMsA_GMPeuCn4bMj7": {
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVNXMsA_GMPeuCn4bMj7?workflow=dmitry"
 *       }
 *     }
 *
 * @apiError NotFound Not Found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NotFound
 *     {
 *       "error": "Not Found."
 *     }
 */
router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server') + '/mf',
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
        json.href = mf_server + '/experiments/' + experimentID + '?workflow=' + workflow;
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
 * @apiParam {String} workflow the username the given experiment is associated with, e.g. 'hpcfapix'
 * @apiParam {Boolean} [extends] returns detailed information about tasks, if present
 *
 * @apiSuccess {String} application application name of the experiment
 * @apiSuccess {String} host hostname of the system
 * @apiSuccess {String} user user identifier of the experiment
 * @apiSuccess {String} timestamp timestamp, when the experiment is registered
 * @apiSuccess {String} job_id job identifier of the experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/experiments/AVNXMXcvGMPeuCn4bMe0?workflow=hpcfapix
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "application":"vector_scal01",
 *       "host":"fe.excess-project.eu",
 *       "user":"hpcfapix",
 *       "@timestamp":"2016-02-15T12:42:22.000",
 *       "job_id":"143249.fe.excess-project.eu"
 *     }
 *
 * @apiError NoWorkflow No workflow is given.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 NoWorkflow
 *     {
 *       "error": "URL parameter 'workflow' is missing"
 *     }
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
 * @apiParam {String} workflowID identifier of a workflow for which an experiment shall be created, e.g. 'hpcfapix'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/experiments/hpcfapix
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
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/experiments/AVXt3coOz5chEwIt8_Ma?workflow=hpcfapix"
 *       }
 *     }
 *
 */
router.post('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
      mf_server = req.app.get('mf_server') + '/mf',
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
            json[response._id].href = mf_server + '/experiments/' + response._id + '?workflow=' + id;
            res.json(json);
        }
    });
});

module.exports = router;
