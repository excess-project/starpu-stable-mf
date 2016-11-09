var express = require('express');
var router = express.Router();
var async = require('async');

/**
 * @api {get} /profiles/:workflowID 1. Request a list of profiled tasks with given workflow ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesWorkflow
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix
 *
 * @apiSuccess {Object} taskID identifier of a registered task
 * @apiSuccess {Object} taskID.experimentID identifier of an experiment
 * @apiSuccess {String} taskID.experimentID.href link to the experiment
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "vector_scal01":{
 *          "AVSf5_wVGMPeuCn4Qdw2":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVSf5_wVGMPeuCn4Qdw2"
 *          },
 *          "AVSf-mU4GMPeuCn4Qd0L":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVSf-mU4GMPeuCn4Qd0L"
 *          }
 *       },
 *       "mfnode01":{
 *          "AVXAMB5FLeaeU4rxyi3w":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/mfnode01/AVXAMB5FLeaeU4rxyi3w"
 *          },
 *          "AVVT4dhwenoRsEhyDkeb":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/mfnode01/AVVT4dhwenoRsEhyDkeb"
 *          }
 *       }
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
router.get('/:workID', function(req, res, next) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server'),
      workflow = req.params.workID.toLowerCase(),
      dreamcloud = req.query.dreamcloud,
      json = {};

    if (is_defined(dreamcloud)) {
        mf_server = mf_server + '/dreamcloud/mf';
    } else {
        mf_server = mf_server + '/mf';
    }

    client.indices.getSettings({
        index: workflow + '*',
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        if (response !== undefined) {
            var results = Object.keys(response);

            async.map(results, function(index, callback) {
                var task = index;
                task = task.replace(workflow + '_', '');
                // please remove for production mode
                if (task.indexOf("2015") > -1) {
                    return callback(null, json);
                }

                client.indices.getMapping({
                    index: index,
                }, function(error, response) {
                    if (error === undefined) {
                        var mappings = response[index].mappings;
                        mappings = Object.keys(mappings);
                        if (json[task] === undefined) {
                            json[task] = {};
                        }
                        for (var i in mappings) {
                            var item = {};
                            // remove in prod. mode
                            if (typeof task !== 'undefined') {
                                item.href = mf_server + '/profiles/' + workflow + '/' + task + '/' + mappings[i];
                                json[task][mappings[i]] = item;
                            } else {
                                item.href = mf_server +  '/profiles/' + workflow + '/' + mappings[i];
                                json[mappings[i]] = item;
                            }
                        }
                        return callback(null, json);
                    } else {
                        json.error = error;
                    }
                });
            }, function(err, results) {
                // remove in production mode
                if (typeof results[0] == 'undefined') {
                    res.status(500);
                    var msg = {};
                    msg.error = "No results found.";
                    res.json(msg);
                } else {
                    for (var key in results[0]) {
                        if (isEmpty(results[0][key])) {
                            delete results[0][key];
                        }
                    }
                    res.json(results[0]);
                }
            });
        }
    });
});

function isEmpty(obj) {
    var name;
    for (name in obj) {
        return false;
    }
    return true;
}

/**
 * @api {get} /profiles/:workflowID/:taskID 2. Request a list of profiled experiments with given workflow ID and task ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesTask
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a registered task
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01
 *
 * @apiSuccess {Object} date date, when the task is registered
 * @apiSuccess {Object} date.experimentID identifier of an experiment
 * @apiSuccess {String} date.experimentID.href link to the experiment
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "2016-05-11":{
 *          "AVSf5_wVGMPeuCn4Qdw2":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVSf5_wVGMPeuCn4Qdw2"
 *          },
 *          "AVSf-mU4GMPeuCn4Qd0L":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVSf-mU4GMPeuCn4Qd0L"
 *          }
 *       },
 *       "2016-05-10":{
 *          "AVXAMB5FLeaeU4rxyi3w":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVXAMB5FLeaeU4rxyi3w"
 *          },
 *          "AVVT4dhwenoRsEhyDkeb":{
 *                "href":"http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVVT4dhwenoRsEhyDkeb"
 *          }
 *       }
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
router.get('/:workID/:taskID', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workID.toLowerCase(),
      mf_server = req.app.get('mf_server'),
      dreamcloud = req.query.dreamcloud,
      task = req.params.taskID.toLowerCase(),
      size = 1000,
      json = {};

    if (is_defined(dreamcloud)) {
        mf_server = mf_server + '/dreamcloud/mf';
    } else {
        mf_server = mf_server + '/mf';
    }

    // assign default taskID when application has no workflow
    if (!is_defined(task)) {
        res.status(500);
        json.error = "Task not found";
        res.json(json);
        return;
    }
    var index = workflow + '_' + task;
    index = index.toLowerCase();

    client.indices.getMapping({
        index: index,
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        if (response !== undefined) {
            var mappings = response[index].mappings;
            mappings = Object.keys(mappings);
            async.map(mappings, function(experimentID, callback) {
                client.get({
                    index: 'mf',
                    type: 'experiments',
                    id: experimentID,
                    parent: workflow
                }, function(error, response) {
                    if (response.found) {
                        var result = response._source,
                          timestamp = result.timestamp,
                          href = mf_server + '/profiles/' + workflow + '/' + task + '/' + experimentID;
                        var element = {};
                        element.href = href;
                        if (typeof timestamp !== 'undefined') {
                            timestamp = timestamp.split('-')[0];
                            timestamp = timestamp.replace(/\./g, '-');
                            if (json[timestamp] === undefined) {
                                json[timestamp] = {};
                            }
                        } else if (typeof result['@timestamp'] !== 'undefined') {
                            timestamp = result['@timestamp'].split('T')[0];
                            if (json[timestamp] === undefined) {
                                json[timestamp] = {};
                            }
                        }
                        json[timestamp][experimentID] = element;
                    } else {
                        json.error = error;
                    }
                    return callback(null, json);
                });
            }, function(err, results) {
                if (typeof results[0] == 'undefined') {
                    res.status(500);
                    var msg = {};
                    msg.error = "No results found.";
                    res.json(msg);
                } else {
                    res.json(results[0]);
                }
            });
        }
    });
});

/**
 * @api {get} /profiles/:workflowID/:taskID/:experimentID 3. Request a profiled experiment with given workflow ID, task ID and experiment ID
 * @apiVersion 1.0.0
 * @apiName GetProfilesExperiment
 * @apiGroup Profiles
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a registered task
 * @apiParam {String} experimentID identifier of an experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVSbT0ChGMPeuCn4QYjq
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
 *         {
 *          "@timestamp":"2016-05-10T17:35:59.576",
 *          "host":"node01.excess-project.eu",
 *          "task":"vector_scal01",
 *          "type":"energy",
 *          "DRAM_ENERGY:PACKAGE0":1.5715,
 *          "DRAM_POWER:PACKAGE0":1.571,
 *         },{
 *           "@timestamp":"2016-05-10T17:35:59.708",
 *           "host":"node01.excess-project.eu",
 *           "task":"vector_scal01",
 *           "type":"memory",
 *           "MemTotal":32771284,
 *           "MemFree":31720604
 *         },{
 *           "@timestamp":"2016-05-10T17:35:59.831",
 *           "host":"node01.excess-project.eu",
 *           "task":"vector_scal01",
 *           "type":"temperature",
 *           "CPU1_Core 1":30,
 *           "CPU1_Core 0":25
 *         }
 *     ]
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
      experiment = req.params.expID,
      filter = req.query.filter,
      size = 1000,
      json = [];

    var index = workflow + '_' + task;

    client.search({
        index: index,
        type: experiment,
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
            index: index,
            type: experiment,
            size: size
        }, function(error, response) {
            if (error) {
                res.status(500);
                return next(error);
            }
            if (response.hits !== undefined) {
                var results = response.hits.hits,
                  keys = Object.keys(results),
                  item = {};
                keys.forEach(function(key) {
                    item = results[key]._source;
                    if (typeof item['@timestamp'] !== 'undefined') {
                        item['@timestamp'] = item['@timestamp'].replace(/\s/g, '0');
                    }
                    json.push(item);
                });
            }

            if (typeof json[0] == 'undefined') {
                res.status(500);
                var msg = {};
                msg.error = "No results found.";
                res.json(msg);
            } else {
                res.json(json);
            }
        });
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

module.exports = router;
