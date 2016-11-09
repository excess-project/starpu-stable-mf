var server = require('../bin/test');

describe('server', function () {
  before(function () {
    server.listen(8000);
  });

  after(function () {
    server.close();
  });
});

var assert = require('assert'),
    http = require('http');

describe('/', function () {
  it('should return 200', function (done) {
    http.get('http://localhost:3030', function (res) {
      assert.equal(200, res.statusCode);
      done();
    });
  });
});
