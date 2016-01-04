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
var branch_tests_per_function = [[]];

var line_num = process.argv[4];

estraverse.traverse(ast, {
    enter: findline,
    leave: done
});

console.log(overall_deps);

function handle_assignment (node,parent_vars) {
    // verify that node is an AssignmentExpression!
    if ( node.type != "AssignmentExpression" ) {
        throw "handle_assignment() called on node that is not an assignment expression!";
    }

    // 'id' is left and 'init' is right
    if ( node.right.type == 'Identifier' ) { // right side is a var so we need to add dep
        parent_vars.push(node.right.name);
    } else if ( node.right.type == "MemberExpression" ) {
        var full_name = handle_nesting(node.right, "");
        parent_vars.push(full_name);
    } else if ( (node.right.type == "BinaryExpression") || (node.right.type == "LogicalExpression") ) {
        binary_expressions( node.right, parent_vars );
    } else if ( node.right.type == "ObjectExpression" ) {
        handle_objects(node.right, parent_vars);
    } else if ( node.right.type == "CallExpression" ) {
        handle_functions(node.right, parent_vars);
    } else if ( node.right.type == "UnaryExpression" ) {
        unary_expressions( node.right, parent_vars );
    } else if ( node.right.type == "UpdateExpression" ) {
        update_expressions( node.right, parent_vars );
    } else if ( node.right.type == "ConditionalExpression" ) {
        conditional_expressions( node.right, parent_vars );
    }
}

function handle_declaration (node, parentvars) {
    // verify that node is an AssignmentExpression!
    if ( node.type != "VariableDeclarator" ) {
        throw "handle_declaration() called on node that is not a variable declarator!";
    }

    // 'id' is left and 'init' is right
    if ( node.init.type == 'Identifier' ) { // right side is a var so we need to add dep
        parent_vars.push(node.init.name);
    } else if ( node.init.type == "MemberExpression" ) {
        var full_name = handle_nesting(node.init, "");
        parent_vars.push(full_name);
    } else if ( (node.init.type == "BinaryExpression") || (node.init.type == "LogicalExpression") ) {
        binary_expressions( node.init, parent_vars );
    } else if ( node.init.type == "ObjectExpression" ) {
        handle_objects(node.init, parent_vars);
    } else if ( node.init.type == "CallExpression" ) {
        handle_functions(node.init, parent_vars);
    } else if (node.init.type == "UnaryExpression" ) {
        unary_expressions( node.init, parent_vars );
    } else if (node.init.type == "UpdateExpression" ) {
        update_expressions( node.init, parent_vars );
    } else if (node.init.type == "ConditionalExpression" ) {
        conditional_expressions( node.init, parent_vars );
    }
}

