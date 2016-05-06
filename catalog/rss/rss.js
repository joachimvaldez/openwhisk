var request = require('request');

function main(msg){

  function parseQName(qname) {
    var parsed = {};
    var delimiter = '/';
    var defaultNamespace = '_';
    if (qname && qname.charAt(0) === delimiter) {
      var parts = qname.split(delimiter);
      parsed.namespace = parts[1];
      parsed.name = parts.length > 2 ? parts.slice(2).join(delimiter) : '';
    } else {
      parsed.namespace = defaultNamespace;
      parsed.name = qname;
    }
    return parsed;
  }
  console.log('rss: ', msg);

  // whisk trigger in payload
  var trigger = parseQName(msg.triggerName);

  // for creation -> CREATE (default)
  // for deletion -> DELETE
  // for pause -> PAUSE
  // for resume -> RESUME
  var lifecycleEvent = msg.lifecycleEvent || 'CREATE';

  if (lifecycleEvent === 'CREATE') {
    // CREATE A PERIODIC PROVIDER INSTANCE AT PERIODIC NODE.JS AND GIVE THE NEWLY CREATED TRIGGER
    //if (typeof msg.trigger_payload === 'string') {
      //msg.trigger_payload = {payload: msg.trigger_payload};
    //}

    // Early exits:
    // TODO if no rss_feed params provided, throw error. Move code from docker file to here

    // POST to our docker file
    request({
      method: 'POST',
      uri: 'http://' + msg.package_endpoint + '/triggers',
      json: {
        name: trigger.name,
        namespace: trigger.namespace,
        //payload: msg.trigger_payload || {},
        //maxTriggers: msg.maxTriggers || 1000,
        rss_feed: msg.rss_feed
      },
      auth: {
        user: msg.authKey.split(':')[0],
        pass: msg.authKey.split(':')[1]
      }
    }, function(err, res, body) {
      console.log('rss: done http request');
      if (!err && res.statusCode === 200) {
        console.log(body);
        whisk.done();
      }
      else {
        if (res) {
          console.log('alarm: Error invoking whisk action:', res.statusCode,
              body);
          whisk.error(body.error);
        }
        else {
          console.log('alarm: Error invoking whisk action:', err);
          whisk.error();
        }
      }
    });
  } else if (lifecycleEvent === 'DELETE') {
    console.log('trigger',  trigger);

    var body = {
      method: 'DELETE',
      uri: 'http://' + msg.package_endpoint + '/triggers/' + trigger.namespace +
        '/' + trigger.name,
      auth: {
        user: msg.authKey.split(':')[0],
        pass: msg.authKey.split(':')[1]
      }
    };
    console.log('body', body);
    request(body, function(err, res) {
      if (!err && res.statusCode === 200) {
        console.log(err);
        console.log(res);
        whisk.done();
      } else {
        console.log(err);
        console.log(res);
        whisk.error();
      }
    });
  }

  return whisk.async();
}

