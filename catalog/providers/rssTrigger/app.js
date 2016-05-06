'use strict';
/*
   'use strict' is not required but helpful for turning syntactical errors into true errors in the program flow
   http://www.w3schools.com/js/js_strict.asp
   */
var logger = require('./Logger');
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var parser = require('node-feedparser');

var app = express();
app.use(bodyParser.json());

var triggers = {};

// Five minutes
var POLLING_TIME = 1000 * 60 * 5;

var cloudantUsername = process.env.CLOUDANT_USERNAME;
var cloudantPassword = process.env.CLOUDANT_PASSWORD;
var cloudantDbPrefix = process.env.DB_PREFIX;
var cloudantDatabase = cloudantDbPrefix + 'rssservice';
var cloudantURI = 'https://' + cloudantUsername + ':' + cloudantPassword + '@' +
  cloudantUsername + '.cloudant.com';

var nano = require('nano')(cloudantURI);
nano.db.create(cloudantDatabase);

var db = nano.db.use(cloudantDatabase);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// standard RAS endpoints
app.get('/ping', function pong(req, res) {
  res.send({msg: 'pong'});
});

app.post('/triggers', authorize, function(req, res) {
  var method = 'POST /triggers';
  var triggerParams = req.body;
  logger.info('??', method, 'Got triggerParams', triggerParams);

  // Early exits. TODO Should we bother here, or do it in rss.js?
  if (!triggerParams.namespace)
    return sendError(method, 400, 'No namespace provided', res);
  if (!triggerParams.name)
    return sendError(method, 400, 'No name provided', res);
  if (!triggerParams.rss_feed)
    return sendError(method, 400, 'No rss_feed provided', res);

  triggerParams.apikey = req.user.uuid + ':' + req.user.key;

  var triggerID = createTrigger(triggerParams);
  db.insert(triggerParams, triggerID, function (err) {
    if (!err) {
      res.status(200).json({ok: 'Your trigger was created successfully.'});
    }
  });
});

function checkFeedUpdated(triggerID) {
  //TODO
  //NOTE: If trigger gets deleted through cloudant and not whisk, we are still checking because we have
  //a reference to it
  //Curl feed.
  //If new items, fire trigger.
  //Set timeout for next feed check
  var method = 'checkFeedUpdated';
  var trigger = triggers[triggerID];
  var timeNow = Date.now();

  logger.info(triggerID, method, 'checkFeedUpdated trigger', {
    apikey: trigger.apikey,
    name: trigger.name,
    namespace: trigger.namespace,
  });

  // req checks the link trigger.rss_feed, passes it to feedparser for parsing
  request(trigger.rss_feed, function(err, res, body) {
    parser(body, function (error, ret) {
      logger.info(triggerID, method, 'Parsing rss');
      if (!error) {
        var lastBuildTime;
        // TODO I was using https://github.com/danmactough/node-feedparser, but
        // was having issues. Using a stream wasn't working - it wouldn't read
        // past the first item, but it worked running locally (and not through
        // Whisk). I switched to https://github.com/BiteBit/node-feedparser

        // Check to see if we should update
        lastBuildTime = ret.site && ret.site.date ?
          new Date(ret.site.date).getTime() : NaN;

        if (!isNaN(lastBuildTime) && trigger.lastChecked > lastBuildTime) {
          // The meta object says this feed has not been updated since
          // the last time we checked
          logger.info(triggerID, method,
              'trigger.lastChecked > lastBuildTime, not firing trigger');
        } else {
          fireTrigger(triggerID, ret);
        }

        // Update our trigger
        trigger.lastChecked = timeNow;
        return;
      }
    });
  });
}

