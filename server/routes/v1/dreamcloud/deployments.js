var crypto = require('crypto');
var express = require('express');
var router = express.Router();

/**
 * @api {get} /deployments/:workflowID/:taskID/:platformID 3. Return available deployment plans
 * @apiVersion 1.0.0
 * @apiName GetDeployments
 * @apiGroup Deployment Plans
 *
 * @apiParam {String} workflowID identifier for a workflow, e.g. 'ms2'
 * @apiParam {String} taskID identifier for a task, e.g. 't2.1'
 * @apiParam {String} platformID identifier for a platform, e.g. 'excesscluster'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster
 *
 * @apiSuccess {String} deploymentPlanID identifier for a deployment plan
 * @apiSuccess {String} deploymentPlanID.href link to the actual deployment plan
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "cf8ba177b43e4a837c4c213f6a149ead4f1ec9ef2e976306a07711e88bf6c60c": {
 *          "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/cf8ba177b43e4a837c4c213f6a149ead4f1ec9ef2e976306a07711e88bf6c60c"
 *       },
 *       "e57d089e2cc396f04d277aa35c399b4a5af5b56f65682b4f4952dd7f334a2c15": {
 *          "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/e57d089e2cc396f04d277aa35c399b4a5af5b56f65682b4f4952dd7f334a2c15"
 *       },
 *       "d6d33f5097e23e55659aba9004dbeb257970926e3927a01c10ff431fe48555e9": {
 *          "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/d6d33f5097e23e55659aba9004dbeb257970926e3927a01c10ff431fe48555e9"
 *       },
 *       "79f2e72501da8a8bcff9d6cd711b44a0fe8174a751e897c51ef7a7d110b925d8": {
 *          "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/79f2e72501da8a8bcff9d6cd711b44a0fe8174a751e897c51ef7a7d110b925d8"
 *       },
 *       ..
 *     }
 *
 * @apiError NotFound No deployment plans available for the given combination of workflow, task, and platform
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "No deployment plans found for the given worklow, task, and platform."
 *     }
 */
router.get('/:workflow/:task/:platform', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflow.toLowerCase(),
      task = req.params.task.toLowerCase(),
      platform = req.params.platform.toLowerCase(),
      mf_server = req.app.get('mf_server'),
      expand = req.query.expand,
      size = 1000,
      json = {};

    client.search({
        index: 'deployment_on_' + platform,
        type: workflow + '_' + task,
        searchType: 'count'
    }, function(error, response) {
        if (response.hits !== undefined) {
            size = response.hits.total;
        }

        client.search({
            index: 'deployment_on_' + platform,
            type: workflow + '_' + task,
            size: size,
        }, function(error, response) {
            if (error) {
                var message = {};
                message.error = 'No deployment plans found for the given workflow, task, and platform.';
                res.status(404);
                return next(message);
            }
            var results = response.hits.hits;
            var keys = Object.keys(results);
            keys.forEach(function(key) {
                var next_deployment = {};
                if (!is_defined(expand)) {
                    next_deployment.href = mf_server + '/dreamcloud/mf/deployments/' +
                        workflow + '/' + task + '/' + platform + '/' + results[key]._id;
                } else {
                    next_deployment = results[key]._source;
                }
                json[results[key]._id] = next_deployment;
            });
            res.json(json);
        });
    });
});

/**
 * @api {get} /deployments/:workflowID/:taskID/:platformID/:deploymentPlanID 2. Return a given deployment plan
 * @apiVersion 1.0.0
 * @apiName GetExperiments
 * @apiGroup Deployment Plans
 *
 * @apiParam {String} workflowID identifier for a workflow, e.g. 'ms2'
 * @apiParam {String} taskID identifier for a task, e.g. 't2.1'
 * @apiParam {String} platformID identifier for a platform, e.g. 'excesscluster'
 * @apiParam {String} deploymentPlanID identifier for a deployment plan, e.g. 'cf8ba177b43e4a837c4c213f6a149ead4f1ec9ef2e976306a07711e88bf6c60c'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/cf8ba177b43e4a837c4c213f6a149ead4f1ec9ef2e976306a07711e88bf6c60c
 *
 * @apiSuccess {String} [estimatedTime] estimated time to finish
 * @apiSuccess {Object} [node] aggregates information for a node the task was deployed on
 * @apiSuccess {String} [node.id] identifier for the node
 * @apiSuccess {Array}  [node.cpus] array of CPU cores
 * @apiSuccess {Object} [node.cpus.id] identifier of the core
 * @apiSuccess {String} [node.cpus.pwMode] power mode of the CPU in percentage (100 equals full perfomance)
 * @apiSuccess {Object} [experiments] list of experiments
 * @apiSuccess {String} [experiments.experiment] identifier of the experiment that used this deployment plan
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "estimatedTime": 0,
 *       "node": {
 *         "id": "node02",
 *         "cpus": [
 *           {
 *             "id": "cpu0",
 *             "cores": [
 *               {
 *                 "id": "core0",
 *                 "pwMode": 100
 *               },
 *               {
 *                 "id": "core1",
 *                 "pwMode": 100
 *               }
 *             ]
 *           }
 *         ]
 *       },
 *       "experiments": {
 *         "AVXQa1RU0GMPeuCn4_2S": 1
 *       }
 *     }
 *
 * @apiError NotFound No deployment plans available for the given combination of workflow, task, and platform
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": "Deployment plan unavailable."
 *     }
 */
