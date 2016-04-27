import os, sys, subprocess, json, ast, re

log_file = sys.argv[1]
recorded_folder = sys.argv[2]
specific_write = ''
specific_step = ''
if ( len(sys.argv) > 3 ):
    specific_write = sys.argv[3]
    specific_step = sys.argv[4]
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
        curr_line = ""
        with open("temp_file") as c:
            for line in c:
                if ( counter == int(line_no) ):
                    cmd_val = "nodejs validate.js '" + line + "'"
                    proc = subprocess.Popen([cmd_val], stdout=subprocess.PIPE, shell=True)
                    (out_val, err_val) = proc.communicate()
                    if ( out_val != "ERROR\n" ):
                        os.system("rm temp_file")
                        return line.strip("\n").strip()
                    curr_line += line.strip("\n").strip()
                if ( counter > int(line_no) ):
                    curr_line += line.strip("\n").strip()
                    cmd_val = "nodejs validate.js '" + curr_line + "'"
                    proc = subprocess.Popen([cmd_val], stdout=subprocess.PIPE, shell=True)
                    (out_val, err_val) = proc.communicate()
                    if ( out_val != "ERROR\n" ):
                        os.system("rm temp_file")
                        return curr_line.strip("\n").strip()
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

# strips 'makeProxy' wrapping from objects
def strip_object( source_line ):
    parts = source_line.split(" = ")
    obj = parts[1]
    if ( 'makeProxy(' == obj[0:10] ):
        obj = obj[10:]
    if ( obj[-1] == ";" ):
        obj = obj[:-1]
    if ( obj[-1] == ")" ):
        obj = obj[:-1]
        return obj
    else:
        return ""

# function that adds dependency to current variable if there have never been any explicit writes to that variable
# currently adds dependency from longest maching prefix that does have an explict write (or has been handled with this function before)
def add_last_update_dep(child, handled):
    # first verify that there are no explict writes or var hasn't yet been handled
    if ( child.variable in var_nodes ):
        return

    orig_parts = child.variable.split(".")

    # then find longest matching variable (TODO: currently doesn't consider aliases)
    longest_match = 0 # in terms of parts split by '.'
    best_var = ""
    for var in var_nodes:
        curr_count = 0
        parts = var.split(".")
        for x in range(0, min(len(parts), len(orig_parts))):
            if ( orig_parts[x] == parts[x] ):
                curr_count+=1
            else:
                break
        if ( curr_count > longest_match ):
            longest_match = curr_count
            best_var = var

    # then add dependency from last write in longest match to current child
    if ( best_var != "" ): # we had some match
        if ( not (longest_match == 1 or var_nodes[best_var][-1].variable.split(".")[longest_match-1] == 'window') ): # longest match can't be 'window'
            dependencies.append((var_nodes[best_var][-1], child))
            # add var to list of variables so we don't try handling it again
            var_nodes[child.variable] = [child]
            handled.append(child.variable)


