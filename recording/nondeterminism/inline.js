if ( __wrappers_are_defined__ != undefined ) {
} else {
    // keys are ast nodes (as strings), values are arrays [ast_unique_id, count]
    var asts_intercepted = {};
    var ast_unique_id_counter = 0;
    function interceptor(e, value, env, pause) {
        var unique_id = 0;
        var ast_counter = 1;
        var curr_ast = JSON.stringify(e);
        // maintain list of ast nodes and counts
        if ( curr_ast in asts_intercepted ) {
            unique_id = asts_intercepted[curr_ast][0];
            ast_counter = asts_intercepted[curr_ast][1] + 1;
            asts_intercepted[curr_ast][1]++;
        } else {
            unique_id = ast_unique_id_counter + 1;
            ast_unique_id_counter++;
            asts_intercepted[curr_ast] = [ast_unique_id_counter, 0];
        }
        var log_ast = {'AST_id': unique_id, 'AST_counter': ast_counter};
        window.js_rewriting_logs.push(JSON.stringify(log_ast));
    }
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
        var caller = get_caller(document.currentScript);
        var stack = new Error().stack.split("\n")[1].split(":");
        var line = stack[stack.length - 2];
        var retVal;
        var log_read = "";
        if ( new.target ) { // constructor call
            var args = Array.from(arguments);
            if ( args.length == 0 ) {
                retVal = new _date();
            } else {
                retVal = new _date(args);
            }
            log_read = {'Function': 'new window.Date', 'Script': caller, 'OrigLine': line, 'Return': retVal.toString()};
        } else {
            var retVal = _date();
            var log_read = {'Function': 'window.Date', 'Script': caller, 'OrigLine': line, 'Return': retVal};
        }
        window.js_rewriting_logs.push(JSON.stringify(log_read));
        return retVal;
    };

    function get_child_path(curr){
        child_path = [];
        child_path_tags = [];
        while ( curr.parentNode != null ) {
           var children = curr.parentNode.children;
           for (j = 0; j < children.length; j++){
               if( children[j] == curr ){
                   child_path.push(j);
                   child_path_tags.push(children[j].tagName);
               }
           }
           curr = curr.parentNode;
        }
        return [child_path, child_path_tags];
    }

    function check_if_proxy(val){
        var isProxy = false;
        var usemap = false;
        try {
            if ( typeof(val.hasOwnProperty) != "function" ) {
                // some objects passed as thisArg seem to have set hasOwnProperty to 'false' --> use 'in'
                if ( ("_base" in val) && ("_id" in val) ) {
                    isProxy = true;
                }
            } else {
                if ( (val.hasOwnProperty("_base")) && (val.hasOwnProperty("_id")) ) {
                    isProxy = true;
                }
            }
        } catch(err) {
            // likely an object from a different scope--> can't check _base!
            // this means that the object would not have been modified with makeProxy
            // since it would use makeProxy below which is also out of scope!
            // so it can be a proxy but has no _base/_id property (must check weakmap)
            if ( baseMap.has(val) ) { // this is a proxy and we must get base from weakmap!
                isProxy = true;
                usemap = true;
            }
        }
        return [isProxy, usemap];
    }

    var _mutationobserve = MutationObserver.prototype.observe;
    MutationObserver.prototype.observe = function(target, options) {
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _mutationobserve.call(baseMap.get(this), target, options);
            } else {
                retVal = _mutationobserve.call(this._base, target, options);
            }
        }
        return retVal;
    };

    var _eventtargetadd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, capture, untrusted) {
        var untrusted_use = untrusted;
        if ( untrusted == undefined ) {
            // mdn page unclear about what defualt value is!
            untrusted_use = true;
        }
        var capture_use = capture;
        if ( capture == undefined ) {
            capture_use = false;
        }
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _eventtargetadd.call(baseMap.get(this), type, listener, capture_use, untrusted_use);
            } else {
                retVal = _eventtargetadd.call(this._base, type, listener, capture_use, untrusted_use);
            }
        }
        return retVal;
    };

    var _getRandomValues = window.crypto.getRandomValues;
    window.crypto.getRandomValues = function(c) {
        var c_use = c;
        if ( c.hasOwnProperty("_id") ) {
            c_use = c._base;
        }
        return _getRandomValues.call(this, c_use);
    };

    var _eventtargetremove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.removeEventListener = function(type, listener, capture) {
        var capture_use = capture;
        if ( capture == undefined ) {
            capture_use = false;
        }
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _eventtargetremove.call(baseMap.get(this), type, listener, capture_use);
            } else {
                retVal = _eventtargetremove.call(this._base, type, listener, capture_use);
            }
        }
        return retVal;
    };

    var _xhropen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        var async_use = async;
        if ( async == undefined ) {
            async_use = true;
        }
        var user_use = user;
        if ( user == undefined ) {
            user_use = "";
        }
        var password_use = password;
        if ( password == undefined ) {
            password_use = "";
        }

        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _xhropen.call(baseMap.get(this), method, url, async_use, user_use, password_use);
            } else {
                retVal = _xhropen.call(this._base, method, url, async_use, user_use, password_use);
            }
        } else {
            retVal = _xhropen.call(this, method, url, async_use, user_use, password_use);
        }

        return retVal;
    };

    var _xhrsetheader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _xhrsetheader.call(baseMap.get(this), header, value);
            } else {
                retVal = _xhrsetheader.call(this._base, header, value);
            }
        } else {
            retVal = _xhrsetheader.call(this, header, value);
        }
        return retVal;
    };

    var _xhrgetresponseheader = XMLHttpRequest.prototype.getResponseHeader;
    XMLHttpRequest.prototype.getResponseHeader = function(header) {
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                retVal = _xhrgetresponseheader.call(baseMap.get(this), header);
            } else {
                retVal = _xhrgetresponseheader.call(this._base, header);
            }
        } else {
            retVal = _xhrgetresponseheader.call(this, base, header);
        }
        return retVal;
    };

    var _xhrsend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        // check whether this is proxy...if so, use _base or get base from weakmap
        var isProxy = check_if_proxy(this);
        var retVal;
        if ( isProxy[0] ) { // this is a proxy
            if ( isProxy[1] ) { // frozen object
                if ( data == undefined ) {
                    retVal = _xhrsend.call(baseMap.get(this));
                } else {
                    retVal = _xhrsend.call(baseMap.get(this), data);
                }
            } else {
                if ( data == undefined ) {
                    retVal = _xhrsend.call(this._base);
                } else {
                    retVal = _xhrsend.call(this._base, data);
                }
            }
        } else {
            if ( data == undefined ) {
                retVal = _xhrsend.call(this);
            } else {
                retVal = _xhrsend.call(this, data);
            }
        }
        return retVal;
    };

    var _alert = window.alert;
    window.alert = function(arg){
                       var caller = get_caller( document.currentScript);
                       var stack = new Error().stack.split("\n")[1].split(":");
                       var line = stack[stack.length - 2];
                       var log_read = {'OpType': 'READ', 'ParentId': 'window', 'PropName': 'screen', 'NewValId': 'null', 'OldValId': 'null', 'script': caller, 'OrigLine': line};
                       var log_write = {'OpType': 'WRITE', 'ParentId': 'window', 'PropName': 'screen', 'NewValId': 'null', 'OldValId': 'null', 'script': caller, 'OrigLine': line};
                       //console.log( JSON.stringify( log_read ) );
                       window.js_rewriting_logs.push(JSON.stringify(log_read));
                       //console.log( JSON.stringify( log_write ) );
                       window.js_rewriting_logs.push(JSON.stringify(log_write));
                       var retVal = _alert.call(this._base, arg);
                       return retVal;
                   };

    var _apply = Function.prototype.apply;
    Function.prototype.apply = function(thisArg, argArray){
        if(typeof(thisArg) != "object"){
            // convert passed primititve to corresponding wrapper type
            switch(typeof(thisArg)){
                case "number":
                    thisArg = new Number(thisArg);
                    break;
                case "string":
                    thisArg = new String(thisArg);
                    break;
                case "boolean":
                    thisArg = new Boolean(thisArg);
                    break;
                default:
                    //console.log( "apply() wrapper: unrecognized type for thisArg: " + typeof(thisArg) );
                    //throw ("Function.prototype.apply() wrapper: typeof(thisArg)=" + typeof(thisArg));
            }
        }

        // check if thisArg is proxy (need better test for this!)
        var isProxy = false;
        var usemap = false;
        var isProxy;
        if ( thisArg != null ) {
            isProxy = check_if_proxy(thisArg);
        }

        var retVal;

        argArray = argArray || []; //in case the caller did not specify an argArray

        //Remember that "this" is a function object!
        this._apply = _apply;

        if(isProxy[0]){
            if ( isProxy[1] ) { // can't call _base to get underlying base object
                retVal = this._apply(baseMap.get(thisArg), argArray);
            } else {
                retVal = this._apply(thisArg._base, argArray);
            }
        } else{
            retVal = this._apply(thisArg, argArray);
        }

        delete this._apply; // ensure app won't see extra properties on function
        return retVal;
    }

    // wrapper for Function.prototype.call() defined using apply() wrapper
    Function.prototype.call = function(thisArg){
        var argArray = [];
        for(var i = 1; i < arguments.length; i++){
            argArray.push(arguments[i]);
        }

        //Remember that "this" is a function object!
        return this.apply(thisArg, argArray);
    }

    function isNativeCodeFunc(f){
        try { // wrap in try because some functions produce errors with toString?
            var srcCode = f.toString();
        } catch(err) {
            console.log( "Error using toString() to check if function is native function" );
            return false;
        }
        if ( srcCode.indexOf("[native code]") != -1 ) {
            return true;
        } else {
            return false;
        }
        //!!!This test should actually be fancier,
        //and use a regular expression to ensure
        //that the string "[native code]" appears
        //in the declaration of the function signature,
        //not as, e.g., a string literal that's assigned
        //to a local function variable.
    };

    var _window = window;

    // counter for proxies returned by makeProxy
    window.proxy_counter = 0;

    // WeakMap for objects which are frozen
    var idMap = new WeakMap();
    // WeakMap to associate proxies with their frozen object bases (for wrappers)
    var baseMap = new WeakMap();

    // object handler for proxies
    var window_handler = {
                      "get": function(base, name){
                                 var value = base[name];
                                 var native_func = false;
                                 if ( typeof(value) == "function" ) {
                                     native_func = isNativeCodeFunc(value);
                                 }
                                 var bound_value;
                                 if (native_func && (base == window)) {
                                     bound_value = value.bind(_window);
                                     /*var props = Object.getOwnPropertyNames(value);
                                     // bind seems to not preserve prototype chain, so we restore it
                                     bound_value.prototype = value.prototype;
                                     for ( prop in props ) {
                                         bound_value[props[prop]] = value[props[prop]]
                                     }
                                     */
                                     var curr_value = value;
                                     new_value = new Proxy(bound_value, {
                                         get: function(base1, name1){
                                             return curr_value[name1];
                                         },
                                         set: function(base1, name1, value1){
                                             curr_value[name1] = value1;
                                         }
                                     });
                                     value = new_value;
                                 }

                             try {
                                 var parent_id = "null";
                                 var old_id = "null";
                                 var new_id = "null";
                                 var caller = get_caller(document.currentScript);
                                 var stack = new Error().stack.split("\n")[1].split(":");
                                 var line = stack[stack.length - 2];

                                 switch( typeof( value ) ){
                                     case "number":
                                     case "boolean":
                                     case "function":
                                     case "string":
                                         old_id = "null";
                                         break;
                                     case "object":
                                         if ( value == null ){
                                             old_id = "null";
                                         } else {
                                             old_id = value._id;
                                             if( typeof(old_id) == "object" ) { // quick hack---not sure how old_id can be an object!
                                                 old_id = old_id._id;
                                             }
                                             if ( old_id == undefined ){
                                                 old_id = "null";
                                                 // check if object was frozen (check WeakMap for id)
                                                 if ( idMap.has( value ) ) { // object is in WeakMap!
                                                     old_id = idMap.get( value )[0];
                                                 }
                                             }
                                         }
                                 }

                                 if ( base == _window ){
                                     parent_id = "window";
                                 } else {
                                     parent_id = base._id;
                                     if ( parent_id == undefined ){
                                         parent_id = "null";
                                         // check if object was frozen (check WeakMap for id)
                                         if ( idMap.has( base ) ) { // object is in WeakMap!
                                             parent_id = idMap.get( base )[0];
                                         }
                                     }
                                 }
                                 var new_id = "null";
                                 // don't log reads from makeProxy logging
                                 if ( name != "_id"  && line != '559' && line != '560' && line != '564' && line != '565' && line != '511' && line != '514' && line != '574' && line != '575' && line != '579' && line != '580' && line != '523' && line != '526' ){
                                     var log = {'OpType': 'READ', 'ParentId': parent_id, 'PropName': name, 'NewValId': new_id, 'OldValId': old_id, 'script': caller, 'OrigLine': line};
                                     //console.log( JSON.stringify( log ) );
                                     window.js_rewriting_logs.push(JSON.stringify(log));
                                 }
                                 return value;
                             } catch( err ) {
                                 console.log("Cross-origin access from proxy handler caused exception");
                                 return value;
                             }
                             },
                      "set": function(base, name, value){
                                 var caller = get_caller(document.currentScript);
                                 var stack = new Error().stack.split("\n")[1].split(":");
                                 var line = stack[stack.length - 2];
                                 var prev = base[name];
                                 var parent_id = "null";
                                 var new_id = "null";
                                 var old_id = "null";
                                 switch( typeof( value ) ){
                                     case "number":
                                     case "boolean":
                                     case "string":
                                     case "function":
                                         new_id = "null";
                                         break;
                                     case "object":
                                         if ( value == null ){
                                             new_id = "null";
                                         } else {
                                             new_id = value._id;
                                             if( typeof(new_id) == "object" ) { // quick hack---not sure how new_id can be an object!
                                                 new_id = new_id._id;
                                             }
                                             if ( new_id == undefined ){
                                                 new_id = "null";
                                                 // check if object was frozen (check WeakMap for id)
                                                 if ( idMap.has( value ) ) { // object is in WeakMap!
                                                     new_id = idMap.get( value )[0];
                                                 }
                                             }
                                         }
                                 }

                                 switch( typeof( prev ) ){
                                     case "number":
                                     case "boolean":
                                     case "function":
                                     case "string":
                                         old_id = "null";
                                         break;
                                     case "object":
                                         if ( prev == null ){
                                             old_id = "null";
                                         } else {
                                             old_id = prev._id;
                                             if( typeof(old_id) == "object" ) { // quick hack---not sure how old_id can be an object!
                                                 old_id = old_id._id;
                                             }
                                             if ( old_id == undefined ){
                                                 old_id = "null";
                                                 // check if object was frozen (check WeakMap for id)
                                                 // should this check (and the ones above) just check if obj is frozen
                                                 // rather than checking if it is in the WeakMap?
                                                 if ( idMap.has( prev ) ) { // object is in WeakMap!
                                                     old_id = idMap.get( prev )[0];
                                                 }
                                             }
                                         }
                                 }

                                 if ( base == _window ){
                                     parent_id = "window";
                                 } else {
                                     var parent_id = base._id;
                                     if( typeof(parent_id) == "object" ) { // quick hack---not sure how parent_id can be an object!
                                         parent_id = parent_id._id;
                                      }

                                     if ( parent_id == undefined ){
                                         parent_id = "null";
                                         // check if object was frozen (check WeakMap for id)
                                         if ( idMap.has( base ) ) { // object is in WeakMap!
                                             parent_id = idMap.get( base )[0];
                                         }
                                     }
                                 }
                                 base[name] = value;
                                 if ( name != "_id" ){
                                        var log = {'OpType': 'WRITE', 'ParentId': parent_id, 'PropName': name, 'NewValId': new_id, 'OldValId': old_id, 'script': caller, 'OrigLine': line}
                                     if ( parent_id != "window" ) {
                                        var log = {'OpType': 'WRITE', 'ParentId': parent_id, 'PropName': name, 'NewValId': new_id, 'OldValId': old_id, 'script': caller, 'OrigLine': line, 'Value': JSON.stringify(base)}
                                     }
                                     //console.log( JSON.stringify( log ) );
                                     window.js_rewriting_logs.push(JSON.stringify(log));
                                 }
                                 //base[name] = value;
                             }
                     };

    var listids = function(obj, arr, start="") {
        for(var i in obj) {
            curr = start + "." + i
            if(obj[i].hasOwnProperty('_id')){
                arr.push([curr, obj[i]._id])
            }
            listids(obj[i], arr, curr);
        }
    };

    function makeProxy(base){
        if ( typeof(base) == "object" ){
            // already has id, so just return object
            if ( base.hasOwnProperty("_id") ) {
                return base;
            }
            // not a user defined object, so return value
            if ( base instanceof Date || base instanceof RegExp ||
                 base instanceof Array || base instanceof Number ||
                 base instanceof Node || base instanceof Element ||
                 base instanceof Error ){
                return base;
            }

            // user defined object, so add logging and return either proxy or base
            if ( !Object.isFrozen(base) ) { // object not frozen, add logging props
                var p = new Proxy( base, window_handler );
                Object.defineProperty(p, '_base', {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: base
                });
                Object.defineProperty(p, '_id', {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: window.proxy_counter
                });
                var log = {'OpType': 'OBJ', 'NewValId': window.proxy_counter, 'Value': JSON.stringify(base)};
                window.js_rewriting_logs.push(JSON.stringify(log));
                o = [];
                listids(base, o);
                for(dep in o) {
                    var idlog = {'OpType': 'IDDEP', 'ChildId': window.proxy_counter, 'ParentId': o[dep][1]};
                    window.js_rewriting_logs.push(JSON.stringify(idlog));
                }
                window.proxy_counter++;
                return p;
            } else { // object frozen, add to weak map for logging
                var p = new Proxy( base, window_handler );
                var map_val = [window.proxy_counter, base];
                idMap.set( base, map_val );
                baseMap.set( p, base );
                var log = {'OpType': 'OBJ', 'NewValId': window.proxy_counter, 'Value': JSON.stringify(base)};
                window.js_rewriting_logs.push(JSON.stringify(log));
                o = [];
                listids(base, o);
                for(dep in o) {
                    var idlog = {'OpType': 'IDDEP', 'ChildId': window.proxy_counter, 'ParentId': o[dep][1]};
                    window.js_rewriting_logs.push(JSON.stringify(idlog));
                }
                window.proxy_counter++;
                return p;
            }
        } else {
            // not an object, so return value
            return base;
        }
    }

    // set debugger_env here so all necessary functions (e.g., window_handler) are already defined)
    var debugger_env = {console:console, Math: Math, window:window, _window:_window, window_handler: window_handler, Proxy: window.Proxy};

    // Source code for ESPRIMA
    (function (root, factory) {
        'use strict';
    
        // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
        // Rhino, and plain browser loading.
    
        /* istanbul ignore next */
        if (typeof define === 'function' && define.amd) {
            define(['exports'], factory);
        } else if (typeof exports !== 'undefined') {
            factory(exports);
        } else {
            factory((root.esprima = {}));
        }
    }(this, function (exports) {
        'use strict';
    
        var Token,
            TokenName,
            FnExprTokens,
            Syntax,
            PlaceHolders,
            PropertyKind,
            Messages,
            Regex,
            source,
            strict,
            index,
            lineNumber,
            lineStart,
            length,
            lookahead,
            state,
            extra;
    
        Token = {
            BooleanLiteral: 1,
            EOF: 2,
            Identifier: 3,
            Keyword: 4,
            NullLiteral: 5,
            NumericLiteral: 6,
            Punctuator: 7,
            StringLiteral: 8,
            RegularExpression: 9
        };
    
        TokenName = {};
        TokenName[Token.BooleanLiteral] = 'Boolean';
        TokenName[Token.EOF] = '<end>';
        TokenName[Token.Identifier] = 'Identifier';
        TokenName[Token.Keyword] = 'Keyword';
        TokenName[Token.NullLiteral] = 'Null';
        TokenName[Token.NumericLiteral] = 'Numeric';
        TokenName[Token.Punctuator] = 'Punctuator';
        TokenName[Token.StringLiteral] = 'String';
        TokenName[Token.RegularExpression] = 'RegularExpression';
    
        // A function following one of those tokens is an expression.
        FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                        'return', 'case', 'delete', 'throw', 'void',
                        // assignment operators
                        '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                        '&=', '|=', '^=', ',',
                        // binary/unary operators
                        '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                        '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                        '<=', '<', '>', '!=', '!=='];
    
        Syntax = {
            AssignmentExpression: 'AssignmentExpression',
            ArrayExpression: 'ArrayExpression',
            ArrowFunctionExpression: 'ArrowFunctionExpression',
            BlockStatement: 'BlockStatement',
            BinaryExpression: 'BinaryExpression',
            BreakStatement: 'BreakStatement',
            CallExpression: 'CallExpression',
            CatchClause: 'CatchClause',
            ConditionalExpression: 'ConditionalExpression',
            ContinueStatement: 'ContinueStatement',
            DoWhileStatement: 'DoWhileStatement',
            DebuggerStatement: 'DebuggerStatement',
            EmptyStatement: 'EmptyStatement',
            ExpressionStatement: 'ExpressionStatement',
            ForStatement: 'ForStatement',
            ForInStatement: 'ForInStatement',
            FunctionDeclaration: 'FunctionDeclaration',
            FunctionExpression: 'FunctionExpression',
            Identifier: 'Identifier',
            IfStatement: 'IfStatement',
            Literal: 'Literal',
            LabeledStatement: 'LabeledStatement',
            LogicalExpression: 'LogicalExpression',
            MemberExpression: 'MemberExpression',
            NewExpression: 'NewExpression',
            ObjectExpression: 'ObjectExpression',
            Program: 'Program',
            Property: 'Property',
            ReturnStatement: 'ReturnStatement',
            SequenceExpression: 'SequenceExpression',
            SwitchStatement: 'SwitchStatement',
            SwitchCase: 'SwitchCase',
            ThisExpression: 'ThisExpression',
            ThrowStatement: 'ThrowStatement',
            TryStatement: 'TryStatement',
            UnaryExpression: 'UnaryExpression',
            UpdateExpression: 'UpdateExpression',
            VariableDeclaration: 'VariableDeclaration',
            VariableDeclarator: 'VariableDeclarator',
            WhileStatement: 'WhileStatement',
            WithStatement: 'WithStatement'
        };
    
        PlaceHolders = {
            ArrowParameterPlaceHolder: {
                type: 'ArrowParameterPlaceHolder'
            }
        };
    
        PropertyKind = {
            Data: 1,
            Get: 2,
            Set: 4
        };
    
        // Error messages should be identical to V8.
        Messages = {
            UnexpectedToken: 'Unexpected token %0',
            UnexpectedNumber: 'Unexpected number',
            UnexpectedString: 'Unexpected string',
            UnexpectedIdentifier: 'Unexpected identifier',
            UnexpectedReserved: 'Unexpected reserved word',
            UnexpectedEOS: 'Unexpected end of input',
            NewlineAfterThrow: 'Illegal newline after throw',
            InvalidRegExp: 'Invalid regular expression',
            UnterminatedRegExp: 'Invalid regular expression: missing /',
            InvalidLHSInAssignment: 'Invalid left-hand side in assignment',
            InvalidLHSInForIn: 'Invalid left-hand side in for-in',
            MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
            NoCatchOrFinally: 'Missing catch or finally after try',
            UnknownLabel: 'Undefined label \'%0\'',
            Redeclaration: '%0 \'%1\' has already been declared',
            IllegalContinue: 'Illegal continue statement',
            IllegalBreak: 'Illegal break statement',
            IllegalReturn: 'Illegal return statement',
            StrictModeWith: 'Strict mode code may not include a with statement',
            StrictCatchVariable: 'Catch variable may not be eval or arguments in strict mode',
            StrictVarName: 'Variable name may not be eval or arguments in strict mode',
            StrictParamName: 'Parameter name eval or arguments is not allowed in strict mode',
            StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
            StrictFunctionName: 'Function name may not be eval or arguments in strict mode',
            StrictOctalLiteral: 'Octal literals are not allowed in strict mode.',
            StrictDelete: 'Delete of an unqualified identifier in strict mode.',
            StrictDuplicateProperty: 'Duplicate data property in object literal not allowed in strict mode',
            AccessorDataProperty: 'Object literal may not have data and accessor property with the same name',
            AccessorGetSet: 'Object literal may not have multiple get/set accessors with the same name',
            StrictLHSAssignment: 'Assignment to eval or arguments is not allowed in strict mode',
            StrictLHSPostfix: 'Postfix increment/decrement may not have eval or arguments operand in strict mode',
            StrictLHSPrefix: 'Prefix increment/decrement may not have eval or arguments operand in strict mode',
            StrictReservedWord: 'Use of future reserved word in strict mode'
        };
    
        // See also tools/generate-unicode-regex.py.
        Regex = {
            NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
            NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
        };
    
        // Ensure the condition is true, otherwise throw an error.
        // This is only to have a better contract semantic, i.e. another safety net
        // to catch a logic error. The condition shall be fulfilled in normal case.
        // Do NOT use this to enforce a certain condition on any user input.
    
        function assert(condition, message) {
            /* istanbul ignore if */
            if (!condition) {
                throw new Error('ASSERT: ' + message);
            }
        }
    
        function isDecimalDigit(ch) {
            return (ch >= 0x30 && ch <= 0x39);   // 0..9
        }
    
        function isHexDigit(ch) {
            return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
        }
    
        function isOctalDigit(ch) {
            return '01234567'.indexOf(ch) >= 0;
        }
    
    
        // 7.2 White Space
    
        function isWhiteSpace(ch) {
            return (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
                (ch >= 0x1680 && [0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(ch) >= 0);
        }
    
        // 7.3 Line Terminators
    
        function isLineTerminator(ch) {
            return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029);
        }
    
        // 7.6 Identifier Names and Identifiers
    
        function isIdentifierStart(ch) {
            return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
                (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
                (ch >= 0x61 && ch <= 0x7A) ||         // a..z
                (ch === 0x5C) ||                      // \ (backslash)
                ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
        }
    
        function isIdentifierPart(ch) {
            return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
                (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
                (ch >= 0x61 && ch <= 0x7A) ||         // a..z
                (ch >= 0x30 && ch <= 0x39) ||         // 0..9
                (ch === 0x5C) ||                      // \ (backslash)
                ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
        }
    
        // 7.6.1.2 Future Reserved Words
    
        function isFutureReservedWord(id) {
            switch (id) {
            case 'class':
            case 'enum':
            case 'export':
            case 'extends':
            case 'import':
            case 'super':
                return true;
            default:
                return false;
            }
        }
    
        function isStrictModeReservedWord(id) {
            switch (id) {
            case 'implements':
            case 'interface':
            case 'package':
            case 'private':
            case 'protected':
            case 'public':
            case 'static':
            case 'yield':
            case 'let':
                return true;
            default:
                return false;
            }
        }
    
        function isRestrictedWord(id) {
            return id === 'eval' || id === 'arguments';
        }
    
        // 7.6.1.1 Keywords
    
        function isKeyword(id) {
            if (strict && isStrictModeReservedWord(id)) {
                return true;
            }
    
            // 'const' is specialized as Keyword in V8.
            // 'yield' and 'let' are for compatibility with SpiderMonkey and ES.next.
            // Some others are from future reserved words.
    
            switch (id.length) {
            case 2:
                return (id === 'if') || (id === 'in') || (id === 'do');
            case 3:
                return (id === 'var') || (id === 'for') || (id === 'new') ||
                    (id === 'try') || (id === 'let');
            case 4:
                return (id === 'this') || (id === 'else') || (id === 'case') ||
                    (id === 'void') || (id === 'with') || (id === 'enum');
            case 5:
                return (id === 'while') || (id === 'break') || (id === 'catch') ||
                    (id === 'throw') || (id === 'const') || (id === 'yield') ||
                    (id === 'class') || (id === 'super');
            case 6:
                return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                    (id === 'switch') || (id === 'export') || (id === 'import');
            case 7:
                return (id === 'default') || (id === 'finally') || (id === 'extends');
            case 8:
                return (id === 'function') || (id === 'continue') || (id === 'debugger');
            case 10:
                return (id === 'instanceof');
            default:
                return false;
            }
        }
    
        // 7.4 Comments
    
        function addComment(type, value, start, end, loc) {
            var comment;
    
            assert(typeof start === 'number', 'Comment must have valid position');
    
            // Because the way the actual token is scanned, often the comments
            // (if any) are skipped twice during the lexical analysis.
            // Thus, we need to skip adding a comment if the comment array already
            // handled it.
            if (state.lastCommentStart >= start) {
                return;
            }
            state.lastCommentStart = start;
    
            comment = {
                type: type,
                value: value
            };
            if (extra.range) {
                comment.range = [start, end];
            }
            if (extra.loc) {
                comment.loc = loc;
            }
            extra.comments.push(comment);
            if (extra.attachComment) {
                extra.leadingComments.push(comment);
                extra.trailingComments.push(comment);
            }
        }
    
        function skipSingleLineComment(offset) {
            var start, loc, ch, comment;
    
            start = index - offset;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart - offset
                }
            };
    
            while (index < length) {
                ch = source.charCodeAt(index);
                ++index;
                if (isLineTerminator(ch)) {
                    if (extra.comments) {
                        comment = source.slice(start + offset, index - 1);
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart - 1
                        };
                        addComment('Line', comment, start, index - 1, loc);
                    }
                    if (ch === 13 && source.charCodeAt(index) === 10) {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    return;
                }
            }
    
            if (extra.comments) {
                comment = source.slice(start + offset, index);
                loc.end = {
                    line: lineNumber,
                    column: index - lineStart
                };
                addComment('Line', comment, start, index, loc);
            }
        }
    
        function skipMultiLineComment() {
            var start, loc, ch, comment;
    
            if (extra.comments) {
                start = index - 2;
                loc = {
                    start: {
                        line: lineNumber,
                        column: index - lineStart - 2
                    }
                };
            }
    
            while (index < length) {
                ch = source.charCodeAt(index);
                if (isLineTerminator(ch)) {
                    if (ch === 0x0D && source.charCodeAt(index + 1) === 0x0A) {
                        ++index;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwUnexpectedToken();
                    }
                } else if (ch === 0x2A) {
                    // Block comment ends with '*/'.
                    if (source.charCodeAt(index + 1) === 0x2F) {
                        ++index;
                        ++index;
                        if (extra.comments) {
                            comment = source.slice(start + 2, index - 2);
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            addComment('Block', comment, start, index, loc);
                        }
                        return;
                    }
                    ++index;
                } else {
                    ++index;
                }
            }
    
            throwUnexpectedToken();
        }
    
        function skipComment() {
            var ch, start;
    
            start = (index === 0);
            while (index < length) {
                ch = source.charCodeAt(index);
    
                if (isWhiteSpace(ch)) {
                    ++index;
                } else if (isLineTerminator(ch)) {
                    ++index;
                    if (ch === 0x0D && source.charCodeAt(index) === 0x0A) {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    start = true;
                } else if (ch === 0x2F) { // U+002F is '/'
                    ch = source.charCodeAt(index + 1);
                    if (ch === 0x2F) {
                        ++index;
                        ++index;
                        skipSingleLineComment(2);
                        start = true;
                    } else if (ch === 0x2A) {  // U+002A is '*'
                        ++index;
                        ++index;
                        skipMultiLineComment();
                    } else {
                        break;
                    }
                } else if (start && ch === 0x2D) { // U+002D is '-'
                    // U+003E is '>'
                    if ((source.charCodeAt(index + 1) === 0x2D) && (source.charCodeAt(index + 2) === 0x3E)) {
                        // '-->' is a single-line comment
                        index += 3;
                        skipSingleLineComment(3);
                    } else {
                        break;
                    }
                } else if (ch === 0x3C) { // U+003C is '<'
                    if (source.slice(index + 1, index + 4) === '!--') {
                        ++index; // `<`
                        ++index; // `!`
                        ++index; // `-`
                        ++index; // `-`
                        skipSingleLineComment(4);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    
        function scanHexEscape(prefix) {
            var i, len, ch, code = 0;
    
            len = (prefix === 'u') ? 4 : 2;
            for (i = 0; i < len; ++i) {
                if (index < length && isHexDigit(source[index])) {
                    ch = source[index++];
                    code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
                } else {
                    return '';
                }
            }
            return String.fromCharCode(code);
        }
    
        function scanUnicodeCodePointEscape() {
            var ch, code, cu1, cu2;
    
            ch = source[index];
            code = 0;
    
            // At least, one hex digit is required.
            if (ch === '}') {
                throwUnexpectedToken();
            }
    
            while (index < length) {
                ch = source[index++];
                if (!isHexDigit(ch)) {
                    break;
                }
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            }
    
            if (code > 0x10FFFF || ch !== '}') {
                throwUnexpectedToken();
            }
    
            // UTF-16 Encoding
            if (code <= 0xFFFF) {
                return String.fromCharCode(code);
            }
            cu1 = ((code - 0x10000) >> 10) + 0xD800;
            cu2 = ((code - 0x10000) & 1023) + 0xDC00;
            return String.fromCharCode(cu1, cu2);
        }
    
        function getEscapedIdentifier() {
            var ch, id;
    
            ch = source.charCodeAt(index++);
            id = String.fromCharCode(ch);
    
            // '\u' (U+005C, U+0075) denotes an escaped character.
            if (ch === 0x5C) {
                if (source.charCodeAt(index) !== 0x75) {
                    throwUnexpectedToken();
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                    throwUnexpectedToken();
                }
                id = ch;
            }
    
            while (index < length) {
                ch = source.charCodeAt(index);
                if (!isIdentifierPart(ch)) {
                    break;
                }
                ++index;
                id += String.fromCharCode(ch);
    
                // '\u' (U+005C, U+0075) denotes an escaped character.
                if (ch === 0x5C) {
                    id = id.substr(0, id.length - 1);
                    if (source.charCodeAt(index) !== 0x75) {
                        throwUnexpectedToken();
                    }
                    ++index;
                    ch = scanHexEscape('u');
                    if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                        throwUnexpectedToken();
                    }
                    id += ch;
                }
            }
    
            return id;
        }
    
        function getIdentifier() {
            var start, ch;
    
            start = index++;
            while (index < length) {
                ch = source.charCodeAt(index);
                if (ch === 0x5C) {
                    // Blackslash (U+005C) marks Unicode escape sequence.
                    index = start;
                    return getEscapedIdentifier();
                }
                if (isIdentifierPart(ch)) {
                    ++index;
                } else {
                    break;
                }
            }
    
            return source.slice(start, index);
        }
    
        function scanIdentifier() {
            var start, id, type;
    
            start = index;
    
            // Backslash (U+005C) starts an escaped character.
            id = (source.charCodeAt(index) === 0x5C) ? getEscapedIdentifier() : getIdentifier();
    
            // There is no keyword or literal with only one character.
            // Thus, it must be an identifier.
            if (id.length === 1) {
                type = Token.Identifier;
            } else if (isKeyword(id)) {
                type = Token.Keyword;
            } else if (id === 'null') {
                type = Token.NullLiteral;
            } else if (id === 'true' || id === 'false') {
                type = Token.BooleanLiteral;
            } else {
                type = Token.Identifier;
            }
    
            return {
                type: type,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
    
        // 7.7 Punctuators
    
        function scanPunctuator() {
            var start = index,
                code = source.charCodeAt(index),
                code2,
                ch1 = source[index],
                ch2,
                ch3,
                ch4;
    
            switch (code) {
    
            // Check for most common single-character punctuators.
            case 0x2E:  // . dot
            case 0x28:  // ( open bracket
            case 0x29:  // ) close bracket
            case 0x3B:  // ; semicolon
            case 0x2C:  // , comma
            case 0x7B:  // { open curly brace
            case 0x7D:  // } close curly brace
            case 0x5B:  // [
            case 0x5D:  // ]
            case 0x3A:  // :
            case 0x3F:  // ?
            case 0x7E:  // ~
                ++index;
                if (extra.tokenize) {
                    if (code === 0x28) {
                        extra.openParenToken = extra.tokens.length;
                    } else if (code === 0x7B) {
                        extra.openCurlyToken = extra.tokens.length;
                    }
                }
                return {
                    type: Token.Punctuator,
                    value: String.fromCharCode(code),
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
    
            default:
                code2 = source.charCodeAt(index + 1);
    
                // '=' (U+003D) marks an assignment or comparison operator.
                if (code2 === 0x3D) {
                    switch (code) {
                    case 0x2B:  // +
                    case 0x2D:  // -
                    case 0x2F:  // /
                    case 0x3C:  // <
                    case 0x3E:  // >
                    case 0x5E:  // ^
                    case 0x7C:  // |
                    case 0x25:  // %
                    case 0x26:  // &
                    case 0x2A:  // *
                        index += 2;
                        return {
                            type: Token.Punctuator,
                            value: String.fromCharCode(code) + String.fromCharCode(code2),
                            lineNumber: lineNumber,
                            lineStart: lineStart,
                            start: start,
                            end: index
                        };
    
                    case 0x21: // !
                    case 0x3D: // =
                        index += 2;
    
                        // !== and ===
                        if (source.charCodeAt(index) === 0x3D) {
                            ++index;
                        }
                        return {
                            type: Token.Punctuator,
                            value: source.slice(start, index),
                            lineNumber: lineNumber,
                            lineStart: lineStart,
                            start: start,
                            end: index
                        };
                    }
                }
            }
    
            // 4-character punctuator: >>>=
    
            ch4 = source.substr(index, 4);
    
            if (ch4 === '>>>=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: ch4,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
            }
    
            // 3-character punctuators: === !== >>> <<= >>=
    
            ch3 = ch4.substr(0, 3);
    
            if (ch3 === '>>>' || ch3 === '<<=' || ch3 === '>>=') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: ch3,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
            }
    
            // Other 2-character punctuators: ++ -- << >> && ||
            ch2 = ch3.substr(0, 2);
    
            if ((ch1 === ch2[1] && ('+-<>&|'.indexOf(ch1) >= 0)) || ch2 === '=>') {
                index += 2;
                return {
                    type: Token.Punctuator,
                    value: ch2,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
            }
    
            // 1-character punctuators: < > = ! + - * % & | ^ /
    
            if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
                ++index;
                return {
                    type: Token.Punctuator,
                    value: ch1,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
            }
    
            throwUnexpectedToken();
        }
    
        // 7.8.3 Numeric Literals
    
        function scanHexLiteral(start) {
            var number = '';
    
            while (index < length) {
                if (!isHexDigit(source[index])) {
                    break;
                }
                number += source[index++];
            }
    
            if (number.length === 0) {
                throwUnexpectedToken();
            }
    
            if (isIdentifierStart(source.charCodeAt(index))) {
                throwUnexpectedToken();
            }
    
            return {
                type: Token.NumericLiteral,
                value: parseInt('0x' + number, 16),
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
        function scanBinaryLiteral(start) {
            var ch, number;
    
            number = '';
    
            while (index < length) {
                ch = source[index];
                if (ch !== '0' && ch !== '1') {
                    break;
                }
                number += source[index++];
            }
    
            if (number.length === 0) {
                // only 0b or 0B
                throwUnexpectedToken();
            }
    
            if (index < length) {
                ch = source.charCodeAt(index);
                /* istanbul ignore else */
                if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                    throwUnexpectedToken();
                }
            }
    
            return {
                type: Token.NumericLiteral,
                value: parseInt(number, 2),
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
        function scanOctalLiteral(prefix, start) {
            var number, octal;
    
            if (isOctalDigit(prefix)) {
                octal = true;
                number = '0' + source[index++];
            } else {
                octal = false;
                ++index;
                number = '';
            }
    
            while (index < length) {
                if (!isOctalDigit(source[index])) {
                    break;
                }
                number += source[index++];
            }
    
            if (!octal && number.length === 0) {
                // only 0o or 0O
                throwUnexpectedToken();
            }
    
            if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
                throwUnexpectedToken();
            }
    
            return {
                type: Token.NumericLiteral,
                value: parseInt(number, 8),
                octal: octal,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
        function isImplicitOctalLiteral() {
            var i, ch;
    
            // Implicit octal, unless there is a non-octal digit.
            // (Annex B.1.1 on Numeric Literals)
            for (i = index + 1; i < length; ++i) {
                ch = source[i];
                if (ch === '8' || ch === '9') {
                    return false;
                }
                if (!isOctalDigit(ch)) {
                    return true;
                }
            }
    
            return true;
        }
    
        function scanNumericLiteral() {
            var number, start, ch;
    
            ch = source[index];
            assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
                'Numeric literal must start with a decimal digit or a decimal point');
    
            start = index;
            number = '';
            if (ch !== '.') {
                number = source[index++];
                ch = source[index];
    
                // Hex number starts with '0x'.
                // Octal number starts with '0'.
                // Octal number in ES6 starts with '0o'.
                // Binary number in ES6 starts with '0b'.
                if (number === '0') {
                    if (ch === 'x' || ch === 'X') {
                        ++index;
                        return scanHexLiteral(start);
                    }
                    if (ch === 'b' || ch === 'B') {
                        ++index;
                        return scanBinaryLiteral(start);
                    }
                    if (ch === 'o' || ch === 'O') {
                        return scanOctalLiteral(ch, start);
                    }
    
                    if (isOctalDigit(ch)) {
                        if (isImplicitOctalLiteral()) {
                            return scanOctalLiteral(ch, start);
                        }
                    }
                }
    
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
                ch = source[index];
            }
    
            if (ch === '.') {
                number += source[index++];
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
                ch = source[index];
            }
    
            if (ch === 'e' || ch === 'E') {
                number += source[index++];
    
                ch = source[index];
                if (ch === '+' || ch === '-') {
                    number += source[index++];
                }
                if (isDecimalDigit(source.charCodeAt(index))) {
                    while (isDecimalDigit(source.charCodeAt(index))) {
                        number += source[index++];
                    }
                } else {
                    throwUnexpectedToken();
                }
            }
    
            if (isIdentifierStart(source.charCodeAt(index))) {
                throwUnexpectedToken();
            }
    
            return {
                type: Token.NumericLiteral,
                value: parseFloat(number),
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
        // 7.8.4 String Literals
    
        function scanStringLiteral() {
            var str = '', quote, start, ch, code, unescaped, restore, octal = false, startLineNumber, startLineStart;
            startLineNumber = lineNumber;
            startLineStart = lineStart;
    
            quote = source[index];
            assert((quote === '\'' || quote === '"'),
                'String literal must starts with a quote');
    
            start = index;
            ++index;
    
            while (index < length) {
                ch = source[index++];
    
                if (ch === quote) {
                    quote = '';
                    break;
                } else if (ch === '\\') {
                    ch = source[index++];
                    if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                        switch (ch) {
                        case 'u':
                        case 'x':
                            if (source[index] === '{') {
                                ++index;
                                str += scanUnicodeCodePointEscape();
                            } else {
                                restore = index;
                                unescaped = scanHexEscape(ch);
                                if (unescaped) {
                                    str += unescaped;
                                } else {
                                    index = restore;
                                    str += ch;
                                }
                            }
                            break;
                        case 'n':
                            str += '\n';
                            break;
                        case 'r':
                            str += '\r';
                            break;
                        case 't':
                            str += '\t';
                            break;
                        case 'b':
                            str += '\b';
                            break;
                        case 'f':
                            str += '\f';
                            break;
                        case 'v':
                            str += '\x0B';
                            break;
    
                        default:
                            if (isOctalDigit(ch)) {
                                code = '01234567'.indexOf(ch);
    
                                // \0 is not octal escape sequence
                                if (code !== 0) {
                                    octal = true;
                                }
    
                                if (index < length && isOctalDigit(source[index])) {
                                    octal = true;
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
    
                                    // 3 digits are only allowed when string starts
                                    // with 0, 1, 2, 3
                                    if ('0123'.indexOf(ch) >= 0 &&
                                            index < length &&
                                            isOctalDigit(source[index])) {
                                        code = code * 8 + '01234567'.indexOf(source[index++]);
                                    }
                                }
                                str += String.fromCharCode(code);
                            } else {
                                str += ch;
                            }
                            break;
                        }
                    } else {
                        ++lineNumber;
                        if (ch === '\r' && source[index] === '\n') {
                            ++index;
                        }
                        lineStart = index;
                    }
                } else if (isLineTerminator(ch.charCodeAt(0))) {
                    break;
                } else {
                    str += ch;
                }
            }
    
            if (quote !== '') {
                throwUnexpectedToken();
            }
    
            return {
                type: Token.StringLiteral,
                value: str,
                octal: octal,
                startLineNumber: startLineNumber,
                startLineStart: startLineStart,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }
    
        function testRegExp(pattern, flags) {
            var tmp = pattern,
                value;
    
            if (flags.indexOf('u') >= 0) {
                // Replace each astral symbol and every Unicode code point
                // escape sequence with a single ASCII symbol to avoid throwing on
                // regular expressions that are only valid in combination with the
                // `/u` flag.
                // Note: replacing with the ASCII symbol `x` might cause false
                // negatives in unlikely scenarios. For example, `[\u{61}-b]` is a
                // perfectly valid pattern that is equivalent to `[a-b]`, but it
                // would be replaced by `[x-b]` which throws an error.
                tmp = tmp
                    .replace(/\\u\{([0-9a-fA-F]+)\}/g, function ($0, $1) {
                        if (parseInt($1, 16) <= 0x10FFFF) {
                            return 'x';
                        }
                        throwError(Messages.InvalidRegExp);
                    })
                    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 'x');
            }
    
            // First, detect invalid regular expressions.
            try {
                value = new RegExp(tmp);
            } catch (e) {
                throwError(Messages.InvalidRegExp);
            }
    
            // Return a regular expression object for this pattern-flag pair, or
            // `null` in case the current environment doesn't support the flags it
            // uses.
            try {
                return new RegExp(pattern, flags);
            } catch (exception) {
                return null;
            }
        }
    
        function scanRegExpBody() {
            var ch, str, classMarker, terminated, body;
    
            ch = source[index];
            assert(ch === '/', 'Regular expression literal must start with a slash');
            str = source[index++];
    
            classMarker = false;
            terminated = false;
            while (index < length) {
                ch = source[index++];
                str += ch;
                if (ch === '\\') {
                    ch = source[index++];
                    // ECMA-262 7.8.5
                    if (isLineTerminator(ch.charCodeAt(0))) {
                        throwError(Messages.UnterminatedRegExp);
                    }
                    str += ch;
                } else if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError(Messages.UnterminatedRegExp);
                } else if (classMarker) {
                    if (ch === ']') {
                        classMarker = false;
                    }
                } else {
                    if (ch === '/') {
                        terminated = true;
                        break;
                    } else if (ch === '[') {
                        classMarker = true;
                    }
                }
            }
    
            if (!terminated) {
                throwError(Messages.UnterminatedRegExp);
            }
    
            // Exclude leading and trailing slash.
            body = str.substr(1, str.length - 2);
            return {
                value: body,
                literal: str
            };
        }
    
        function scanRegExpFlags() {
            var ch, str, flags, restore;
    
            str = '';
            flags = '';
            while (index < length) {
                ch = source[index];
                if (!isIdentifierPart(ch.charCodeAt(0))) {
                    break;
                }
    
                ++index;
                if (ch === '\\' && index < length) {
                    ch = source[index];
                    if (ch === 'u') {
                        ++index;
                        restore = index;
                        ch = scanHexEscape('u');
                        if (ch) {
                            flags += ch;
                            for (str += '\\u'; restore < index; ++restore) {
                                str += source[restore];
                            }
                        } else {
                            index = restore;
                            flags += 'u';
                            str += '\\u';
                        }
                        tolerateUnexpectedToken();
                    } else {
                        str += '\\';
                        tolerateUnexpectedToken();
                    }
                } else {
                    flags += ch;
                    str += ch;
                }
            }
    
            return {
                value: flags,
                literal: str
            };
        }
    
        function scanRegExp() {
            var start, body, flags, value;
    
            lookahead = null;
            skipComment();
            start = index;
    
            body = scanRegExpBody();
            flags = scanRegExpFlags();
            value = testRegExp(body.value, flags.value);
    
            if (extra.tokenize) {
                return {
                    type: Token.RegularExpression,
                    value: value,
                    regex: {
                        pattern: body.value,
                        flags: flags.value
                    },
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: start,
                    end: index
                };
            }
    
            return {
                literal: body.literal + flags.literal,
                value: value,
                regex: {
                    pattern: body.value,
                    flags: flags.value
                },
                start: start,
                end: index
            };
        }
    
        function collectRegex() {
            var pos, loc, regex, token;
    
            skipComment();
    
            pos = index;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };
    
            regex = scanRegExp();
    
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
    
            /* istanbul ignore next */
            if (!extra.tokenize) {
                // Pop the previous token, which is likely '/' or '/='
                if (extra.tokens.length > 0) {
                    token = extra.tokens[extra.tokens.length - 1];
                    if (token.range[0] === pos && token.type === 'Punctuator') {
                        if (token.value === '/' || token.value === '/=') {
                            extra.tokens.pop();
                        }
                    }
                }
    
                extra.tokens.push({
                    type: 'RegularExpression',
                    value: regex.literal,
                    regex: regex.regex,
                    range: [pos, index],
                    loc: loc
                });
            }
    
            return regex;
        }
    
        function isIdentifierName(token) {
            return token.type === Token.Identifier ||
                token.type === Token.Keyword ||
                token.type === Token.BooleanLiteral ||
                token.type === Token.NullLiteral;
        }
    
        function advanceSlash() {
            var prevToken,
                checkToken;
            // Using the following algorithm:
            // https://github.com/mozilla/sweet.js/wiki/design
            prevToken = extra.tokens[extra.tokens.length - 1];
            if (!prevToken) {
                // Nothing before that: it cannot be a division.
                return collectRegex();
            }
            if (prevToken.type === 'Punctuator') {
                if (prevToken.value === ']') {
                    return scanPunctuator();
                }
                if (prevToken.value === ')') {
                    checkToken = extra.tokens[extra.openParenToken - 1];
                    if (checkToken &&
                            checkToken.type === 'Keyword' &&
                            (checkToken.value === 'if' ||
                             checkToken.value === 'while' ||
                             checkToken.value === 'for' ||
                             checkToken.value === 'with')) {
                        return collectRegex();
                    }
                    return scanPunctuator();
                }
                if (prevToken.value === '}') {
                    // Dividing a function by anything makes little sense,
                    // but we have to check for that.
                    if (extra.tokens[extra.openCurlyToken - 3] &&
                            extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                        // Anonymous function.
                        checkToken = extra.tokens[extra.openCurlyToken - 4];
                        if (!checkToken) {
                            return scanPunctuator();
                        }
                    } else if (extra.tokens[extra.openCurlyToken - 4] &&
                            extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                        // Named function.
                        checkToken = extra.tokens[extra.openCurlyToken - 5];
                        if (!checkToken) {
                            return collectRegex();
                        }
                    } else {
                        return scanPunctuator();
                    }
                    // checkToken determines whether the function is
                    // a declaration or an expression.
                    if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                        // It is an expression.
                        return scanPunctuator();
                    }
                    // It is a declaration.
                    return collectRegex();
                }
                return collectRegex();
            }
            if (prevToken.type === 'Keyword' && prevToken.value !== 'this') {
                return collectRegex();
            }
            return scanPunctuator();
        }
    
        function advance() {
            var ch;
    
            skipComment();
    
            if (index >= length) {
                return {
                    type: Token.EOF,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    start: index,
                    end: index
                };
            }
    
            ch = source.charCodeAt(index);
    
            if (isIdentifierStart(ch)) {
                return scanIdentifier();
            }
    
            // Very common: ( and ) and ;
            if (ch === 0x28 || ch === 0x29 || ch === 0x3B) {
                return scanPunctuator();
            }
    
            // String literal starts with single quote (U+0027) or double quote (U+0022).
            if (ch === 0x27 || ch === 0x22) {
                return scanStringLiteral();
            }
    
    
            // Dot (.) U+002E can also start a floating-point number, hence the need
            // to check the next character.
            if (ch === 0x2E) {
                if (isDecimalDigit(source.charCodeAt(index + 1))) {
                    return scanNumericLiteral();
                }
                return scanPunctuator();
            }
    
            if (isDecimalDigit(ch)) {
                return scanNumericLiteral();
            }
    
            // Slash (/) U+002F can also start a regex.
            if (extra.tokenize && ch === 0x2F) {
                return advanceSlash();
            }
    
            return scanPunctuator();
        }
    
        function collectToken() {
            var loc, token, value, entry;
    
            skipComment();
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };
    
            token = advance();
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
    
            if (token.type !== Token.EOF) {
                value = source.slice(token.start, token.end);
                entry = {
                    type: TokenName[token.type],
                    value: value,
                    range: [token.start, token.end],
                    loc: loc
                };
                if (token.regex) {
                    entry.regex = {
                        pattern: token.regex.pattern,
                        flags: token.regex.flags
                    };
                }
                extra.tokens.push(entry);
            }
    
            return token;
        }
    
        function lex() {
            var token;
    
            token = lookahead;
            index = token.end;
            lineNumber = token.lineNumber;
            lineStart = token.lineStart;
    
            lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
    
            index = token.end;
            lineNumber = token.lineNumber;
            lineStart = token.lineStart;
    
            return token;
        }
    
        function peek() {
            var pos, line, start;
    
            pos = index;
            line = lineNumber;
            start = lineStart;
            lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
            index = pos;
            lineNumber = line;
            lineStart = start;
        }
    
        function Position() {
            this.line = lineNumber;
            this.column = index - lineStart;
        }
    
        function SourceLocation() {
            this.start = new Position();
            this.end = null;
        }
    
        function WrappingSourceLocation(startToken) {
            if (startToken.type === Token.StringLiteral) {
                this.start = {
                    line: startToken.startLineNumber,
                    column: startToken.start - startToken.startLineStart
                };
            } else {
                this.start = {
                    line: startToken.lineNumber,
                    column: startToken.start - startToken.lineStart
                };
            }
            this.end = null;
        }
    
        function Node() {
            // Skip comment.
            index = lookahead.start;
            if (lookahead.type === Token.StringLiteral) {
                lineNumber = lookahead.startLineNumber;
                lineStart = lookahead.startLineStart;
            } else {
                lineNumber = lookahead.lineNumber;
                lineStart = lookahead.lineStart;
            }
            if (extra.range) {
                this.range = [index, 0];
            }
            if (extra.loc) {
                this.loc = new SourceLocation();
            }
        }
    
        function WrappingNode(startToken) {
            if (extra.range) {
                this.range = [startToken.start, 0];
            }
            if (extra.loc) {
                this.loc = new WrappingSourceLocation(startToken);
            }
        }
    
        WrappingNode.prototype = Node.prototype = {
    
            processComment: function () {
                var lastChild,
                    leadingComments,
                    trailingComments,
                    bottomRight = extra.bottomRightStack,
                    i,
                    comment,
                    last = bottomRight[bottomRight.length - 1];
    
                if (this.type === Syntax.Program) {
                    if (this.body.length > 0) {
                        return;
                    }
                }
    
                if (extra.trailingComments.length > 0) {
                    trailingComments = [];
                    for (i = extra.trailingComments.length - 1; i >= 0; --i) {
                        comment = extra.trailingComments[i];
                        if (comment.range[0] >= this.range[1]) {
                            trailingComments.unshift(comment);
                            extra.trailingComments.splice(i, 1);
                        }
                    }
                    extra.trailingComments = [];
                } else {
                    if (last && last.trailingComments && last.trailingComments[0].range[0] >= this.range[1]) {
                        trailingComments = last.trailingComments;
                        delete last.trailingComments;
                    }
                }
    
                // Eating the stack.
                if (last) {
                    while (last && last.range[0] >= this.range[0]) {
                        lastChild = last;
                        last = bottomRight.pop();
                    }
                }
    
                if (lastChild) {
                    if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= this.range[0]) {
                        this.leadingComments = lastChild.leadingComments;
                        lastChild.leadingComments = undefined;
                    }
                } else if (extra.leadingComments.length > 0) {
                    leadingComments = [];
                    for (i = extra.leadingComments.length - 1; i >= 0; --i) {
                        comment = extra.leadingComments[i];
                        if (comment.range[1] <= this.range[0]) {
                            leadingComments.unshift(comment);
                            extra.leadingComments.splice(i, 1);
                        }
                    }
                }
    
    
                if (leadingComments && leadingComments.length > 0) {
                    this.leadingComments = leadingComments;
                }
                if (trailingComments && trailingComments.length > 0) {
                    this.trailingComments = trailingComments;
                }
    
                bottomRight.push(this);
            },
    
            finish: function () {
                if (extra.range) {
                    this.range[1] = index;
                }
                if (extra.loc) {
                    this.loc.end = new Position();
                    if (extra.source) {
                        this.loc.source = extra.source;
                    }
                }
    
                if (extra.attachComment) {
                    this.processComment();
                }
            },
    
            finishArrayExpression: function (elements) {
                this.type = Syntax.ArrayExpression;
                this.elements = elements;
                this.finish();
                return this;
            },
    
            finishArrowFunctionExpression: function (params, defaults, body, expression) {
                this.type = Syntax.ArrowFunctionExpression;
                this.id = null;
                this.params = params;
                this.defaults = defaults;
                this.body = body;
                this.rest = null;
                this.generator = false;
                this.expression = expression;
                this.finish();
                return this;
            },
    
            finishAssignmentExpression: function (operator, left, right) {
                this.type = Syntax.AssignmentExpression;
                this.operator = operator;
                this.left = left;
                this.right = right;
                this.finish();
                return this;
            },
    
            finishBinaryExpression: function (operator, left, right) {
                this.type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression : Syntax.BinaryExpression;
                this.operator = operator;
                this.left = left;
                this.right = right;
                this.finish();
                return this;
            },
    
            finishBlockStatement: function (body) {
                this.type = Syntax.BlockStatement;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishBreakStatement: function (label) {
                this.type = Syntax.BreakStatement;
                this.label = label;
                this.finish();
                return this;
            },
    
            finishCallExpression: function (callee, args) {
                this.type = Syntax.CallExpression;
                this.callee = callee;
                this.arguments = args;
                this.finish();
                return this;
            },
    
            finishCatchClause: function (param, body) {
                this.type = Syntax.CatchClause;
                this.param = param;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishConditionalExpression: function (test, consequent, alternate) {
                this.type = Syntax.ConditionalExpression;
                this.test = test;
                this.consequent = consequent;
                this.alternate = alternate;
                this.finish();
                return this;
            },
    
            finishContinueStatement: function (label) {
                this.type = Syntax.ContinueStatement;
                this.label = label;
                this.finish();
                return this;
            },
    
            finishDebuggerStatement: function () {
                this.type = Syntax.DebuggerStatement;
                this.finish();
                return this;
            },
    
            finishDoWhileStatement: function (body, test) {
                this.type = Syntax.DoWhileStatement;
                this.body = body;
                this.test = test;
                this.finish();
                return this;
            },
    
            finishEmptyStatement: function () {
                this.type = Syntax.EmptyStatement;
                this.finish();
                return this;
            },
    
            finishExpressionStatement: function (expression) {
                this.type = Syntax.ExpressionStatement;
                this.expression = expression;
                this.finish();
                return this;
            },
    
            finishForStatement: function (init, test, update, body) {
                this.type = Syntax.ForStatement;
                this.init = init;
                this.test = test;
                this.update = update;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishForInStatement: function (left, right, body) {
                this.type = Syntax.ForInStatement;
                this.left = left;
                this.right = right;
                this.body = body;
                this.each = false;
                this.finish();
                return this;
            },
    
            finishFunctionDeclaration: function (id, params, defaults, body) {
                this.type = Syntax.FunctionDeclaration;
                this.id = id;
                this.params = params;
                this.defaults = defaults;
                this.body = body;
                this.rest = null;
                this.generator = false;
                this.expression = false;
                this.finish();
                return this;
            },
    
            finishFunctionExpression: function (id, params, defaults, body) {
                this.type = Syntax.FunctionExpression;
                this.id = id;
                this.params = params;
                this.defaults = defaults;
                this.body = body;
                this.rest = null;
                this.generator = false;
                this.expression = false;
                this.finish();
                return this;
            },
    
            finishIdentifier: function (name) {
                this.type = Syntax.Identifier;
                this.name = name;
                this.finish();
                return this;
            },
    
            finishIfStatement: function (test, consequent, alternate) {
                this.type = Syntax.IfStatement;
                this.test = test;
                this.consequent = consequent;
                this.alternate = alternate;
                this.finish();
                return this;
            },
    
            finishLabeledStatement: function (label, body) {
                this.type = Syntax.LabeledStatement;
                this.label = label;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishLiteral: function (token) {
                this.type = Syntax.Literal;
                this.value = token.value;
                this.raw = source.slice(token.start, token.end);
                if (token.regex) {
                    this.regex = token.regex;
                }
                this.finish();
                return this;
            },
    
            finishMemberExpression: function (accessor, object, property) {
                this.type = Syntax.MemberExpression;
                this.computed = accessor === '[';
                this.object = object;
                this.property = property;
                this.finish();
                return this;
            },
    
            finishNewExpression: function (callee, args) {
                this.type = Syntax.NewExpression;
                this.callee = callee;
                this.arguments = args;
                this.finish();
                return this;
            },
    
            finishObjectExpression: function (properties) {
                this.type = Syntax.ObjectExpression;
                this.properties = properties;
                this.finish();
                return this;
            },
    
            finishPostfixExpression: function (operator, argument) {
                this.type = Syntax.UpdateExpression;
                this.operator = operator;
                this.argument = argument;
                this.prefix = false;
                this.finish();
                return this;
            },
    
            finishProgram: function (body) {
                this.type = Syntax.Program;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishProperty: function (kind, key, value, method, shorthand) {
                this.type = Syntax.Property;
                this.key = key;
                this.value = value;
                this.kind = kind;
                this.method = method;
                this.shorthand = shorthand;
                this.finish();
                return this;
            },
    
            finishReturnStatement: function (argument) {
                this.type = Syntax.ReturnStatement;
                this.argument = argument;
                this.finish();
                return this;
            },
    
            finishSequenceExpression: function (expressions) {
                this.type = Syntax.SequenceExpression;
                this.expressions = expressions;
                this.finish();
                return this;
            },
    
            finishSwitchCase: function (test, consequent) {
                this.type = Syntax.SwitchCase;
                this.test = test;
                this.consequent = consequent;
                this.finish();
                return this;
            },
    
            finishSwitchStatement: function (discriminant, cases) {
                this.type = Syntax.SwitchStatement;
                this.discriminant = discriminant;
                this.cases = cases;
                this.finish();
                return this;
            },
    
            finishThisExpression: function () {
                this.type = Syntax.ThisExpression;
                this.finish();
                return this;
            },
    
            finishThrowStatement: function (argument) {
                this.type = Syntax.ThrowStatement;
                this.argument = argument;
                this.finish();
                return this;
            },
    
            finishTryStatement: function (block, guardedHandlers, handlers, finalizer) {
                this.type = Syntax.TryStatement;
                this.block = block;
                this.guardedHandlers = guardedHandlers;
                this.handlers = handlers;
                this.finalizer = finalizer;
                this.finish();
                return this;
            },
    
            finishUnaryExpression: function (operator, argument) {
                this.type = (operator === '++' || operator === '--') ? Syntax.UpdateExpression : Syntax.UnaryExpression;
                this.operator = operator;
                this.argument = argument;
                this.prefix = true;
                this.finish();
                return this;
            },
    
            finishVariableDeclaration: function (declarations, kind) {
                this.type = Syntax.VariableDeclaration;
                this.declarations = declarations;
                this.kind = kind;
                this.finish();
                return this;
            },
    
            finishVariableDeclarator: function (id, init) {
                this.type = Syntax.VariableDeclarator;
                this.id = id;
                this.init = init;
                this.finish();
                return this;
            },
    
            finishWhileStatement: function (test, body) {
                this.type = Syntax.WhileStatement;
                this.test = test;
                this.body = body;
                this.finish();
                return this;
            },
    
            finishWithStatement: function (object, body) {
                this.type = Syntax.WithStatement;
                this.object = object;
                this.body = body;
                this.finish();
                return this;
            }
        };
    
        // Return true if there is a line terminator before the next token.
    
        function peekLineTerminator() {
            var pos, line, start, found;
    
            pos = index;
            line = lineNumber;
            start = lineStart;
            skipComment();
            found = lineNumber !== line;
            index = pos;
            lineNumber = line;
            lineStart = start;
    
            return found;
        }
    
        function createError(line, pos, description) {
            var error = new Error('Line ' + line + ': ' + description);
            error.index = pos;
            error.lineNumber = line;
            error.column = pos - lineStart + 1;
            error.description = description;
            return error;
        }
    
        // Throw an exception
    
        function throwError(messageFormat) {
            var args, msg;
    
            args = Array.prototype.slice.call(arguments, 1);
            msg = messageFormat.replace(/%(\d)/g,
                function (whole, idx) {
                    assert(idx < args.length, 'Message reference must be in range');
                    return args[idx];
                }
            );
    
            throw createError(lineNumber, index, msg);
        }
    
        function tolerateError(messageFormat) {
            var args, msg, error;
    
            args = Array.prototype.slice.call(arguments, 1);
            /* istanbul ignore next */
            msg = messageFormat.replace(/%(\d)/g,
                function (whole, idx) {
                    assert(idx < args.length, 'Message reference must be in range');
                    return args[idx];
                }
            );
    
            error = createError(lineNumber, index, msg);
            if (extra.errors) {
                extra.errors.push(error);
            } else {
                throw error;
            }
        }
    
        // Throw an exception because of the token.
    
        function unexpectedTokenError(token, message) {
            var msg = Messages.UnexpectedToken;
    
            if (token) {
                msg = message ? message :
                    (token.type === Token.EOF) ? Messages.UnexpectedEOS :
                    (token.type === Token.Identifier) ? Messages.UnexpectedIdentifier :
                    (token.type === Token.NumericLiteral) ? Messages.UnexpectedNumber :
                    (token.type === Token.StringLiteral) ? Messages.UnexpectedString :
                    Messages.UnexpectedToken;
    
                if (token.type === Token.Keyword) {
                    if (isFutureReservedWord(token.value)) {
                        msg = Messages.UnexpectedReserved;
                    } else if (strict && isStrictModeReservedWord(token.value)) {
                        msg = Messages.StrictReservedWord;
                    }
                }
            }
    
            msg = msg.replace('%0', token ? token.value : 'ILLEGAL');
    
            return (token && typeof token.lineNumber === 'number') ?
                createError(token.lineNumber, token.start, msg) :
                createError(lineNumber, index, msg);
        }
    
        function throwUnexpectedToken(token, message) {
            throw unexpectedTokenError(token, message);
        }
    
        function tolerateUnexpectedToken(token, message) {
            var error = unexpectedTokenError(token, message);
            if (extra.errors) {
                extra.errors.push(error);
            } else {
                throw error;
            }
        }
    
        // Expect the next token to match the specified punctuator.
        // If not, an exception will be thrown.
    
        function expect(value) {
            var token = lex();
            if (token.type !== Token.Punctuator || token.value !== value) {
                throwUnexpectedToken(token);
            }
        }
    
        /**
         * @name expectCommaSeparator
         * @description Quietly expect a comma when in tolerant mode, otherwise delegates
         * to <code>expect(value)</code>
         * @since 2.0
         */
        function expectCommaSeparator() {
            var token;
    
            if (extra.errors) {
                token = lookahead;
                if (token.type === Token.Punctuator && token.value === ',') {
                    lex();
                } else if (token.type === Token.Punctuator && token.value === ';') {
                    lex();
                    tolerateUnexpectedToken(token);
                } else {
                    tolerateUnexpectedToken(token, Messages.UnexpectedToken);
                }
            } else {
                expect(',');
            }
        }
    
        // Expect the next token to match the specified keyword.
        // If not, an exception will be thrown.
    
        function expectKeyword(keyword) {
            var token = lex();
            if (token.type !== Token.Keyword || token.value !== keyword) {
                throwUnexpectedToken(token);
            }
        }
    
        // Return true if the next token matches the specified punctuator.
    
        function match(value) {
            return lookahead.type === Token.Punctuator && lookahead.value === value;
        }
    
        // Return true if the next token matches the specified keyword
    
        function matchKeyword(keyword) {
            return lookahead.type === Token.Keyword && lookahead.value === keyword;
        }
    
        // Return true if the next token is an assignment operator
    
        function matchAssign() {
            var op;
    
            if (lookahead.type !== Token.Punctuator) {
                return false;
            }
            op = lookahead.value;
            return op === '=' ||
                op === '*=' ||
                op === '/=' ||
                op === '%=' ||
                op === '+=' ||
                op === '-=' ||
                op === '<<=' ||
                op === '>>=' ||
                op === '>>>=' ||
                op === '&=' ||
                op === '^=' ||
                op === '|=';
        }
    
        function consumeSemicolon() {
            var line, oldIndex = index, oldLineNumber = lineNumber,
                oldLineStart = lineStart, oldLookahead = lookahead;
    
            // Catch the very common case first: immediately a semicolon (U+003B).
            if (source.charCodeAt(index) === 0x3B || match(';')) {
                lex();
                return;
            }
    
            line = lineNumber;
            skipComment();
            if (lineNumber !== line) {
                index = oldIndex;
                lineNumber = oldLineNumber;
                lineStart = oldLineStart;
                lookahead = oldLookahead;
                return;
            }
    
            if (lookahead.type !== Token.EOF && !match('}')) {
                throwUnexpectedToken(lookahead);
            }
        }
    
        // Return true if provided expression is LeftHandSideExpression
    
        function isLeftHandSide(expr) {
            return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
        }
    
        // 11.1.4 Array Initialiser
    
        function parseArrayInitialiser() {
            var elements = [], node = new Node();
    
            expect('[');
    
            while (!match(']')) {
                if (match(',')) {
                    lex();
                    elements.push(null);
                } else {
                    elements.push(parseAssignmentExpression());
    
                    if (!match(']')) {
                        expect(',');
                    }
                }
            }
    
            lex();
    
            return node.finishArrayExpression(elements);
        }
    
        // 11.1.5 Object Initialiser
    
        function parsePropertyFunction(param, first) {
            var previousStrict, body, node = new Node();
    
            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (first && strict && isRestrictedWord(param[0].name)) {
                tolerateUnexpectedToken(first, Messages.StrictParamName);
            }
            strict = previousStrict;
            return node.finishFunctionExpression(null, param, [], body);
        }
    
        function parsePropertyMethodFunction() {
            var previousStrict, param, method;
    
            previousStrict = strict;
            strict = true;
            param = parseParams();
            method = parsePropertyFunction(param.params);
            strict = previousStrict;
    
            return method;
        }
    
        function parseObjectPropertyKey() {
            var token, node = new Node();
    
            token = lex();
    
            // Note: This function is called only from parseObjectProperty(), where
            // EOF and Punctuator tokens are already filtered out.
    
            if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
                if (strict && token.octal) {
                    tolerateUnexpectedToken(token, Messages.StrictOctalLiteral);
                }
                return node.finishLiteral(token);
            }
    
            return node.finishIdentifier(token.value);
        }
    
        function parseObjectProperty() {
            var token, key, id, value, param, node = new Node();
    
            token = lookahead;
    
            if (token.type === Token.Identifier) {
    
                id = parseObjectPropertyKey();
    
                // Property Assignment: Getter and Setter.
    
                if (token.value === 'get' && !(match(':') || match('('))) {
                    key = parseObjectPropertyKey();
                    expect('(');
                    expect(')');
                    value = parsePropertyFunction([]);
                    return node.finishProperty('get', key, value, false, false);
                }
                if (token.value === 'set' && !(match(':') || match('('))) {
                    key = parseObjectPropertyKey();
                    expect('(');
                    token = lookahead;
                    if (token.type !== Token.Identifier) {
                        expect(')');
                        tolerateUnexpectedToken(token);
                        value = parsePropertyFunction([]);
                    } else {
                        param = [ parseVariableIdentifier() ];
                        expect(')');
                        value = parsePropertyFunction(param, token);
                    }
                    return node.finishProperty('set', key, value, false, false);
                }
                if (match(':')) {
                    lex();
                    value = parseAssignmentExpression();
                    return node.finishProperty('init', id, value, false, false);
                }
                if (match('(')) {
                    value = parsePropertyMethodFunction();
                    return node.finishProperty('init', id, value, true, false);
                }
    
                value = id;
                return node.finishProperty('init', id, value, false, true);
            }
            if (token.type === Token.EOF || token.type === Token.Punctuator) {
                throwUnexpectedToken(token);
            } else {
                key = parseObjectPropertyKey();
                if (match(':')) {
                    lex();
                    value = parseAssignmentExpression();
                    return node.finishProperty('init', key, value, false, false);
                }
                if (match('(')) {
                    value = parsePropertyMethodFunction();
                    return node.finishProperty('init', key, value, true, false);
                }
                throwUnexpectedToken(lex());
            }
        }
    
        function parseObjectInitialiser() {
            var properties = [], property, name, key, kind, map = {}, toString = String, node = new Node();
    
            expect('{');
    
            while (!match('}')) {
                property = parseObjectProperty();
    
                if (property.key.type === Syntax.Identifier) {
                    name = property.key.name;
                } else {
                    name = toString(property.key.value);
                }
                kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;
    
                key = '$' + name;
                if (Object.prototype.hasOwnProperty.call(map, key)) {
                    if (map[key] === PropertyKind.Data) {
                        if (strict && kind === PropertyKind.Data) {
                            tolerateError(Messages.StrictDuplicateProperty);
                        } else if (kind !== PropertyKind.Data) {
                            tolerateError(Messages.AccessorDataProperty);
                        }
                    } else {
                        if (kind === PropertyKind.Data) {
                            tolerateError(Messages.AccessorDataProperty);
                        } else if (map[key] & kind) {
                            tolerateError(Messages.AccessorGetSet);
                        }
                    }
                    map[key] |= kind;
                } else {
                    map[key] = kind;
                }
    
                properties.push(property);
    
                if (!match('}')) {
                    expectCommaSeparator();
                }
            }
    
            expect('}');
    
            return node.finishObjectExpression(properties);
        }
    
        // 11.1.6 The Grouping Operator
    
        function parseGroupExpression() {
            var expr;
    
            expect('(');
    
            if (match(')')) {
                lex();
                return PlaceHolders.ArrowParameterPlaceHolder;
            }
    
            ++state.parenthesisCount;
    
            expr = parseExpression();
    
            expect(')');
    
            return expr;
        }
    
    
        // 11.1 Primary Expressions
    
        function parsePrimaryExpression() {
            var type, token, expr, node;
    
            if (match('(')) {
                return parseGroupExpression();
            }
    
            if (match('[')) {
                return parseArrayInitialiser();
            }
    
            if (match('{')) {
                return parseObjectInitialiser();
            }
    
            type = lookahead.type;
            node = new Node();
    
            if (type === Token.Identifier) {
                expr = node.finishIdentifier(lex().value);
            } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
                if (strict && lookahead.octal) {
                    tolerateUnexpectedToken(lookahead, Messages.StrictOctalLiteral);
                }
                expr = node.finishLiteral(lex());
            } else if (type === Token.Keyword) {
                if (matchKeyword('function')) {
                    return parseFunctionExpression();
                }
                if (matchKeyword('this')) {
                    lex();
                    expr = node.finishThisExpression();
                } else {
                    throwUnexpectedToken(lex());
                }
            } else if (type === Token.BooleanLiteral) {
                token = lex();
                token.value = (token.value === 'true');
                expr = node.finishLiteral(token);
            } else if (type === Token.NullLiteral) {
                token = lex();
                token.value = null;
                expr = node.finishLiteral(token);
            } else if (match('/') || match('/=')) {
                if (typeof extra.tokens !== 'undefined') {
                    expr = node.finishLiteral(collectRegex());
                } else {
                    expr = node.finishLiteral(scanRegExp());
                }
                peek();
            } else {
                throwUnexpectedToken(lex());
            }
    
            return expr;
        }
    
        // 11.2 Left-Hand-Side Expressions
    
        function parseArguments() {
            var args = [];
    
            expect('(');
    
            if (!match(')')) {
                while (index < length) {
                    args.push(parseAssignmentExpression());
                    if (match(')')) {
                        break;
                    }
                    expectCommaSeparator();
                }
            }
    
            expect(')');
    
            return args;
        }
    
        function parseNonComputedProperty() {
            var token, node = new Node();
    
            token = lex();
    
            if (!isIdentifierName(token)) {
                throwUnexpectedToken(token);
            }
    
            return node.finishIdentifier(token.value);
        }
    
        function parseNonComputedMember() {
            expect('.');
    
            return parseNonComputedProperty();
        }
    
        function parseComputedMember() {
            var expr;
    
            expect('[');
    
            expr = parseExpression();
    
            expect(']');
    
            return expr;
        }
    
        function parseNewExpression() {
            var callee, args, node = new Node();
    
            expectKeyword('new');
            callee = parseLeftHandSideExpression();
            args = match('(') ? parseArguments() : [];
    
            return node.finishNewExpression(callee, args);
        }
    
        function parseLeftHandSideExpressionAllowCall() {
            var expr, args, property, startToken, previousAllowIn = state.allowIn;
    
            startToken = lookahead;
            state.allowIn = true;
            expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
    
            for (;;) {
                if (match('.')) {
                    property = parseNonComputedMember();
                    expr = new WrappingNode(startToken).finishMemberExpression('.', expr, property);
                } else if (match('(')) {
                    args = parseArguments();
                    expr = new WrappingNode(startToken).finishCallExpression(expr, args);
                } else if (match('[')) {
                    property = parseComputedMember();
                    expr = new WrappingNode(startToken).finishMemberExpression('[', expr, property);
                } else {
                    break;
                }
            }
            state.allowIn = previousAllowIn;
    
            return expr;
        }
    
        function parseLeftHandSideExpression() {
            var expr, property, startToken;
            assert(state.allowIn, 'callee of new expression always allow in keyword.');
    
            startToken = lookahead;
    
            expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
    
            for (;;) {
                if (match('[')) {
                    property = parseComputedMember();
                    expr = new WrappingNode(startToken).finishMemberExpression('[', expr, property);
                } else if (match('.')) {
                    property = parseNonComputedMember();
                    expr = new WrappingNode(startToken).finishMemberExpression('.', expr, property);
                } else {
                    break;
                }
            }
            return expr;
        }
    
        // 11.3 Postfix Expressions
    
        function parsePostfixExpression() {
            var expr, token, startToken = lookahead;
    
            expr = parseLeftHandSideExpressionAllowCall();
    
            if (lookahead.type === Token.Punctuator) {
                if ((match('++') || match('--')) && !peekLineTerminator()) {
                    // 11.3.1, 11.3.2
                    if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                        tolerateError(Messages.StrictLHSPostfix);
                    }
    
                    if (!isLeftHandSide(expr)) {
                        tolerateError(Messages.InvalidLHSInAssignment);
                    }
    
                    token = lex();
                    expr = new WrappingNode(startToken).finishPostfixExpression(token.value, expr);
                }
            }
    
            return expr;
        }
    
        // 11.4 Unary Operators
    
        function parseUnaryExpression() {
            var token, expr, startToken;
    
            if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
                expr = parsePostfixExpression();
            } else if (match('++') || match('--')) {
                startToken = lookahead;
                token = lex();
                expr = parseUnaryExpression();
                // 11.4.4, 11.4.5
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    tolerateError(Messages.StrictLHSPrefix);
                }
    
                if (!isLeftHandSide(expr)) {
                    tolerateError(Messages.InvalidLHSInAssignment);
                }
    
                expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
            } else if (match('+') || match('-') || match('~') || match('!')) {
                startToken = lookahead;
                token = lex();
                expr = parseUnaryExpression();
                expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
            } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
                startToken = lookahead;
                token = lex();
                expr = parseUnaryExpression();
                expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
                if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                    tolerateError(Messages.StrictDelete);
                }
            } else {
                expr = parsePostfixExpression();
            }
    
            return expr;
        }
    
        function binaryPrecedence(token, allowIn) {
            var prec = 0;
    
            if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
                return 0;
            }
    
            switch (token.value) {
            case '||':
                prec = 1;
                break;
    
            case '&&':
                prec = 2;
                break;
    
            case '|':
                prec = 3;
                break;
    
            case '^':
                prec = 4;
                break;
    
            case '&':
                prec = 5;
                break;
    
            case '==':
            case '!=':
            case '===':
            case '!==':
                prec = 6;
                break;
    
            case '<':
            case '>':
            case '<=':
            case '>=':
            case 'instanceof':
                prec = 7;
                break;
    
            case 'in':
                prec = allowIn ? 7 : 0;
                break;
    
            case '<<':
            case '>>':
            case '>>>':
                prec = 8;
                break;
    
            case '+':
            case '-':
                prec = 9;
                break;
    
            case '*':
            case '/':
            case '%':
                prec = 11;
                break;
    
            default:
                break;
            }
    
            return prec;
        }
    
        // 11.5 Multiplicative Operators
        // 11.6 Additive Operators
        // 11.7 Bitwise Shift Operators
        // 11.8 Relational Operators
        // 11.9 Equality Operators
        // 11.10 Binary Bitwise Operators
        // 11.11 Binary Logical Operators
    
        function parseBinaryExpression() {
            var marker, markers, expr, token, prec, stack, right, operator, left, i;
    
            marker = lookahead;
            left = parseUnaryExpression();
            if (left === PlaceHolders.ArrowParameterPlaceHolder) {
                return left;
            }
    
            token = lookahead;
            prec = binaryPrecedence(token, state.allowIn);
            if (prec === 0) {
                return left;
            }
            token.prec = prec;
            lex();
    
            markers = [marker, lookahead];
            right = parseUnaryExpression();
    
            stack = [left, token, right];
    
            while ((prec = binaryPrecedence(lookahead, state.allowIn)) > 0) {
    
                // Reduce: make a binary expression from the three topmost entries.
                while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                    right = stack.pop();
                    operator = stack.pop().value;
                    left = stack.pop();
                    markers.pop();
                    expr = new WrappingNode(markers[markers.length - 1]).finishBinaryExpression(operator, left, right);
                    stack.push(expr);
                }
    
                // Shift.
                token = lex();
                token.prec = prec;
                stack.push(token);
                markers.push(lookahead);
                expr = parseUnaryExpression();
                stack.push(expr);
            }
    
            // Final reduce to clean-up the stack.
            i = stack.length - 1;
            expr = stack[i];
            markers.pop();
            while (i > 1) {
                expr = new WrappingNode(markers.pop()).finishBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
                i -= 2;
            }
    
            return expr;
        }
    
    
        // 11.12 Conditional Operator
    
        function parseConditionalExpression() {
            var expr, previousAllowIn, consequent, alternate, startToken;
    
            startToken = lookahead;
    
            expr = parseBinaryExpression();
            if (expr === PlaceHolders.ArrowParameterPlaceHolder) {
                return expr;
            }
            if (match('?')) {
                lex();
                previousAllowIn = state.allowIn;
                state.allowIn = true;
                consequent = parseAssignmentExpression();
                state.allowIn = previousAllowIn;
                expect(':');
                alternate = parseAssignmentExpression();
    
                expr = new WrappingNode(startToken).finishConditionalExpression(expr, consequent, alternate);
            }
    
            return expr;
        }
    
        // [ES6] 14.2 Arrow Function
    
        function parseConciseBody() {
            if (match('{')) {
                return parseFunctionSourceElements();
            }
            return parseAssignmentExpression();
        }
    
        function reinterpretAsCoverFormalsList(expressions) {
            var i, len, param, params, defaults, defaultCount, options, rest, token;
    
            params = [];
            defaults = [];
            defaultCount = 0;
            rest = null;
            options = {
                paramSet: {}
            };
    
            for (i = 0, len = expressions.length; i < len; i += 1) {
                param = expressions[i];
                if (param.type === Syntax.Identifier) {
                    params.push(param);
                    defaults.push(null);
                    validateParam(options, param, param.name);
                } else if (param.type === Syntax.AssignmentExpression) {
                    params.push(param.left);
                    defaults.push(param.right);
                    ++defaultCount;
                    validateParam(options, param.left, param.left.name);
                } else {
                    return null;
                }
            }
    
            if (options.message === Messages.StrictParamDupe) {
                token = strict ? options.stricted : options.firstRestricted;
                throwUnexpectedToken(token, options.message);
            }
    
            if (defaultCount === 0) {
                defaults = [];
            }
    
            return {
                params: params,
                defaults: defaults,
                rest: rest,
                stricted: options.stricted,
                firstRestricted: options.firstRestricted,
                message: options.message
            };
        }
    
        function parseArrowFunctionExpression(options, node) {
            var previousStrict, body;
    
            expect('=>');
            previousStrict = strict;
    
            body = parseConciseBody();
    
            if (strict && options.firstRestricted) {
                throwUnexpectedToken(options.firstRestricted, options.message);
            }
            if (strict && options.stricted) {
                tolerateUnexpectedToken(options.stricted, options.message);
            }
    
            strict = previousStrict;
    
            return node.finishArrowFunctionExpression(options.params, options.defaults, body, body.type !== Syntax.BlockStatement);
        }
    
        // 11.13 Assignment Operators
    
        function parseAssignmentExpression() {
            var oldParenthesisCount, token, expr, right, list, startToken;
    
            oldParenthesisCount = state.parenthesisCount;
    
            startToken = lookahead;
            token = lookahead;
    
            expr = parseConditionalExpression();
    
            if (expr === PlaceHolders.ArrowParameterPlaceHolder || match('=>')) {
                if (state.parenthesisCount === oldParenthesisCount ||
                        state.parenthesisCount === (oldParenthesisCount + 1)) {
                    if (expr.type === Syntax.Identifier) {
                        list = reinterpretAsCoverFormalsList([ expr ]);
                    } else if (expr.type === Syntax.AssignmentExpression) {
                        list = reinterpretAsCoverFormalsList([ expr ]);
                    } else if (expr.type === Syntax.SequenceExpression) {
                        list = reinterpretAsCoverFormalsList(expr.expressions);
                    } else if (expr === PlaceHolders.ArrowParameterPlaceHolder) {
                        list = reinterpretAsCoverFormalsList([]);
                    }
                    if (list) {
                        return parseArrowFunctionExpression(list, new WrappingNode(startToken));
                    }
                }
            }
    
            if (matchAssign()) {
                // LeftHandSideExpression
                if (!isLeftHandSide(expr)) {
                    tolerateError(Messages.InvalidLHSInAssignment);
                }
    
                // 11.13.1
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    tolerateUnexpectedToken(token, Messages.StrictLHSAssignment);
                }
    
                token = lex();
                right = parseAssignmentExpression();
                expr = new WrappingNode(startToken).finishAssignmentExpression(token.value, expr, right);
            }
    
            return expr;
        }
    
        // 11.14 Comma Operator
    
        function parseExpression() {
            var expr, startToken = lookahead, expressions;
    
            expr = parseAssignmentExpression();
    
            if (match(',')) {
                expressions = [expr];
    
                while (index < length) {
                    if (!match(',')) {
                        break;
                    }
                    lex();
                    expressions.push(parseAssignmentExpression());
                }
    
                expr = new WrappingNode(startToken).finishSequenceExpression(expressions);
            }
    
            return expr;
        }
    
        // 12.1 Block
    
        function parseStatementList() {
            var list = [],
                statement;
    
            while (index < length) {
                if (match('}')) {
                    break;
                }
                statement = parseSourceElement();
                if (typeof statement === 'undefined') {
                    break;
                }
                list.push(statement);
            }
    
            return list;
        }
    
        function parseBlock() {
            var block, node = new Node();
    
            expect('{');
    
            block = parseStatementList();
    
            expect('}');
    
            return node.finishBlockStatement(block);
        }
    
        // 12.2 Variable Statement
    
        function parseVariableIdentifier() {
            var token, node = new Node();
    
            token = lex();
    
            if (token.type !== Token.Identifier) {
                if (strict && token.type === Token.Keyword && isStrictModeReservedWord(token.value)) {
                    tolerateUnexpectedToken(token, Messages.StrictReservedWord);
                } else {
                    throwUnexpectedToken(token);
                }
            }
    
            return node.finishIdentifier(token.value);
        }
    
        function parseVariableDeclaration(kind) {
            var init = null, id, node = new Node();
    
            id = parseVariableIdentifier();
    
            // 12.2.1
            if (strict && isRestrictedWord(id.name)) {
                tolerateError(Messages.StrictVarName);
            }
    
            if (kind === 'const') {
                expect('=');
                init = parseAssignmentExpression();
            } else if (match('=')) {
                lex();
                init = parseAssignmentExpression();
            }
    
            return node.finishVariableDeclarator(id, init);
        }
    
        function parseVariableDeclarationList(kind) {
            var list = [];
    
            do {
                list.push(parseVariableDeclaration(kind));
                if (!match(',')) {
                    break;
                }
                lex();
            } while (index < length);
    
            return list;
        }
    
        function parseVariableStatement(node) {
            var declarations;
    
            expectKeyword('var');
    
            declarations = parseVariableDeclarationList();
    
            consumeSemicolon();
    
            return node.finishVariableDeclaration(declarations, 'var');
        }
    
        // kind may be `const` or `let`
        // Both are experimental and not in the specification yet.
        // see http://wiki.ecmascript.org/doku.php?id=harmony:const
        // and http://wiki.ecmascript.org/doku.php?id=harmony:let
        function parseConstLetDeclaration(kind) {
            var declarations, node = new Node();
    
            expectKeyword(kind);
    
            declarations = parseVariableDeclarationList(kind);
    
            consumeSemicolon();
    
            return node.finishVariableDeclaration(declarations, kind);
        }
    
        // 12.3 Empty Statement
    
        function parseEmptyStatement() {
            var node = new Node();
            expect(';');
            return node.finishEmptyStatement();
        }
    
        // 12.4 Expression Statement
    
        function parseExpressionStatement(node) {
            var expr = parseExpression();
            consumeSemicolon();
            return node.finishExpressionStatement(expr);
        }
    
        // 12.5 If statement
    
        function parseIfStatement(node) {
            var test, consequent, alternate;
    
            expectKeyword('if');
    
            expect('(');
    
            test = parseExpression();
    
            expect(')');
    
            consequent = parseStatement();
    
            if (matchKeyword('else')) {
                lex();
                alternate = parseStatement();
            } else {
                alternate = null;
            }
    
            return node.finishIfStatement(test, consequent, alternate);
        }
    
        // 12.6 Iteration Statements
    
        function parseDoWhileStatement(node) {
            var body, test, oldInIteration;
    
            expectKeyword('do');
    
            oldInIteration = state.inIteration;
            state.inIteration = true;
    
            body = parseStatement();
    
            state.inIteration = oldInIteration;
    
            expectKeyword('while');
    
            expect('(');
    
            test = parseExpression();
    
            expect(')');
    
            if (match(';')) {
                lex();
            }
    
            return node.finishDoWhileStatement(body, test);
        }
    
        function parseWhileStatement(node) {
            var test, body, oldInIteration;
    
            expectKeyword('while');
    
            expect('(');
    
            test = parseExpression();
    
            expect(')');
    
            oldInIteration = state.inIteration;
            state.inIteration = true;
    
            body = parseStatement();
    
            state.inIteration = oldInIteration;
    
            return node.finishWhileStatement(test, body);
        }
    
        function parseForVariableDeclaration() {
            var token, declarations, node = new Node();
    
            token = lex();
            declarations = parseVariableDeclarationList();
    
            return node.finishVariableDeclaration(declarations, token.value);
        }
    
        function parseForStatement(node) {
            var init, test, update, left, right, body, oldInIteration, previousAllowIn = state.allowIn;
    
            init = test = update = null;
    
            expectKeyword('for');
    
            expect('(');
    
            if (match(';')) {
                lex();
            } else {
                if (matchKeyword('var') || matchKeyword('let')) {
                    state.allowIn = false;
                    init = parseForVariableDeclaration();
                    state.allowIn = previousAllowIn;
    
                    if (init.declarations.length === 1 && matchKeyword('in')) {
                        lex();
                        left = init;
                        right = parseExpression();
                        init = null;
                    }
                } else {
                    state.allowIn = false;
                    init = parseExpression();
                    state.allowIn = previousAllowIn;
    
                    if (matchKeyword('in')) {
                        // LeftHandSideExpression
                        if (!isLeftHandSide(init)) {
                            tolerateError(Messages.InvalidLHSInForIn);
                        }
    
                        lex();
                        left = init;
                        right = parseExpression();
                        init = null;
                    }
                }
    
                if (typeof left === 'undefined') {
                    expect(';');
                }
            }
    
            if (typeof left === 'undefined') {
    
                if (!match(';')) {
                    test = parseExpression();
                }
                expect(';');
    
                if (!match(')')) {
                    update = parseExpression();
                }
            }
    
            expect(')');
    
            oldInIteration = state.inIteration;
            state.inIteration = true;
    
            body = parseStatement();
    
            state.inIteration = oldInIteration;
    
            return (typeof left === 'undefined') ?
                    node.finishForStatement(init, test, update, body) :
                    node.finishForInStatement(left, right, body);
        }
    
        // 12.7 The continue statement
    
        function parseContinueStatement(node) {
            var label = null, key;
    
            expectKeyword('continue');
    
            // Optimize the most common form: 'continue;'.
            if (source.charCodeAt(index) === 0x3B) {
                lex();
    
                if (!state.inIteration) {
                    throwError(Messages.IllegalContinue);
                }
    
                return node.finishContinueStatement(null);
            }
    
            if (peekLineTerminator()) {
                if (!state.inIteration) {
                    throwError(Messages.IllegalContinue);
                }
    
                return node.finishContinueStatement(null);
            }
    
            if (lookahead.type === Token.Identifier) {
                label = parseVariableIdentifier();
    
                key = '$' + label.name;
                if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                    throwError(Messages.UnknownLabel, label.name);
                }
            }
    
            consumeSemicolon();
    
            if (label === null && !state.inIteration) {
                throwError(Messages.IllegalContinue);
            }
    
            return node.finishContinueStatement(label);
        }
    
        // 12.8 The break statement
    
        function parseBreakStatement(node) {
            var label = null, key;
    
            expectKeyword('break');
    
            // Catch the very common case first: immediately a semicolon (U+003B).
            if (source.charCodeAt(index) === 0x3B) {
                lex();
    
                if (!(state.inIteration || state.inSwitch)) {
                    throwError(Messages.IllegalBreak);
                }
    
                return node.finishBreakStatement(null);
            }
    
            if (peekLineTerminator()) {
                if (!(state.inIteration || state.inSwitch)) {
                    throwError(Messages.IllegalBreak);
                }
    
                return node.finishBreakStatement(null);
            }
    
            if (lookahead.type === Token.Identifier) {
                label = parseVariableIdentifier();
    
                key = '$' + label.name;
                if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                    throwError(Messages.UnknownLabel, label.name);
                }
            }
    
            consumeSemicolon();
    
            if (label === null && !(state.inIteration || state.inSwitch)) {
                throwError(Messages.IllegalBreak);
            }
    
            return node.finishBreakStatement(label);
        }
    
        // 12.9 The return statement
    
        function parseReturnStatement(node) {
            var argument = null;
    
            expectKeyword('return');
    
            if (!state.inFunctionBody) {
                tolerateError(Messages.IllegalReturn);
            }
    
            // 'return' followed by a space and an identifier is very common.
            if (source.charCodeAt(index) === 0x20) {
                if (isIdentifierStart(source.charCodeAt(index + 1))) {
                    argument = parseExpression();
                    consumeSemicolon();
                    return node.finishReturnStatement(argument);
                }
            }
    
            if (peekLineTerminator()) {
                return node.finishReturnStatement(null);
            }
    
            if (!match(';')) {
                if (!match('}') && lookahead.type !== Token.EOF) {
                    argument = parseExpression();
                }
            }
    
            consumeSemicolon();
    
            return node.finishReturnStatement(argument);
        }
    
        // 12.10 The with statement
    
        function parseWithStatement(node) {
            var object, body;
    
            if (strict) {
                // TODO(ikarienator): Should we update the test cases instead?
                skipComment();
                tolerateError(Messages.StrictModeWith);
            }
    
            expectKeyword('with');
    
            expect('(');
    
            object = parseExpression();
    
            expect(')');
    
            body = parseStatement();
    
            return node.finishWithStatement(object, body);
        }
    
        // 12.10 The swith statement
    
        function parseSwitchCase() {
            var test, consequent = [], statement, node = new Node();
    
            if (matchKeyword('default')) {
                lex();
                test = null;
            } else {
                expectKeyword('case');
                test = parseExpression();
            }
            expect(':');
    
            while (index < length) {
                if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                    break;
                }
                statement = parseStatement();
                consequent.push(statement);
            }
    
            return node.finishSwitchCase(test, consequent);
        }
    
        function parseSwitchStatement(node) {
            var discriminant, cases, clause, oldInSwitch, defaultFound;
    
            expectKeyword('switch');
    
            expect('(');
    
            discriminant = parseExpression();
    
            expect(')');
    
            expect('{');
    
            cases = [];
    
            if (match('}')) {
                lex();
                return node.finishSwitchStatement(discriminant, cases);
            }
    
            oldInSwitch = state.inSwitch;
            state.inSwitch = true;
            defaultFound = false;
    
            while (index < length) {
                if (match('}')) {
                    break;
                }
                clause = parseSwitchCase();
                if (clause.test === null) {
                    if (defaultFound) {
                        throwError(Messages.MultipleDefaultsInSwitch);
                    }
                    defaultFound = true;
                }
                cases.push(clause);
            }
    
            state.inSwitch = oldInSwitch;
    
            expect('}');
    
            return node.finishSwitchStatement(discriminant, cases);
        }
    
        // 12.13 The throw statement
    
        function parseThrowStatement(node) {
            var argument;
    
            expectKeyword('throw');
    
            if (peekLineTerminator()) {
                throwError(Messages.NewlineAfterThrow);
            }
    
            argument = parseExpression();
    
            consumeSemicolon();
    
            return node.finishThrowStatement(argument);
        }
    
        // 12.14 The try statement
    
        function parseCatchClause() {
            var param, body, node = new Node();
    
            expectKeyword('catch');
    
            expect('(');
            if (match(')')) {
                throwUnexpectedToken(lookahead);
            }
    
            param = parseVariableIdentifier();
            // 12.14.1
            if (strict && isRestrictedWord(param.name)) {
                tolerateError(Messages.StrictCatchVariable);
            }
    
            expect(')');
            body = parseBlock();
            return node.finishCatchClause(param, body);
        }
    
        function parseTryStatement(node) {
            var block, handlers = [], finalizer = null;
    
            expectKeyword('try');
    
            block = parseBlock();
    
            if (matchKeyword('catch')) {
                handlers.push(parseCatchClause());
            }
    
            if (matchKeyword('finally')) {
                lex();
                finalizer = parseBlock();
            }
    
            if (handlers.length === 0 && !finalizer) {
                throwError(Messages.NoCatchOrFinally);
            }
    
            return node.finishTryStatement(block, [], handlers, finalizer);
        }
    
        // 12.15 The debugger statement
    
        function parseDebuggerStatement(node) {
            expectKeyword('debugger');
    
            consumeSemicolon();
    
            return node.finishDebuggerStatement();
        }
    
        // 12 Statements
    
        function parseStatement() {
            var type = lookahead.type,
                expr,
                labeledBody,
                key,
                node;
    
            if (type === Token.EOF) {
                throwUnexpectedToken(lookahead);
            }
    
            if (type === Token.Punctuator && lookahead.value === '{') {
                return parseBlock();
            }
    
            node = new Node();
    
            if (type === Token.Punctuator) {
                switch (lookahead.value) {
                case ';':
                    return parseEmptyStatement(node);
                case '(':
                    return parseExpressionStatement(node);
                default:
                    break;
                }
            } else if (type === Token.Keyword) {
                switch (lookahead.value) {
                case 'break':
                    return parseBreakStatement(node);
                case 'continue':
                    return parseContinueStatement(node);
                case 'debugger':
                    return parseDebuggerStatement(node);
                case 'do':
                    return parseDoWhileStatement(node);
                case 'for':
                    return parseForStatement(node);
                case 'function':
                    return parseFunctionDeclaration(node);
                case 'if':
                    return parseIfStatement(node);
                case 'return':
                    return parseReturnStatement(node);
                case 'switch':
                    return parseSwitchStatement(node);
                case 'throw':
                    return parseThrowStatement(node);
                case 'try':
                    return parseTryStatement(node);
                case 'var':
                    return parseVariableStatement(node);
                case 'while':
                    return parseWhileStatement(node);
                case 'with':
                    return parseWithStatement(node);
                default:
                    break;
                }
            }
    
            expr = parseExpression();
    
            // 12.12 Labelled Statements
            if ((expr.type === Syntax.Identifier) && match(':')) {
                lex();
    
                key = '$' + expr.name;
                if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                    throwError(Messages.Redeclaration, 'Label', expr.name);
                }
    
                state.labelSet[key] = true;
                labeledBody = parseStatement();
                delete state.labelSet[key];
                return node.finishLabeledStatement(expr, labeledBody);
            }
    
            consumeSemicolon();
    
            return node.finishExpressionStatement(expr);
        }
    
        // 13 Function Definition
    
        function parseFunctionSourceElements() {
            var sourceElement, sourceElements = [], token, directive, firstRestricted,
                oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody, oldParenthesisCount,
                node = new Node();
    
            expect('{');
    
            while (index < length) {
                if (lookahead.type !== Token.StringLiteral) {
                    break;
                }
                token = lookahead;
    
                sourceElement = parseSourceElement();
                sourceElements.push(sourceElement);
                if (sourceElement.expression.type !== Syntax.Literal) {
                    // this is not directive
                    break;
                }
                directive = source.slice(token.start + 1, token.end - 1);
                if (directive === 'use strict') {
                    strict = true;
                    if (firstRestricted) {
                        tolerateUnexpectedToken(firstRestricted, Messages.StrictOctalLiteral);
                    }
                } else {
                    if (!firstRestricted && token.octal) {
                        firstRestricted = token;
                    }
                }
            }
    
            oldLabelSet = state.labelSet;
            oldInIteration = state.inIteration;
            oldInSwitch = state.inSwitch;
            oldInFunctionBody = state.inFunctionBody;
            oldParenthesisCount = state.parenthesizedCount;
    
            state.labelSet = {};
            state.inIteration = false;
            state.inSwitch = false;
            state.inFunctionBody = true;
            state.parenthesizedCount = 0;
    
            while (index < length) {
                if (match('}')) {
                    break;
                }
                sourceElement = parseSourceElement();
                if (typeof sourceElement === 'undefined') {
                    break;
                }
                sourceElements.push(sourceElement);
            }
    
            expect('}');
    
            state.labelSet = oldLabelSet;
            state.inIteration = oldInIteration;
            state.inSwitch = oldInSwitch;
            state.inFunctionBody = oldInFunctionBody;
            state.parenthesizedCount = oldParenthesisCount;
    
            return node.finishBlockStatement(sourceElements);
        }
    
        function validateParam(options, param, name) {
            var key = '$' + name;
            if (strict) {
                if (isRestrictedWord(name)) {
                    options.stricted = param;
                    options.message = Messages.StrictParamName;
                }
                if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                    options.stricted = param;
                    options.message = Messages.StrictParamDupe;
                }
            } else if (!options.firstRestricted) {
                if (isRestrictedWord(name)) {
                    options.firstRestricted = param;
                    options.message = Messages.StrictParamName;
                } else if (isStrictModeReservedWord(name)) {
                    options.firstRestricted = param;
                    options.message = Messages.StrictReservedWord;
                } else if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                    options.firstRestricted = param;
                    options.message = Messages.StrictParamDupe;
                }
            }
            options.paramSet[key] = true;
        }
    
        function parseParam(options) {
            var token, param, def;
    
            token = lookahead;
            param = parseVariableIdentifier();
            validateParam(options, token, token.value);
            if (match('=')) {
                lex();
                def = parseAssignmentExpression();
                ++options.defaultCount;
            }
    
            options.params.push(param);
            options.defaults.push(def);
    
            return !match(')');
        }
    
        function parseParams(firstRestricted) {
            var options;
    
            options = {
                params: [],
                defaultCount: 0,
                defaults: [],
                firstRestricted: firstRestricted
            };
    
            expect('(');
    
            if (!match(')')) {
                options.paramSet = {};
                while (index < length) {
                    if (!parseParam(options)) {
                        break;
                    }
                    expect(',');
                }
            }
    
            expect(')');
    
            if (options.defaultCount === 0) {
                options.defaults = [];
            }
    
            return {
                params: options.params,
                defaults: options.defaults,
                stricted: options.stricted,
                firstRestricted: options.firstRestricted,
                message: options.message
            };
        }
    
        function parseFunctionDeclaration() {
            var id, params = [], defaults = [], body, token, stricted, tmp, firstRestricted, message, previousStrict, node = new Node();
    
            expectKeyword('function');
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    tolerateUnexpectedToken(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
    
            tmp = parseParams(firstRestricted);
            params = tmp.params;
            defaults = tmp.defaults;
            stricted = tmp.stricted;
            firstRestricted = tmp.firstRestricted;
            if (tmp.message) {
                message = tmp.message;
            }
    
            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (strict && firstRestricted) {
                throwUnexpectedToken(firstRestricted, message);
            }
            if (strict && stricted) {
                tolerateUnexpectedToken(stricted, message);
            }
            strict = previousStrict;
    
            return node.finishFunctionDeclaration(id, params, defaults, body);
        }
    
        function parseFunctionExpression() {
            var token, id = null, stricted, firstRestricted, message, tmp,
                params = [], defaults = [], body, previousStrict, node = new Node();
    
            expectKeyword('function');
    
            if (!match('(')) {
                token = lookahead;
                id = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        tolerateUnexpectedToken(token, Messages.StrictFunctionName);
                    }
                } else {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictFunctionName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    }
                }
            }
    
            tmp = parseParams(firstRestricted);
            params = tmp.params;
            defaults = tmp.defaults;
            stricted = tmp.stricted;
            firstRestricted = tmp.firstRestricted;
            if (tmp.message) {
                message = tmp.message;
            }
    
            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (strict && firstRestricted) {
                throwUnexpectedToken(firstRestricted, message);
            }
            if (strict && stricted) {
                tolerateUnexpectedToken(stricted, message);
            }
            strict = previousStrict;
    
            return node.finishFunctionExpression(id, params, defaults, body);
        }
    
        // 14 Program
    
        function parseSourceElement() {
            if (lookahead.type === Token.Keyword) {
                switch (lookahead.value) {
                case 'const':
                case 'let':
                    return parseConstLetDeclaration(lookahead.value);
                case 'function':
                    return parseFunctionDeclaration();
                default:
                    return parseStatement();
                }
            }
    
            if (lookahead.type !== Token.EOF) {
                return parseStatement();
            }
        }
    
        function parseSourceElements() {
            var sourceElement, sourceElements = [], token, directive, firstRestricted;
    
            while (index < length) {
                token = lookahead;
                if (token.type !== Token.StringLiteral) {
                    break;
                }
    
                sourceElement = parseSourceElement();
                sourceElements.push(sourceElement);
                if (sourceElement.expression.type !== Syntax.Literal) {
                    // this is not directive
                    break;
                }
                directive = source.slice(token.start + 1, token.end - 1);
                if (directive === 'use strict') {
                    strict = true;
                    if (firstRestricted) {
                        tolerateUnexpectedToken(firstRestricted, Messages.StrictOctalLiteral);
                    }
                } else {
                    if (!firstRestricted && token.octal) {
                        firstRestricted = token;
                    }
                }
            }
    
            while (index < length) {
                sourceElement = parseSourceElement();
                /* istanbul ignore if */
                if (typeof sourceElement === 'undefined') {
                    break;
                }
                sourceElements.push(sourceElement);
            }
            return sourceElements;
        }
    
        function parseProgram() {
            var body, node;
    
            skipComment();
            peek();
            node = new Node();
            strict = false;
    
            body = parseSourceElements();
            return node.finishProgram(body);
        }
    
        function filterTokenLocation() {
            var i, entry, token, tokens = [];
    
            for (i = 0; i < extra.tokens.length; ++i) {
                entry = extra.tokens[i];
                token = {
                    type: entry.type,
                    value: entry.value
                };
                if (entry.regex) {
                    token.regex = {
                        pattern: entry.regex.pattern,
                        flags: entry.regex.flags
                    };
                }
                if (extra.range) {
                    token.range = entry.range;
                }
                if (extra.loc) {
                    token.loc = entry.loc;
                }
                tokens.push(token);
            }
    
            extra.tokens = tokens;
        }
    
        function tokenize(code, options) {
            var toString,
                tokens;
    
            toString = String;
            if (typeof code !== 'string' && !(code instanceof String)) {
                code = toString(code);
            }
    
            source = code;
            index = 0;
            lineNumber = (source.length > 0) ? 1 : 0;
            lineStart = 0;
            length = source.length;
            lookahead = null;
            state = {
                allowIn: true,
                labelSet: {},
                inFunctionBody: false,
                inIteration: false,
                inSwitch: false,
                lastCommentStart: -1
            };
    
            extra = {};
    
            // Options matching.
            options = options || {};
    
            // Of course we collect tokens here.
            options.tokens = true;
            extra.tokens = [];
            extra.tokenize = true;
            // The following two fields are necessary to compute the Regex tokens.
            extra.openParenToken = -1;
            extra.openCurlyToken = -1;
    
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
    
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
    
            try {
                peek();
                if (lookahead.type === Token.EOF) {
                    return extra.tokens;
                }
    
                lex();
                while (lookahead.type !== Token.EOF) {
                    try {
                        lex();
                    } catch (lexError) {
                        if (extra.errors) {
                            extra.errors.push(lexError);
                            // We have to break on the first error
                            // to avoid infinite loops.
                            break;
                        } else {
                            throw lexError;
                        }
                    }
                }
    
                filterTokenLocation();
                tokens = extra.tokens;
                if (typeof extra.comments !== 'undefined') {
                    tokens.comments = extra.comments;
                }
                if (typeof extra.errors !== 'undefined') {
                    tokens.errors = extra.errors;
                }
            } catch (e) {
                throw e;
            } finally {
                extra = {};
            }
            return tokens;
        }
    
        function parse(code, options) {
            var program, toString;
    
            toString = String;
            if (typeof code !== 'string' && !(code instanceof String)) {
                code = toString(code);
            }
    
            source = code;
            index = 0;
            lineNumber = (source.length > 0) ? 1 : 0;
            lineStart = 0;
            length = source.length;
            lookahead = null;
            state = {
                allowIn: true,
                labelSet: {},
                parenthesisCount: 0,
                inFunctionBody: false,
                inIteration: false,
                inSwitch: false,
                lastCommentStart: -1
            };
    
            extra = {};
            if (typeof options !== 'undefined') {
                extra.range = (typeof options.range === 'boolean') && options.range;
                extra.loc = (typeof options.loc === 'boolean') && options.loc;
                extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;
    
                if (extra.loc && options.source !== null && options.source !== undefined) {
                    extra.source = toString(options.source);
                }
    
                if (typeof options.tokens === 'boolean' && options.tokens) {
                    extra.tokens = [];
                }
                if (typeof options.comment === 'boolean' && options.comment) {
                    extra.comments = [];
                }
                if (typeof options.tolerant === 'boolean' && options.tolerant) {
                    extra.errors = [];
                }
                if (extra.attachComment) {
                    extra.range = true;
                    extra.comments = [];
                    extra.bottomRightStack = [];
                    extra.trailingComments = [];
                    extra.leadingComments = [];
                }
            }
    
            try {
                program = parseProgram();
                if (typeof extra.comments !== 'undefined') {
                    program.comments = extra.comments;
                }
                if (typeof extra.tokens !== 'undefined') {
                    filterTokenLocation();
                    program.tokens = extra.tokens;
                }
                if (typeof extra.errors !== 'undefined') {
                    program.errors = extra.errors;
                }
            } catch (e) {
                throw e;
            } finally {
                extra = {};
            }
    
            return program;
        }
    
        // Sync with *.json manifests.
        exports.version = '2.0.0';
    
        exports.tokenize = tokenize;
    
        exports.parse = parse;
    
        // Deep copy.
       /* istanbul ignore next */
        exports.Syntax = (function () {
            var name, types = {};
    
            if (typeof Object.create === 'function') {
                types = Object.create(null);
            }
    
            for (name in Syntax) {
                if (Syntax.hasOwnProperty(name)) {
                    types[name] = Syntax[name];
                }
            }
    
            if (typeof Object.freeze === 'function') {
                Object.freeze(types);
            }
    
            return types;
        }());
    
    }));
    /* vim: set sw=4 ts=4 et tw=80 : */
    
    // Source code for MetaES
    // The MIT License (MIT)
    //
    // Copyright (c) 2015 Bartosz Krupa
    //
    // Permission is hereby granted, free of charge, to any person obtaining a copy
    // of this software and associated documentation files (the "Software"), to deal
    // in the Software without restriction, including without limitation the rights
    // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    // copies of the Software, and to permit persons to whom the Software is
    // furnished to do so, subject to the following conditions:
    //
    //   The above copyright notice and this permission notice shall be included in
    // all copies or substantial portions of the Software.
    //
    //   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    //   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    //   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    // THE SOFTWARE.
    
    (function (fn) {
      if (typeof define !== "undefined") {
        // AMD (Browser)
        define([
          'bower_components/esprima/esprima'
        ], fn);
      } else if (typeof module !== "undefined") {
        // nodejs (CommonJS)
        module.exports = fn(require('esprima'));
      } else {
        // plain JS
        if (typeof esprima !== "undefined") {
          window.metaes = fn(esprima);
        } else {
          throw new Error("esprima is not loaded.");
        }
      }
    }(function (esprima) {
    
      function clone(from) {
        var to = {};
        for (var i in from) {
          if (from.hasOwnProperty(i)) {
            to[i] = from[i];
          }
        }
        return to;
      }
    
      var tokens = {
        VariableDeclaration: function (e, env, c, cerr) {
          delayEvaluate(e.declarations, env, function () {
            c()
          }, cerr);
        },
    
        VariableDeclarator: function (e, env, c, cerr) {
          setValue(env, e.id.name, undefined, true);
          env.variables = env.variables || {};
          env.variables[e.id.name] = e.id;
    
          if (e.init) {
            delayEvaluate(e.init, env, function (val) {
              setValue(env, e.id.name, val, false);
              c(val, e.id.name);
            }, cerr);
          } else {
            c(undefined, e.id.name);
          }
        },
    
        EmptyStatement: function (e, env, c, cerr) {
          c();
        },
    
        FunctionExpression: function (e, env, c, cerr) {
          c(new MetaFunction(e, env));
        },
    
        FunctionDeclaration: function (e, env, c, cerr) {
          c(new MetaFunction(e, env));
        },
    
        Literal: function (e, env, c, cerr) {
          c(e.value);
        },
    
        Identifier: function (e, env, c, cerr) {
          try {
            function foundName(pair) {
              var value = pair[0],
                container = pair[1];
              c(value, container, e.name);
            }
    
            getValue(env, e.name, true, foundName, cerr);
          } catch (error) {
            cerr("Error", error, e);
          }
        },
    
        BinaryExpression: function (e, env, c, cerr) {
          delayEvaluate(e.left, env, function (left) {
            delayEvaluate(e.right, env, function (right) {
              try {
                var value;
                switch (e.operator) {
                  case "+":
                    value = left + right;
                    break;
                  case "-":
                    value = left - right;
                    break;
                  case "===":
                    value = left === right;
                    break;
                  case "==":
                    value = left == right;
                    break;
                  case "!==":
                    value = left !== right;
                    break;
                  case "!=":
                    value = left != right;
                    break;
                  case "<":
                    value = left < right;
                    break;
                  case "<=":
                    value = left <= right;
                    break;
                  case ">":
                    value = left > right;
                    break;
                  case ">=":
                    value = left >= right;
                    break;
                  case "*":
                    value = left * right;
                    break;
                  case "/":
                    value = left / right;
                    break;
                  case "instanceof":
                    value = left instanceof right;
                    break;
                  case "in":
                    value = left in right;
                    break;
                  case "^":
                    value = left ^ right;
                    break;
                  case "<<":
                    value = left << right;
                    break;
                  case ">>":
                    value = left >> right;
                    break;
                  case ">>>":
                    value = left >>> right;
                    break;
                  case "%":
                    value = left % right;
                    break;
                  case "&":
                    value = left & right;
                    break;
                  case "|":
                    value = left | right;
                    break;
                  default:
                    throw new Error(e.type + " not implemented " + e.operator);
                }
                c(value, left, right);
              } catch (e) {
                cerr("Error", e);
              }
            }, cerr);
          }, cerr);
        },
    
        LogicalExpression: function (e, env, c, cerr) {
          delayEvaluate(e.left, env, function (left) {
            if (!left && e.operator === "&&") {
              c(left);
            } else if (left && e.operator === "||") {
              c(left);
            } else {
              delayEvaluate(e.right, env, c, cerr);
            }
          }, cerr);
        },
    
        UnaryExpression: function (e, env, c, cerr) {
    
          // this variable is "private symbol", used for `===` comparison
          var noSuchReference = {};
    
          function success(argument, obj, propName) {
            try {
              var envCopy = env,
                foundWithEnvironment;
              while (envCopy.prev) {
                if (envCopy.type === "WithStatement") {
                  foundWithEnvironment = envCopy;
                }
                envCopy = envCopy.prev;
              }
              var
                global = envCopy,
                value;
    
              switch (e.operator) {
                case "delete":
    
                  // make sure that for example
                  // function(arg){
                  //  arg = 2;
                  //  delete arguments[0];
                  //  return arg;
                  // }
                  // will work properly
                  if (obj && obj === env.arguments && propName !== "length") {
                    env.paramsNames[propName] = void 0;
                  }
    
                  // TODO: simplify
                  if (e.argument.type === "Literal" ||
                    e.argument.type === "CallExpression" ||
                    e.argument.type === "ObjectExpression" ||
                    propName === 'this' ||
                    argument === noSuchReference) {
    
                    // 3. return true for this, but don't delete
                    // 4. reference not found in global, but return true
                    value = true;
                  } else if (foundWithEnvironment) {
                    var obj2 = obj;
                    if (propName in foundWithEnvironment.names) {
                      obj2 = foundWithEnvironment.names;
                    }
                    value = delete obj2[propName];
                  } else if (
                    obj === global.names ||
                    e.argument.type !== "Identifier") {
    
                    // always try to delete in global object or from object
                    value = delete obj[propName];
                  } else {
                    // identifier not in global object, don't delete it, but return false
                    value = false;
                  }
                  break;
                case "typeof":
                  value = typeof argument;
                  break;
                case "-":
                  value = -argument;
                  break;
                case "!":
                  value = !argument;
                  break;
                case "+":
                  value = +argument;
                  break;
                case "~":
                  value = ~argument;
                  break;
                case "void":
                  value = void argument;
                  break;
                default:
                  throw new Error("not implemented " + e.operator);
              }
              c(value);
            } catch (e) {
              cerr("Error", e);
            }
          }
    
          function error(argument, obj, propName) {
            switch (e.operator) {
              case "typeof":
                // it means that reference was not declared,
                // so in case of `typeof`, "undefined" value should be returned
                c("undefined");
                break;
              case "delete":
                if (e.argument.type === "MemberExpression" && obj instanceof ReferenceError) {
                  cerr.apply(null, arguments);
                } else {
                  success(noSuchReference, obj, propName);
                }
                break;
              default:
                cerr.apply(null, arguments);
                break;
            }
          }
    
          delayEvaluate(e.argument, env, success, error);
        },
    
        LabeledStatement: function (e, env, c, cerr) {
          delayEvaluate(e.body, env, c, function (type, labelName, continuation) {
            if (e.label.name && e.label.name === labelName) {
              if (type === "ContinueStatement") {
                continuation();
              } else if (type === "BreakStatement") {
                c();
              }
            } else {
              cerr.apply(null, arguments);
            }
          });
        },
    
        ForStatement: function (e, env, c, cerr) {
          var bodyResults = [];
          if (e.init) {
            delayEvaluate(e.init, env, loop_, cerr);
          } else if (e.type === "WhileStatement") {
            loop_();
          } else {
            startBody();
          }
    
          function bodyC(result) {
            bodyResults.push(result);
            if (e.update) {
              delayEvaluate(e.update, env, loop_, cerr);
            } else {
              loop_(e, env);
            }
          }
    
          function updateAndContinue(c) {
            if (e.update) {
              delayEvaluate(e.update, env, function () {
                c.apply(null, bodyResults.reverse());
              }, cerr);
            } else {
              c.apply(null, bodyResults.reverse());
            }
          }
    
          function bodyCerr(errorType, value, extra) {
            switch (errorType) {
              case "BreakStatement":
                if (typeof value === "undefined") {
                  c.apply(null, extra.length ? extra : [bodyResults.pop()]);
                } else {
                  cerr(errorType, value, loop_);
                }
                break;
              case "ContinueStatement":
                if (typeof value === "undefined") {
                  updateAndContinue(loop_);
                } else {
                  // update first
                  updateAndContinue(function () {
                    cerr(errorType, value, loop_);
                  });
                }
                break;
              default:
                cerr.apply(null, arguments);
                break;
            }
          }
    
          function evaluateBody() {
            delayEvaluate(e.body, env, bodyC, bodyCerr);
          }
    
          function loop_() {
            if (e.test) {
              delayEvaluate(e.test, env, function (bool) {
                if (bool) {
                  evaluateBody();
                } else {
                  c(bodyResults.reverse());
                }
              }, cerr);
            } else {
              evaluateBody();
            }
          }
    
          function startBody() {
            evaluateBody();
          }
        },
    
        BreakStatement: function (e, env, c, cerr) {
          cerr(e.type, (e.label ? e.label.name : undefined));
        },
    
        ContinueStatement: function (e, env, c, cerr) {
          cerr(e.type, (e.label ? e.label.name : undefined));
        },
    
        ForInStatement: function (e, env, c, cerr) {
          function rightHandSide() {
            delayEvaluate(e.right, env, function (right) {
    
              /**
               * Collect results into an array. Inconsistent with native implementation,
               * because all the getters would be called immediately at the very beginning
               */
              var
                leftHandSide = e.left.type === "VariableDeclaration" ? e.left.declarations[0].id : e.left,
                results = [];
    
              for (var i in right) {
                results.push(e.type === 'ForOfStatement' ? right[i] : i);
              }
    
              /**
               * Haven't found yet a better way to follow semantics of let-hand-side expression updates.
               * Remember that
               *
               * for(var x in z) {}
               * for(x in z) {}
               * for(x.y in z) {}
               *
               * are all valid programs.
               *
               * TODO: what about values attached to the original AST?
               */
              function assignment(value) {
                return {
                  "type": "AssignmentExpression",
                  "operator": "=",
                  "left": leftHandSide,
                  "right": {
                    "type": "Literal",
                    "value": value,
                    "raw": "\"" + value + "\""
                  }
                }
              }
    
              function bodyCerr(errorType, value, extra) {
                switch (errorType) {
                  case "BreakStatement":
                    if (typeof value === "undefined") {
                      c();
                    } else {
                      cerr(errorType, value);
                    }
                    break;
                  case "ContinueStatement":
                    if (typeof value === "undefined") {
                      loop_();
                    } else {
                      cerr(errorType, value);
                    }
                    break;
                  default:
                    cerr.apply(null, arguments);
                    break;
                }
              }
    
              var loopResults;
    
              function loop_(result) {
                if (loopResults) {
                  loopResults.push(result);
                } else {
                  loopResults = [];
                }
                if (results.length) {
                  delayEvaluate(assignment(results.shift()), env, function () {
                    delayEvaluate(e.body, env, loop_, bodyCerr);
                  }, cerr);
                } else {
                  c(loopResults.pop());
                }
              }
    
              loop_();
            }, cerr)
          }
    
          delayEvaluate(e.left, env, rightHandSide, function (errorType, value) {
            if (errorType === "Error" && (value instanceof ReferenceError)) {
              setValue(env, e.left.name, undefined, false);
              rightHandSide();
            } else {
              cerr.apply(null, arguments);
            }
          })
        },
    
        WhileStatement: function (e, env, c, cerr) {
          tokens.ForStatement(e, env, c, cerr);
        },
    
        DoWhileStatement: function (e, env, c, cerr) {
          // TODO: create base function for all loops and call it with functions as configuration arguments
          tokens.ForStatement(e, env, c, cerr);
        },
    
        ExpressionStatement: function (e, env, c, cerr) {
          delayEvaluate(e.expression, env, c, cerr);
        },
    
        ObjectExpression: function (e, env, c, cerr) {
          delayEvaluate(e.properties, env, function (properties) {
            var objectProperties = Object.create(null);
    
            for (var i = 0; i < properties.length; i++) {
              var key = properties[i].key,
                kind = e.properties[i].kind;
              if (["get", "set"].indexOf(kind) >= 0) {
                objectProperties[key] = objectProperties[key] || {};
    
                // defaults
                objectProperties[key].enumerable = true;
                objectProperties[key].configurable = true;
    
                objectProperties[key][kind] = properties[i].value;
              } else {
                objectProperties[properties[i].key] = {
                  value: properties[i].value,
                  configurable: true,
                  writable: true,
                  enumerable: true
                };
              }
            }
            c(Object.create(Object.prototype, objectProperties));
          }, cerr);
        },
    
        Property: function (e, env, c, cerr) {
          function continueToValue(key) {
            key = e.key.name || key;
            delayEvaluate(e.value, env, function (value) {
              c({
                key: key,
                value: value
              });
            }, cerr);
          }
    
          delayEvaluate(e.key, env, continueToValue, continueToValue);
        },
    
        // TODO: clean up
        AssignmentExpression: function (e, env, c, cerr) {
          delayEvaluate(e.right, env, function (right) {
            // TODO: integrate with case below using env names containers (?) or something else
            function assignToMemberExpression(obj, propName, c) {
              var value;
              switch (e.operator) {
                case "=":
                  value = obj[propName] = right;
                  break;
                case "+=":
                  value = obj[propName] += right;
                  break;
                case "-=":
                  value = obj[propName] -= right;
                  break;
                case "*=":
                  value = obj[propName] *= right;
                  break;
                case "/=":
                  value = obj[propName] /= right;
                  break;
                case "%=":
                  value = obj[propName] %= right;
                  break;
                case "<<=":
                  value = obj[propName] <<= right;
                  break;
                case ">>=":
                  value = obj[propName] >>= right;
                  break;
                case ">>>=":
                  value = obj[propName] >>>= right;
                  break;
                case "&=":
                  value = obj[propName] &= right;
                  break;
                case "|=":
                  value = obj[propName] |= right;
                  break;
                case "^=":
                  value = obj[propName] ^= right;
                  break;
                default:
                  throw new Error(e.type + " not implemented " + e.operator);
              }
              if ('arguments' in env && obj === env.arguments && typeof env.paramsNames[propName] !== "undefined") {
                setValue(env, env.paramsNames[propName], value, false);
              }
              c(value);
            }
    
            if (e.left.name) {
              function foundName(left) {
                var value;
                switch (e.operator) {
                  case "=":
                    value = left = right;
                    break;
                  case "+=":
                    value = left += right;
                    break;
                  case "-=":
                    value = left -= right;
                    break;
                  case "*=":
                    value = left *= right;
                    break;
                  case "/=":
                    value = left /= right;
                    break;
                  case "%=":
                    value = left %= right;
                    break;
                  case "<<=":
                    value = left <<= right;
                    break;
                  case ">>=":
                    value = left >>= right;
                    break;
                  case ">>>=":
                    value = left >>>= right;
                    break;
                  case "&=":
                    value = left &= right;
                    break;
                  case "|=":
                    value = left |= right;
                    break;
                  case "^=":
                    value = left ^= right;
                    break;
                  default:
                    throw new Error(e.type + " not implemented " + e.operator);
                }
                setValue(env, e.left.name, value, false);
                if ('arguments' in env) {
                  var index = env.paramsNames.indexOf(e.left.name);
                  if (index >= 0) {
                    env.names.arguments[index] = value;
                  }
                }
                c(value);
              }
    
              function notFoundNameButAssignToGlobal(errorType, error, flag, env) {
                // PutValue in global environment only if this is a simple assignment expression
                if (e.operator === "=") {
                  // find global env
                  var global = env;
                  while (global.prev) {
                    global = global.prev;
                  }
                  assignToMemberExpression(global.names, e.left.name, c);
                } else {
                  cerr.apply(null, arguments);
                }
              }
    
              getValue(env, e.left.name, false, foundName, notFoundNameButAssignToGlobal);
    
            } else {
              delayEvaluate(e.left, env, function (prop, obj, propName) {
                assignToMemberExpression(obj, propName, c);
              }, cerr);
            }
          }, cerr);
        },
    
        UpdateExpression: function (e, env, c, cerr) {
          delayEvaluate(e.argument, env, function (argument, container, propName) {
            try {
              var value;
              if (e.prefix) {
                switch (e.operator) {
                  case "++":
                    value = ++container[propName];
                    break;
                  case "--":
                    value = --container[propName];
                    break;
                  default:
                    throw new Error("Implement me, " + e.operator);
                }
              } else {
                switch (e.operator) {
                  case "++":
                    value = container[propName]++;
                    break;
                  case "--":
                    value = container[propName]--;
                    break;
                  default:
                    throw new Error("Implement me, " + e.operator);
                }
              }
              c(value);
            } catch (e) {
              cerr("Error", e);
            }
    
          }, cerr);
    
        },
    
        ThisExpression: function (e, env, c, cerr) {
          function foundName(pair) {
            var
              value = pair[0],
              container = pair[1];
            c(value, container, 'this');
          }
    
          getValue(env, 'this', true, foundName, cerr);
        },
    
        CallExpression: function (e, env, c, cerr) {
          delayEvaluate(e.callee, env, function (callee, thisObj, calleeName) {
            delayEvaluate(e.arguments, env, function (args) {
              if (e.callee.type === "MemberExpression" && typeof callee === "undefined" || typeof callee !== "function") {
                cerr("Error", new TypeError(typeof callee + " is not a function"));
              } else {
                thisObj = e.callee.type === "MemberExpression" ? thisObj : null;
                if (env.type === "WithStatement" && env.names[calleeName] === callee) {
                  thisObj = env.names;
                }
                delayApply(e, thisObj, callee, args, c, cerr, env);
              }
            }, cerr);
          }, cerr);
        },
    
        MemberExpression: function (e, env, c, cerr, pause) {
          delayEvaluate(e.object, env, function (object, name) {
    
            function extractor(obj, prop, propName) {
    
              // no support for arguments.callee.caller
              // TODO: optimize
              var value;
              if (typeof obj === "function" && propName === "caller") {
                value = void 0;
              } else {
                value = obj[prop];
              }
              applyInterceptor(e.property, value, env, pause);
              return value;
            }
    
            try {
              // check if `value` belongs to the object and is not taken from its prototype
              if (e.property.hasOwnProperty("value")) {
                c(extractor(object, e.property.value, e.property.name), object, e.property.value);
              } else if (e.computed) {
                delayEvaluate(e.property, env, function (member, property) {
                  c(extractor(object, member, e.property.name), object, member);
                }, cerr);
              } else {
                c(extractor(object, e.property.name, e.property.name), object, e.property.name);
              }
            } catch (e) {
              cerr("Error", e);
            }
          }, cerr);
        },
    
        NewExpression: function (e, env, c, cerr) {
          delayEvaluate(e.arguments, env, function (args) {
            delayEvaluate(e.callee, env, function (ctor) {
              var obj;
              if (typeof ctor !== "function") {
                cerr("Error", new TypeError(typeof ctor + " is not a function"));
              } else if (ctor.metaFunction) {
                // delay constructor evaluation so don't use native `new`.
                if (typeof ctor.prototype === "object" || typeof ctor.prototype === "function") {
                  obj = Object.create(ctor.prototype);
                } else {
                  obj = Object.create(Object.prototype);
                }
    
                delayEvaluate(apply, e, obj, ctor, args, function (result) {
                  // if constructor function returns object, then this object is the result of NewExpression
                  c(typeof result === "object" || typeof result === "function" ? result : obj);
                }, cerr, env);
              } else {
                try {
                  // create new object using given constructor function and unknown number of arguments
                  obj = new (Function.prototype.bind.apply(ctor, [undefined].concat(args)));
                  c(obj);
                } catch (e) {
                  // possible TypeError
                  cerr("Error", e);
                }
              }
            }, cerr);
          }, cerr);
        },
    
        ArrayExpression: function (e, env, c, cerr) {
          delayEvaluate(e.elements, env, function (result) {
            result.forEach(function (r, index) {
              if (typeof result[index] === "undefined") {
                // example: [,,] - in this case all indexes are not enumerable
                // TODO: what about reasigning value to index?
                Object.defineProperty(result, index, {
                  enumerable: false
                });
              }
            });
            c(result);
          }, cerr);
        },
    
        WithStatement: function (e, env, c, cerr) {
          delayEvaluate(e.object, env, function (object) {
    
            // TODO: simplify
            if (typeof object == "undefined" || object === null ||
              typeof object === "number" || object === true || object === false) {
    
              cerr("Error", new TypeError(object + " has no properties"));
            } else {
              if (typeof object === "string") {
                object = new String(object);
              }
              var withCfg = clone(env.cfg),
                withEnv = {
                  names: object,
                  prev: env,
                  cfg: withCfg,
                  type: e.type
                };
              delayEvaluate(e.body, withEnv, c, cerr);
            }
          }, cerr);
        },
    
        BlockStatement: function (e, env, c, cerr) {
    
          function runHoisting(e) {
            var declarations = [];
    
            if (e.declarations) {
              declarations = e.declarations;
            } else {
              function isToken(o) {
                return o && o.type;
              }
    
              function search(e) {
                if (["FunctionDeclaration", "VariableDeclarator"].indexOf(e.type) >= 0) {
                  declarations.push(e);
                } else if (["FunctionExpression", "FunctionDeclaration"].indexOf(e.type) === -1) {
                  Object.keys(e).forEach(function (key) {
                    var child = e[key];
                    if (child &&
                      child.type && key !== "test") {
                      search(child);
    
                    } else if (Array.isArray(child)) {
                      child.filter(isToken).forEach(search);
                    }
                  });
                }
              }
              e.forEach(search);
            }
    
            declarations.forEach(function (e) {
              var value;
              switch (e.type) {
                case "FunctionDeclaration":
                case "FunctionExpression":
                  value = new MetaFunction(e, env);
                  break;
              }
              setValue(env, e.id.name, value, true);
            });
    
            // TODO: warning: optimization that can corrupt live coding
            e.declarations = declarations;
          }
    
          // 1st pass, hoisting. Just collect declarations and bind them to values.
          runHoisting(e.body);
    
          function errorHandler(errorType, result, extraParam) {
            switch (errorType) {
              case "ReturnStatement":
              case "YieldExpression":
              case "ContinueStatement":
              case "BreakStatement":
              case "ThrowStatement":
              case "Error":
                cerr.apply(null, arguments);
                break;
              default:
                c.apply(null, arguments);
                break;
            }
          }
    
          // 2nd pass, execution.
          evaluate(e.body, env, function (results) {
            c(results.reverse()[0]);
          }, errorHandler);
        },
    
        SequenceExpression: function (e, env, c, cerr) {
          delayEvaluate(e.expressions, env, function (results) {
            c(results[results.length - 1]);
          }, cerr);
        },
    
        IfStatement: function (e, env, c, cerr) {
          delayEvaluate(e.test, env, function (test) {
            if (test) {
              delayEvaluate(e.consequent, env, c, cerr);
            } else if (e.alternate) {
              delayEvaluate(e.alternate, env, c, cerr);
            } else {
              c();
            }
          }, cerr);
        },
    
        ConditionalExpression: function (e, env, c, cerr) {
          tokens.IfStatement(e, env, c, cerr);
        },
    
        SwitchStatement: function (e, env, c, cerr) {
          function cleanup(c) {
            return function () {
    
              // TODO: clean up casePassed concept
              env.casePassed = false;
              c();
            }
          }
    
          delayEvaluate(e.discriminant, env, function (discriminant) {
            setValue(env, "discriminant", discriminant, true);
    
            // TODO: block discriminant access and remove after switch is finished
            function maybeBreak(value) {
              if (value === "BreakStatement") {
                c();
              } else {
                cerr.apply(null, arguments);
              }
            }
    
            env.casePassed = false;
            delayEvaluate(e.cases, env, cleanup(c), maybeBreak);
          }, cleanup(cerr));
        },
    
        SwitchCase: function (e, env, c, cerr) {
          getValue(env, "discriminant", false, function (discriminant) {
            if (e.test) {
              delayEvaluate(e.test, env, function (test) {
                if (env.casePassed || test === discriminant) {
                  env.casePassed = true;
                  delayEvaluate(e.consequent, env, c, cerr);
                } else {
                  c();
                }
              }, cerr);
            } else if (env.casePassed) {
              // "default:" case
              delayEvaluate(e.consequent, env, c, cerr);
            }
    
          }, cerr);
        },
    
        TryStatement: function (e, env, c, cerr) {
          function finalizer(c) {
            if (e.finalizer) {
              delayEvaluate(e.finalizer, env, c, cerr);
            } else {
              c();
            }
          }
    
          function continueOrFinalize(result) {
            finalizer(c.bind(null, result));
          }
    
          function maybeCatch(errorType, throwArgument) {
            switch (errorType) {
    
              case "ReturnStatement":
              case "ContinueStatement":
              case "BreakStatement":
                var args = arguments;
                finalizer(function () {
                  cerr.apply(null, args);
                });
                break;
              case "ThrowStatement":
              case "Error":
                // TODO: mark `throwArgument` as inacessible
                setValue(env, 'throwArgument', throwArgument, true);
                if (e.handlers.length) {
                  delayEvaluate(e.handlers[0], env, function (result) {
                      // TODO: tidy up throwArgument here
                      delete env.names.throwArgument;
                      finalizer(c.bind(null, result));
                    },
                    function () {
                      var args = arguments;
                      finalizer(function () {
                        cerr.apply(null, args);
                      });
                    });
                } else {
                  finalizer(c);
                }
                break;
              default:
                cerr.apply(null, arguments);
                break;
            }
          }
    
          delayEvaluate(e.block, env, continueOrFinalize, maybeCatch);
        },
    
        ThrowStatement: function (e, env, c, cerr) {
          delayEvaluate(e.argument, env, function (argument) {
            cerr(e.type, argument);
          }, cerr);
        },
    
        CatchClause: function (e, env, c, cerr) {
          function foundName(value) {
            // assign catched variable value to the given reference name
            var catchEnv = {
              prev: env,
              names: {},
              type: e.type,
              cfg: env.cfg
            };
            catchEnv.names[e.param.name] = value;
    
            delayEvaluate(e.body, catchEnv, c, cerr);
          }
    
          getValue(env, 'throwArgument', false, foundName, cerr);
        },
    
        ReturnStatement: function (e, env, c, cerr, pause) {
          if (e.argument) {
            delayEvaluate(e.argument, env, function (result) {
              applyInterceptor(e, result, env, pause);
              cerr(e.type, result);
            }, cerr);
          } else {
            applyInterceptor(e, undefined, env, pause);
            cerr(e.type);
          }
        },
    
        DebuggerStatement: function (e, env, c, cerr) {
          debugger;
          c();
        },
    
        Program: function (e, env, c, cerr) {
          tokens.BlockStatement(e, env, c, cerr);
        },
    
        // ES6
        ArrowFunctionExpression: function (e, env, c, cerr) {
          // TODO: track `this` properly
          tokens.FunctionExpression(e, env, c, cerr);
        },
    
        ForOfStatement: function (e, env, c, cerr) {
          // TODO: create base function for all loops and call it with functions as configuration arguments
          tokens.ForInStatement(e, env, c, cerr);
        },
    
        ComprehensionExpression: function (e, env, c, cerr) {
          // TODO: what about values attached to the original AST?
          var construct = e.blocks.map(function (block) {
            return {
              left: block.left,
              right: block.right,
              body: e.body,
              type: "ForOfStatement"
            };
          });
          delayEvaluate(construct.reverse(), env, c, cerr);
        },
    
        YieldExpression: function (e, env, c, cerr) {
          delayEvaluate(e.argument, env, function (result) {
            cerr(e.type, result, c);
          }, cerr)
        }
      };
    
      function setValue(env, name, value, isDeclaration) {
        if (isDeclaration) {
          while (env.type === "CatchClause" || env.type === "WithStatement") {
            env = env.prev;
          }
          if (!(name in env.names)) {
            Object.defineProperty(env.names, name, {
              value: value,
              configurable: false,
              enumerable: true,
              writable: true
            });
          } else if (typeof value !== "undefined") {
            env.names[name] = value;
          }
          return value;
        } else {
          function loop_(env) {
            if (!env.prev) {
              return env.names;
            } else {
              if (name in env.names) {
                return env.names;
              } else {
                return loop_(env.prev);
              }
            }
          }
    
          return loop_(env)[name] = value;
        }
      }
    
      /**
       * Gets a value from an environment.
       *
       * @param env
       * @param name
       * @param shouldReturnContainer - If true, then return value and object that contains that value.
       * @param c
       * @param cerr
       */
      function getValue(env, name, shouldReturnContainer, c, cerr) {
        var envs = [];
    
        function getValueHelper(container, key) {
          var value = container[key];
          return shouldReturnContainer ? [value, container] : value;
        }
    
        function loop_(env) {
    
          if (!env) {
            if (cerr) {
              cerr("Error", new ReferenceError(name + " is not defined."), true, envs[0]);
            }
          } else {
            envs.push(env);
            if (name in env.names) {
              c(getValueHelper(env.names, name))
            } else {
              loop_(env.prev);
            }
          }
        }
    
        loop_(env);
      }
    
      /**
       * Constructor for Function in metacircular world.
       */
      function MetaFunction(e, env) {
        this.e = e;
        this.env = env;
        this.cfg = clone(env.cfg);
    
        var
          self = this,
          evaluationResult;
    
        function MetaInvokerInner() {
    
          // If metacirtular function is called from native function, it is important to return metacircular value
          // to the native function.
          self.run(this, arguments, c, cerr, self.env);
    
          // passing c to the `run` function should eventually set up `evaluationResult` variable with evaluated value
          return evaluationResult;
        }
    
        function cerr(errorType, e) {
          throw e;
        }
    
        // nowhere to continue
        function c(result) {
          evaluationResult = result;
        }
    
        var
          functionParamsNames = this.paramsNames = e.params.map(function (param) {
            return param.name;
          }),
          functionName = e.id ? e.id.name : "",
          functionSource =
            "(function " + functionName + "(" + functionParamsNames.join(",") + ") {" +
            "return MetaInvokerInner.apply(this,arguments)" +
            "})",
          MetaInvoker = eval(functionSource);
    
        MetaInvoker.toString = function () {
          return env.cfg.programText.substring(e.range[0], e.range[1]);
        };
    
        MetaInvoker.metaFunction = this;
    
        Object.defineProperties(MetaInvoker, {
          "toString": {
            enumerable: false
          },
          "metaFunction": {
            enumerable: false
          }
        });
    
        this.metaInvoker = MetaInvoker;
    
        return MetaInvoker;
      }
    
      MetaFunction.prototype.run = function (thisObj, args, c, cerr, prevEnv) {
        function buildArgsObject(input) {
          var mockedArgsObject = {};
    
          for (var i = 0; i < input.length; i++) {
            mockedArgsObject[i] = input[i];
          }
    
          Object.defineProperties(mockedArgsObject, {
            "length": {
              enumerable: false,
              value: input.length
            },
            "callee": {
              enumerable: false,
              value: self.metaInvoker
            }
          });
          return mockedArgsObject;
        }
    
        var _this;
        getValue(this.env, 'this', false, function (value) {
          _this = value;
        }, cerr);
    
        var
          cfg = prevEnv.cfg,
          self = this,
          argsObject = buildArgsObject(args),
          env = {
            fn: self,
            cfg: cfg,
            names: {
              this: thisObj || _this
            },
            closure: this.env,
            prev: prevEnv
          };
    
        // if function is named, pass its name to environment to allow recursive calls
        if (this.e.id) {
          setValue(env, this.e.id.name, this.metaInvoker, true);
        }
    
        Object.defineProperty(env.names, "arguments", {
          configurable: false,
          value: argsObject,
          writable: true
        });
        var functionResult;
    
        env.variables = env.variables || {};
    
        // set function scope variables variables based on formal function parameters
        this.e.params.forEach(function (param, i) {
          applyInterceptor(param, args[i], env);
    
          // TODO: clean up
          // create variable
          setValue(env, param.name, args[i], true);
    
          // assign (or reassign) variable
          setValue(env, param.name, args[i], false);
    
          env.variables[param.name] = param;
        });
    
        delayEvaluate(this.e.body, env,
          function (result) {
            c(undefined);
          },
          function (nodeType, result, extraParam) {
            switch (nodeType) {
              case "YieldExpression":
                throw new Error("Handle properly saving continuation here");
                break;
              case "ReturnStatement":
                c.call(null, result, extraParam);
                break;
              default:
                cerr.apply(null, arguments);
                break;
            }
          });
    
        execute();
        applyInterceptor(this.e, this.metaInvoker, env);
        return functionResult;
      };
    
      /**
       * In here the function is called from metacircular space. Therefore it's possible to give it some settings.
       */
      function apply(e, thisObj, fn, args, c, cerr, env) {
        if (fn === eval) {
          if (typeof args[0] === "string") {
            // here is the case where `eval` is executed in metacircular space, therefore it has to be
            // handled in special way
            function cc(e, result) {
              c(result);
            }
    
            metaEval(e, args, env, cc, cerr);
          } else {
            c(args[0]);
          }
        } else if (fn.metaFunction instanceof MetaFunction) {
          fn.metaFunction.run(thisObj, args, c, cerr, env);
        } else {
          try {
            c(fn.apply(thisObj, args));
          } catch (e) {
            cerr("Error", e);
          }
        }
      }
    
      function applyInterceptor(e, val, env, pause) {
        if ('interceptor' in env.cfg && e.type) {
          env.cfg.interceptor(e, val, env, pause);
        }
      }
    
      /**
       * Evaluates given AST node.
       *
       * @param e - currently evaluated AST node
       * @param env - current execution environment
       * @param c - continuation function
       * @param cerr - alternative continuation function, used by try/catch, return, break, continue
       */
      function evaluate(e, env, c, cerr) {
        if (Array.isArray(e)) {
          var results = [];
    
          function next(e) {
            if (e.length) {
              delayEvaluate(e[0], env,
                function (result) {
                  results.push(result);
                  next(e.slice(1));
                },
                function (errorType) {
                  if (errorType === "BreakStatement") {
                    cerr.apply(null, [].slice.call(arguments).concat([results]));
                  } else {
                    cerr.apply(null, arguments);
                  }
                });
            } else {
              c(results);
            }
          }
    
          next(e);
        } else {
          // e can be null in [,,]
          if (e) {
            function success(result) {
              if (arguments.length > 1) {
                c.apply(null, arguments);
              } else {
                c(result);
              }
            }
    
            if (e.type in tokens) {
              if (e.range) {
                e.subProgram = env.cfg.programText.substring(e.range[0], e.range[1]);
              }
              tokens[e.type](e, env, success, cerr);
            } else {
              var error = new Error(e.type + " token is not yet implemented.");
              error.e = e;
              throw error;
            }
          } else {
            c();
          }
        }
      }
    
      // Global accumulator of expression to be executed
      // TODO: should be local for each subsequent VM?
      var tasksStack = [];
    
      /**
       * Creates a version of `fn` that is uncallable until it's allowed.
       *
       * @param fn - default function to be called
       * @param c - alternative function that can be called with a value instead of `fn`
       * @param args - arguments to `fn` if `fn` is called
       * @returns {{pauser: Function, delayed: Function}}
       */
      function createPausable(fn, c, args) {
        var
          locked = false,
          delayed = function () {
            if (!locked) {
              locked = true;
              if (arguments.length) {
                // alternative call with given continuation
                c.apply(null, arguments);
              } else {
                // normal call
                fn.apply(null, args);
              }
            }
          },
          resume = function () {
            locked = false;
            delayed.apply(null, arguments);
    
            // rerun the VM
            execute();
          },
          pauser = function () {
            locked = true;
            return function () {
              resume.apply(null, arguments);
            }
          };
    
        return {pauser: pauser, delayed: delayed};
      }
    
      function delayEvaluate(e, env, c, cerr) {
        var _c = c;
        c = function () {
          var continuation = createPausable(_c, _c, arguments);
          // give a change to the client code to pause and modify the execution after evaluation
          applyInterceptor(e, arguments, env, continuation.pauser);
          tasksStack.push(continuation.delayed);
        };
        var pausableEvaluate = createPausable(evaluate, c, arguments);
    
        // give a change to the client code to pause the execution before evaluation
        applyInterceptor(e, undefined, env, pausableEvaluate.pauser);
        pausableEvaluate.delayed();
        tasksStack.push(pausableEvaluate.delayed);
      }
    
      function delayApply(e, thisObj, callee, args, c, cerr, env) {
        var pausable = createPausable(apply, c, arguments);
        applyInterceptor(e, {this: thisObj, callee: callee, arguments: args}, env, pausable.pauser);
        tasksStack.push(pausable.delayed);
      }
    
      function execute() {
        while (tasksStack.length) {
          tasksStack.pop()();
        }
      }
    
      var parseConfig = {
        loc: true,
        range: true
      };
    
      function metaEval(node, programText, env, c, cerr) {
    
        // take only first argument that should be a text
        programText = programText[0];
    
        try {
          var e = esprima.parse(programText, parseConfig),
            env2,
            cfg = clone(env.cfg);
    
          cfg.programText = programText;
    
          // indirect eval call is run in global context
          if (node.callee.name !== "eval") {
            while (env.prev) {
              env = env.prev;
            }
          }
          env2 = clone(env);
          env2.cfg = cfg;
    
          function metaCerr() {
            // by pass 1st argument (ast)
            cerr.apply(null, [].slice.call(arguments, 1));
          }
    
          function metaC() {
            c.apply(null, arguments);
          }
    
          runVM(e, env2, metaC, metaCerr);
    
        } catch (error) {
          if (error.message.indexOf("Invalid left-hand side in assignment") >= 0) {
            cerr("Error", new ReferenceError(error.message));
          } else {
            cerr("Error", new SyntaxError(error.message));
          }
        }
      }
    
      var VMsCounter = 0;
    
      /**
       * This is the function calling the interpreter
       * @param text - JavaScript program
       * @param rootEnvironment - object containing key-values pairs that will be enviroment for `text`. Can be for example just `window`, or `{a: 1, b:2}`, or environment that has previous (outer) environment that should have following shape:
    
       ```js
       {
           name: [[key-valued object]],
           prev: [[literal or reference to another rootEnvironment]]
       }
       ```
       * @param c - function that will be called if evaluation finishes successfully
       * @param cerr - function that will be called if evaluation finishes with error (`SyntaxError`, `ReferenceError` of any kind of exception)
       * @param cfg - object with may contain following settings:
    
       ```
       {
         name: //name of the VM, can be filename or just any arbitrary name.
               Leaving it undefined will by default assign name like VMx where `x` is next natural number.
         interceptor: // function of signature `(e, value, env)` where `e` is AST node from exprima, value is JavaScript value
         and env is enviroment object compatible with `rootEnvironment` parameter
       }
       ```
       * @returns {*}
       */
      function mainEvaluate(text, rootEnvironment, cfg, c, cerr) {
        if (typeof text === "function") {
          text = "(" + text.toString() + ")";
        }
        var evaluationResult;
    
        cfg = cfg || {};
        cfg.programText = text;
        cfg.name = cfg.name || "VM" + VMsCounter++;
    
        rootEnvironment = rootEnvironment || {};
    
        try {
          var
            e = esprima.parse(text, parseConfig),
            env;
          if ('names' in rootEnvironment) {
            env = rootEnvironment;
            env.cfg = cfg;
          } else {
            env = {
              prev: null,
              names: rootEnvironment || {},
              cfg: cfg
            };
          }
    
          Object.defineProperty(env.names, 'this', {
            configurable: false,
            value: env.names
          });
    
          function wrapResult(continuation) {
            return function (ast, result, result2) {
              evaluationResult = result2 || result;
              if (continuation) {
                continuation.apply(null, arguments);
              } else if (result === "Error") {
                throw result2;
              }
            }
          }
    
          runVM(e, env, wrapResult(c), wrapResult(cerr));
          execute();
        } catch (err) {
          if (cerr) {
            cerr(null, err);
          } else {
            throw err;
          }
        }
    
        return evaluationResult;
      }
    
      function runVM(e, env, c, cerr) {
        evaluate(e, env, c.bind(null, e), cerr.bind(null, e));
      }
    
      return {
        evaluate: mainEvaluate
      };
    }));
}
var __wrappers_are_defined__ = true;