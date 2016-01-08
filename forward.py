import os, sys, subprocess, json, random

log_file = sys.argv[1]
recorded_folder = sys.argv[2]
files = os.listdir(recorded_folder)
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
                if ( counter == line_no ):
                    os.system("rm temp_file")
                    return line.strip("\n").strip()
                counter = counter + 1
        os.system("rm temp_file")
        raise ValueError("File (" + recorded_file + "," + filename + ") is shorter than log's line number (" + line_no + ")")
    else:
        raise ValueError("Object (" + filename + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")

# function that considers individual variable dependencies (var_deps) and cross-variable deps (cross_deps) and outputs dot file
def make_dot():
    dot_output = open("flow_diagram.dot", 'w')

    # first print standard DOT file lines
    dot_output.write("strict digraph G {\nratio=compress;\nconcentrate=true;\n")

    # first go through per-variable dependencies and add edges (one write to next)
    for k in var_deps:
        if ( 'maybelocal_' not in k ):
            curr_ending = ""
            if ( k == imp_var ):
                curr_ending = "[color=red]"
            write_list = var_deps[k]
            for x in range(0, len(write_list)):
                if ( x != 0 ): # currently just print the variable,obj_id,file,line_num
                    parent_id = "null"
                    child_id = "null"
                    if ( 'real_id' in write_list[x-1] ):
                        parent_id = write_list[x-1]['real_id']
                    if ( 'real_id' in write_list[x] ):
                        child_id = write_list[x]['real_id']
                    curr_parent = k + ",id=" + str(parent_id) + "," + write_list[x-1].get('script') + "," + write_list[x-1].get('OrigLine')
                    curr_child = k + ",id=" + str(child_id) + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                    curr_label = ""
                    prop_change = ""
                    if ( 'property' in write_list[x] ): # this write is for an id property, so add a label
                        curr_label = "[label=\"'" + write_list[x]['property'] + "'\"]"
                        prop_change = write_list[x]['property']
                    dot_output.write("\"" + curr_parent + "\" -> \"" + curr_child + "\"" + curr_ending + curr_label + ";\n")
                    # add node for each new object literal created and add edge to curr_parent with label "set"
                    if ( write_list[x].get('NewValId') != "null" ):
                        if ( first_id_name[write_list[x].get('NewValId')] == k ):
                            object_node = write_list[x].get('Value')
                            label = "[label=\" set\"]"
                            print "adding for: " + str(object_node)
                            dot_output.write("\"" + str(object_node) + "\" -> \"" + curr_parent + "\"" + label + ";\n")
                    if ( isinstance(write_list[x].get('Value'), dict) ):
                        if ( k in alias_map ):
                            # iterate through alias map using all properties (split by '.') and add edge from the highest level alias
                            props = prop_change.split(".")
                            current_var = k
                            current_prop = props[0]
                            prop_counter = 0
                            alias_info = ""
                            while ( current_prop in alias_map[current_var] ):
                                alias_info = alias_map[current_var][current_prop]
                                current_var = alias_info[0]
                                prop_counter = prop_counter + 1
                                if ( prop_counter >= len(props) ):
                                    break
                                current_prop = props[prop_counter]
                                if ( current_var not in alias_map ):
                                    break
                            # create appropriate parent node for alias
                            if ( alias_info != "" ):
                                alias_id = var_deps[alias_info[0]][alias_info[1]].get('real_id')
                                alias_parent = alias_info[0] + ",id=" + str(alias_id) + "," + var_deps[alias_info[0]][alias_info[1]].get('script') + "," + var_deps[alias_info[0]][alias_info[1]].get('OrigLine')
                                dot_output.write("\"" + alias_parent + "\" -> \"" + curr_child + "\"[style=dotted];\n")
                else:
                    if ( len(write_list) == 1 ):
                        single_id = "null"
                        if ( 'real_id' in write_list[x] ):
                            single_id = write_list[x]['real_id']
                        curr_node = k + ",id=" + str(single_id) + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                        dot_output.write("\"" + curr_node + "\"" + curr_ending + ";\n")
                        if ( write_list[x].get('NewValId') != "null" ):
                            if ( first_id_name[write_list[x].get('NewValId')] == k ):
                                object_node = write_list[x].get('Value')
                                label = "[label=\" set\"]"
                                dot_output.write("\"" + str(object_node) + "\" -> \"" + curr_node + "\"" + label + ";\n")

    # add edges for cross-var dependencies
    for c in cross_deps:
        curr_ending = ""
        if ( c == imp_var ):
            curr_ending = "[color=red]"
        for ind in cross_deps[c]:
            parent_id = "null"
            child_id = "null"
            if ( 'real_id' in var_deps[c][ind] ):
                child_id = var_deps[c][ind]['real_id']
            curr_child = c + ",id=" + str(child_id) + "," + var_deps[c][ind].get('script') + "," + var_deps[c][ind].get('OrigLine')
            for pind in cross_deps[c][ind]:
                curr_name = pind[0]
                if ( 'real_id' in var_deps[pind[0]][pind[1]] ):
                    parent_id = var_deps[pind[0]][pind[1]]['real_id']
                if ( 'maybelocal_' in pind[0] ):
                    curr_name = pind[0].split("_")[2]
                curr_parent = curr_name + ",id=" + str(parent_id) + "," + var_deps[pind[0]][pind[1]].get('script') + "," + var_deps[pind[0]][pind[1]].get('OrigLine')
                if ( 'type' in var_deps[pind[0]][pind[1]] ):
                    curr_parent = "Local Variable: " + curr_parent
                curr_label = ""
                prop_change = ""
                if ( 'property' in var_deps[pind[0]][pind[1]] ): # this write is for an id property, so add a label
                    curr_label = "[label=\" '" + var_deps[pind[0]][pind[1]]['property'] + "'\"]"
                    prop_change = var_deps[pind[0]][pind[1]]['property']
                new_curr_label = ""
                if ( len(pind) > 2 ):
                    new_curr_label = "[label=\" '"
                    for i in range(2, len(pind) ):
                        new_curr_label = new_curr_label + pind[i]
                        if ( i != len(pind)-1 ):
                            new_curr_label = new_curr_label + "\n"
                        if ( 'property: ' in pind[i] ):
                            prop_change = pind[i][10:]
                    new_curr_label = new_curr_label + "'\"]"
                dot_output.write("\"" + curr_parent + "\" -> \"" + curr_child + "\"" + curr_ending + curr_label + new_curr_label +  ";\n")
                # add dotted edge from original object variable if applicable
                # only add alias edges if current line is an object
                if ( isinstance(var_deps[c][ind].get('Value'), dict) ):
                    if ( curr_name in alias_map ):
                        # iterate through alias map using all properties (split by '.') and add edge from the highest level alias
                        props = prop_change.split(".")
                        current_var = curr_name
                        current_prop = props[0]
                        prop_counter = 0
                        alias_info = ""
                        while ( current_prop in alias_map[current_var] ):
                            alias_info = alias_map[current_var][current_prop]
                            current_var = alias_info[0]
                            prop_counter = prop_counter + 1
                            if ( prop_counter >= len(props) ):
                                break
                            current_prop = props[prop_counter]
                            if ( current_var not in alias_map ):
                                break
                        # create appropriate parent node for alias
                        if ( alias_info != "" ):
                            alias_id = var_deps[alias_info[0]][alias_info[1]].get('real_id')
                            alias_parent = alias_info[0] + ",id=" + str(alias_id) + "," + var_deps[alias_info[0]][alias_info[1]].get('script') + "," + var_deps[alias_info[0]][alias_info[1]].get('OrigLine')
                            dot_output.write("\"" + alias_parent + "\" -> \"" + curr_child + "\"[style=dotted];\n")

    # finally, close dot graph
    dot_output.write("}")
    dot_output.close()

    # make graph
    os.system("dot -Tpdf flow_diagram.dot -o flow_diagram.pdf")


# read in original log. while going through, make list of all unique variables (only window for now, not DOM)
# also get the AST for each source file (for now, only consider standalone JS files)
log = []
# make a dictionary of write deps for each variable (key is var name, value is list of deps)
var_deps = {}
# dictionary of cross-variable dependencies (keys are variables and values are dictionaries where keys are index of key var and values are tuples (var, index) of parents..tuples can have third component as object property names)
cross_deps = {}
# dictionary of ASTs (key is filename, value is AST)
asts = {}
# dictionary mapping object id's to JS heap variable names
obj_map = {}
# dictionary mapping last instance of each id to a var name
last_id_name = {}
# dictionary mapping alias references for objects (keys are var names and values are dictionaries with keys as property names and values as other var names that they map to)
alias_map = {}
# dictionary mapping object id's to the first heap variable name it is assigned to
first_id_name = {}

with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        log.append(curr_line)
        curr_var = curr_line.get('PropName')
        if ( curr_var not in var_deps ):
            var_deps[curr_var] = []
        if ( curr_line.get('OpType') == 'WRITE' ):
            if ( (curr_line.get('NewValId') != "null") and (curr_line.get('NewValId') not in first_id_name ) ):
                first_id_name[curr_line.get('NewValId')] = curr_line.get('PropName')
            parent_obj_id = curr_line.get('ParentId')
            if ( parent_obj_id in obj_map ):
                # consider this a write on the last instance of this object we considered (which is this line)
                # also, adding a property 'property' which lists the property of the id we are modifying and id to print
                changed_curr_line = curr_line
                changed_curr_line['property'] = curr_line.get('PropName')
                changed_curr_line['real_id'] = parent_obj_id
                var_deps[last_id_name[parent_obj_id]].append(changed_curr_line)
            else:
                new_obj_id = curr_line.get('NewValId')
                if ( new_obj_id != "null" ):
                    if ( new_obj_id not in obj_map ):
                        obj_map[new_obj_id] = []
                    # this is now the last instance of this id
                    last_id_name[new_obj_id] = curr_var
                    obj_map[new_obj_id].append(curr_var)
                changed_curr_line = curr_line
                changed_curr_line['real_id'] = new_obj_id
                var_deps[curr_var].append(changed_curr_line)
                curr_script = curr_line.get('script')
                # first get the file as plaintext (if it exists)
            if ( get_source_file(curr_script) ):
                cmd = "nodejs line_type.js file temp_file " + curr_line.get('OrigLine')
                proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
                (out, err) = proc.communicate()
                out_json = json.loads(out.strip("\n").replace("\'", '"'))
                # there could be some relevant deps!
                # for now we are only considering writes b/c with assignments read precedes write for same line
                # and we want the write to be already listed for left side variable!
                if (len(out_json.keys()) > 0 ):
                    for key in out_json:
                        curr_key = key
                        if ( curr_key[0:7] == "window." ):
                            curr_key = curr_key[7:]
                        curr_key_prop = ""
                        curr_key_prop = curr_key[curr_key.find(".")+1:]
                        if ( "." in curr_key ):
                            curr_key = curr_key[0:curr_key.find(".")]
                        # only care about this if curr_key is in var_deps (otherwise it is a local var)
                        if ( curr_key in var_deps ):
                            for dep in out_json[key]:
                                curr_dep = dep
                                assign_prop = ""
                                alias_prop = ""
                                if ( isinstance(dep, list) ):
                                    curr_dep = dep[0]
                                    assign_prop = "set: " + dep[1]
                                    alias_prop = dep[1]
                                if ( curr_dep[0:7] == "window." ):
                                    curr_dep = curr_dep[7:]
                                if ( curr_dep != curr_key ): # only care if variable is not the same!
                                    curr_key_line = len(var_deps[curr_key])-1
                                    # only care about this if curr_dep is in var_deps (otherwise it is a local var)
                                    # if curr_dep is not in var_deps, then it is a local variable so we should add it to the graph but make note that it is local!
                                    if ( (curr_dep in var_deps) ):
                                        if curr_key not in cross_deps:
                                            cross_deps[curr_key] = {}
                                        if ( curr_key_line not in cross_deps[curr_key] ):
                                            cross_deps[curr_key][curr_key_line] = []
                                        len_dep = len(var_deps[curr_dep])-1
                                        dep_tuple = (curr_dep, len_dep)
                                        if ( assign_prop != "" ):
                                            dep_tuple = (curr_dep, len_dep, assign_prop)
                                        if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                            cross_deps[curr_key][curr_key_line].append(dep_tuple)
                                        # add alias info
                                        if ( curr_key not in alias_map ):
                                            alias_map[curr_key] = {}
                                        alias_map[curr_key][alias_prop] = (curr_dep, len(var_deps[curr_dep])-1)
                                    else:
                                        # this is a local var or a property
                                        # if local var- create new variable with name maybelocal_randnum_varname (since local vars can have same name)
                                        # if property- check if top-level variable has an object id, and if so, add real_id and property fields to the json
                                        if ( "." in curr_dep ):
                                            top_level_name = curr_dep[0:curr_dep.find(".")]
                                            prop = "property: " + curr_dep[curr_dep.find(".")+1:]
                                            is_obj = False
                                            rel_id = "null"
                                            for i in obj_map:
                                                for k in obj_map[i]:
                                                    if ( k == top_level_name ):
                                                        is_obj = True
                                                        rel_id = i
                                            if ( is_obj ):
                                                if curr_key not in cross_deps:
                                                    cross_deps[curr_key] = {}
                                                if ( curr_key_line not in cross_deps[curr_key] ):
                                                    cross_deps[curr_key][curr_key_line] = []
                                                dep_tuple = (top_level_name, len(var_deps[top_level_name])-1, prop)
                                                if ( assign_prop != "" ):
                                                    dep_tuple = dep_tuple + (assign_prop,)
                                                if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                                    cross_deps[curr_key][curr_key_line].append(dep_tuple)
                                            else:
                                                local_var_name = "maybelocal_" + str(random.uniform(0,100)) + "_" + curr_dep
                                                var_deps[local_var_name] = [{'type': 'local', 'name': local_var_name, 'script': curr_script, 'OrigLine': curr_line.get('OrigLine')}]
                                                if curr_key not in cross_deps:
                                                    cross_deps[curr_key] = {}
                                                curr_key_line = len(var_deps[curr_key])-1
                                                if ( curr_key_line not in cross_deps[curr_key] ):
                                                    cross_deps[curr_key][curr_key_line] = []
                                                dep_tuple = (local_var_name, 0)
                                                if ( curr_key_prop != "" ):
                                                    dep_tuple = dep_tuple + (curr_key_prop,)
                                                if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                                    cross_deps[curr_key][curr_key_line].append(dep_tuple)
                                        else:
                                            local_var_name = "maybelocal_" + str(random.uniform(0,100)) + "_" + curr_dep
                                            var_deps[local_var_name] = [{'type': 'local', 'name': local_var_name, 'script': curr_script, 'OrigLine': curr_line.get('OrigLine')}]
                                            if curr_key not in cross_deps:
                                                cross_deps[curr_key] = {}
                                            curr_key_line = len(var_deps[curr_key])-1
                                            if ( curr_key_line not in cross_deps[curr_key] ):
                                                cross_deps[curr_key][curr_key_line] = []
                                            dep_tuple = (local_var_name, 0)
                                            if ( curr_key_prop != "" ):
                                                dep_tuple = dep_tuple + (curr_key_prop,)
                                            if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                                cross_deps[curr_key][curr_key_line].append(dep_tuple)
                os.system("rm temp_file")
            else:
                raise ValueError("Object (" + curr_script + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")
print cross_deps
make_dot()
# iterate through log (top to bottom) and print out list of source code lines and corresponding ASTs
#for entry in log:
#    source_line = get_source_line(entry.get('script'), int(entry.get('OrigLine')))
#    cmd = "nodejs process.js line " + "'" + source_line + "'"
#    proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
#    (out, err) = proc.communicate()
#    print source_line + "\n"
#    print out + "\n\n"
print obj_map
