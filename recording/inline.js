var debugger_env = {console:console, Math: Math};
if ( __wrappers_are_defined__ != undefined ) {
} else {
    var js_rewriting_logs = [];
    window.addEventListener("message", function(event){
        if( window.self == window.top ) {
            xmlhttp = new XMLHttpRequest();
            xmlhttp.open("POST", "http://127.0.0.1:8090", true);
            xmlhttp.send(event.data);
        }
    }, false);
    window.addEventListener("load", function(){
        var complete_log = "";
        for (i=0; i < window.js_rewriting_logs.length; i++ ){
            complete_log = complete_log + window.js_rewriting_logs[i] + "\n"
        }
        complete_log = complete_log + "END OF LOG";
        xmlhttp = new XMLHttpRequest();
        xmlhttp.open("POST", "http://127.0.0.1:8090", true);
        xmlhttp.send(complete_log);
    });

    function get_caller(caller){
        if ( caller == null ) {
            return window.location.href;
        } else {
            if ( caller.src == "" ) {
                return window.location.href;
            }
            return caller.src;
        }
    }

    var _random = Math.random;
    Math.random = function(){
        var caller = get_caller(document.currentScript);
        var stack = new Error().stack.split("\n")[1].split(":");
        var line = stack[stack.length - 2];
        var retVal = _random(this._base);
        var log_read = {'Function': 'Math.random', 'Script': caller, 'OrigLine': line, 'Return': retVal};
        window.js_rewriting_logs.push(JSON.stringify(log_read));
        return retVal;
    };

    var _date = window.Date;
    window.Date = function(time){
        var retVal;
        var log_read = "";
        if ( new.target ) { // constructor call
            var args = Array.from(arguments);
            if ( args.length == 0 ) {
                retVal = new _date();
            } else {
                retVal = new _date(args);
            }
            log_read = {'Function': 'window.Date', 'Return': retVal.toString()};
        } else {
            var retVal = _date();
            var log_read = {'Function': 'window.Date', 'Return': retVal};
        }
        window.js_rewriting_logs.push(JSON.stringify(log_read));
        return retVal;
    };
}
var __wrappers_are_defined__ = true;
