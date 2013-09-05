// Generated by CoffeeScript 1.6.2
var Alarm, AlarmManager, AppManager, Application, Notification, NotificationsHelper, RealtimeAdapter, User, americano, applicationTimeout, client, haibuClient, mark_broken, notifhelper, port, request, resetProxy, resetRoutes, stop_app, updateApps;

americano = require('americano');

request = require('request-json');

NotificationsHelper = require('cozy-notifications-helper');

RealtimeAdapter = require('cozy-realtime-adapter');

AppManager = require("./server/lib/paas").AppManager;

AlarmManager = require('./server/lib/alarm_manager');

User = require('./server/models/user');

Alarm = require('./server/models/alarm');

Application = require('./server/models/application');

Notification = require('./server/models/notification');

client = request.newClient('http://localhost:9104/');

haibuClient = request.newClient('http://localhost:9002/');

resetRoutes = function() {
  return Application.all(function(err, installedApps) {
    var appDict, installedApp, _i, _len;

    appDict = {};
    if (installedApps !== void 0) {
      for (_i = 0, _len = installedApps.length; _i < _len; _i++) {
        installedApp = installedApps[_i];
        if (installedApp.name !== "") {
          appDict[installedApp.name] = installedApp;
        } else {
          installedApp.destroy();
        }
      }
    }
    return haibuClient.get('drones/running', function(err, res, apps) {
      return updateApps(apps, appDict, resetProxy);
    });
  });
};

updateApps = function(apps, appDict, callback) {
  var app, installedApp;

  if ((apps != null) && apps.length > 0) {
    app = apps.pop();
    installedApp = appDict[app.name];
    if ((installedApp != null) && installedApp.port !== app.port) {
      return installedApp.updateAttributes({
        port: app.port
      }, function(err) {
        return updateApps(apps, appDict, callback);
      });
    } else {
      return updateApps(apps, appDict, callback);
    }
  } else {
    return callback();
  }
};

resetProxy = function() {
  return client.get('routes/reset/', function(err, res, body) {
    if ((res != null) && res.statusCode === 200) {
      return console.info('Proxy successfuly reseted.');
    } else {
      return console.info('Something went wrong while reseting proxy.');
    }
  });
};

if (process.env.NODE_ENV !== "test") {
  resetRoutes();
}

process.on('uncaughtException', function(err) {
  console.error(err);
  return console.error(err.stack);
});

mark_broken = function(app, err) {
  app.state = "broken";
  app.password = null;
  app.errormsg = err.message;
  return app.save(function(saveErr) {
    if (saveErr) {
      return send_error(saveErr);
    }
  });
};

stop_app = function(app) {
  var manager,
    _this = this;

  manager = new AppManager;
  return manager.stop(app, function(err, result) {
    var data;

    if (err) {
      return mark_broken(app, err);
    }
    data = {
      state: "stopped",
      port: 0
    };
    return app.updateAttributes(data, function(err) {
      if (err) {
        return send_error(err);
      }
      return manager.resetProxy(function(err) {
        if (err) {
          return mark_broken(app, err);
        }
      });
    });
  });
};

applicationTimeout = [];

notifhelper = new NotificationsHelper('home');

port = process.env.PORT || 9103;

americano.start({
  name: 'Cozy Home',
  port: port
}, function(app, server) {
  var realtime;

  app.server = server;
  realtime = RealtimeAdapter(app, ['notification.*', 'application.*']);
  app.param('slug', require('./server/controllers/applications').loadApplication);
  realtime.on('application.update', function(event, id) {
    return Application.find(id, function(err, app) {
      if (err) {
        return console.log(err.stack);
      }
      switch (app.state) {
        case 'broken':
          return notifhelper.createTemporary({
            text: "" + app.name + "'s installation failled.",
            resource: {
              app: 'home'
            }
          });
      }
    });
  });
  realtime.on('usage.application', function(event, name) {
    if (applicationTimeout[name] != null) {
      clearTimeout(applicationTimeout[name]);
    }
    return applicationTimeout[name] = setTimeout(function() {
      console.log("stop : " + name);
      if (name !== "home" && name !== "proxy") {
        return Application.all(function(err, apps) {
          var _i, _len, _results;

          _results = [];
          for (_i = 0, _len = apps.length; _i < _len; _i++) {
            app = apps[_i];
            if (app.name === name && app.isStoppable) {
              _results.push(stop_app(app));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        });
      }
    }, 15000);
  });
  User.all(function(err, users) {
    var alarmManager, timezone;

    if ((err != null) || users.length === 0) {
      return console.info("Internal server error. Can't retrieve users or no user exists.");
    } else {
      timezone = users[0].timezone;
      alarmManager = new AlarmManager(timezone, Alarm, notifhelper);
      app.alarmManager = alarmManager;
      return realtime.on('alarm.*', alarmManager.handleAlarm);
    }
  });
  return setInterval(function() {
    return console.log(process.memoryUsage());
  }, 5000);
});
