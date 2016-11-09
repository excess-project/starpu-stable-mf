var express = require('express');
var router = express.Router();
var async = require('async');
var dateFormat = require('dateformat');

router.get('/', function(req, res, next) {
    res.redirect('/v1/dreamcloud/mf/workflows?users');
});

router.get('/:id', function(req, res, next) {
    res.redirect('/v1/dreamcloud/mf/workflows/' + req.params.id + '?users');
});

/**
 * @api {put} /users/:userID 1. Registers a new user
 * @apiVersion 1.0.0
 * @apiName PutUsers
 * @apiGroup Users
 *
 * @apiParam {String} userID identifier for a user, e.g. 'excess'
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "name": "Fangli Pi",
 *       "affiliation": "HLRS",
 *       "applications": [
 *          "avx"
 *       ]
 *     }
 *
 * @apiParam {String} [name] name of the user
 * @apiParam {String} [affiliation] affiliation of the user
 * @apiParam {Array}  [applications] list of applications to be monitored
 *
 * @apiSuccess {String} href link to the data stored for the given user
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          "href":"http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix"
 *     }
 *
 * @apiError DatabaseError The given user could not be registered at the database
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "error": "Resource could not be stored."
 *     }
 */
router.put('/:id', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        mf_server = req.app.get('mf_server') + '/mf',
        client = req.app.get('elastic');

    client.index({
        index: 'mf',
        type: 'workflows',
        id: id,
        body: req.body
    }, function(error, response) {
        if (error) {
            var message = 'Resource could not be stored.';
            console.log(error);
            res.status(500);
            return next(message);
        }
        var json = {};
        json.href = mf_server + '/users/' + id;
        res.json(json);
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

/**
 * @api {post} /users/:userID/create 2. Create a user and an associated experiment
 * @apiVersion 1.0.0
 * @apiName PostUsers
 * @apiGroup Users
 *
 * @apiParam {String} userID identifier for a user, e.g. 'excess'
 * @apiSuccess {String} experimentID unique identifier generated for the experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix/create
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     
 *          AVX9O-3oz5chEwIt8_M9
 *     
 *
 */
router.post('/:id/create', function(req, res, next) {
    var id = req.params.id.toLowerCase(),
        client = req.app.get('elastic');

    var data = req.body;
    if (data.application) {
        data.application = data.application.replace(' ', '_');
    }
    var experiment_id;

    var created_on = {};
    var now = new Date();
    now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
    created_on.created_on = now;

    if (!is_defined(data['@timestamp'])) {
        data['@timestamp'] = now;
    }

    async.series([
        /* (1) register workflow, if not exists yet */
        function(series_callback) {
            client.index({
                index: 'mf',
                type: 'workflows',
                id: id,
                body: created_on
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }

                series_callback(null);
            });
        },
        /* (2) create experiment ID on the fly */
        function(series_callback) {
            client.index({
                index: 'mf',
                type: 'experiments',
                parent: id,
                body: data
            }, function(error, response) {
                if (error) {
                    res.json(error);
                } else {
                    experiment_id = response._id;
                    series_callback(null);
                }
            });
        },
    ], function(error) {
        if (error) {
            res.status(500);
            return next(error);
        }
        res.send(experiment_id);
    });
});

/**
 * @api {post} /users/:userID/:experimentID/create 3. Create a user and an associated experiment with given experiment ID
 * @apiVersion 1.0.0
 * @apiName PostUserExperiment
 * @apiGroup Users
 *
 * @apiParam {String} userID identifier for a user, e.g. 'excess'
 * @apiParam {String} experimentID identifier given for the experiment
 * @apiSuccess {String} experimentID identifier given for the experiment
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://mf.excess-project.eu:3030/v1/mf/users/hpcfapix/AVX9O-3oz5chEwIt8_M9/create
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     
 *          AVX9O-3oz5chEwIt8_M9
 *     
 *
 */
router.post('/:uid/:eid/create', function(req, res, next) {
    var uid = req.params.uid.toLowerCase(),
        eid = req.params.eid,
        client = req.app.get('elastic');

    var data = req.body;
    if (data.application) {
        data.application = data.application.replace(' ', '_');
    }
    var experiment_id;

    var created_on = {};
    var now = new Date();
    now = dateFormat(now, "yyyy-mm-dd'T'HH:MM:ss");
    created_on.created_on = now;

    if (!is_defined(data['@timestamp'])) {
        data['@timestamp'] = now;
    }

    async.series([
        /* (1) register workflow, if not exists yet */
        function(series_callback) {
            client.index({
                index: 'mf',
                type: 'workflows',
                id: uid,
                body: created_on
            }, function(error, response) {
                if (error) {
                    return series_callback(error);
                }

                series_callback(null);
            });
        },
        /* (2) create experiment ID on the fly */
        function(series_callback) {
            client.exists({
                index: 'mf',
                type: 'experiments',
                id: eid,
                routing: uid
            }, function (error, exists) {
                if (exists === true) {
                    experiment_id = eid;
                    series_callback(null);
                } else {
                    client.index({
                        index: 'mf',
                        type: 'experiments',
                        parent: uid,
                        id: eid,
                        body: data
                    }, function(error, response){
                        if(error) {
                            res.json(error);
                        } else {
                            experiment_id = response._id;
                            series_callback(null);
                        }
                    });
                }
            });
        }
    ], function(error) {
        if (error) {
            res.status(500);
            return next(error);
        }
        res.send(experiment_id);
    });
});

module.exports = router;
