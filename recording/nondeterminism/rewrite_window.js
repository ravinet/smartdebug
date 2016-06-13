// requires node packages listed below
// example: 'npm install esprima'
//
esprima = require('esprima');
estraverse = require('estraverse');
escodegen = require('escodegen');
util = require('util');

fs = require('fs');

var code = fs.readFileSync(process.argv[2]);
var ast = esprima.parse(code, {loc: true});
//console.log(escodegen.generate(ast));

var assignmentChain = [];
var vars = {};
var currentChain = "Program";
vars[currentChain] = [];
var anonFuncCounter = 0;

estraverse.traverse(ast, {
  enter: preenter,
  leave: preleave
});

currentChain = "Program";
var anonFuncCounter = 0;

estraverse.traverse(ast, {
  enter: enter,
  leave: leave
});

var hoistIndex = 0;

estraverse.traverse(ast, {
  enter: hoistEnter,
  leave: hoistLeave
});

//console.log(util.inspect(ast, {depth:null}));
var proxy_wrapper = {"type":"Program","body":[{"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"FunctionExpression","id":null,"params":[],"defaults":[],"body":{"type":"BlockStatement","body":[]},"rest":null,"generator":false,"expression":false},"arguments":[]}}]};

// take body from the initial source code and put into our new anonymous function
var body = ast.body;
var window_proxy = {"type": "VariableDeclaration","declarations": [{"type": "VariableDeclarator","id": {"type": "Identifier","name": "window"},"init": {"type": "NewExpression","callee": {"type": "Identifier","name": "Proxy"},"arguments": [{"type": "Identifier","name": "_window"},{"type": "Identifier","name": "window_handler"}]}}],"kind": "var"};
body.splice(0, 0, window_proxy);
proxy_wrapper.body[0].expression.callee.body.body = body;

ast = proxy_wrapper;
output = escodegen.generate(ast).replace(/<\/script>/g, "<\\/script>");
//console.log(output);
outname = process.argv[3] ? process.argv[3] : "out";
fs.writeFileSync(outname, output);

function createsNewScope(node){
  return node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'Program' ||
    node.type === 'CatchClause';
}

function preenter(node){
  if (createsNewScope(node)) {
    if (node.type !== "Program") {
      if (node.type === "CatchClause") {
        currentChain += ",catch";
        vars[currentChain] = [];
      } else if (node.id !== null && node.id.name !== null) {
        if (isObj(node.id)) {
          currentChain += "," + node.id.name;
          vars[currentChain] = [];
          //add function name
          vars[previousChain(currentChain)].push(node.id.name);
          vars[currentChain].push(node.id.name);
        }
      } else {
        currentChain += "," + "anon" + anonFuncCounter++;
        vars[currentChain] = [];
      }

      //add function args
      if (node.params !== null) {
        for (var i in node.params) {
          if (isObj(node.params[i])) {
            vars[currentChain].push(node.params[i].name);
          }
        }
      }
    }
  }
  
  if (node.type === "CatchClause") {
    vars[currentChain].push(node.param.name);
  }


  if (node.type === 'VariableDeclarator'){
    vars[currentChain].push(node.id.name);
  }
 
  if (node.type === "AssignmentExpression"){
    // if declared in global scope it's a global var
    if (isObj(node.left)) {
      if (currentChain == "Program") {
        vars[currentChain].push(memberExpToIdentifier(node.left).name);
      }
    }
  }
}

function preleave(node) {
  if (createsNewScope(node)){
    currentChain = previousChain(currentChain);
  }
}

function previousChain(chain) {
  if (chain == "Program") {
    return undefined;
  }
  chain = chain.split(",");
  chain.pop();
  return chain.join();
}

function enter(node, p){
  if (createsNewScope(node)) {
    if (node.type !== "Program") {
      if (node.type === "CatchClause") {
        currentChain += ",catch";
      } else if (node.id !== null && node.id.name !== null) {
        if (isObj(node.id)) {
          currentChain += "," + node.id.name;
        }
      } else {
        if (node.proxied == null) { 
          currentChain += "," + "anon" + anonFuncCounter++;
        }
      }
    }
    assignmentChain.push([]);
  }

  var currentAssignment = assignmentChain[assignmentChain.length - 1];

  //rewrite var in global to just be assignments
  if(currentChain == "Program" && node.type === 'VariableDeclaration') {
    var expressions = [];
    var leaveAsVars = [];
    for (var i = 0; i < node.declarations.length; i++) {
      var assignment = {"type":"AssignmentExpression", "operator": "="};
      assignment.left = node.declarations[i].id;
      assignment.right = node.declarations[i].init;
      if (assignment.right != null) {
        expressions.push(assignment);
      } else {
        leaveAsVars.push(node.declarations[i]);
      }
    }
    if (expressions.length != 0) {
      delete node.declarations;
      if (expressions.length > 1 || p.type != "ForStatement") {
        node.type = "ExpressionStatement";
        node.expression = {"type":"SequenceExpression","expressions":expressions};
      } else {
        node.type = "AssignmentExpression";
        node.operator = "=";
        node.left = expressions[0].left;
        node.right = expressions[0].right;
      } 
      if (leaveAsVars.length > 0) {
        varDeclaration = {"type":"VariableDeclaration", "declarations":leaveAsVars, "kind":"var"};
        if (p.body) {
          p.body.unshift(varDeclaration);
        }
        if (p.consequent) {
          p.consequent.type = "BlockStatement";
          p.consequent.body = [varDeclaration];
        }
      }
    }
  }

  if (node.type === 'AssignmentExpression' || node.type === "BinaryExpression") {
    if (isObj(node.left)) {
      currentAssignment.push(node.left);
    }
    if (isObj(node.right)){
      currentAssignment.push(node.right);
    }
  }

  if (node.type === "UnaryExpression") {
    if (isObj(node.argument)) {
      currentAssignment.push(node.argument);
    }
  }

  if (node.type === "ConditionalExpression") {
    if (isObj(node.test)) {
      currentAssignment.push(node.test);
    }
    if (isObj(node.consequent)) {
      currentAssignment.push(node.consequent);
    }
    if (isObj(node.alternate)) {
      currentAssignment.push(node.alternate);
    }
  }

  if (node.type === "LogicalExpression") {
    if (isObj(node.left)) {
      currentAssignment.push(node.left);
    }
    if (isObj(node.right)) {
      currentAssignment.push(node.right);
    }
  }

  if (node.type === "ArrayExpression") {
    for (var i = 0; i < node.elements.length; i++) {
      if (isObj(node.elements[i])) {
        currentAssignment.push(node.elements[i]);
      }
    }
  }

  if (node.type === "CallExpression") {
    for (var i = 0; i < node.arguments.length; i++){
      if (isObj(node.arguments[i])) {
        currentAssignment.push(node.arguments[i]);
      }
    }
    if (isObj(node.callee)) {
      currentAssignment.push(node.callee);
    }
  }

  if (node.type === "VariableDeclarator") {
    if (isObj(node.init)) {
      currentAssignment.push(node.init);
    }
  }
  // the "proxied" hack is to avoid recursion
  if (node.type === 'NewExpression' && node.proxied == null) {
    newexpression = {"type": node.type, "callee": node.callee, "arguments":node.arguments, "proxied":true};
    node.type = "CallExpression";
    node.callee = {"type": "Identifier", "name": "makeProxy" };
    node.arguments = [newexpression];
  }

  // the "proxied" hack is to avoid recursion
  if (node.type === 'ObjectExpression' && node.proxied == null) {
   for (var i = 0; i < node.properties.length; i++){
      if (isObj(node.properties[i].value)) {
        currentAssignment.push(node.properties[i].value);
      }
    }
    objexpression = {"type": node.type, "properties": node.properties, "proxied":true};
    node.type = "CallExpression";
    node.callee = {"type": "Identifier", "name": "makeProxy" };
    node.arguments = [objexpression];
  }
}

function isObj(node) {
  if (node == null) {
    return false;
  }
  while (node.type === "MemberExpression") {
    node = node.object; 
  }
  if (node.type === "Identifier" && node.name !== "console" && node.name !== "window" && node.name !== "arguments") {
    return true;
  }
}

function leave(node){
  if (createsNewScope(node)){
    var currentAssignment = assignmentChain.pop();
    checkForGlobals(currentAssignment, currentChain);
    printScope(node, currentChain);
    currentChain = previousChain(currentChain);
  }
}

function hoistEnter(node, p) {

  if (node.type == "FunctionDeclaration") {
    newLine = {
            "type": "ExpressionStatement",
            "expression": {
                "type": "AssignmentExpression",
                "operator": "=",
                "left": {
                    "type": "MemberExpression",
                    "computed": false,
                    "object": {
                        "type": "Identifier",
                        "name": "window"
                    },
                    "property": {
                        "type": "Identifier",
                        "name": node.id.name
                    }
                },
                "right": {
                    "type": "Identifier",
                    "name": node.id.name
                }
            }
        };
    if (p.type == "BlockStatement") {
      p.body.splice(p.body.indexOf(node)+1, 0, newLine);
    } else if (p.type == "IfStatement") {
      if (node == p.consequent) 
        p.consequent = {"type":"BlockStatement", "body": [node, newLine]}; 
      else if (node == p.alternate) 
        p.alternate = {"type":"BlockStatement", "body": [node, newLine]}; 
    } else {
      p.body.splice(hoistIndex++, 0, newLine);
    }
  }
  //skip everything that makes new scope aside from program
  if (node.type != "Program" && createsNewScope(node)) {
    this.skip();
  }
}

function hoistLeave(node) {
}

function printScope(node, currentChain){
  var varsDisplay = vars[currentChain].join(', ');
  if (node.type === 'Program'){
    //console.log('Variables declared in the global scope:', varsDisplay);
  } else{
    if (node.id && node.id.name){
      //console.log('Variables declared in the function ' + node.id.name + '():', varsDisplay);
    } else{
      //console.log('Variables declared in anonymous function:', varsDisplay);
    }
  }
}

function checkForGlobals(assignments, currentChain){
  for (var i = 0; i < assignments.length; i++){
    var assignment = assignments[i];
    var varname = memberExpToIdentifier(assignment).name;
    if (currentChain == "Program" || !isVarDefined(varname, currentChain)){
      rewriteAssignment(assignment);
    }
  }
}

function rewriteAssignment(assignment) {
  var node = memberExpToIdentifier(assignment);
  node.name = "window." + node.name;
}

function memberExpToIdentifier(node) {
  while(node.type !== "Identifier") {
    node = node.object;
  }
  return node;  
}

function isVarDefined(varname, currentChain){
  // skip vars defined in global scope
  while(previousChain(currentChain)) {
    if (vars[currentChain].indexOf(varname) !== -1){
      return true;
    }
    currentChain = previousChain(currentChain);
  }
  return false;
}

