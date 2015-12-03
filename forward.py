import os, sys, subprocess, json

log_file = sys.argv[1]
recorded_folder = sys.argv[2]
files = os.listdir(recorded_folder)

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
    # first print standard DOT file lines
    print "strict digraph G {\nratio=compress;\nconcentrate=true;"

    # first go through per-variable dependencies and add edges (one write to next)
    for k in var_deps:
        write_list = var_deps[k]
        for x in range(0, len(write_list)):
            if ( x != 0 ): # currently just print the variable,file,line_num
                curr_parent = k + "," + write_list[x-1].get('script') + "," + write_list[x-1].get('OrigLine')
                curr_child = k + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                print "\"" + curr_parent + "\" -> \"" + curr_child + "\";"
            else:
                if ( len(write_list) == 1 ):
                    curr_node = k + "," + write_list[x].get('script') + "," + write_list[x].get('OrigLine')
                    print "\"" + curr_node + "\";"

    # finally, close dot graph
    print "}"


# read in original log. while going through, make list of all unique variables (only window for now, not DOM)
# also get the AST for each source file (for now, only consider standalone JS files)
log = []
# make a dictionary of write deps for each variable (key is var name, value is list of deps)
var_deps = {}
# dictionary of ASTs (key is filename, value is AST)
asts = {}
with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        log.append(curr_line)
        curr_var = curr_line.get('PropName')
        if ( curr_var not in var_deps ):
            var_deps[curr_var] = []
        if ( curr_line.get('OpType') == 'WRITE' ):
            var_deps[curr_var].append(curr_line)
        curr_script = curr_line.get('script')
        if ( curr_script not in asts ):
            # first get the file as plaintext (if it exists)
            if ( get_source_file(curr_script) ):
                cmd = "nodejs process.js file temp_file"
                proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
                (out, err) = proc.communicate()
                asts[curr_script] = out
                os.system("rm temp_file")
            else:
                raise ValueError("Object (" + curr_script + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")

# iterate through log (top to bottom) and print out list of source code lines and corresponding ASTs
#for entry in log:
#    source_line = get_source_line(entry.get('script'), int(entry.get('OrigLine')))
#    cmd = "nodejs process.js line " + "'" + source_line + "'"
#    proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
#    (out, err) = proc.communicate()
#    print source_line + "\n"
#    print out + "\n\n"
