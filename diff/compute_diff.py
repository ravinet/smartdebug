# requires 'sudo pip install pyxDamerauLevenshtein
import os, sys, subprocess, json, ast, re

original_log = sys.argv[1]
new_log = sys.argv[2]
start_step = int(sys.argv[3])

# iterate through each log and, starting at specified step, maintain list of writes per variable--can do in array for now (each write is a step)
step = 1
# list of variables written after given step
original_vars_written = []
with open(original_log) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        if ( curr_line.get('OpType') == 'WRITE' ):
            step += 1
            if ( step >= start_step ): # we care about this write!
                curr_var = curr_line.get('PropName')
                curr_script = curr_line.get('script')
                curr_line_num = curr_line.get('OrigLine')
                curr_newvalid = curr_line.get('NewValId')
                curr_parentid = curr_line.get('ParentId')
                if ( curr_var not in original_vars_written ):
                    original_vars_written.append(curr_var)
                # TODO: need to do this for object ids as well            
 [foo.js:Line 5:window.x-->window.y]

step = 1
# list of variables written after given step
new_vars_written = []
with open(new_log) as f:
    for line in f:
        curr_line = json.loads(line.strip("\n"))
        if ( curr_line.get('OpType') == 'WRITE' ):
            step += 1
            if ( step >= start_step ): # we care about this write!
                curr_var = curr_line.get('PropName')
                curr_script = curr_line.get('script')
                curr_line_num = curr_line.get('OrigLine')
                curr_newvalid = curr_line.get('NewValId')
                curr_parentid = curr_line.get('ParentId')
                if ( curr_var not in new_vars_written ):
                    new_vars_written.append(curr_var)
                # TODO: need to do this for object ids as well  

# Now, call original processing script with a given variable and step so we can get the list of relevant writes---that script should be modified to just output the list of relevant writes (without making the graph) Alternatively, it could output both graphs and we can show them side by side!

# once we have the two strings to compare, we can compare using:
#-Edit distance (damerau_levenshtein_distance): Compute the raw distance between two strings (i.e., the minumum number of operations necessary to transform one string into the other).
#-Normalized edit distance (normalized_damerau_levenshtein_distance): Compute the ratio of the edit distance to the length of max(string1, string2). 0.0 means that the sequences are identical, while 1.0 means that they have nothing in common. Note that this definition is the exact opposite of difflib.SequenceMatcher.ratio().
