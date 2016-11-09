var express = require('express');
var router = express.Router();

/**
 * @api {get} /statistics/:workflowID 1. Get statistics on a metric across all tasks
 * @apiVersion 1.0.0
 * @apiName GetStats
 * @apiGroup Statistics
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} metric name of a metric, e.g., metric=CPU0::PAPI_TOT_CYC
 * @apiParam {String} [host] hostname of the system, e.g., host=node01
 * @apiParam {String} [from] start time of the statistics, e.g., from=2016-05-10T17:35:57.610
 * @apiParam {String} [to] end time of the statistics, e.g., to=2016-05-10T17:35:57.610
 *
 * @apiExample {curl} Example usage:
 *     curl -i 'http://mf.excess-project.eu:3030/v1/mf/statistics/ms2?metric=CPU0::PAPI_TOT_CYC'
 *
 * @apiSuccess {Object} workflow workflow-related data
 * @apiSuccess {String} workflow.href link to the stored workflow information
 * @apiSuccess {String} metric name of the metric for which statistics are captured
 * @apiSuccess {Object} statistics extended set of statistics as provided by Elasticsearch
 * @apiSuccess {Number} statistics.count number of metric values sampled
 * @apiSuccess {Number} statistics.min minimum value obtained for the given metric
 * @apiSuccess {Number} statistics.max maximum value obtained for the given metric
 * @apiSuccess {Number} statistics.avg average value across all metric values
 * @apiSuccess {Number} statistics.sum sum of all sampled metric values
 * @apiSuccess {Number} statistics.sum_of_squares sum of squares for the given metric values
 * @apiSuccess {Number} statistics.variance variance of the given metric
 * @apiSuccess {Number} statistics.std_deviation standard deviation computed for the given metric
 * @apiSuccess {Object} statistics.std_deviation_bounds deviation bounds of the given metric
 * @apiSuccess {Number} statistics.std_deviation_bounds.upper upper bounds
 * @apiSuccess {Number} statistics.std_deviation_bounds.lower lower bounds
 * @apiSuccess {Object} min experiment that has the minimum value of the metric included
 * @apiSuccess {String} timestamp time when the experiment was executed
 * @apiSuccess {String} host hostname on which the experiment was executed
 * @apiSuccess {String} task identifier for a task
 * @apiSuccess {String} type type of plug-in the metric is associated with
 * @apiSuccess {String} metric metric value associated with a given value
 * @apiSuccess {Object} max experiment that has the maximum value of the metric included
 * @apiSuccess {String} timestamp time when the experiment was executed
 * @apiSuccess {String} host hostname on which the experiment was executed
 * @apiSuccess {String} task identifier for a task
 * @apiSuccess {String} type type of plug-in the metric is associated with
 * @apiSuccess {String} metric metric value associated with a given value
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "workflow": {
 *           "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2"
 *        },
 *        "metric": "CPU0::PAPI_TOT_CYC",
 *        "statistics": {
 *           "count": 314,
 *           "min": 2188289,
 *           "max": 140712658075784,
 *           "avg": 27784198121927.688,
 *           "sum": 8724238210285294,
 *           "sum_of_squares": 1.2276032329935587e+30,
 *           "variance": 3.1376027710066886e+27,
 *           "std_deviation": 56014308627409.555,
 *           "std_deviation_bounds": {
 *              "upper": 139812815376746.8,
 *              "lower": -84244419132891.42
 *           }
 *        },
 *        "min": {
 *           "@timestamp": "2016-05-17T16:25:48.123",
 *           "host": "node01.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "performance",
 *           "CPU0::PAPI_FP_INS": 869,
 *           "CPU0::PAPI_TOT_CYC": 2188289,
 *           "CPU1::PAPI_FP_INS": 891,
 *           "CPU1::PAPI_TOT_CYC": 1214959,
 *           "CPU2::PAPI_FP_INS": 8126,
 *           ...
 *        },
 *        "max": {
 *           ...
 *        }
 *     }
 *
 * @apiError NoResults response is empty for the metric.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "error": "response is empty for the metric."
 *     }
 */
router.get('/:workflowID', function(req, res, next) {
    var workflowID = req.params.workflowID.toLowerCase(),
        index = workflowID + '_*';

    return handle_response(req, res, next, index);
});