# function to create flow diagram (in dot format)
def plot_flow_diagram():
    # store dot lines in a file
    dot_output = open("flow_diagram.dot", 'w')
    dot_output.write("digraph pipeline_diagram {\ngraph[splines=true];\n")

    # key is id and val is tuple (obj literal, step)
    last_obj_nodes = {}

    # add nodes for each id and variable (these will eventually become labels)
    id_pos = {}
    var_pos = {}
    id_x = 0
    var_x = 1000
    # Add column nodes for each id/variable
    for var in variables:
        dot_output.write("\"" + var + "\"[pos=\"" + str(var_x) + ",0\"];\n")
        if ( var not in var_pos ):
            var_pos[var] = var_x
        var_x = var_x + 300
    for obj_id in aliases:
        dot_output.write("\"" + str(obj_id) + "\"[pos=\"" + str(id_x) + ",0\"];\n")
        id_pos[obj_id] = id_x
        id_x = id_x + 300
    # iterate through dependencies and print dependency line for each tuple
    for dep_pair in dependencies:
        if ( dep_pair[0] != dep_pair[1] ):
            #label = ""
            alias = False
            if ( len(dep_pair) > 2 and 'new' not in dep_pair[2] and 'iddep' not in dep_pair[2]):
                alias = True
            parent = ""
            if ( len(dep_pair) > 2 and dep_pair[2] == 'iddep' ):
                # this is a dep from id1 to id2 (logged in makeProxy)
                child_label = "[pos=\"" + str(id_pos[dep_pair[0]]) + "," + str(dep_pair[3]*-100) +"\"]"
                parent_label = "[pos=\"" + str(id_pos[dep_pair[1]]) + "," + str(dep_pair[3]*-100) +"\"]"
                dot_output.write("\"" + str(id_to_obj[dep_pair[0]]) + "\"" + child_label + ";\n")
                dot_output.write("\"" + str(id_to_obj[dep_pair[1]]) + "\"" + parent_label + ";\n")
                dot_output.write("\"" + str(id_to_obj[dep_pair[1]]) + "\" -> \"" + str(id_to_obj[dep_pair[0]]) + "\";\n")
                # add id/steps to list of node_deps
                if ( (str(id_to_obj[dep_pair[1]]), str(dep_pair[3]*-100), int(dep_pair[1])) not in node_deps ):
                    node_deps[(str(id_to_obj[dep_pair[1]]), str(dep_pair[3]*-100), int(dep_pair[1]))] = []
                if ( (str(id_to_obj[dep_pair[0]]), str(dep_pair[3]*-100), int(dep_pair[0])) not in node_deps ):
                    node_deps[(str(id_to_obj[dep_pair[0]]), str(dep_pair[3]*-100), int(dep_pair[0]))] = [(str(id_to_obj[dep_pair[1]]), str(dep_pair[3]*-100), int(dep_pair[1]))]
                else:
                    if ( (str(id_to_obj[dep_pair[1]]), str(dep_pair[3]*-100), int(dep_pair[1])) not in node_deps[(str(id_to_obj[dep_pair[0]]), str(dep_pair[3]*-100), int(dep_pair[0]))] ):
                        node_deps[(str(id_to_obj[dep_pair[0]]), str(dep_pair[3]*-100), int(dep_pair[0]))].append((str(id_to_obj[dep_pair[1]]), str(dep_pair[3]*-100), int(dep_pair[1])))
                last_obj_nodes[dep_pair[0]] = (str(id_to_obj[dep_pair[0]]), -100)
                last_obj_nodes[dep_pair[1]] = (str(id_to_obj[dep_pair[1]]), -100)
            else:
                if ( not isinstance(dep_pair[0], str) ):
                    label_id = ""
                    if (  dep_pair[0].objid != "null" ):
                        label_id = "[pos=\"" + str(id_pos[dep_pair[0].objid]) + "," + str(dep_pair[0].step*-100) +"\"]"
                    label_var = "[pos=\"" + str(var_pos[dep_pair[0].variable]) + "," + str(dep_pair[0].step*-100) +"\"]"
                    parent = str(dep_pair[0].variable) + "," + str(dep_pair[0].line_number) + "\n" + str(strip_object(dep_pair[0].source_line))
                    id_node = str(strip_object(dep_pair[0].source_line))
                    if ( dep_pair[0].objid in last_obj_nodes ):
                        if ( (dep_pair[0].step*-100) < last_obj_nodes[dep_pair[0].objid][1] ):
                            last_obj_nodes[dep_pair[0].objid] = (str(strip_object(dep_pair[0].source_line)), (dep_pair[0].step*-100))
                        else:
                            if ( id_node != "" ):
                                id_node = last_obj_nodes[dep_pair[0].objid][0]
                    if ( id_node != "" ):
                        dot_output.write("\"" + id_node + "\"" + label_id + ";\n")
                        dot_output.write("\"" + id_node + "\" -> \"" + parent + "\";\n")
                        if ( (id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)) not in node_deps ):
                            node_deps[(id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid))] = []
                        if ( (parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)) not in node_deps ):
                            node_deps[(parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable))] = [(id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid))]
                        else:
                            if ( (id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)) not in node_deps[(parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable))] ):
                                node_deps[(parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable))].append((id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)))
                    dot_output.write("\"" + parent + "\"" + label_var +";\n")
                    if ( (parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)) not in node_deps ):
                        node_deps[(parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable))] = []
                label_id = ""
                child_id_node = ""
                if ( not isinstance(dep_pair[1], int) ):
                    if ( dep_pair[1].objid != "null" ):
                        if ( str(strip_object(dep_pair[1].source_line)) != "" ):
                            label_id =  "[pos=\"" + str(id_pos[dep_pair[1].objid]) + "," + str(dep_pair[1].step*-100) +"\"]"
                            child_id_node = str(strip_object(dep_pair[1].source_line))
                            if ( dep_pair[1].objid in last_obj_nodes ):
                                if ( (dep_pair[1].step*-100) < last_obj_nodes[dep_pair[1].objid][1] ):
                                    last_obj_nodes[dep_pair[1].objid] = (str(strip_object(dep_pair[1].source_line)), (dep_pair[1].step*-100))
                                else:
                                    if ( label_id != "" ):
                                        child_id_node = last_obj_nodes[dep_pair[1].objid][0]
                    label_var =  "[pos=\"" + str(var_pos[dep_pair[1].variable]) + "," + str(dep_pair[1].step*-100) +"\"]"
                    child = str(dep_pair[1].variable) + "," + str(dep_pair[1].line_number) + "\n" + str(strip_object(dep_pair[1].source_line))
                    if ( (child, str(dep_pair[1].step*-100), str(dep_pair[1].variable)) not in node_deps ):
                        node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))] = []
                    dot_output.write("\"" + child + "\"" + label_var + ";\n")
                    if ( label_id != "" ):
                        dot_output.write("\"" + child_id_node + "\"" + label_id + ";\n")
                        if ( (child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid)) not in node_deps ):
                            node_deps[(child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid))] = []
                        dot_output.write("\"" + child_id_node + "\" -> \"" +  child + "\";\n")
                        if ( (child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid)) not in node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))] ):
                            node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))].append((child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid)))
                    if ( parent != "" ):
                        if ( label_id != "" ):
                            if ( alias ):
                                dot_output.write("\"" + id_node + "\" -> \"" + child_id_node + "\";\n")
                                if ( (id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)) not in node_deps[(child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid))] ):
                                    node_deps[(child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid))].append((id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)))
                            else:
                                dot_output.write("\"" + parent + "\" -> \"" + child_id_node + "\";\n")
                                if ( (parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)) not in node_deps[(child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid))] ):
                                    node_deps[(child_id_node, str(dep_pair[1].step*-100), int(dep_pair[1].objid))].append((parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)))
                        else:
                            if ( alias ):
                                dot_output.write("\"" + id_node + "\" -> \"" + child + "\";\n")
                                if ( (id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)) not in node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))] ):
                                    node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))].append((id_node, str(dep_pair[0].step*-100), int(dep_pair[0].objid)))
                            else:
                                dot_output.write("\"" + parent + "\" -> \"" + child + "\";\n")
                                if ( (parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)) not in node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))] ):
                                    node_deps[(child, str(dep_pair[1].step*-100), str(dep_pair[1].variable))].append((parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)))
                else:
                    if ( not isinstance(dep_pair[0], str) ):
                        # make write for id
                        id_write_label = "[pos=\"" + str(id_pos[dep_pair[1]]) + "," + str(dep_pair[0].step*-100) +"\"]"
                        id_pos[dep_pair[1]] *= -100
                        id_node = dep_pair[2]
                        if ( dep_pair[1] in last_obj_nodes ):
                            if ( (dep_pair[0].step*-100) < last_obj_nodes[dep_pair[1]][1] ):
                                last_obj_nodes[dep_pair[1]] = (str(dep_pair[2]), (dep_pair[0].step*-100))
                            else:
                                id_node = last_obj_nodes[dep_pair[1]][0]
                        if ( id_node[0:3] == 'new' ):
                            id_node = id_node[3:]
                        dot_output.write("\"" + id_node + "\"" + id_write_label + ";\n")
                        if ( (id_node, str(dep_pair[0].step*-100), int(dep_pair[1])) not in node_deps ):
                            node_deps[(id_node, str(dep_pair[0].step*-100), int(dep_pair[1]))] = []
                        dot_output.write("\"" + parent + "\" -> \"" + id_node + "\";\n")
                        if ( (parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)) not in node_deps[(id_node, str(dep_pair[0].step*-100), int(dep_pair[1]))] ):
                            node_deps[(id_node, str(dep_pair[0].step*-100), int(dep_pair[1]))].append((parent, str(dep_pair[0].step*-100), str(dep_pair[0].variable)))

    for i in id_to_obj:
        if ( id_pos[i] == 0 ):
            lab = "[pos=\"" + str(id_pos[i]) + ",-100\"]"
            dot_output.write("\"" + str(id_to_obj[i]) + "\"" + lab + ";\n")
            if ( (str(id_to_obj[i]), str(-100)) not in node_deps ):
                node_deps[(str(id_to_obj[i]), str(-100), int(i))] = []

    # close dot file
    dot_output.write("}")
    dot_output.close()

    # make graph
    os.system("neato -Tpdf -n flow_diagram.dot -o flow_diagram.pdf")