function createTrigger(triggerParams) {
  var method = 'createTrigger';

  var triggerID = getTriggerIdentifier(
    triggerParams.apikey,
    triggerParams.namespace,
    triggerParams.name
  );

  var trigger = {
    apikey: triggerParams.apikey,
    name: triggerParams.name,
    namespace: triggerParams.namespace,
    rss_feed: triggerParams.rss_feed,
    lastChecked: Number.MIN_SAFE_INTEGER // The time we last checked the RSS feed
  };

  triggers[triggerID] = trigger;
  logger.info(triggerID, method, 'Created trigger', trigger);
  checkFeedUpdated(triggerID);

  trigger.intervalID = setInterval(function () {
    checkFeedUpdated(triggerID);
  }, POLLING_TIME);
  return triggerID;
}

function fireTrigger(triggerID, feedAsJson) {
  var method = 'fireTrigger';
  var trigger = triggers[triggerID];
  if (!trigger)
    return;
  var namespace = trigger.namespace;
  var name = trigger.name;

  var apikey = trigger.apikey;


  var routerHost = process.env.ROUTER_HOST;
  var host = 'https://' + routerHost + ':443';
  var keyParts = apikey.split(':');

  // Fire trigger
  logger.info(triggerID, method, 'did fire trigger', triggerID);
  request({
    method: 'POST',
    uri: host + '/api/v1/namespaces/' + namespace + '/triggers/' + name,
    json: feedAsJson,
    auth: {
      user: keyParts[0],
      pass: keyParts[1]
    },
    pool: false
  }, function(/*err, res*/) {
  });
}

app.delete('/triggers/:namespace/:name', authorize, function(req, res) {
  var triggerID = getTriggerIdentifier(
    req.user.uuid + ':' + req.user.key,
    req.params.namespace,
    req.params.name
  );

  var success = deleteTrigger(triggerID);

  if (success) {
    res.status(200).json({
      ok: 'trigger ' + req.params.name + ' successfully deleted'
    });
  }
  else {
    res.status(404).json({
      error: 'trigger ' + req.params.name + ' not found'
    });
  }
});

function deleteTrigger(triggerID) {
  var method = 'deleteTrigger';

  if (triggers[triggerID]) {
    if (triggers[triggerID].intervalID) {
      clearInterval(triggers[triggerID].intervalID);
    }
    delete triggers[triggerID];

    logger.info(triggerID, method, 'successfully deleted');

    db.get(triggerID, function(err, body) {
      if (!err) {
        db.destroy(body._id, body._rev, function(err) {
          if (err)
            logger.error( triggerID, method, 'Error deleting from database');
        });
      }
      else {
        logger.error( triggerID, method, 'Error deleting from database');
      }
    });
    return true;
  }
  else {
    logger.info(triggerID, method, triggerID + 'could not be found');
    return false;
  }
}

function getTriggerIdentifier(apikey, namespace, name) {
  return apikey + '/' + namespace + '/' + name;
}

function resetSystem() {
  var method = 'resetSystem';
  logger.info('??', method, 'resetting system from last state');
  db.list({include_docs: true}, function(err, body) {
    if(!err) {
      body.rows.forEach(function(trigger) {
        createTrigger(trigger.doc);
      });
    }
    else {
      logger.error('??', method, 'could not get latest state from database');
    }
  });
}

function sendError(method, code, message, res) {
  logger.warn('??', method, message);
  res.status(code).json({error: message});
}

function authorize(req, res, next) {
  if (!req.headers.authorization)
    return sendError(
      400,
      'Malformed request, authentication header expected',
      res
    );

  var parts = req.headers.authorization.split(' ');
  if (parts[0].toLowerCase() !== 'basic' || !parts[1])
    return sendError(
      400,
      'Malformed request, basic authentication expected',
      res
    );

  var auth = new Buffer(parts[1], 'base64').toString().match(/^([^:]*):(.*)$/);
  if (!auth)
    return sendError(
      400,
      'Malformed request, authentication invalid',
      res
    );

  req.user = {
    uuid: auth[1],
    key: auth[2]
  };

  next();
}

app.listen(8080, function () {
  logger.info('??', 'init', 'listening on port 8080');
  resetSystem();
});
