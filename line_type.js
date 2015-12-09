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

var overall_deps = {};

var line_num = process.argv[4];

estraverse.traverse(ast, {
    enter: findline,
    leave: done
});

console.log(overall_deps);

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
                    binary_expressions( node.right, parent_vars );
                } else if ( node.right.type == "ObjectExpression" ) {
                    handle_objects(node.right, parent_vars);
                } else if ( node.right.type == "CallExpression" ) {
                    handle_functions(node.right, parent_vars);
                }
                var res = {};
                if ( node.left.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.left, "");
                    res[full_name] = parent_vars;
                } else {
                    res[node.left.name] = parent_vars;
                }
                add_deps(res);
            } else if ( node.type == 'VariableDeclarator' ) { // return (assignment, left_var, right_var)
                parent_vars = [];
                if ( node.init != null ) {
                    // 'id' is left and 'init' is right
                    if ( node.init.type == 'Identifier' ) { // right side is a var so we need to add dep
                        parent_vars.push(node.init.name);
                    } else if ( node.init.type == "MemberExpression" ) {
                        var full_name = handle_nesting(node.init, "");
                        parent_vars.push(full_name);
                    } else if ( node.init.type == "BinaryExpression" ) { // have to get the variables we care about from the binary expression
                        binary_expressions( node.init, parent_vars );
                    } else if ( node.init.type == "ObjectExpression" ) {
                        handle_objects(node.init, parent_vars);
                    } else if ( node.init.type == "CallExpression" ) {
                        handle_functions(node.init, parent_vars);
                    }

                }
                var res = {};
                if ( node.id.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.id, "");
                    res[full_name] = parent_vars;
                } else {
                    res[node.id.name] = parent_vars;
                }
                add_deps(res);
            } else {
                //console.log("Unhandled type: " + node.type);
            }
        }
    }
}

function done() {
    //console.log("DONE");
}

// function to add dependencies to overall list
function add_deps(curr_deps) {
    for ( key in curr_deps ) {
        if (!(key in overall_deps)) {
            overall_deps[key] = [];
        }
        for (var q = 0; q < curr_deps[key].length; q++ ) {
            if ( !(curr_deps[key][q] in overall_deps[key] ) ) {
                overall_deps[key].push(curr_deps[key][q]);
            }
        }
    }
}

// function to extract nested variable names (e.g., window.a.b)
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


// takes a Binary Expression node and returns a complete list of all variables that are listed (vars is a list)
function binary_expressions(node,vars) {
    // verify that node is a BinaryExpression!
    if ( node.type != "BinaryExpression" ) {
        throw "binary_expressions() called on node that is not a binary expression!";
    }

    // left side is JS heap variable
    if ( node.left.type == "Identifier" ) {
        if ( vars.indexOf(node.left.name) == -1 ) {
            vars.push( node.left.name );
        }
    }

    // left side is a multi-part name
    if ( node.left.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.left, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    // right side is a JS heap variable
    if ( node.right.type == "Identifier" ) {
        if ( vars.indexOf(node.right.name) == -1 ) {
            vars.push( node.right.name );
        }
    }

    // right side is a multi-part name
    if ( node.right.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.right, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    // must recurse because left or right side has nested BinaryExpression
    if ( node.left.type == "BinaryExpression" ) {
        return binary_expressions(node.left, vars);
    }

    if ( node.right.type == "BinaryExpression" ) {
        return binary_expressions(node.right, vars);
    }
    return vars;
}


function handle_functions(node,vars) {
    // verify that node is a function call!
    if ( node.type != "CallExpression" ) {
        throw "handle_function() called on node that is not a function call!";
    }

    // for now, only deal with makeProxy calls (handle the objects within)
    if ( node.callee.name == "makeProxy" ) {
        // iterate through each argument and handle
        // TODO: handle date(), etc.
        for ( var x = 0; x < node.arguments.length; x++ ) {
            if ( node.arguments[x].type == "ObjectExpression" ) {
               handle_objects(node.arguments[x], vars);
            }
        }
    }
    return vars;
}

// takes ObjectExpression (potentially nested) and return list of variables inside
function handle_objects(node,vars) {
    // verify that node is an object declaration!
    if ( node.type != "ObjectExpression" ) {
        throw "handle_objects() called on node that is not an object declaration!";
    }

    // iterate through each property (key/value) in object
    for ( var x = 0; x < node.properties.length; x++ ) {
        // first handle key because it cannot be another object
        if ( node.properties[x].key.type == "Identifier" ) {
            if ( vars.indexOf(node.properties[x].key.name) == -1 ) {
                vars.push( node.properties[x].key.name );
            }
        }

        if ( node.properties[x].key.type == "MemberExpression" ) {
            var curr_name = handle_nesting(node.properties[x].key, "");
            if ( vars.indexOf(curr_name) == -1 ) {
                vars.push( curr_name );
            }
        }

        // now handle values which can be nested objects
        if ( node.properties[x].value.type == "Identifier" ) {
            if ( vars.indexOf(node.properties[x].value.name) == -1 ) {
                vars.push( node.properties[x].value.name );
            }
        }

        if ( node.properties[x].value.type == "MemberExpression" ) {
            var curr_name = handle_nesting(node.properties[x].value, "");
            if ( vars.indexOf(curr_name) == -1 ) {
                vars.push( curr_name );
            }
        }

        if ( node.properties[x].value.type == "BinaryExpression" ) {
            var binary_nest = binary_expressions( node.properties[x].value, []);
            for (var z = 0; z < binary_nest.length; z++ ) {
                if ( vars.indexOf(binary_nest[z]) == -1 ) {
                    vars.push(binary_nest[z]);
                }
            }
        }

        if ( node.properties[x].value.type == "CallExpression" ) {
            handle_functions(node.properties[x].value, vars);
        }

        if ( node.properties[x].value.type == "ObjectExpression" ) {
            var curr_nest = handle_objects(node.properties[x].value, []);
            for (var y = 0; y < curr_nest.length; y++ ) {
                if ( vars.indexOf(curr_nest[y]) == -1 ) {
                    vars.push(curr_nest[y]);
                }
            }
        }
    }
    return vars;
}
