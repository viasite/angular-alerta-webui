'use strict';

/* Controllers */

var alertaControllers = angular.module('alertaControllers', []);

alertaControllers.controller('MenuController', ['$scope', '$location', '$auth', 'config',
  function($scope, $location, $auth, config) {

    if ($auth.isAuthenticated()) {
      $scope.name = $auth.getPayload().name;
    };

    $scope.$on('login:name', function(evt, name) {
      $scope.name = name;
    });

    $scope.isActive = function (viewLocation) {
        return viewLocation === $location.path();
    };

    $scope.isAuthenticated = function() {
      return $auth.isAuthenticated();
    };

    $scope.authenticate = function() {
      if (config.provider == 'basic') {
        $location.path('/login');
      } else {
        $auth.authenticate(config.provider)
          .then(function() {
            $scope.name = $auth.getPayload().name;
          })
          .catch(function(e) {
            alert(JSON.stringify(e));
          });
        }
    };

  }]);

alertaControllers.controller('AlertListController', ['$scope', '$location', '$timeout', 'Count', 'Environment', 'Service', 'Alert',
  function($scope, $location, $timeout, Count, Environment, Service, Alert){

    $scope.autoRefresh = true;
    $scope.refreshText = 'Auto Update';

    var search = $location.search();
    if (search.environment) {
      $scope.environment = search.environment;
    }
    if (search.service) {
      $scope.service = search.service;
    }
    if (search.status) {
      $scope.status = search.status;
    } else {
      $scope.status = 'open';
    }

    $scope.show = [
      {name: 'Open', status: 'open'},
      {name: 'Active', status: ['open', 'ack', 'assign']},
      {name: 'Closed', status: 'closed'}
    ]

    $scope.alerts = [];
    $scope.alertLimit = 20;
    $scope.reverse = true;
    $scope.query = {};

    $scope.setService = function(service) {
      $scope.service = service;
      updateQuery();
      refresh();
    };

    $scope.setEnv = function(environment) {
      $scope.environment = environment;
      updateQuery();
      refresh();
    };

    $scope.setStatus = function(status) {
      $scope.status = status;
      updateQuery();
      refresh();
    };

    $scope.refresh = function() {
      refresh();
    };

    var updateQuery = function() {
      if ($scope.service) {
        $scope.query['service'] = $scope.service
      } else {
        delete $scope.query['service'];
      }
      if ($scope.environment) {
        $scope.query['environment'] = $scope.environment
      } else {
        delete $scope.query['environment'];
      }
      if ($scope.status) {
        $scope.query['status'] = $scope.status;
      } else {
        delete $scope.query['status'];
      }
      $location.search($scope.query);
    };

    var refresh = function() {
      $scope.refreshText = 'Refreshing...';
      Count.query({status: $scope.status}, function(response) {
        $scope.total = response.total;
        $scope.statusCounts = response.statusCounts;
      });
      Service.all({status: $scope.status}, function(response) {
        $scope.services = response.services;
      });
      Environment.all({status: $scope.status}, function(response) {
        $scope.environments = response.environments;
      });
      updateQuery();
      Alert.query($scope.query, function(response) {
        if (response.status == 'ok') {
          $scope.alerts = response.alerts;
        }
        $scope.message = response.status + ' - ' + response.message;
        $scope.autoRefresh = response.autoRefresh;
        if ($scope.autoRefresh) {
          $scope.refreshText = 'Auto Update';
        } else {
          $scope.refreshText = 'Refresh';
        }
      });
    };
    var refreshWithTimeout = function() {
      if ($scope.autoRefresh) {
        refresh();
      }
      timer = $timeout(refreshWithTimeout, 5000);
    };
    var timer = $timeout(refreshWithTimeout, 200);

    $scope.$on('$destroy', function() {
      if (timer) {
        $timeout.cancel(timer);
      }
    });

    var SEVERITY_MAP = {
        'critical': 1,
        'major': 2,
        'minor': 3,
        'warning': 4,
        'indeterminate': 5,
        'cleared': 5,
        'normal': 5,
        'informational': 6,
        'debug': 7,
        'auth': 8,
        'unknown': 9
    };

    $scope.reverseSeverityCode = function(alert) {
      return -SEVERITY_MAP[alert.severity];
    };

    $scope.severityCode = function(alert) {
      return SEVERITY_MAP[alert.severity];
    };

  }]);

