global.shim_logs = []

var from = require('array.from');
const util = require('util');
delete Array.from;

var request = require('request');
var http = require('http');
var events = require('events');

var outputlog = function () {
    for (var i = 0; i < shim_logs.length; i++ ) {
        console.log(shim_logs[i]);
    }
};
setTimeout(outputlog, 4000);

// shim for EventEmitter.on()
global._eventemitteron = events.EventEmitter.prototype.on;
events.EventEmitter.prototype.on = function (type, listener) {
    var args = from(arguments);
    var wrapper_func = function() {shim_logs.push("IN THE FUNCTION TO EVALUATE");var args = from(arguments); listener.apply(this, args);};
    args = [type, wrapper_func];
    var retVal = global._eventemitteron.apply(this, args);
    return retVal;
};


// shim for EventEmitter.emit()
_eventemitteremit = events.EventEmitter.prototype.emit;
events.EventEmitter.prototype.emit = function (type) {
    var args = from(arguments);
    var retVal = _eventemitteremit.apply(this, args);
    return retVal;
};

var options = {
  host: 'nyc.csail.mit.edu',
  path: '/'
};

callback = function (response) {
    str = "";
    response.on("data", function(d) { str += d;});
    response.on("end", function(body) {console.log(str);});
};

http.request(options, callback).end();
