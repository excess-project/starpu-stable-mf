var express = require('express');
var router = express.Router();
/**
 * @api {get} /statistics/:workflowID/:taskID 1. Request the statistics of a task with given workflow ID and task ID
 * @apiVersion 1.0.0
 * @apiName GetStatsTask
 * @apiGroup Statistics
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} metric name of a metric
 * @apiParam {String} [host] hostname of the system
 * @apiParam {String} [from] start time of the statistics
 * @apiParam {String} [to] end time of the statistics
 *
 * @apiExample {curl} Example usage:
 *     curl -i 'http://mf.excess-project.eu:3030/v1/mf/statistics/hpcfapix/vector_scal01?metric=DRAM_POWER:PACKAGE0&metric=DRAM_POWER:PACKAGE1&host=node01&from=2016-05-10T17:35:57.610&to=2016-05-10T17:36:57.610'
 *
 * @apiSuccess {Object} user link to the user
 * @apiSuccess {String} metric name of the metric
 * @apiSuccess {Object} statistics statistics of the metric during the time interval
 * @apiSuccess {Object} min minimum measurement during the time interval
 * @apiSuccess {Object} max maximum measurement during the time interval
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *            "user":
 *                   {"href":"http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix"},
 *            "metric":"DRAM_POWER:PACKAGE0",
 *            "statistics":
 *                   {"count":6,
 *                    "min":1.5568,
 *                    "max":1.5724,
 *                    "avg":1.5640333333333334,
 *                    "sum":9.3842,
 *                    "sum_of_squares":14.677405239999999,
 *                    "variance":0.000033938888888881045,
 *                    "std_deviation":0.0058257093034995355,
 *                    "std_deviation_bounds":
 *                           {"upper":1.5756847519403325,
 *                            "lower":1.5523819147263342}
 *                   },
 *            "min":
 *                   {"@timestamp":"2016-05-10T17:36:00.851",
 *                    "host":"node01.excess-project.eu",
 *                    "task":"vector_scal01",
 *                    "type":"energy",
 *                    "DRAM_ENERGY:PACKAGE0":1.5573,
 *                    "DRAM_POWER:PACKAGE0":1.5568,
 *                    "DRAM_ENERGY:PACKAGE1":1.5584,
 *                    "DRAM_POWER:PACKAGE1":1.5578}
 *            "max":{
 *                    "@timestamp":"2016-05-10T17:35:57.610",
 *                    "host":"node01.excess-project.eu",
 *                    "task":"vector_scal01",
 *                    "type":"energy",
 *                    "DRAM_ENERGY:PACKAGE0":1.5727,
 *                    "DRAM_POWER:PACKAGE0":1.5724,
 *                    "DRAM_ENERGY:PACKAGE1":1.5692,
 *                    "DRAM_POWER:PACKAGE1":1.5689}
 *        }
 *     ]
 *
 * @apiError NoResults response is empty for the metric.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "error": "response is empty for the metric."
 *     }
 */
router.get('/:workflowID/:taskID', function(req, res, next) {
    var workflowID = req.params.workflowID.toLowerCase(),
      taskID = req.params.taskID.toLowerCase(),
      index = workflowID + '_' + taskID;

    return handle_response(req, res, next, index);
});

/**
 * @api {get} /statistics/:workflowID/:taskID/:experimentID 2. Request the statistics of an experiment with given workflow ID, task ID and experiment ID
 * @apiVersion 1.0.0
 * @apiName GetStatsExperiment
 * @apiGroup Statistics
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} experimentID identifier of an experiment
 * @apiParam {String} metric name of a metric
 * @apiParam {String} [host] hostname of the system
 * @apiParam {String} [from] start time of the statistics
 * @apiParam {String} [to] end time of the statistics
 *
 * @apiExample {curl} Example usage:
 *     curl -i 'http://mf.excess-project.eu:3030/v1/mf/statistics/hpcfapix/vector_scal01/AVSbT0ChGMPeuCn4QYjq?metric=DRAM_POWER:PACKAGE0&metric=DRAM_POWER:PACKAGE1&host=node01&from=2016-05-10T17:35:57.610&to=2016-05-10T17:36:57.610'
 *
 * @apiSuccess {Object} user link to the user
 * @apiSuccess {String} metric name of the metric
 * @apiSuccess {Object} statistics statistics of the metric during the time interval
 * @apiSuccess {Object} min minimum measurement during the time interval
 * @apiSuccess {Object} max maximum measurement during the time interval
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *        {
 *            "user":
 *                   {"href":"http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix"},
 *            "metric":"DRAM_POWER:PACKAGE0",
 *            "statistics":
 *                   {"count":6,
 *                    "min":1.5568,
 *                    "max":1.5724,
 *                    "avg":1.5640333333333334,
 *                    "sum":9.3842,
 *                    "sum_of_squares":14.677405239999999,
 *                    "variance":0.000033938888888881045,
 *                    "std_deviation":0.0058257093034995355,
 *                    "std_deviation_bounds":
 *                           {"upper":1.5756847519403325,
 *                            "lower":1.5523819147263342}
 *                   },
 *            "min":
 *                   {"@timestamp":"2016-05-10T17:36:00.851",
 *                    "host":"node01.excess-project.eu",
 *                    "task":"vector_scal01",
 *                    "type":"energy",
 *                    "DRAM_ENERGY:PACKAGE0":1.5573,
 *                    "DRAM_POWER:PACKAGE0":1.5568,
 *                    "DRAM_ENERGY:PACKAGE1":1.5584,
 *                    "DRAM_POWER:PACKAGE1":1.5578}
 *            "max":{
 *                    "@timestamp":"2016-05-10T17:35:57.610",
 *                    "host":"node01.excess-project.eu",
 *                    "task":"vector_scal01",
 *                    "type":"energy",
 *                    "DRAM_ENERGY:PACKAGE0":1.5727,
 *                    "DRAM_POWER:PACKAGE0":1.5724,
 *                    "DRAM_ENERGY:PACKAGE1":1.5692,
 *                    "DRAM_POWER:PACKAGE1":1.5689}
 *        }
 *     ]
 *
 * @apiError NoResults response is empty for the metric.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "error": "response is empty for the metric."
 *     }
 */
