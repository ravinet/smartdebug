import os
import sys
import subprocess

recorded_file = sys.argv[1]
new_file = sys.argv[2]
log_file = sys.argv[3]

log = ""
event_order = ""
dom_event_order = ""

log_cmd = "python process_log.py " + log_file
proc = subprocess.Popen([log_cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
(log_out, log_err) = proc.communicate()
log_out = log_out.strip("\n")
start_wall_clock = log_out.split("-,-")[0]
avg_date_diff = log_out.split("-,-")[1]
log = log_out.split("-,-")[2]
log_err = log_err.strip("\n")
event_order = log_err.strip("\n").split("----")[0]
dom_event_order = log_err.strip("\n").split("----")[1]
xhr_event_order = log_err.strip("\n").split("----")[2]

# make string containing ast info to add
ast_string = "var log_vals = " + log + ";\nvar ordered_events = " + event_order + ";\nvar dom_ordered_events = " + dom_event_order + ";\nvar xhr_ordered_events = " + xhr_event_order + ";\nglobal.upper_wall_clock = " + str(start_wall_clock) + ";\nglobal.lower_wall_clock = 0;\nglobal.avg_date_diff = " + avg_date_diff + ";\n"

new_js = open(new_file, 'w')
new_js.write(ast_string)
new_js.close()
os.system("cat replay_shims.js >> " + new_file)
os.system("cat " + recorded_file + " >> " + new_file)