/**
 * @api {get} /statistics/:workflowID/:taskID 2. Get statistics on a metric filtered by task ID
 * @apiVersion 1.0.0
 * @apiName GetStatsTask
 * @apiGroup Statistics
 *
 * @apiParam {String} workflowID identifer of a workflow
 * @apiParam {String} taskID identifier of a task
 * @apiParam {String} metric name of a metric, e.g., metric=CPU0::PAPI_TOT_CYC
 * @apiParam {String} [host] hostname of the system, e.g., host=node01
 * @apiParam {String} [from] start time of the statistics, e.g., from=2016-05-10T17:35:57.610
 * @apiParam {String} [to] end time of the statistics, e.g., to=2016-05-10T17:35:57.610
 *
 * @apiExample {curl} Example usage:
 *     curl -i 'http://mf.excess-project.eu:3030/v1/mf/statistics/ms2/t2.1?metric=CPU0::PAPI_TOT_CYC'
 *
 * @apiSuccess {Object} workflow workflow-related data
 * @apiSuccess {String} workflow.href link to the stored workflow information
 * @apiSuccess {String} metric name of the metric for which statistics are captured
 * @apiSuccess {Object} statistics extended set of statistics as provided by Elasticsearch
 * @apiSuccess {Number} statistics.count number of metric values sampled
 * @apiSuccess {Number} statistics.min minimum value obtained for the given metric
 * @apiSuccess {Number} statistics.max maximum value obtained for the given metric
 * @apiSuccess {Number} statistics.avg average value across all metric values
 * @apiSuccess {Number} statistics.sum sum of all sampled metric values
 * @apiSuccess {Number} statistics.sum_of_squares sum of squares for the given metric values
 * @apiSuccess {Number} statistics.variance variance of the given metric
 * @apiSuccess {Number} statistics.std_deviation standard deviation computed for the given metric
 * @apiSuccess {Object} statistics.std_deviation_bounds deviation bounds of the given metric
 * @apiSuccess {Number} statistics.std_deviation_bounds.upper upper bounds
 * @apiSuccess {Number} statistics.std_deviation_bounds.lower lower bounds
 * @apiSuccess {Object} min experiment that has the minimum value of the metric included
 * @apiSuccess {String} timestamp time when the experiment was executed
 * @apiSuccess {String} host hostname on which the experiment was executed
 * @apiSuccess {String} task identifier for a task
 * @apiSuccess {String} type type of plug-in the metric is associated with
 * @apiSuccess {String} metric metric value associated with a given value
 * @apiSuccess {Object} max experiment that has the maximum value of the metric included
 * @apiSuccess {String} timestamp time when the experiment was executed
 * @apiSuccess {String} host hostname on which the experiment was executed
 * @apiSuccess {String} task identifier for a task
 * @apiSuccess {String} type type of plug-in the metric is associated with
 * @apiSuccess {String} metric metric value associated with a given value
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "workflow": {
 *           "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/workflows/ms2"
 *        },
 *        "metric": "CPU0::PAPI_TOT_CYC",
 *        "statistics": {
 *           "count": 314,
 *           "min": 2188289,
 *           "max": 140712658075784,
 *           "avg": 27784198121927.688,
 *           "sum": 8724238210285294,
 *           "sum_of_squares": 1.2276032329935587e+30,
 *           "variance": 3.1376027710066886e+27,
 *           "std_deviation": 56014308627409.555,
 *           "std_deviation_bounds": {
 *              "upper": 139812815376746.8,
 *              "lower": -84244419132891.42
 *           }
 *        },
 *        "min": {
 *           "@timestamp": "2016-05-17T16:25:48.123",
 *           "host": "node01.excess-project.eu",
 *           "task": "t2.1",
 *           "type": "performance",
 *           "CPU0::PAPI_FP_INS": 869,
 *           "CPU0::PAPI_TOT_CYC": 2188289,
 *           "CPU1::PAPI_FP_INS": 891,
 *           "CPU1::PAPI_TOT_CYC": 1214959,
 *           "CPU2::PAPI_FP_INS": 8126,
 *           ...
 *        },
 *        "max": {
 *           ...
 *        }
 *     }
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

function handle_response(req, res, next, index) {
    var client = req.app.get('elastic'),
      mf_server = req.app.get('mf_server') + '/dreamcloud/mf',
      workflowID = req.params.workflowID.toLowerCase(),
      filter = req.query.filter,
      metric = req.query.metric,
      from = req.query.from,
      to = req.query.to,
      body = aggregation_by(metric);

     if (!is_defined(metric)) {
        var error = {
            'error': {
                'message': 'parameter metric is missing'
            }
        };
        res.json(error);
        return;
    }

    if (is_defined(filter)) {
        if (filter.indexOf("==") >= 0) {
            var terms = filter.split("==");
            body = filter_and_aggregate_by(terms[0], terms[1], metric, from, to);
        } else {
            var error_message= {
                'error': {
                    'message': 'only the operator == is supported'
                }
            };
            res.json(error_message);
            return;
        }
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
        var answer = {},
          aggs = response.aggregations;

        answer.workflow = {};
        answer.workflow.href = mf_server + '/workflows/' + workflowID;
        answer.metric = metric;

        if (is_defined(filter)) {
            answer.filter = filter;
            aggs = aggs.filtered_stats;
        }
        answer.statistics = aggs[metric + '_Stats'];
        answer.min = aggs['Minimum_' + metric].hits.hits[0]._source;
        answer.max = aggs['Maximum_' + metric].hits.hits[0]._source;
        res.json(answer);
    });
}

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function filter_and_aggregate_by(term_key, term_filter, field_name, from, to) {
    return '{' +
        '"aggs": {' +
            '"filtered_stats": {' +
                '"filter": {' +
                    '"and": [' +
                        '{' +
                            '"term": {' +
                                '"' + term_key + '": "' + term_filter.toLowerCase() + '"' +
                            '}' +
                        '}' +
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
            ',{ ' +
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

function aggregation_by(field_name) {
    return '{' +
        '"aggs": {' +
            '"' + field_name + '_Stats" : {' +
                '"extended_stats" : {' +
                    '"field" : "' + field_name + '"' +
                '}' +
            '},' +
            '"Minimum_' + field_name + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + field_name + '": {' +
                                '"order": "asc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '},' +
            '"Maximum_' + field_name + '": {' +
                '"top_hits": {' +
                    '"size": 1,' +
                    '"sort": [' +
                        '{' +
                            '"' + field_name + '": {' +
                                '"order": "desc"' +
                            '}' +
                        '}' +
                    ']' +
                '}' +
            '}' +
        '}' +
    '}';
}

module.exports = router;
