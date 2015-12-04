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

// find the relevant block based on line number and then handle types accordingly
function findline( node, p ) {
    // first check if the line number is even in the program
    if ( "loc" in node ) {
        if ( node.type == "Program" ) {
            if ( (line_num < node.loc.start.line) || (line_num > node.loc.end.line) ) {
                throw "Requested line number (" + line_num + ") not in file (range " + node.loc.start.line + ":" + node.loc.end.line + ")";
            }
        }
    }

    // only do something if the line number is correct!
    if ( "loc" in node ) {
        if ( node.loc.start.line == line_num ) {
            // first detect specific types (e.g., AssignmentExpression) and then traverse up parent if any info is needed
            if ( node.type == "AssignmentExpression" ) {
                parent_vars = [];
                // 'id' is left and 'init' is right
                if ( node.right.type == 'Identifier' ) { // right side is a var so we need to add dep
                    parent_vars.push(node.right.name);
                } else if ( node.right.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.right, "");
                    parent_vars.push(full_name);
                } else if ( node.right.type == "BinaryExpression" ) { // have to get the variables we care about from the binary expression
                    if ( node.right.left.type == 'Identifier' ) {
                        parent_vars.push(node.right.left.name);
                    } else if ( node.right.left.type == "MemberExpression" ) {
                        var full_name = handle_nesting(node.right.left, "");
                        parent_vars.push(full_name);
                    }
                    if ( node.right.right.type == 'Identifier' ) {
                        parent_vars.push(node.right.right.name);
                    } else if (node.right.right.type == "MemberExpression" ) {
                        var full_name = handle_nesting(node.right.right, "");
                        parent_vars.push(full_name);
                    }
                }
                var res = {};
                if ( node.left.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.left, "");
                    res[full_name] = parent_vars;
                } else {
                    res[node.left.name] = parent_vars;
                }
                console.log(res);
            } else if ( node.type == 'VariableDeclarator' ) { // return (assignment, left_var, right_var)
                parent_vars = [];
                // 'id' is left and 'init' is right
                if ( node.init.type == 'Identifier' ) { // right side is a var so we need to add dep
                    parent_vars.push(node.init.name);
                } else if ( node.init.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.init, "");
                    parent_vars.push(full_name);
                } else if ( node.init.type == "BinaryExpression" ) { // have to get the variables we care about from the binary expression
                    if ( node.init.left.type == 'Identifier' ) {
                        parent_vars.push(node.init.left.name);
                    } else if ( node.init.left.type == "MemberExpression" ) {
                        var full_name = handle_nesting(node.init.left, "");
                        parent_vars.push(full_name);
                    }
                    if ( node.init.right.type == 'Identifier' ) {
                        parent_vars.push(node.init.right.name);
                    } else if ( node.init.right.type == "MemberExpression" ) {
                        var full_name = handle_nesting(node.init.right, "");
                        parent_vars.push(full_name);
                    }
                }
                var res = {};
                if ( node.id.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.id, "");
                    res[full_name] = parent_vars;
                } else {
                    res[node.id.name] = parent_vars;
                }
                console.log(res);
            } else {
                console.log("Unhandled type: " + node.type);
            }
        }
    }
}

function done() {
    //console.log("DONE");
}

function handle_nesting(node,name) {
    // verify that node is nested!
    if ( node.type != "MemberExpression" ) {
        throw "handle_nesting() called on node that is not nested!";
    }

    // first prepend the current property name to 'name'
    name = node.property.name + "." + name;

    // recursively go through MemberExpressions until 'object' field is a Literal
    if ( node.object.type == "MemberExpression" ) {
        return handle_nesting(node.object, name);
    } else {
        name = node.object.name + "." + name;
        if ( name.slice(-1) == "." ) {
            return name.substring(0, name.length-1);
        } else {
            return name;
        }
    }
}