router.get('/:workflow/:task/:platform/:deployment', function(req, res, next) {
    var client = req.app.get('elastic'),
      workflow = req.params.workflow.toLowerCase(),
      task = req.params.task.toLowerCase(),
      platform = req.params.platform.toLowerCase(),
      deployment = req.params.deployment,
      json = {};

    client.get({
        index: 'deployment_on_' + platform,
        type: workflow + '_' + task,
        id: deployment
    }, function(error, response) {
        if (error) {
            var message = {};
            message.error = 'Deployment plan unavailable.';
            res.status(404);
            return next(message);
        }
        if (response.found) {
            json = response._source;
        } else {
            json = 'Deployment plan unavailable.';
        }
        res.json(json);
    });
});

/**
 * @api {put} /deployments/:workflowID/:taskID/:platformID/:experimentID 1. Add a new deployment plan
 * @apiVersion 1.0.0
 * @apiName PutDeployments
 * @apiGroup Deployment Plans
 *
 * @apiParam {String} workflowID identifier for a workflow, e.g. 'ms2'
 * @apiParam {String} taskID identifier for a task, e.g. 't2.1'
 * @apiParam {String} platformID identifier for a platform, e.g. 'excesscluster'
 * @apiParam {String} experimentID identifier of an experiment, e.g. 'AVX123A3asd_S'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/excesscluster/AVX123A3asd_S
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "estimatedTime":217,
 *       "node":{
 *         "id":"node01",
 *         "cpus":[
 *           {
 *             "id":"cpu0",
 *             "cores":[
 *               {
 *                 "id":"core0",
 *                 "pwMode":100
 *               },
 *               {
 *                 "id":"core1",
 *                 "pwMode":100
 *               },
 *               {
 *                 "id":"core2",
 *                 "pwMode":100
 *               },
 *               {
 *                 "id":"core3",
 *                 "pwMode":100
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *     }
 *
 * @apiParam (body) {String} [estimatedTime] estimated time to finish
 * @apiParam (body) {Object} [node] aggregates information for a node the task was deployed on
 * @apiParam (body) {String} [node.id] identifier for the node
 * @apiParam (body) {Array}  [node.cpus] array of CPU cores
 * @apiParam (body) {Object} [node.cpus.id] identifier of the core
 * @apiParam (body) {String} [node.cpus.pwMode] power mode of the CPU in percentage (100 equals full perfomance)
 * @apiParam (body) {Object} [experiments] list of experiments
 *
 * @apiSuccess {String} deploymentPlanID identifier for a deployment plan
 * @apiSuccess {String} deploymentPlanID.href link to the actual deployment plan
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "deployment_id": "da117e8171ae58b935a02a9768c21ce96ffd5f6e"
 *       "predicted_time": 2017
 *       "href": "http://mf.excess-project.eu:3030/v1/dreamcloud/mf/deployments/ms2/t2.1/test_cluster/da117e8171ae58b935a02a9768c21ce96ffd5f6e"
 *      }
 *
 * @apiError DatabaseError Could not store given deployment plan.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Could not store given deployment plan."
 *     }
 */
router.put('/:workflow/:task/:platform/:experiment', function(req, res, next) {
    var workflow = req.params.workflow.toLowerCase(),
      task = req.params.task.toLowerCase(),
      platform = req.params.platform.toLowerCase(),
      experiment = req.params.experiment, /* we keep the original case */
      mf_server = req.app.get('mf_server'),
      client = req.app.get('elastic'),
      hashvalue = '',
      json = {};

    /* generate hash for the request body */
    if (is_defined(req.body)) {
        var hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(req.body));
        hashvalue = hash.digest('hex');
    } else {
        res.json("body is missing");
        return;
    }

    client.exists({
        index: 'deployment_on_' + platform,
        type: workflow + '_' + task,
        id: hashvalue
    }, function(error, exists) {
        if (exists === true) {
            client.get({
                index: 'deployment_on_' + platform,
                type: workflow + '_' + task,
                id: hashvalue
            }, function(error, response) {
                /* add experiment to source.experiments array */
                var source = response._source;
                var experiments = source.experiments;
                experiments = ( typeof experiments != 'undefined' &&
                                experiments instanceof Object ) ? experiments : {};
                experiments[experiment] = 1;
                source.experiments = experiments;
                /* update document */
                client.index({
                    index: 'deployment_on_' + platform,
                    type: workflow + '_' + task,
                    id: hashvalue,
                    body: source
                },function(error, response) {
                    if (error) {
                        res.status(500);
                        return next(error);
                    }
                    json.deployment_id = hashvalue;
                    json.predicted_time = source.estimatedTime;
                    json.href = mf_server + '/dreamcloud/mf/deployments/' +
                        workflow + '/' + task + '/' + platform + '/' + hashvalue;
                    res.json(json);
                });
            });
        } else { /* index new deployment plan */
            var source = req.body;
            source.experiments = {};
            source.experiments[experiment] = 1;
            client.index({
                index: 'deployment_on_' + platform,
                type: workflow + '_' + task,
                id: hashvalue,
                body: source
            },function(error, response) {
                if (error) {
                    var message = {};
                    message.error = 'Could not store given deployment plan.';
                    res.status(500);
                    return next(message);
                }
                json.deployment_id = hashvalue;
                json.predicted_time = source.estimatedTime;
                json.href = mf_server + '/dreamcloud/mf/deployments/' +
                    workflow + '/' + task + '/' + platform + '/' + hashvalue;
                res.json(json);
            });
        }
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

module.exports = router;