alertaControllers.controller('AlertDetailController', ['$scope', '$route', '$routeParams', '$location', '$auth', 'Alert',
  function($scope, $route, $routeParams, $location, $auth, Alert){

    if ($auth.isAuthenticated()) {
      $scope.user = $auth.getPayload().name;
     } else {
       $scope.user = undefined;
     };

    $scope.isAuthenticated = function() {
      return $auth.isAuthenticated();
    };

    Alert.get({id: $routeParams.id}, function(response) {
      $scope.alert = response.alert;
    });

    $scope.openAlert = function(id) {
      Alert.status({id: id}, {status: 'open', text: 'status change via console'}, function(data) {
        $route.reload();
      });
    };

    $scope.tagAlert = function(id, tags) {
      Alert.tag({id: id}, {tags: tags}, function(data) {
        $route.reload();
      });
    };

    $scope.watchAlert = function(id, user) {
      Alert.tag({id: id}, {tags: ['watch:' + user]}, function(data) {
        $route.reload();
      });
    };

    $scope.unwatchAlert = function(id, user) {
      Alert.untag({id: id}, {tags: ['watch:' + user]}, function(data) {
        $route.reload();
      });
    };

    $scope.ackAlert = function(id) {
      Alert.status({id: id}, {status: 'ack', text: 'status change via console'}, function(data) {
        $route.reload();
      });
    };

    $scope.closeAlert = function(id) {
      Alert.status({id: id}, {status: 'closed', text: 'status change via console'}, function(data) {
        $route.reload();
      });
    };

    $scope.deleteAlert = function(id) {
      Alert.delete({id: id}, {}, function(data) {
        $location.path('/');
      });
    };

    $scope.tagged = function(tags, tagged) {
      angular.forEach(tags, function(tag) {
        if (tag == tagged) {
          return true;
        };
        return false;
      });
    };

  }]);

alertaControllers.controller('AlertTop10Controller', ['$scope', '$location', '$timeout', 'Count', 'Environment', 'Service', 'Alert',
  function($scope, $location, $timeout, Count, Environment, Service, Alert){

    var search = $location.search();
    if (search.environment) {
      $scope.environment = search.environment;
    }
    if (search.service) {
      $scope.service = search.service;
    }
    if (search.status) {
      $scope.status = search.status;
    } else {
      $scope.status = 'open';
    }

    $scope.show = [
      {name: 'Open', status: 'open'},
      {name: 'Active', status: ['open', 'ack', 'assign']},
      {name: 'Closed', status: 'closed'}
    ]

    $scope.top10 = [];
    $scope.query = {};

    $scope.setService = function(service) {
      $scope.service = service;
      updateQuery();
      refresh();
    };

    $scope.setEnv = function(environment) {
      $scope.environment = environment;
      updateQuery();
      refresh();
    };

    $scope.setStatus = function(status) {
      $scope.status = status;
      updateQuery();
      refresh();
    };

    $scope.refresh = function() {
      refresh();
    };

    var updateQuery = function() {
      if ($scope.service) {
        $scope.query['service'] = $scope.service
      } else {
        delete $scope.query['service'];
      }
      if ($scope.environment) {
        $scope.query['environment'] = $scope.environment
      } else {
        delete $scope.query['environment'];
      }
      if ($scope.status) {
        $scope.query['status'] = $scope.status;
      } else {
        delete $scope.query['status'];
      }
      $location.search($scope.query);
    };

    var refresh = function() {
      Count.query({status: $scope.status}, function(response) {
        $scope.total = response.total;
        $scope.statusCounts = response.statusCounts;
      });
      Service.all({status: $scope.status}, function(response) {
        $scope.services = response.services;
      });
      Environment.all({status: $scope.status}, function(response) {
        $scope.environments = response.environments;
      });
      updateQuery();
      Alert.top10($scope.query, function(response) {
        if (response.status == 'ok') {
          $scope.top10 = response.top10;
        }
        $scope.message = response.status + ' - ' + response.message;
      });
      timer = $timeout(refresh, 5000);
    };
    var timer = $timeout(refresh, 200);

    $scope.$on('$destroy', function() {
      if (timer) {
        $timeout.cancel(timer);
      }
    });

  }]);

alertaControllers.controller('AlertWatchController', ['$scope', '$timeout', '$auth', 'Alert',
  function($scope, $timeout, $auth, Alert){

    $scope.watches = [];

    var refresh = function() {
      Alert.query({'tags': 'watch:' + $auth.getPayload().name}, function(response) {
        if (response.status == 'ok') {
          $scope.watches = response.alerts;
        }
        $scope.message = response.status + ' - ' + response.message;
      });
      timer = $timeout(refresh, 5000);
    };
    var timer = $timeout(refresh, 200);

    $scope.$on('$destroy', function() {
      if (timer) {
        $timeout.cancel(timer);
      }
    });

  }]);

alertaControllers.controller('AlertLinkController', ['$scope', '$location',
  function($scope, $location) {

    $scope.getDetails = function(alert) {
      $location.url('/alert/' + alert.id);
    };
  }]);

