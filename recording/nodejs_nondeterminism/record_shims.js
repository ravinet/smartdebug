global.shim_logs = []

var events = require('events');
var from = require('array.from');
const util = require('util');
delete Array.from;

global.unique_timeout_ids = 0;
var unique_timeout_id_mappings = {};

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
    var wrapper_func = function() {var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.on', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_event));listener();};
    var retVal = _eventemitteron.call(this, type, wrapper_func);
    return retVal;
};

// shim for EventEmitter.once()
_eventemitteronce = events.EventEmitter.prototype.once;
events.EventEmitter.prototype.once = function (type, listener) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var wrapper_func = function() {var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.once', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_event));listener();};
    var retVal = _eventemitteronce.call(this, type, wrapper_func);
    return retVal;
};

// shim for EventEmitter.prependListener()
_eventemitterprepend = events.EventEmitter.prototype.prependListener;
events.EventEmitter.prototype.prependListener = function (type, listener) {
    var stack = new Error().stack.split("\n")[1].split(":");
    var line = stack[stack.length - 2];
    var wrapper_func = function() {var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.prependListener', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};shim_logs.push(JSON.stringify(log_event));listener();};
    var retVal = _eventemitterprepend.call(this, type, wrapper_func);
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
    var log_event = {'Function': 'EventEmitter.emit', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000};
    shim_logs.push(JSON.stringify(log_event));
    var retVal = _eventemitteremit.call(this, type);
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
