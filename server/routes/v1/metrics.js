var express = require('express');
var http = require('http');
var async = require('async');
var router = express.Router();

/**
 * @api {post} /metrics 1. Send bulk of metrics
 * @apiVersion 1.0.0
 * @apiName PostBulkMetrics
 * @apiGroup Metrics
 *
 * @apiParam {String} WorkflowID identifier of a workflow
 * @apiParam {String} task identifier of a task
 * @apiParam {String} ExperimentID identifier of an experiment
 * @apiParam {String} type type of the metric, e.g. power, temperature, and so on
 * @apiParam {String} host hostname of the system
 * @apiParam {String} timestamp timestamp, when the metric is collected
 * @apiParam {String} metric value of the metric
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/metrics
 *
 * @apiParamExample {json} Request-Example:
 *     [
 *         {
 *              "WorkflowID":"hpcfapix",
 *              "task":"vector_scal01",
 *              "ExperimentID":"AVUWnydqGMPeuCn4l-cj",
 *              "type":"power", "host": "node01.excess-project.eu",
 *              "@timestamp": "2016-02-15T12:46:48.749",
 *              "GPU1:power": "168.519"
 *          }, {
 *              "WorkflowID":"hoppe",
 *              "task":"testing",
 *              "ExperimentID":"AVNXMXcvGMPeuCn4bMe0",
 *              "type": "power",
 *              "host": "node01.excess-project.eu",
 *              "@timestamp": "2016-02-15T12:43:48.524",
 *              "GPU0:power": "152.427"
 *          }
 *     ]
 *
 * @apiSuccess {String} href links to all updated experiments' profiled metrics
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *           "http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix_vector_scal01/AVUWnydqGMPeuCn4l-cj",
 *           "http://mf.excess-project.eu:3030/v1/mf/profiles/hoppe_testing/AVNXMXcvGMPeuCn4bMe0"
 *     ]
 *
 */
router.post('/', function(req, res, next) {
    var data = req.body,
      mf_server = req.app.get('mf_server') + '/mf',
      client = req.app.get('elastic'),
      bulk_data = [];

    var tmp = {};
    tmp.index = {};
    for (i = 0; i != data.length; ++i) {
        var action = JSON.parse(JSON.stringify(tmp));
        var index = data[i].WorkflowID;
        if (data[i].task) {
          index = index + '_' + data[i].task;
        } else {
          index = index + '_all';
        }
        // index: no white spaces allowed
        index = index.replace(' ', '_');
        action.index._index = index.toLowerCase();
        action.index._type = data[i].ExperimentID;
        delete data[i].WorkflowID;
        delete data[i].ExperimentID;
        bulk_data.push(action);
        bulk_data.push(data[i]);
    }

    client.bulk({
        body: bulk_data
    },function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        var json = [];
        for (var i in response.items) {
            json.push(mf_server + '/profiles/' +
              response.items[i].create._index.replace('_all', '/all') +
              '/' + response.items[i].create._type);
        }
        res.json(json);
    });
});

/**
 * @api {post} /metrics/:workflowID/:experimentID 2. Send one metric with given workflow ID and experiment ID
 * @apiVersion 1.0.0
 * @apiName PostMetrics
 * @apiGroup Metrics
 *
 * @apiParam {String} workflowID identifier of a workflow
 * @apiParam {String} experimentID identifier of an experiment
 * @apiParam {String} type type of the metric, e.g. power, temperature, and so on
 * @apiParam {String} host hostname of the system
 * @apiParam {String} timestamp timestamp, when the metric is collected
 * @apiParam {String} metric value of the metric
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/metrics/hpcfapix/AVNXMXcvGMPeuCn4bMe0?task=vector_scal01
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "type": "power",
 *       "host": "fe.excess-project.eu",
 *       "@timestamp": "2016-02-15T12:42:22.000",
 *       "GPU0:power": "152.427"
 *     }
 *
 * @apiSuccess {Object} metricID identifier of the sent metric
 * @apiSuccess {String} metricID.href link to the experiment with updated metrics
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "AVXt3coOz5chEwIt8_Ma": {
 *         "href": "http://mf.excess-project.eu:3030/v1/mf/profiles/hpcfapix/vector_scal01/AVNXMXcvGMPeuCn4bMe0"
 *       }
 *     }
 *
 */
