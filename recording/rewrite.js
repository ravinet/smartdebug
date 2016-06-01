// requires node packages listed below
// example: 'npm install esprima'
//
esprima = require('esprima');
estraverse = require('estraverse');
escodegen = require('escodegen');
util = require('util');

fs = require('fs');

var code = String(fs.readFileSync(process.argv[2]));
if ( code[code.length-1] == "\n" ) {
    code = code.substring(0, code.length-1);
}
// add quotes around JS code since it will be passed to metaes as a string
code = "'" + code + "'";
code = code.split("\n").join("\\\n");
var ast = esprima.parse(code, {loc: true});
var proxy_wrapper = {"type": "Program","body": [{"type": "ExpressionStatement","expression": {"type": "CallExpression","callee": {"type": "MemberExpression","computed": false,"object": {"type": "Identifier","name": "metaes"},"property": {"type": "Identifier","name": "evaluate"}},"arguments": []}}]};

// take body from the initial source code and put into our new anonymous function
var body = ast.body;
body.push({"type": "Identifier", "name": "debugger_env"});
body.push({"type": "ObjectExpression", "properties": [{"type": "Property", "key": {"type": "Identifier", "name": "interceptor"}, "computed": false, "value": {"type": "Identifier", "name": "interceptor"}, "kind": "init", "method": false, "shorthand": false}]});
proxy_wrapper.body[0].expression.arguments = body;
ast = proxy_wrapper;
output = escodegen.generate(ast);
// verify that there is not an extra semi-colon in arg to metaes.evaluate()
if ( (output.substring(output.length-47) == ';, debugger_env, { interceptor: interceptor });') ) {
    output = output.substring(0, output.length-47) + ", debugger_env, {interceptor:interceptor});";
}
outname = process.argv[3] ? process.argv[3] : "out";
fs.writeFileSync(outname, output);