alertaControllers.controller('UserController', ['$scope', '$route', '$timeout', '$auth', 'config', 'Users',
  function($scope, $route, $timeout, $auth, config, Users) {

    $scope.domains = [];
    $scope.users = [];
    $scope.login = '';
    $scope.provider = config.provider;

    switch (config.provider) {
      case "google":
        $scope.placeholder = "Google Email";
        break;
      case "github":
        $scope.placeholder = "GitHub username";
        break;
      case "twitter":
        $scope.placeholder = "Twitter username";
        break;
      default:
        $scope.placeholder = "Email";
    }

    $scope.createUser = function(name, login, password) {
      Users.save({}, {name: name, login: login, password: password, provider: config.provider, text: 'Added by '+$auth.getPayload().name}, function(data) {
        $route.reload();
      });
    };

    $scope.deleteUser = function(user) {
      Users.delete({user: user}, {}, function(data) {
        $route.reload();
      });
    };

    Users.query(function(response) {
      $scope.domains = response.domains;
      $scope.orgs = response.orgs;
      $scope.users = response.users;
    });

  }]);

alertaControllers.controller('ApiKeyController', ['$scope', '$route', '$timeout', '$auth', 'Keys',
  function($scope, $route, $timeout, $auth, Keys) {

    $scope.keys = [];
    $scope.type = 'read-only';
    $scope.text = '';

    $scope.types = ['read-only', 'read-write'];

    $scope.createKey = function(type, text) {
      Keys.save({}, {user: $auth.getPayload().login, type: type, text: text}, function(data) {
        $route.reload();
      });
    };

    $scope.deleteKey = function(key) {
      Keys.delete({key: key}, {}, function(data) {
        $route.reload();
      });
    };

    Keys.query({user: $auth.getPayload().login}, function(response) {
      $scope.keys = response.keys;
    });

  }]);

alertaControllers.controller('ProfileController', ['$scope', '$auth',
  function($scope, $auth) {

    $scope.user_id = $auth.getPayload().sub;
    $scope.name = $auth.getPayload().name;
    $scope.login = $auth.getPayload().login;
    $scope.provider = $auth.getPayload().provider;

    $scope.token = $auth.getToken();
    $scope.payload = $auth.getPayload();
  }]);

alertaControllers.controller('AboutController', ['$scope', '$timeout', 'Management', 'Heartbeat',
  function($scope, $timeout, Management, Heartbeat) {

    Management.manifest(function(response) {
      $scope.manifest = response;
    });

    $scope.metrics = [];
    $scope.heartbeats = [];

    var refresh = function() {
      Management.status(function(response) {
        $scope.metrics = response.metrics;
        $scope.lastTime = response.time;
        $scope.uptime = response.uptime;
      });
      Heartbeat.query(function(response) {
        $scope.heartbeats = response.heartbeats;
      });
      timer = $timeout(refresh, 10000);
    };
    var timer = $timeout(refresh, 200);

    $scope.$on('$destroy', function() {
      if (timer) {
        $timeout.cancel(timer);
      }
    });

  }]);

alertaControllers.controller('LoginController', ['$scope', '$rootScope', '$auth', 'config',
 function($scope, $rootScope, $auth, config) {

    $scope.provider = config.provider;

    $scope.login = function(email, password) {
      $auth.login({
        email: $scope.email,
        password: $scope.password
      })
        .then(function() {
          $rootScope.$broadcast('login:name', $auth.getPayload().name);
        })
        .catch(function(e) {
          console.log(e);
          if (e.status == 403) {
            $scope.error = "Incorrect username or password.";
          };
        });
    };

    $scope.authenticate = function(provider) {
      $auth.authenticate(provider)
        .then(function() {
          console.log('You have successfully logged in');
        })
        .catch(function(e) {
          console.log(e);
          $scope.error = e.statusText;
        });
    };
  }]);

alertaControllers.controller('SignupController', ['$scope', '$rootScope', '$auth', 'config',
 function($scope, $rootScope, $auth, config) {

    $scope.provider = config.provider;

    $scope.signup = function(name, email, password, text) {
        $auth.signup({
          name: $scope.name,
          email: $scope.email,
          password: $scope.password,
          text: $scope.text
        })
          .then(function() {
            $rootScope.$broadcast('login:name', $auth.getPayload().name);
          })
          .catch(function(e) {
            console.log(e);
            $scope.error = e.statusText;
          });
      };

    $scope.authenticate = function(provider) {
      $auth.authenticate(provider)
        .then(function() {
          console.log('You have successfully logged in');
        })
        .catch(function(e) {
          console.log(e);
          $scope.error = e.statusText;
        });
    };
  }]);

  alertaControllers.controller('LogoutController', ['$auth',
    function($auth) {
    if (!$auth.isAuthenticated()) {
        return;
    }
    $auth.logout()
      .then(function() {
        console.log('You have been logged out');
      });
  }]);
