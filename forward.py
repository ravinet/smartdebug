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
            curr_ending = ";"
            if ( k == imp_var ):
                curr_ending = "[color=red];"
            write_list = var_deps[k]
            for x in range(0, len(write_list)):
                if ( x != 0 ): # currently just print the variable,file,line_num
                    curr_parent = k + "," + write_list[x-1].get('script') + "," + write_list[x-1].get('OrigLine')
                    curr_child = k + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                    dot_output.write("\"" + curr_parent + "\" -> \"" + curr_child + "\"" + curr_ending + "\n")
                else:
                    if ( len(write_list) == 1 ):
                        curr_node = k + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                        dot_output.write("\"" + curr_node + "\"" + curr_ending + "\n")

    # add edges for cross-var dependencies
    for c in cross_deps:
        curr_ending = ";"
        if ( c == imp_var ):
            curr_ending = "[color=red];"
        for ind in cross_deps[c]:
            curr_child = c + "," + var_deps[c][ind].get('script') + "," + var_deps[c][ind].get('OrigLine')
            for pind in cross_deps[c][ind]:
                curr_name = pind[0]
                if ( 'maybelocal_' in pind[0] ):
                    curr_name = pind[0].split("_")[2]
                curr_parent = curr_name + "," + var_deps[pind[0]][pind[1]].get('script') + "," + var_deps[pind[0]][pind[1]].get('OrigLine')
                if ( 'type' in var_deps[pind[0]][pind[1]] ):
                    curr_parent = "Local Variable: " + curr_parent
                dot_output.write("\"" + curr_parent + "\" -> \"" + curr_child + "\"" + curr_ending + "\n")

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
# dictionary of cross-variable dependencies (keys are variables and values are dictionaries where keys are index of key var and values are tuples (var, index) of parents)
cross_deps = {}
# dictionary of ASTs (key is filename, value is AST)
asts = {}
# dictionary mapping object id's to JS heap variable names
obj_map = {}

with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        log.append(curr_line)
        curr_var = curr_line.get('PropName')
        if ( curr_var not in var_deps ):
            var_deps[curr_var] = []
        if ( curr_line.get('OpType') == 'WRITE' ):
            parent_obj_id = curr_line.get('ParentId')
            if ( parent_obj_id in obj_map ):
                # consider this a write on each of those variables!
                for pastvar in obj_map[parent_obj_id]:
                    var_deps[pastvar].append(curr_line)
            else:
                new_obj_id = curr_line.get('NewValId')
                if ( new_obj_id != "null" ):
                    if ( new_obj_id not in obj_map ):
                        obj_map[new_obj_id] = []
                    obj_map[new_obj_id].append(curr_line.get('PropName'))
                var_deps[curr_var].append(curr_line)
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
                            # only care about this if curr_key is in var_deps (otherwise it is a local var)
                            if ( curr_key in var_deps ):
                                for dep in out_json[key]:
                                    curr_dep = dep
                                    if ( dep[0:7] == "window." ):
                                        curr_dep = dep[7:]
                                    if ( curr_dep != curr_key ): # only care if variable is not the same!
                                        # only care about this if curr_dep is in var_deps (otherwise it is a local var)
                                        # if curr_dep is not in var_deps, then it is a local variable so we should add it to the graph but make note that it is local!
                                        if ( (curr_dep in var_deps) ):
                                            if curr_key not in cross_deps:
                                                cross_deps[curr_key] = {}
                                            curr_key_line = len(var_deps[curr_key])-1
                                            if ( curr_key_line not in cross_deps[curr_key] ):
                                                cross_deps[curr_key][curr_key_line] = []
                                            len_dep = len(var_deps[curr_dep])-1
                                            dep_tuple = (curr_dep, len_dep)
                                            if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                                cross_deps[curr_key][curr_key_line].append(dep_tuple)
                                        else:
                                            # this is a local var--create new variable with name maybelocal_randnum_varname (since local vars can have same name)
                                            local_var_name = "maybelocal_" + str(random.uniform(0,100)) + "_" + curr_dep
                                            var_deps[local_var_name] = [{'type': 'local', 'name': local_var_name, 'script': curr_script, 'OrigLine': curr_line.get('OrigLine')}]
                                            if curr_key not in cross_deps:
                                                cross_deps[curr_key] = {}
                                            curr_key_line = len(var_deps[curr_key])-1
                                            if ( curr_key_line not in cross_deps[curr_key] ):
                                                cross_deps[curr_key][curr_key_line] = []
                                            dep_tuple = (local_var_name, 0)
                                            if ( dep_tuple not in cross_deps[curr_key][curr_key_line] ):
                                                cross_deps[curr_key][curr_key_line].append(dep_tuple)

                            # TODO: use object mapping to add appropriate dependencies (e.g. if different var names refer to same heap object)
                            # we have a dictionary of dependencies by var names that come back...we only want to add edges based on obj ids for the variables that pertain to these objects (e.g. if line has comma)
                            # one approach is to go through the list of deps and if any dep is in the obj mapping, then add an edge from that var and all other obj id vars to the new thing?
                            # we could also simply go through the writes (as we do now) and each time we have a write, we we can check to see if there is a parent id and if yes then we can add a dep
                            # OR anytime we have a write that has a parent id then we can simply add writes to all vars that map to that parent id?


                    # if "window.", strip it since logs don't list this
                    print curr_line
                    print out
                    print "\n"
                    #asts[curr_script] = out
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
