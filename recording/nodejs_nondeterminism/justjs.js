var events = require('events');
var a = Math.random();
var b = Date();
console.log(a);
console.log(b);
const myEmitter = new events.EventEmitter();
myEmitter.on('blah', function () {console.log('IN THE EVENT');});
myEmitter.emit('blah');