// function to go through the relevant scope's branches and add dependencies to each variable (key) in overall_deps
function branch_dependencies(branches) {
    var deps = [];
    for (var x = 0; x < branches.length; x++ ) {
        if ( branches[x].type == "IfStatement" ) {
            handle_ifs(branches[x], deps);
        } else if ( branches[x].type == "WhileStatement" ) {
            handle_whiles(branches[x], deps);
        } else if ( branches[x].type == "ForStatement" ) {
            handle_fors(branches[x], deps);
        } else {
            throw "Trying to handle unsupported branch dependency of type: " + branches[x].type;
        }
    }

    // add these dependencies to *all* variables in overall_deps (since branches dictate whether or not current line ever happens!)
    for ( var p = 0; p < deps.length; p++ ) {
        for (key in overall_deps ) {
            if ( overall_deps[key].indexOf(deps[p]) == -1 ) {
                overall_deps[key].push(deps[p]);
            }
        }
    }
}

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

    if (node.type == "IfStatement" || node.type == "WhileStatement" || node.type == "ForStatement") {
        branch_tests_per_function[branch_tests_per_function.length-1].push(node);
    }
    if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
        branch_tests_per_function.push([]);
    }

    // only do something if the line number is correct!
    if ( "loc" in node ) {
        if ( node.loc.start.line == line_num ) {
            parent_vars = [];
            // first detect specific types (e.g., AssignmentExpression) and then traverse up parent if any info is needed
            if ( node.type == "AssignmentExpression" ) {
                handle_assignment(node, parent_vars);
                var res = {};
                if ( node.left.type == "MemberExpression" ) {
                    var full_name = handle_nesting(node.left, "");
                    res[full_name] = parent_vars;
                } else {
                    res[node.left.name] = parent_vars;
                }
                add_deps(res);
            } else if ( node.type == 'VariableDeclarator' ) { // return (assignment, left_var, right_var)
                if ( node.init != null ) {
                    handle_declaration(node, parent_vars);
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
            // handle branch dependencies
            branch_dependencies(branch_tests_per_function[branch_tests_per_function.length-1]);
        }
    }
}

function done(node, p) {
    if (node.type == "IfStatement" || node.type == "WhileStatement" || node.type == "ForStatement") {
        branch_tests_per_function[branch_tests_per_function.length-1].pop();
    }
    if (node.type == "FunctionExpression" || node.type == "FunctionDeclaration") {
        branch_tests_per_function.pop();
    }
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

// takes a Unary Expression node and returns a complete list of all variables that are listed (vars is a list)
function unary_expressions(node,vars) {
    // verify that node is a UnaryExpression!
    if ( node.type != "UnaryExpression" ) {
        throw "unary_expressions() called on node that is not a unary expression!";
    }

    // JS heap variable
    if ( node.argument.type == "Identifier" ) {
        if ( vars.indexOf(node.argument.name) == -1 ) {
            vars.push( node.argument.name );
        }
    }

    // multi-part name
    if ( node.argument.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.argument, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    // update expression
    if ( node.argument.type == "UpdateExpression" ) {
        var update_nest = update_expressions( node.argument, []);
        for (var p = 0; p < update_nest.length; p++ ) {
            if ( vars.indexOf(update_nest[p]) == -1 ) {
                vars.push(update_nest[p]);
            }
        }
    }

    // binary or logical expression
    if ( (node.argument.type == "BinaryExpression") || (node.argument.type == "LogicalExpression") ) {
        return binary_expressions(node.argument, vars);
    }

    // conditional expression
    if ( node.argument.type == "ConditionalExpression" ) {
        return conditional_expressions(node.argument, vars);
    }

    return vars;
}

// takes an Update Expression node and returns a complete list of all variables that are listed (vars is a list)
function update_expressions(node,vars) {
    // verify that node is a UpdateExpression!
    if ( node.type != "UpdateExpression" ) {
        throw "update_expressions() called on node that is not a update expression!";
    }

    // JS heap variable
    if ( node.argument.type == "Identifier" ) {
        if ( vars.indexOf(node.argument.name) == -1 ) {
            vars.push( node.argument.name );
        }
    }

    // multi-part name
    if ( node.argument.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.argument, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    return vars;
}

// takes a Conditional Expression node and returns a complete list of all variables that are listed (vars is a list)
function conditional_expressions(node,vars) {
    // verify that node is a ConditionalExpression!
    if ( node.type != "ConditionalExpression" ) {
        throw "conditional_expressions() called on node that is not a conditional (turnary) expression!";
    }

    // first handle the condition
    if ( node.test.type == "Identifier" ) {
        if ( vars.indexOf(node.test.name) == -1 ) {
            vars.push( node.argument.name );
        }
    }

    if ( node.test.type == "UnaryExpression" ) {
        var unary_nest = unary_expressions( node.test, []);
        for (var b = 0; m < unary_nest.length; b++ ) {
            if ( vars.indexOf(unary_nest[b]) == -1 ) {
                vars.push(unary_nest[b]);
            }
        }
    }
    if ( (node.test.type == "LogicalExpression") || (node.test.type == "BinaryExpression") ) {
        var logical_nest = binary_expressions( node.test, []);
        for (var z = 0; z < logical_nest.length; z++ ) {
            if ( vars.indexOf(logical_nest[z]) == -1 ) {
                vars.push(logical_nest[z]);
            }
        }
    }

    // now handle first possible value (consequent)
    if ( node.consequent.type == "Identifier" ) {
        if ( vars.indexOf(node.consequent.name) == -1 ) {
            vars.push( node.consequent.name );
        }
    }

    if ( (node.consequent.type == "LogicalExpression") || (node.consequent.type == "BinaryExpression") ) {
        var logical_nest = binary_expressions( node.consequent, []);
        for (var y = 0; y < logical_nest.length; y++ ) {
            if ( vars.indexOf(logical_nest[y]) == -1 ) {
                vars.push(logical_nest[y]);
            }
        }
    }

    if ( node.consequent.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.consequent, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    if ( node.consequent.type == "UnaryExpression" ) {
        var unary_nest = unary_expressions( node.consequent, []);
        for (var m = 0; m < unary_nest.length; m++ ) {
            if ( vars.indexOf(unary_nest[m]) == -1 ) {
                vars.push(unary_nest[m]);
            }
        }
    }

    if ( node.consequent.type == "UpdateExpression" ) {
        var update_nest = update_expressions( node.consequent, []);
        for (var r = 0; r < update_nest.length; r++ ) {
            if ( vars.indexOf(update_nest[r]) == -1 ) {
                vars.push(update_nest[r]);
            }
        }
    }

    if ( node.consequent.type == "ConditionalExpression" ) {
        var nested_cond = conditional_expressions(node.consequent, []);
        for (var tt = 0; tt < nested_cond.length; tt++ ) {
            if ( vars.indexOf(nested_cond[tt]) == -1 ) {
                vars.push(nested_cond[tt]);
            }
        }
    }


    // now handle the other possible value (alternate)
    if ( node.alternate.type == "Identifier" ) {
        if ( vars.indexOf(node.alternate.name) == -1 ) {
            vars.push( node.alternate.name );
        }
    }

    if ( (node.alternate.type == "LogicalExpression") || (node.alternate.type == "BinaryExpression") ) {
        var logical_nest = binary_expressions( node.alternate, []);
        for (var y = 0; y < logical_nest.length; y++ ) {
            if ( vars.indexOf(logical_nest[y]) == -1 ) {
                vars.push(logical_nest[y]);
            }
        }
    }

    if ( node.alternate.type == "MemberExpression" ) {
        var curr_name = handle_nesting(node.alternate, "");
        if ( vars.indexOf(curr_name) == -1 ) {
            vars.push( curr_name );
        }
    }

    if ( node.alternate.type == "UnaryExpression" ) {
        var unary_nest = unary_expressions( node.alternate, []);
        for (var m = 0; m < unary_nest.length; m++ ) {
            if ( vars.indexOf(unary_nest[m]) == -1 ) {
                vars.push(unary_nest[m]);
            }
        }
    }

    if ( node.alternate.type == "UpdateExpression" ) {
        var update_nest = update_expressions( node.alternate, []);
        for (var r = 0; r < update_nest.length; r++ ) {
            if ( vars.indexOf(update_nest[r]) == -1 ) {
                vars.push(update_nest[r]);
            }
        }
    }

    if ( node.alternate.type == "ConditionalExpression" ) {
        var nested_cond = conditional_expressions(node.alternate, []);
        for (var tt = 0; tt < nested_cond.length; tt++ ) {
            if ( vars.indexOf(nested_cond[tt]) == -1 ) {
                vars.push(nested_cond[tt]);
            }
        }
    }
    return vars;
}

// takes a Binary Expression node and returns a complete list of all variables that are listed (vars is a list)
function binary_expressions(node,vars) {
    // verify that node is a BinaryExpression or LogicalExpression!
    if ( (node.type != "BinaryExpression") && (node.type != "LogicalExpression") ) {
        throw "binary_expressions() called on node that is not a binary nor a expression!";
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

    // left side is a unary expression
    if ( node.left.type == "UnaryExpression" ) {
        var unary_nest = unary_expressions( node.left, []);
        for (var m = 0; m < unary_nest.length; m++ ) {
            if ( vars.indexOf(unary_nest[m]) == -1 ) {
                vars.push(unary_nest[m]);
            }
        }
    }

    // left side is a conditional expression
    if ( node.left.type == "ConditionalExpression" ) {
        var cond_nest = conditional_expressions( node.left, []);
        for (var rr = 0; rr < cond_nest.length; rr++ ) {
            if ( vars.indexOf(cond_nest[rr]) == -1 ) {
                vars.push(cond_nest[rr]);
            }
        }
    }

    // left side is a update expression
    if ( node.left.type == "UpdateExpression" ) {
        var update_nest = update_expressions( node.left, []);
        for (var r = 0; r < update_nest.length; r++ ) {
            if ( vars.indexOf(update_nest[r]) == -1 ) {
                vars.push(update_nest[r]);
            }
        }
    }

    // right side is a update expression
    if ( node.right.type == "UpdateExpression" ) {
        var update_nest = update_expressions( node.right, []);
        for (var p = 0; p < update_nest.length; p++ ) {
            if ( vars.indexOf(update_nest[p]) == -1 ) {
                vars.push(update_nest[p]);
            }
        }
    }

    // right side is a unary expression
    if ( node.right.type == "UnaryExpression" ) {
        var unary_nest = unary_expressions( node.right, []);
        for (var z = 0; z < unary_nest.length; z++ ) {
            if ( vars.indexOf(unary_nest[z]) == -1 ) {
                vars.push(unary_nest[z]);
            }
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

    // right side is a conditional expression
    if ( node.right.type == "ConditionalExpression" ) {
        var cond_nest = conditional_expressions( node.right, []);
        for (var rt = 0; rt < cond_nest.length; rt++ ) {
            if ( vars.indexOf(cond_nest[rt]) == -1 ) {
                vars.push(cond_nest[rt]);
            }
        }
    }

    // must recurse because left or right side has nested BinaryExpression or LogicalExpression
    if ( (node.left.type == "BinaryExpression") || (node.left.type == "LogicalExpression") ) {
        var bin_nest = binary_expressions( node.left, []);
        for (var ty = 0; ty < bin_nest.length; ty++ ) {
            if ( vars.indexOf(bin_nest[ty]) == -1 ) {
                vars.push(bin_nest[ty]);
            }
        }
    }

    if ( (node.right.type == "BinaryExpression") || (node.right.type == "LogicalExpression") ) {
        var bin_nest = binary_expressions( node.right, []);
        for (var uy = 0; uy < bin_nest.length; uy++ ) {
            if ( vars.indexOf(bin_nest[uy]) == -1 ) {
                vars.push(bin_nest[uy]);
            }
        }
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

        if ( node.properties[x].value.type == "UnaryExpression" ) {
            var unary_nest = unary_expressions( node.properties[x].value, []);
            for (var q = 0; q < unary_nest.length; q++ ) {
                if ( vars.indexOf(unary_nest[q]) == -1 ) {
                    vars.push(unary_nest[q]);
                }
            }
        }

        if ( node.properties[x].value.type == "MemberExpression" ) {
            var curr_name = handle_nesting(node.properties[x].value, "");
            if ( vars.indexOf(curr_name) == -1 ) {
                vars.push( curr_name );
            }
        }

        if ( (node.properties[x].value.type == "BinaryExpression") || (node.properties[x].value.type == "LogicalExpression") ) {
            var binary_nest = binary_expressions( node.properties[x].value, []);
            for (var z = 0; z < binary_nest.length; z++ ) {
                if ( vars.indexOf(binary_nest[z]) == -1 ) {
                    vars.push(binary_nest[z]);
                }
            }
        }

        if ( node.properties[x].value.type == "ConditionalExpression" ) {
            var cond_nest = conditional_expressions( node.properties[x].value, []);
            for (var zz = 0; zz < cond_nest.length; zz++ ) {
                if ( vars.indexOf(cond_nest[zz]) == -1 ) {
                    vars.push(cond_nest[zz]);
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

// function to handle for statements (return list of dependencies from all three parts)
// TODO: once we have list of nested for loops above current line, we can process the current line and then process each for statement and add deps to that list
function handle_fors(node, vars) {
    // verify that node is a For Statement
    if ( node.type != "ForStatement" ) {
        throw "handle_fors() called on node that is not a for statement!!";
    }

    // handle the assignment (first part of the for statement)
    if ( node.init.type == "AssignmentExpression" ) {
        handle_assignment(node.init, vars);
    }

    // handle the test condition (the second part of the for statement)
    if ( (node.test.type == "BinaryExpression") || (node.test.type == "LogicalExpression") ) {
        binary_expressions(node.test, vars);
    }

    // handle the third part of the assignment (if it is a binary expression and not simply x++)
    if ( node.update.type == "AssignmentExpression" ) {
        handle_assignment(node.update, vars);
    }
    return vars;
}

function handle_whiles(node, vars) {
    // verify that node is a While Statement
    if ( node.type != "WhileStatement" ) {
        throw "handle_whiles() called on node that is not a while statement!!";
    }

    // handle the test condition
    if ( (node.test.type == "BinaryExpression") || (node.test.type == "LogicalExpression") ) {
        binary_expressions(node.test, vars);
    }

    return vars;
}

// function to handle if statements (this includes else ifs)
// TODO: perhaps we should also take a line number such that we only care if it is before the relevant line number?
function handle_ifs(node, vars) {
    // verify that node is a While Statement
    if ( node.type != "IfStatement" ) {
        throw "handle_ifs() called on node that is not a if statement!!";
    }

    // handle the test condition
    if ( (node.test.type == "BinaryExpression") || (node.test.type == "LogicalExpression") ) {
        binary_expressions(node.test, vars);
    }

    return vars;
}
