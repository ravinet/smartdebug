import os, sys, subprocess, json, ast, re

log_file = sys.argv[1]
recorded_folder = sys.argv[2]
files = os.listdir(recorded_folder)

# allow user to input a variable to track
imp_var = ""
if ( len(sys.argv) > 3 ):
    imp_var = sys.argv[3]

# takes an object name and finds the relevant file in the recorded folder
# if it exists, it returns True (plaintext is in curr_dir/'temp_file'), else False
def get_source_file(filename):
    for recorded_file in files:
        cmd_find = "protototext " + recorded_folder + "/" + recorded_file + " temp_file"
        proc_find = subprocess.Popen([cmd_find], stdout=subprocess.PIPE, shell=True)
        (out_find, err_find) = proc_find.communicate()
        if filename in out_find.split("na--me=")[1].strip("\n"):
           # decompress if necessary
            if ( out_find.split("gzipped=")[1].split("*")[0] == "true" ):
                os.system("gzip -d -c temp_file > temp_file2")
                os.system("mv temp_file2 temp_file")
            return True
        else:
            os.system("rm temp_file")
    return False

# given an object name and line number (from log), return relevant source code line
def get_source_line(filename, line_no):
    # first find the relevant file
    if ( get_source_file(filename) ):
        # file exists---in 'temp_file'
        counter = 1
        with open("temp_file") as c:
            for line in c:
                if ( counter == int(line_no) ):
                    os.system("rm temp_file")
                    return line.strip("\n").strip()
                counter = counter + 1
        os.system("rm temp_file")
    else:
        raise ValueError("Object (" + filename + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")

# class for each node in the flow diagram
class Node(object):
    def __init__(self, variable, line_number, source_line, step, obj_id):
        self.variable = variable
        self.line_number = line_number
        self.source_line = source_line
        self.step = step
        self.objid = obj_id

# function to create flow diagram (in dot format)
def plot_flow_diagram():
    # store dot lines in a file
    dot_output = open("flow_diagram.dot", 'w')
    dot_output.write("strict digraph G {\nratio=compress;\nconcentrate=true;\nrankdir=LR;\n")

    # iterate through dependencies and print dependency line for each tuple
    for dep_pair in dependencies:
        label = ""
        if ( len(dep_pair) == 3 ):
            label = dep_pair[2]
        parent = ""
        if ( not isinstance(dep_pair[0], str) ):
            parent = str(dep_pair[0].variable) + "," + str(dep_pair[0].line_number) + "\n" + str(dep_pair[0].source_line) + "\nID: " + str(dep_pair[0].objid)
        child = str(dep_pair[1].variable) + "," + str(dep_pair[1].line_number) + "\n" + str(dep_pair[1].source_line) + "\nID: " + str(dep_pair[1].objid)
        if ( parent != "" ):
            dot_output.write("\"" + parent + "\" -> \"" + child + "\"[label=\"" + label + "\"];\n")
        else:
            dot_output.write("\"" + child + "\";\n")

    # close dot file
    dot_output.write("}")
    dot_output.close()

    # make graph
    os.system("dot -Tpdf flow_diagram.dot -o flow_diagram.pdf")

# maintain a list of 'nodes' per variable (keys are variables and values are lists of nodes (in step order))
var_nodes = {}

# maintain a list of dependencies (each entry is a tuple...order doesn't really matter)
dependencies = []

# maintain a list of alias mappings (keys are object ids, and values are lists of variable names that are currently aliases for same underlying object)
#TODO: need to remove alias mapping if no longer an alias!
aliases = {}

# list of variable names (lhs and rhs) that will eventually be columns in the graph (need node for each of these)
variables = []

# strips 'makeProxy' wrapping from objects
def strip_object( source_line ):
    parts = source_line.split(" = ")
    obj = parts[1]
    if ( 'makeProxy(' == obj[0:10] ):
        obj = obj[10:]
    return obj

# takes in a source line that should be an object declaration, and outputs the new dictionary with keys as full variable names (top level var + key) and vals
def process_object( source_line ):
    parts = source_line.split(" = ")
    top_level = parts[0]
    obj = parts[1]
    if ( 'makeProxy(' == obj[0:10] ):
        obj = obj[10:]
    if ( obj[-1] == ";" ):
        obj = obj[:-1]
    if ( obj[-1] == ")" ):
        obj = obj[:-1]
    if ( '{' in obj ): # cheap way of seeing if it is an object declaration or simply an object due to aliasing
        colons = [m.start() for m in re.finditer(':', obj)]
        new_obj = ""
        prev_c = 0
        for c in colons:
            if ( obj[c+2] != "'" ):
                new_obj = new_obj + obj[prev_c:c+2] + "'"
            else:
                new_obj = new_obj + obj[prev_c:c+2]
            prev_c = c+2
        new_obj = new_obj + obj[colons[-1]+2:]
        commas = [m.start() for m in re.finditer(',', new_obj)]
        prev_c = 0
        comm_obj = ""
        for c in commas:
            if ( new_obj[c-1] == "'" ):
                comm_obj = comm_obj + new_obj[prev_c:c+1]
            else:
                comm_obj = comm_obj + "\"" + new_obj[prev_c:c] + "'" + new_obj[c]
            prev_c = c+2
        if ( len(commas) !=  0 ):
            comm_obj = comm_obj + new_obj[commas[-1]+1:]
        else:
            comm_obj = new_obj
        closes = [m.start() for m in re.finditer('}', comm_obj)]
        prev_c = 0
        final_obj = "\""
        if ( comm_obj[0] == "\"" ):
            final_obj = ""
        for c in closes:
            if ( comm_obj[c-2] == "'" ):
                final_obj = final_obj + comm_obj[prev_c:c+1]
            else:
                final_obj = final_obj + comm_obj[prev_c:c-1] + "'" + comm_obj[c]
            prev_c = c+2
        final_obj = final_obj + "\"" + comm_obj[closes[-1]+1:]
        ret_obj = ast.literal_eval(json.loads(final_obj))
        # iterate through object and create dictionary with keys as full var names and vals
        ret = {}
        for k in ret_obj:
            ret[top_level + "." + k] = ret_obj[k]
        return ret
    else:
        # not an object assignment so rerturn empty dict
        return {}

# iterate through log and process each write. maintain a step counter (each write is a step)
step = 0
with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        if ( curr_line.get('OpType') == 'WRITE' ):
            curr_var = curr_line.get('PropName')
            curr_script = curr_line.get('script')
            curr_line_num = curr_line.get('OrigLine')
            curr_newvalid = curr_line.get('NewValId')
            curr_source_line = get_source_line(curr_script, curr_line_num)
            # if the script exists, get the static dependencies
            if ( get_source_file(curr_script) ):
                cmd = "nodejs line_type.js file temp_file " + curr_line_num
                proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
                (out, err) = proc.communicate()
                esprima_deps = json.loads(out.strip("\n").replace("\'", '"'))
                # handle each left-side variable in dependency list for the line
                for left_var in esprima_deps:
                    # add parent variable to list of vars if not already there
                    if ( left_var not in variables ):
                        variables.append(left_var)
                    # create node for current write and add node to appropriate variable list
                    curr_node = Node( left_var, curr_line_num, curr_source_line, step, curr_newvalid)
                    curr_esprima_deps = esprima_deps[left_var]
                    key_deps = {}
                    if ( len(esprima_deps[left_var]) > 0 ):
                        if ( isinstance(esprima_deps[left_var][0], list) ):
                            curr_esprima_deps = []
                            for arr in esprima_deps[left_var]:
                                new_key = arr[1]
                                new_dep = arr[0]
                                new_key = left_var + "." + new_key
                                curr_esprima_deps.append(new_dep)
                                if ( new_key not in key_deps ):
                                    key_deps[new_key] = [new_dep]
                                else:
                                    key_deps[new_key].append(new_dep)
                        else:
                            for dep_var in esprima_deps[left_var]:
                                if ( dep_var not in variables ):
                                    variables.append(dep_var)
                    # if it is an object assignment (object id present), add node for each property (only if it is literal declaration)
                    #if ( (curr_newvalid != "null") and (curr_newvalid not in aliases) ):
                    #    obj_parts = process_object(curr_source_line)
                    #    for key in obj_parts:
                    #        # create node for each key
                    #        part_node = Node( key, curr_line_num, obj_parts[key], step, curr_newvalid)
                    #        if ( key in var_nodes ):
                    #            var_nodes[key].append(part_node)
                    #        else:
                    #            var_nodes[key] = [part_node]
                    #        # add edge from original write to each sub-write
                    #        dependencies.append((curr_node, part_node))
                    #        # add appropriate edges from other existing vars
                    #        if ( part_node.variable in key_deps ):
                    #            for d in key_deps[part_node.variable]:
                    #                if ( d in var_nodes ):
                    #                    dependencies.append((var_nodes[d][-1], part_node))
                    # get list of alias nodes (based on NewValId), and add current var to alias list
                    curr_alias_list = []
                    if ( curr_newvalid != "null" ):
                        if ( curr_newvalid in aliases ):
                            curr_alias_list = aliases[curr_newvalid]
                            # add dep from each alias node to curr node (alias creation edges)
                            for u in curr_alias_list:
                                alias_parent = var_nodes[u][-1]
                                dependencies.append((alias_parent, curr_node, "alias created"))
                            aliases[curr_newvalid].append(left_var)
                        else:
                            aliases[curr_newvalid] = [left_var]
                    if ( left_var in var_nodes ):
                        var_nodes[left_var].append(curr_node)
                        dependencies.append(("", curr_node))
                    else:
                        var_nodes[left_var] = [curr_node]
                        dependencies.append(("", curr_node))
                    for curr_dep in curr_esprima_deps:
                        # add dependencies from last 'write' to each variable to current node
                        if ( curr_dep in var_nodes ):
                            parent_node = var_nodes[curr_dep][-1]
                            dependencies.append((parent_node, curr_node))
                            # add dependencies for aliases as well
                            for alias in curr_alias_list:
                                alias_child_node = var_nodes[alias][-1]
                                dependencies.append((parent_node, alias_child_node, "alias update"))
                os.system("rm temp_file")
        step += 1

plot_flow_diagram()

#TODO:
#each time an object is created, we want to iterate throrugh it and crerate a node for each key that was written (e.g., x.test)..the source code should be the value forr that key.
#we want to have dotted lines when aliases are created and then each time something is updated, we want to add edges to/frrom all aliases.


#we want to treat variables individually (x and x.blah)
#
#what if we just store a list of dependencies which are tuples of node objects (parent, child)?
#store alias dictionary- mapping node to node (anytime we add a dep, check if we need to add for alias as well for both parent or child)
#
#can we just detect aliases using the object ids?..basically anytime we find a new id, add a mapping of id to node and then all nodes for that id are aliases
#still want to maintain a list of nodes per variable so we know what the last one is! but, we dont need to add dependencies in that list..only if there is a dep!
#


'''
go through the log and for each write, we want to:
1) get the source code line (currently from the rewritten version)...we may only care about the right side
2) get the dependencies from esprima
3) object properties that are written should be their own variables (we don't need to link back to the top-level obj, except we do want to keep track of when an object becomes invalid because top-level has been overwritten.
4) for aliases, we want to to keep track of which nodes are aliases of one another---when one is updated, check the list and update the other. also, when the alias is created, add an edge for that (perhaps dotted).

* perhaps we should have a class for nodes (this can store source code, line number and variable name, and step number
* we want to keep track of time steps (each write essentially represents a step so we need a counter 
'''
