// counter for nondeterminism replay
global.nd_pointer = 0;

// function that returns estimate of 'current wall clock time' using log
//function curr_wall_clock_time() {
//    // current doesn't take arguments, but uses the global lower/upper bounds and modifies them accordingly
//    if ( upper_wall_clock < lower_wall_clock ) {
//        throw "Upper bound on current wall clock time is less than lower"
//    }
//    // currently returns 40% between the two (note that this has to remain monotonically increasing!)
//    var curr = lower_wall_clock + 0.4(upper_wall_clock-lower_wall_clock);
//    lower_wall_clock = curr;
//    return curr;
//}

_orig_date_now = Date.now;
var _date = global.Date;
global.Date = function(time){
    var retVal;
    if ( this.constructor == Date.prototype.constructor ) { // new Date()
        if ( log_vals[nd_pointer][0] != "new window.Date" ) {
            throw "new window.Date called when next nondetermistic function expected is: " + log_vals[nd_pointer][0];
        }
        if ( log_vals.length <= nd_pointer ) { // run out of logs!
            //var ret = (curr_wall_clock_time)*1000 + avg_date_diff;
            //lower_wall_clock = ret;
            //upper_wall_clock = ret + 10;
            //retVal = new _date(ret);
            retVal = new _date();
        } else {
            retVal = new _date(log_vals[nd_pointer][1]);
        }
    } else {
        if ( log_vals[nd_pointer][0] != "window.Date" ) {
            throw "window.Date called when next nondetermistic function expected is: " + log_vals[nd_pointer][0];
        }
        if ( log_vals.length <= nd_pointer ) { // run out of logs!
            // return curr_wall_clock + avg_date_diff
            //var ret = (curr_wall_clock_time)*1000 + avg_date_diff;
            //lower_wall_clock = ret;
            //upper_wall_clock = ret + 10;
            //retVal = ret;
            retVal = _date();
        } else {
            var retVal = log_vals[nd_pointer][1];
        }
    }
    nd_pointer++;
    return retVal;
};

// shim for Math.random()
var _random = Math.random;
Math.random = function(){
    if ( log_vals[nd_pointer][0] != "Math.random" ) {
        throw "Math.random called when next nondetermistic function expected is: " + log_vals[nd_pointer][0];
    }
    if ( log_vals.length <= nd_pointer ) { // run out of logs!
        // since math.random is 'random', just return a new random value!
        return _random();
    }
    var retVal = log_vals[nd_pointer][1];
    nd_pointer++;
    return retVal;
};
