var express = require('express');
var dateFormat = require('dateformat');
var router = express.Router();

/* return the current servertime */
router.get('/', function(req, res, next) {
    var json = {};
    json.current_time = dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss");
    res.json(json);
});

module.exports = router;
