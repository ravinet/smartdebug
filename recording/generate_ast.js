var m = require('metaes');
var e = require('esprima');
var escodegen = require('escodegen');
var ast = e.parse('window.d = 400;', {range: true});
console.log(JSON.stringify(ast));