# function takes in a node (for a write) and lists all parent nodes that influenced it
def list_parents(node, pars):
    start = node
    if ( len(node) == 2 ):
        column = ''
        for dep in node_deps:
            if ( dep[0] == node[0] and dep[1] == node[1] ):
                column = dep[2]
        if ( column == '' ):
            print "Node: " + str(node) + " not found in node_deps"
            return
        start = node + (column,)
        pars.append(start)
    for parent in node_deps[start]:
        if ( parent not in pars ):
            pars.append(parent)
            list_parents(parent, pars)

# function that takes subgraph list (list of parents for a given write) and creates corresponding graph
def make_subgraph(parents):
    # TODO: go through parents and make list of all vars and ids. then go through parents again and plot in similar way to previous plotting function (plot all nodes in list and also go through node_deps for each parent and if any parents for each node are also in parents list, then add edges)

    # sort list of parents in step order (since sorting variable names would be hard later)
    parents = sorted(parents, key=lambda tup: tup[1])

    variables = []
    ids = []
    for node in parents:
        if ( isinstance(node[2], str) ): # variable
            if ( node[2] not in variables ):
                variables.append(node[2])
        if ( isinstance(node[2], int) ): # id
            if ( node[2] not in ids ):
                ids.append(node[2])

    # sort ids to make graph easier to understand
    ids.sort()

    # store dot lines in a file
    dot_output = open("subgraph.dot", 'w')
    dot_output.write("digraph pipeline_diagram {\ngraph[splines=true];\n")

    # add nodes for each id and variable (these will eventually become labels)
    id_pos = {}
    var_pos = {}
    id_x = 0
    var_x = 1000
    # Add column nodes for each id/variable
    for var in variables:
        dot_output.write("\"" + var + "\"[pos=\"" + str(var_x) + ",0\"];\n")
        if ( var not in var_pos ):
            var_pos[var] = var_x
        var_x = var_x + 300
    for obj_id in ids:
        dot_output.write("\"" + str(obj_id) + "\"[pos=\"" + str(id_x) + ",0\"];\n")
        id_pos[obj_id] = id_x
        id_x = id_x + 300

    # go through parents, and create node in graph for each one
    for node in parents:
        if ( isinstance(node[2], str) ): # variable
            label_var =  "[pos=\"" + str(var_pos[node[2]]) + "," + str(node[1]) +"\"]"
            dot_output.write("\"" + node[0] + "\"" + label_var + ";\n")

    for node in parents:
        if ( isinstance(node[2], int) ): # id
            label_id =  "[pos=\"" + str(id_pos[node[2]]) + "," + str(node[1]) +"\"]"
            dot_output.write("\"" + node[0] + "\"" + label_id + ";\n")

    # close dot file
    dot_output.write("}")
    dot_output.close()

    # make graph
    os.system("neato -Tpdf -n subgraph.dot -o subgraph.pdf")