router.post('/:workflowID/:experimentID', function(req, res, next) {
    var workflowID = req.params.workflowID.toLowerCase(),
      experimentID = req.params.experimentID,
      mf_server = req.app.get('mf_server') + '/mf',
      taskID = req.query.task.toLowerCase(),
      client = req.app.get('elastic'),
      index_missing = false;

    // taskID will later be used as an index, no white spaces allowed
    taskID = taskID.replace(' ', '_');

    var index = workflowID;
    if (typeof taskID == 'undefined') {
        taskID = 'manual_monitoring';
    }

    index = workflowID + '_' + taskID;

    async.series([
        function(callback) {
            client.indices.exists({
                index: index
            }, function(error, response) {
                index_missing = !response;
                callback(null, '1=' + index_missing);
            });
        },
        function(callback) {
            var created = false;
            if (index_missing) {
                var headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': bodyString.length
                };

                var options = {
                    host: 'localhost',
                    path: '/' + index,
                    port: 9200,
                    method: 'PUT',
                    headers: headers
                };

                var http_request = http.request(options, function(res) {
                    res.setEncoding('utf-8');
                    res.on('data', function(data) {
                        //console.log('incoming: ' + data);
                    });
                    res.on('end', function() {
                        callback(null, '2=created');
                    });
                });

                http_request.on('error', function(e) {
                    callback(null, '2=not_created');
                });

                http_request.write(bodyString);
                http_request.end();
            } else {
                callback(null, '2=exists');
            }
        },
        function(callback) {
            /* work-around for plug-ins sending the old timestamp format */
            if (req.body.Timestamp) {
                req.body['@timestamp'] = req.body.Timestamp;
                delete req.body.Timestamp;
            }
            client.index({
                index: index,
                type: experimentID,
                body: req.body
            },function(error, response) {
                if (error) {
                    res.status(500);
                    callback(null, 'id not found');
                    console.log(error);
                    return;
                }
                var json = {};
                json[response._id] = {};
                json[response._id].href = mf_server + '/profiles/' + workflowID;
                if (typeof taskID !== 'undefined') {
                    json[response._id].href += '/' + taskID;
                }
                json[response._id].href += '/' + experimentID;
                res.json(json);
                callback(null, '3=' + JSON.stringify(json));
            });
        }
    ],
    function(err, results){
        //console.log(results);
    });
});

var bodyString =
'{' +
   '"dynamic_templates": [' +
      '{' +
         '"string_fields": {' +
            '"mapping": {' +
               '"index": "analyzed",' +
               '"omit_norms": true,' +
               '"type": "string",' +
               '"fields": {' +
                  '"raw": {' +
                     '"index": "not_analyzed",' +
                     '"ignore_above": 256,' +
                     '"type": "string"' +
                  '}' +
               '}' +
            '},' +
            '"match": "*",' +
            '"match_mapping_type": "string"' +
         '}' +
      '}' +
   '],' +
   '"_all": {' +
      '"enabled": true' +
   '},' +
   '"properties": {' +
      '"@timestamp": {' +
         '"enabled" : true,' +
         '"type":"date",' +
         '"format": "date_hour_minute_second_millis",' +
         '"store": true,' +
         '"path": "@timestamp"' +
      '},' +
      '"host": {' +
         '"type": "string",' +
         '"norms": {' +
            '"enabled": false' +
         '},' +
         '"fields": {' +
            '"raw": {' +
               '"type": "string",' +
               '"index": "not_analyzed",' +
               '"ignore_above": 256' +
            '}' +
         '}' +
      '},' +
      '"name": {' +
         '"type": "string",' +
         '"norms": {' +
            '"enabled": false' +
         '},' +
         '"fields": {' +
            '"raw": {' +
               '"type": "string",' +
               '"index": "not_analyzed",' +
               '"ignore_above": 256' +
            '}' +
         '}' +
      '},' +
      '"value": {' +
         '"type": "long",' +
         '"norms": {' +
            '"enabled": false' +
         '},' +
         '"fields": {' +
            '"raw": {' +
               '"type": "long",' +
               '"index": "not_analyzed",' +
               '"ignore_above": 256' +
            '}' +
         '}' +
      '}' +
   '}' +
'}';

module.exports = router;
