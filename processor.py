import os, sys, subprocess, json, random

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
                if ( counter == line_no ):
                    os.system("rm temp_file")
                    return line.strip("\n").strip()
                counter = counter + 1
        os.system("rm temp_file")
        raise ValueError("File (" + recorded_file + "," + filename + ") is shorter than log's line number (" + line_no + ")")
    else:
        raise ValueError("Object (" + filename + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")

# class for each node in the flow diagram
class Node(object):
    def __init__(self, variable, line_number, source_line, step):
        self.variable = variable
        self.line_number = line_number
        self.source_line = source_line
        self.step = step

# iterate through log and process each write
with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        if ( curr_line.get('OpType') == 'WRITE' ):
            curr_var = curr_line.get('PropName')
            curr_script = curr_line.get('script')
            # if the script exists, get the static dependencies
            if ( get_source_file(curr_script) ):
                cmd = "nodejs line_type.js file temp_file " + curr_line.get('OrigLine')
                proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
                (out, err) = proc.communicate()
                esprima_deps = json.loads(out.strip("\n").replace("\'", '"'))
            os.system("rm temp_file")
'''
go through the log and for each write, we want to:
1) get the source code line (currently from the rewritten version)...we may only care about the right side
2) get the dependencies from esprima
3) object properties that are written should be their own variables (we don't need to link back to the top-level obj, except we do want to keep track of when an object becomes invalid because top-level has been overwritten.
4) for aliases, we want to to keep track of which nodes are aliases of one another---when one is updated, check the list and update the other. also, when the alias is created, add an edge for that (perhaps dotted).

* perhaps we should have a class for nodes (this can store source code, line number and variable name, and step number
* we want to keep track of time steps (each write essentially represents a step so we need a counter 
'''
