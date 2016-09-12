global.shim_logs = []

var events = require('events');
var from = require('array.from');
var http = require('http');
const util = require('util');
delete Array.from;

global.http_events = ['response', 'end', 'finish', '_socketEnd', 'connect', 'free', 'close', 'agentRemove', 'socket', 'drain', 'data', 'prefinish', 'SIGWINCH'];
global.http_emits = ['socket', 'prefinish', 'resume', 'lookup', 'finish', 'connect', 'data', 'readable', 'end', 'close'];


// event types that pertain to asynchronous http requests/responses
global.request_info = ['domain', '_events', '_eventsCount', '_maxListeners', 'output', 'outputEncodings', 'outputCallbacks', 'outputSize',
                       'writable', '_last',  'chunkedEncoding', 'shouldKeepAlive', 'useChunkedEncodingByDefault', 'sendDate', '_removedHeader',
                       '_contentLength', '_hasBody', '_trailer', 'finished', '_headerSent', '_header', '_headers', '_headerNames', '_onPendingData', 'socketPath', 'method', 'path' ];

global.response_info = [ '_readableState', 'readable', 'domain', '_events', '_eventsCount', '_maxListeners', 'httpVersionMajor', 'httpVersionMinor',
                         'httpVersion', 'complete', 'headers', 'rawHeaders', 'trailers', 'rawTrailers', 'upgrade', 'url', 'method', 'statusCode', 'statusMessage',
                         '_consuming', '_dumped'];

global.unique_timeout_ids = 0;
var unique_timeout_id_mappings = {};

global.handler_ids = 0;

// shim for setTimeout
_settimeout = global.setTimeout;
global.setTimeout = function (func, delay) {
    if ( this.hasOwnProperty("_dontlog") ) {
        return _settimeout(func, delay);
    }
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var curr_id = unique_timeout_ids;
    var wrapper_func = function() {var hrTime = process.hrtime();var log_timeout = {'Function': 'setTimeout', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_timeout));func();};
    if ( typeof(func) == "string" ) {
        var make_func = new Function(func);
        var wrapper_func = function() {var log_timeout = {'Function': 'setTimeout', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_timeout));make_func();};
    }
    var retVal = _settimeout(wrapper_func, delay);
    unique_timeout_id_mappings[curr_id] = retVal;
    unique_timeout_ids+= 1;
    return retVal;
};

// shim for setInterval
_setinterval = global.setInterval;
global.setInterval = function (func, delay) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var curr_id = unique_timeout_ids;
    var wrapper_func = function() {var hrTime = process.hrtime();var log_timeout = {'Function': 'setInterval', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_timeout));func();};
    if ( typeof(func) == "string" ) {
        var make_func = new Function(func);
        var wrapper_func = function() {var log_timeout = {'Function': 'setInterval', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_timeout));make_func();};
    }
    var retVal = _setinterval(wrapper_func, delay);
    unique_timeout_id_mappings[curr_id] = retVal;
    unique_timeout_ids+= 1;
    return retVal;
};

// shim for EventEmitter.on()
_eventemitteron = events.EventEmitter.prototype.on;
events.EventEmitter.prototype.on = function (type, listener) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var curr_id = global.handler_ids;
    global.handler_ids += 1;
    if ( global.http_events.indexOf(type) != -1 ) { // http event we care about, handle appropriately! log info to fire again in replay
    }
    var args = from(arguments);
    var wrapper_func = function() {var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.on', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res)};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
    args1 = [type, wrapper_func];
    var retVal = _eventemitteron.apply(this, args1);
    return retVal;
};

// shim for EventEmitter.once()
_eventemitteronce = events.EventEmitter.prototype.once;
events.EventEmitter.prototype.once = function (type, listener) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var curr_id = global.handler_ids;
    global.handler_ids += 1;
    var wrapper_func = function() {var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.once', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res)};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
    var args = [type, wrapper_func];
    var retVal = _eventemitteronce.apply(this, args);
    return retVal;
};

// shim for EventEmitter.prependListener()
_eventemitterprepend = events.EventEmitter.prototype.prependListener;
events.EventEmitter.prototype.prependListener = function (type, listener) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var curr_id = global.handler_ids;
    global.handler_ids += 1;
    var wrapper_func = function() {var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.prependListener', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res)};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
    var args = [type, wrapper_func];
    var retVal = _eventemitterprepend.apply(this, args);
    return retVal;
};

// output logs after 4 seconds
var outputlog = function () {
    for (var i = 0; i < shim_logs.length; i++ ) {
        console.log(shim_logs[i]);
    }
};
outputlog._dontlog = true;
setTimeout(outputlog, 4000);

// shim for EventEmitter.emit()
_eventemitteremit = events.EventEmitter.prototype.emit;
events.EventEmitter.prototype.emit = function (type) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var hrTime = process.hrtime();
    var retVal;
    var log_event = {'Function': 'EventEmitter.emit', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'EmitStatus': 'Before'};
    shim_logs.push(JSON.stringify(log_event));
    if ( global.http_emits.indexOf(type) != -1 ) { // I don't think we have to do anything for these types of emits?
    }
    var args = from(arguments);
    var retVal = _eventemitteremit.apply(this, args);
    var log_event_after = {'Function': 'EventEmitter.emit', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'EmitStatus': 'After'};
    shim_logs.push(JSON.stringify(log_event_after));
    return retVal;
}

_orig_date_now = Date.now;

var _date = global.Date;
global.Date = function(time){
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var retVal;
    var log_read = "";
    var hrTime = process.hrtime();
    if ( this.constructor == Date.prototype.constructor ) { // new Date()
        var args = from(arguments);
        if ( args.length == 0 ) {
            retVal = new _date();
        } else {
            retVal = new _date(args);
        }
        log_read = {'Function': 'new window.Date', 'OrigLine': line, 'Return': retVal.toString(), 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'msTime': _date.now()};
    } else {
        var retVal = _date();
        var log_read = {'Function': 'window.Date', 'OrigLine': line, 'Return': retVal, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'msTime': _date.now()};
    }
    shim_logs.push(JSON.stringify(log_read));
    return retVal;
};

// shim for Math.random()
var _random = Math.random;
Math.random = function(){
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var retVal = _random(this._base);
    var log_read = {'Function': 'Math.random', 'OrigLine': line, 'Return': retVal};
    shim_logs.push(JSON.stringify(log_read));
    return retVal;
};
