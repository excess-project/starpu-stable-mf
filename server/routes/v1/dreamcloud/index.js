var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    var json = {};
    json.message = 'ATOM API service is up and running.';
    json.version = req.app.get('version');
    res.json(json);
});

module.exports = router;
