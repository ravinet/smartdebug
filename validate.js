// requires node packages listed below
// example: 'npm install esprima'
//
esprima = require('esprima');
var code = process.argv[2];
try {
var ast = esprima.parse(code, {loc: true});
} catch (e) {
    console.log("ERROR")
}