router.get('/:workflowID/:taskID/:experimentID', function(req, res, next) {
    var workflowID = req.params.workflowID.toLowerCase(),
      taskID = req.params.taskID.toLowerCase(),
      type = req.params.experimentID,
      index = workflowID + '_' + taskID;

    return handle_response(req, res, next, index, type);
});

function handle_response(req, res, next, index, type) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server') + '/mf',
      workflowID = req.params.workflowID.toLowerCase(),
      host = req.query.host,
      metric = req.query.metric,
      from = req.query.from,
      to = req.query.to,
      body = aggregation_by(metric, type);

     if (!is_defined(metric)) {
        var error = {
            'error': {
                'message': 'parameter metric is missing'
            }
        }
        res.json(error);
        return;
    }

    if (is_defined(from) && is_defined(to)) {
        body = filter_and_aggregate_by(metric, from, to, type, host);
    }

    client.indices.refresh({
        index: index
    }, function(error, response) {
        if (error) {
            res.json(error);
            return;
        }
        client.search({
            index: index,
            searchType: 'count',
            body: body
        }, function(error, response) {
            if (error) {
                res.json(error);
                return;
            }
            var metrics = [],
                answers = [];
            if (typeof(metric) == "string") {
                metrics[0] = metric;
            }
            else {
                metrics = metric;
            }
            for (var key in metrics) {
                var answer = {},
                    aggs = response.aggregations;
                answer['user'] = {};
                answer['user'].href = mf_server + '/users/' + workflowID;
                answer['metric'] = metrics[key];

                if (is_defined(from) && is_defined(to)) {
                    aggs = aggs['filtered_stats'];
                }
                if(aggs['Minimum_' + metrics[key]]['hits']['total'] == 0) {
                        var json = {};
                        json.error = "response is empty for the metric";
                        answers.push(json);
                }
                else {
                    answer['statistics'] = aggs[metrics[key] + '_Stats'];
                    answer['min'] = aggs['Minimum_' + metrics[key]]['hits']['hits'][0]['_source'];
                    answer['max'] = aggs['Maximum_' + metrics[key]]['hits']['hits'][0]['_source'];
                    answers.push(answer);
                }
            }
            res.json(answers);
        });
    });
}

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function filter_and_aggregate_by(field_name, from, to, type, host) {
    var filter_type = '';
    if (is_defined(type)) {
        filter_type = '{ ' +
                        '"type": { "value": "' + type + '" }' +
                    '},';
    }
    if(is_defined(host)) {
        filter_type += '{ ' +
                        '"prefix": { "host": "' + host + '" }' +
                    '},';
    }
    return '{' +
        '"aggs": {' +
            '"filtered_stats": {' +
                '"filter": {' +
                    '"and": [' +
                        filter_type +
                        date_filter(from, to) +
                    ']' +
                '},' +
                aggregation_by(field_name).slice(1, -1) +
            '}' +
        '}' +
    '}';
}

function date_filter(from, to) {
    var filter = '';

    if (is_defined(from) && is_defined(to)) {
        filter =
            '{ ' +
                '"range": {' +
                    '"@timestamp": {' +
                        '"from": "' + from + '",' +
                        '"to": "' + to + '"' +
                    '}' +
                '}' +
            '}';
    }

    return filter;
}

function type_filter(type) {
    var filter = '';

    if (is_defined(type)) {
        filter =
            '"query": {' +
                '"filtered": {' +
                    '"filter": {' +
                        '"type": { "value": "' + type + '" }' +
                    '}' +
                '}' +
            '},';
    }

    return filter;
}

function aggregation_by(field_name, type) {
    var fields = [];
    var query_msg = '{' + type_filter(type) +
        '"aggs": {';
    if(typeof(field_name) == "string") {
        fields[0] = field_name;
    }
    else {
        fields = field_name;
    }
    for (var key in fields) {
        query_msg +=
            '"' + fields[key] + '_Stats" : {' +
                '"extended_stats" : {' +
                    '"field" : "' + fields[key] + '"' +
                '}' +
            '},' +
            '"Minimum_' + fields[key] + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + fields[key] + '": {' +
                                '"order": "asc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '},' +
            '"Maximum_' + fields[key] + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + fields[key] + '": {' +
                                '"order": "desc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '},'
    }
    query_msg = query_msg.slice(0, -1);
    query_msg +=
        '}' +
    '}';
    return query_msg;
}

module.exports = router;