# maintain a list of 'nodes' per variable (keys are variables and values are lists of nodes (in step order))
var_nodes = {}

# maintain a list of dependencies (each entry is a tuple...order doesn't really matter)
dependencies = []

# maintain a list of alias mappings (keys are object ids, and values are lists of variable names that are currently aliases for same underlying object)
#TODO: need to remove alias mapping if no longer an alias!
aliases = {}

# list of variable names (lhs and rhs) that will eventually be columns in the graph (need node for each of these)
variables = []

# list of id to object mappings with OBJ lines (will use this to add writes for nested objects that don't have other writes)
id_to_obj = {}

# dictionary where keys are (var/id, step) and vals are list of parents (in tuple format)
node_deps = {}

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
step = 1
with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        if ( curr_line.get('OpType') == "OBJ" ):
            curr_id = curr_line.get('NewValId')
            if ( curr_id not in aliases ):
                aliases[curr_id] = []
            if ( curr_id not in id_to_obj ):
                id_to_obj[curr_id] = json.loads(curr_line.get('Value').strip("\n").replace("\'",'"'))
        if ( curr_line.get('OpType') == "IDDEP" ):
            curr_child = curr_line.get('ChildId')
            curr_parent = curr_line.get('ParentId')
            dependencies.append((curr_child, curr_parent, 'iddep', step))
        if ( curr_line.get('OpType') == 'WRITE' ):
            curr_var = curr_line.get('PropName')
            curr_script = curr_line.get('script')
            curr_line_num = curr_line.get('OrigLine')
            curr_newvalid = curr_line.get('NewValId')
            curr_parentid = curr_line.get('ParentId')
            curr_val = 'newupdate'
            if ( 'Value' in curr_line ):
                curr_val = 'new' + str(json.loads(curr_line.get('Value').strip("\n").replace("\'",'"')))
            curr_source_line = get_source_line(curr_script, curr_line_num)
            # if the script exists, get the static dependencies
            if ( get_source_file(curr_script) ):
                cmd = "nodejs line_type.js file temp_file " + curr_line_num
                proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
                (out, err) = proc.communicate()
                esprima_deps = json.loads(out.strip("\n").replace("\'", '"'))
                # handle each left-side variable in dependency list for the line
                for left_var in esprima_deps:
                    handled = [] # list of vars that we have added writes for with longest match..avoids added writes for them in this iteration
                    # add parent variable to list of vars if not already there
                    if ( left_var not in variables ):
                        variables.append(left_var)
                    # create node for current write and add node to appropriate variable list
                    curr_node = Node( left_var, curr_line_num, curr_source_line, step, curr_newvalid)
                    add_last_update_dep(curr_node, handled)
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
                                if ( dep_var in var_nodes ):
                                    dependencies.append((var_nodes[dep_var][-1], curr_node))
                                    # add dependency for right hand side variable (from last relevant write)
                                    add_last_update_dep(curr_node, handled)
                                else:
                                    new_child = Node( dep_var, curr_line_num, curr_source_line, step, curr_newvalid)
                                    dependencies.append((new_child, curr_node))
                                    add_last_update_dep(new_child, handled)
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
                        if ( curr_parentid != "window" and curr_parentid != "null" ):
                            dependencies.append((curr_node, curr_parentid, curr_val))
                        else:
                            dependencies.append(("", curr_node))
                    else:
                        var_nodes[left_var] = [curr_node]
                        if ( curr_parentid != "window" and curr_parentid != "null" ):
                            dependencies.append((curr_node, curr_parentid, curr_val))
                        else:
                            dependencies.append(("", curr_node))
                    for curr_dep in curr_esprima_deps:
                        # add dependencies from last 'write' to each variable to current node
                        if ( curr_dep in var_nodes and curr_dep not in handled ):
                            parent_node = var_nodes[curr_dep][-1]
                            dependencies.append((parent_node, curr_node))
                            # add dependencies for aliases as well
                            for alias in curr_alias_list:
                                alias_child_node = var_nodes[alias][-1]
                                dependencies.append((parent_node, alias_child_node, "alias update"))
                    step += 1
                os.system("rm temp_file")
plot_flow_diagram()
#for key in node_deps:
#    print str(key) + " --> " + str(node_deps[key])
pars = []
if ( specific_write != '' ):
    # Note: currently appends newline to the write (since all nodes have a newline at the end right now)
    node = (specific_write + '\n', specific_step)
    list_parents(node, pars)
    print "parents for '" + specific_write + "' are: " + str(pars)
    make_subgraph(pars)
