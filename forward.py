import os, sys, subprocess, json

log_file = sys.argv[1]
recorded_folder = sys.argv[2]

files = os.listdir(recorded_folder)

# read in original log. while going through, make list of all unique variables (only window for now, not DOM)
log = []
# make a dictionary of write deps for each variable (key is var name, value is list of deps)
var_deps = {}
with open(log_file) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        log.append(curr_line)
        curr_var = curr_line.get('PropName')
        if ( curr_var not in var_deps ):
            var_deps[curr_var] = []
        if ( curr_line.get('OpType') == 'WRITE' ):
            var_deps[curr_var].append(curr_line)

# given an object name and line number (from log), return relevant source code line
def get_source_line(filename, line_no):
    # first find the relevant file
    for recorded_file in files:
        cmd = "protototext " + " " + recorded_folder + "/" + recorded_file + " temp_file"
        proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
        (out, err) = proc.communicate()
        if filename in out.split("na--me=")[1].strip("\n"):
            # decompress if necessary
            if ( out.split("gzipped=")[1].split("*")[0] == "true" ):
                os.system("gzip -d -c temp_file > temp_file2")
                os.system("mv temp_file2 temp_file")
            # this is the right file, so get the source code line and return
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
            # not the right file, so delete tempfile and continue
            os.system("rm temp_file")
    os.system("rm temp_file")
    raise ValueError("Object (" + filename + ") doesn't seem to exist in recorded folder (" + recorded_folder + ")")

# iterate through log (top to bottom) and print out list of source code lines and corresponding ASTs
for entry in log:
    source_line = get_source_line(entry.get('script'), int(entry.get('OrigLine')))
    cmd = "nodejs process.js " + "'" + source_line + "'"
    proc = subprocess.Popen([cmd], stdout=subprocess.PIPE, shell=True)
    (out, err) = proc.communicate()
    print source_line + "\n"
    print out + "\n\n"
