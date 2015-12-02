// requires node packages listed below
// example: 'npm install esprima'
//
esprima = require('esprima');
estraverse = require('estraverse');
util = require('util');

fs = require('fs');
var type = process.argv[2];
var code = '';
if ( type == "line" ) {
    code = process.argv[3];
} else if ( type == "file" ) {
    code = fs.readFileSync(process.argv[3]);
} else {
    throw "Must specify either 'line' or 'file'"
}
var ast = esprima.parse(code, {loc: true});
//console.log(JSON.stringify(ast, null, 4));

var line_num = process.argv[4];

estraverse.traverse(ast, {
    enter: findline,
    leave: done
});

function findline( node ) {
    // first check if the line number is even in the program
    if ( "loc" in node ) {
        if ( (line_num < node.loc.start.line) || (line_num > node.loc.end.line) ) {
            throw "Requested line number (" + line_num + ") not in file (range " + node.loc.start.line + ":" + node.loc.end.line + ")";
        }
    }

    // check if the relevant line number is here
    if ( node.type != "Program" ) {
        console.log(node);
        console.log("\n");
    }
}

function done() {
    console.log("DONE");
}
