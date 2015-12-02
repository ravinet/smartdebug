// requires node packages listed below
// example: 'npm install esprima'
//
esprima = require('esprima');
estraverse = require('estraverse');
util = require('util');

fs = require('fs');

var code = process.argv[2];
var ast = esprima.parse(code, {loc: true});
console.log(JSON.stringify(ast, null, 4));
