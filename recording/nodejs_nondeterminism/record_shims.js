global.shim_logs = []

var events = require('events');
var from = require('array.from');
var http = require('http');
const util = require('util');
delete Array.from;

(function(){
    var nextUniqueId = 0;

    //numEntries: The number of clocks in the vector.
    //localPos:   The local process' position in the vector.
    //name:       [Optional] A unique name for this clock. The
    //            name must actually be unique, so that we can
    //            use names to break ties in VectorClock::generateTotalOrder().    
    function VectorClock(numEntries, localPos, name){
        this.clock = [];
        this.name = name || nextUniqueId++;
        this.localPos = localPos;
        for(var i = 0; i < numEntries; i++){
            this.clock.push(0);
        }
    }

    //Call this method when a process is starting to
    //handle an internal event. 
    VectorClock.prototype.increment = function(){
        this.clock[this.localPos]++;
    };

    //Returns whether this vector clock is causally ordered
    //before another vector clock.
    VectorClock.prototype.lessThan = function(otherClock){
        if(this.clock.length != otherClock.clock.length){
            throw "VectorClock::lessThan(): ERROR: The two clocks have different lengths.";
        }
        var atLeastOneSmaller = false;
        for(var i = 0; i < this.clock.length; i++){
            var mine = this.clock[i];
            var theirs = otherClock.clock[i];
            if(mine > theirs){
                return false;
            }
            if(mine < theirs){
                atLeastOneSmaller = true;
            }
        }
        return atLeastOneSmaller;
    };

    //Returns whether two clocks happened at the same time
    //with respect to logical time.
    VectorClock.prototype.isConcurrent =  function(otherClock){
        return (!this.lessThan(otherClock)) &&
               (!otherClock.lessThan(this));
    };

    //Returns whether this clock happened before or concurrently
    //with another clock.
    VectorClock.prototype.lessThanOrEqual = function(otherClock){
        return this.lessThan(otherClock) || this.isConcurrent(otherClock);
    };

    //Used to update this clock in response to the reception
    //of another clock in a message.
    VectorClock.prototype.update = function(clockFromMsg){
        if(this.clock.length != clockFromMsg.clock.length){
            throw "VectorClock::lessThan(): ERROR: The two clocks have different lengths.";
        }
        for(var i = 0; i < this.clock.length; i++){
            if(i == this.localPos){
                this.clock[i]++;
            }else{
                this.clock[i] = Math.max(this.clock[i], clockFromMsg.clock[i]);
            }
        }
        // write the vector clock to the client cookie (so we don't have to do this everywhere!)
        //this.writeToCookie();
    };

    //Returns a string with the individual clocks separated
    //by colons, e.g., "4:23:0:1".
    VectorClock.prototype.toString = function(){
        var arr = [];
        for(var i = 0; i < this.clock.length; i++){
            arr.push(this.clock[i].toString());
        }
        return arr.join(":");
    };

    //Read the local cookies and extract the vector clock,
    //looking for the clock inside the cookie key "vector-clock"
    //unless a different key is explicitly provided. The
    //localPos argument is required and indicates the position
    //in the vector which the new VectorClock should associate
    //with the local process.
//    VectorClock.extractFromCookie = function(localPos, key){
//        if(!localPos){
//            throw "VectorClock::extractFromCookie(): ERROR: Must specify a localPos.";
//        }
//
//        var cookies = document.cookie.split(";");
//        key = key || "vector-clock";
//        for(var i = 0; i < cookies.length; i++){
//            var tokens = cookies[i].split("=");
//            if(tokens[0] == key || tokens[0] == " vector-clock"){
//                var val = tokens[1];
//                tokens = val.split(":");
//                var newClock = new VectorClock();
//                for(var i = 0; i < tokens.length; i++){
//                    newClock.clock[i] = parseInt(tokens[i]);
//                }
//                newClock.localPos = localPos;
//                return newClock;
//            }
//        }
//        return null;
//    };

    //Sorts the given log of {clock: VectorClockInstance, data: whatever}
    //objects IN PLACE, i.e., the function does not return a new array,
    //but instead sorts the array passed in as a parameter. Concurrent
    //clocks are ordered using their .name property, so it's important
    //for those properties to be unique!
    VectorClock.generateTotalOrder = function(log){
        var sortFunc = function(logEntry0, logEntry1){
            var c0 = logEntry0.clock;
            var c1 = logEntry1.clock;
            if(c0.lessThan(c1)){
                return -1;
            }else if(c1.lessThan(c0)){
                return 1;
            }else{
                if(c0.name < c1.name){
                    return -1;
                }else if(c0.name > c1.name){
                    return 1;
                }else{
                    throw "VectorClock::generateTotalOrder: ERROR: Could not break tie . . . are clock names non-unique?";
                }
            }
        };
        log.sort(sortFunc);
    };

    global.VectorClock = VectorClock;
})();
    // create vector clock for client (has entries for client and server)
    var server_clock = new VectorClock(2,0);

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
    var wrapper_func = function() {server_clock.increment();var hrTime = process.hrtime();var log_timeout = {'Function': 'setTimeout', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_timeout));func();};
    if ( typeof(func) == "string" ) {
        var make_func = new Function(func);
        var wrapper_func = function() {server_clock.increment();var log_timeout = {'Function': 'setTimeout', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_timeout));make_func();};
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
    var wrapper_func = function() {server_clock.increment();var hrTime = process.hrtime();var log_timeout = {'Function': 'setInterval', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_timeout));func();};
    if ( typeof(func) == "string" ) {
        var make_func = new Function(func);
        var wrapper_func = function() {server_clock.increment();var log_timeout = {'Function': 'setInterval', 'OrigLine': line, 'UniqueID': curr_id, 'TimeoutId': unique_timeout_id_mappings[curr_id], 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_timeout));make_func();};
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
    var wrapper_func = function() {server_clock.increment();var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.on', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res), 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
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
    var wrapper_func = function() {server_clock.increment();var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.once', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res), 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
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
    var wrapper_func = function() {server_clock.increment();var keep_req = {};if ( this instanceof http.ClientRequest ) {for (var d in global.request_info ) {keep_req[global.request_info[d]] = this[global.request_info[d]];}}var keep_res = {};if ( this instanceof http.IncomingMessage ) {for (var d in global.response_info ) {keep_res[global.response_info[d]] = this[global.response_info[d]];}}var hrTime = process.hrtime();var log_event = {'Function': 'EventEmitter.prependListener', 'OrigLine': line, 'EventType': type, 'Time': hrTime[0] * 1000000 + hrTime[1] / 1000, 'ReqInfo': JSON.stringify(keep_req), 'ResInfo': JSON.stringify(keep_res), 'Vector_Clock': server_clock.toString()};shim_logs.push(JSON.stringify(log_event));var args = from(arguments);listener.apply(this, args);};
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
