var watson = require('watson-developer-cloud');
var fs = require('fs');
var stream = require('stream');

function isValidEncoding(encoding) {
  return encoding === 'ascii' ||
    encoding === 'utf8' ||
    encoding === 'utf16le' ||
    encoding === 'ucs2' ||
    encoding === 'base64' ||
    encoding === 'binary' ||
    encoding === 'hex';
}

/**
 * Convert a string into speech.
 *
 * @param voice The voice of the speaker.
 * @param accept The format of the speech file.
 * @param payload The text to turn into speech. Required.
 * @param encoding The encoding of the speech binary data.
 * @param username The Watson service username.
 * @param password The Watson service password.
 *
 * @return
 */
function main(params) {
  var payload = params.payload;
  var content_type = params.content_type;
  var encoding = isValidEncoding(params.encoding) ? params.encoding : 'base64';
  var username = params.username;
  var password = params.password;

  console.log('params:', params);

  var speechToText = watson.speech_to_text({
    username: 'c814763d-642d-4d22-8e60-cd5514b05d07',
    password: 'tqxtGF1GRr6T',
    version: 'v1',
  });

  // Create the stream.
  var recognizeStream = speechToText.createRecognizeStream({
    content_type: content_type,
    continuous: true,
    interim_results: true
  });

  // Pipe in some audio.
  var b = Buffer(payload, encoding);
  var s = new stream.Readable();
  s._read = function noop() {}; // redundant? see update below
  s.push(b);
  s.pipe(recognizeStream);
  s.push(null);
  //

  // Pipe out the transcription.
  recognizeStream.pipe(fs.createWriteStream('transcription.txt'));

  // Get strings instead of buffers from `data` events.
  recognizeStream.setEncoding('utf8');

  // Listen for 'data' events for only the final results.
  // Listen for 'results' events to get interim results.
  ['data', 'results', 'error', 'connection-close'].forEach(function(eventName) {
    recognizeStream.on(eventName,
      function (event_) {
        console.log(eventName + ' event: ' + JSON.stringify(event_));
        if (eventName === 'data') {
          whisk.done({
            'payload': event_
          });
        }
      }
    );
  });

  return whisk.async();
}

