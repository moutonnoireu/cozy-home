// Generated by CoffeeScript 1.6.2
var fs, https, url;

fs = require('fs');

https = require('https');

url = require('url');

exports.PermissionsManager = (function() {
  function PermissionsManager() {
    this.docTypes = {};
  }

  PermissionsManager.prototype.get = function(app, callback) {
    var config, options, path, request,
      _this = this;

    path = app.git.substring(19, app.git.length - 4);
    path = "https://raw.github.com/" + path + '/master/package.json';
    options = {
      host: url.parse(path).host,
      path: url.parse(path).path
    };
    config = "";
    request = https.get(options, function(response) {
      if (response.headers.status !== "404 Not Found") {
        return response.on('data', function(data) {
          return config = JSON.parse(data);
        }).on('end', function() {
          if (config["cozy-permissions"] != null) {
            _this.docTypes = config["cozy-permissions"];
          }
          return callback(null, _this.docTypes);
        });
      } else {
        return callback(null, {});
      }
    });
    return request.on('error', function(error) {
      return callback(null, {});
    });
  };

  return PermissionsManager;

})();
