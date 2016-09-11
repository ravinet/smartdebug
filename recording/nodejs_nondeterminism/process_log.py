import os, sys, json, numpy

log = sys.argv[1]

# list of event handler types that we care about
event_types = ['setTimeout', 'setInterval']
nondeterminism_types = ['new window.Date', 'window.Date', 'Math.random']

# list of events to fire (in order)..entries are tuples (uniqueid, timeoutid, time)
#TODO: may want to change this to be time from start (rather than time)
ordered_events = []
emit_events = []
# list of nondeterminism calls (date, random)...list of tuples (type, return_val)
return_list = []

start_wall_clock_time = 0
date_diffs = []
last_date = 0

with open(log) as file1:
    for line1 in file1:
        try:
            curr_entry = json.loads(line1[0:len(line1)-1])
            if ( curr_entry.get('Function') in nondeterminism_types ):
                if ( curr_entry.get('Function') != "Math.random" ):
                    curr_time = float(curr_entry.get('Time'))
                    if ( curr_time < start_wall_clock_time or start_wall_clock_time == 0 ):
                        start_wall_clock_time = curr_time
                    # compute date diff
                    curr_ms = float(curr_entry.get('msTime'))
                    if ( last_date == 0 ): # first date call
                        last_date = curr_ms
                    else:
                        curr_diff = curr_ms - last_date
                        last_date = curr_ms
                        date_diffs.append(curr_diff)
                return_list.append((curr_entry.get('Function'), curr_entry.get('Return')))
            if ( curr_entry.get('Function') in event_types ):
                ordered_events.append((curr_entry.get('UniqueID'), curr_entry.get('TimeoutId'), curr_entry.get('Time')))
                curr_time = float(curr_entry.get('Time'))
                if ( curr_time < start_wall_clock_time or start_wall_clock_time == 0 ):
                    start_wall_clock_time = curr_time
            if ( 'ID' in curr_entry ): # this is a handler firing!
                emit_events.append(curr_entry)
            if ( curr_entry.get('Function') == "EventEmitter.emit" ): # before/after an emit
                emit_events.append(curr_entry)
        except:
            continue

# go through ordered events and output in form that we can add to recorded pages
event_out = []
for e in ordered_events:
    curr_log = {'UniqueID': e[0], 'TimeoutID': e[1], 'Time': e[2]}
    event_out.append(curr_log)

date_diff_avg = 10
if ( len(date_diffs) != 0 ):
    date_diff_avg = numpy.average(date_diffs)

print str(start_wall_clock_time) + "-,-" + str(date_diff_avg) + "-,-" + json.dumps(return_list)
print >> sys.stderr, json.dumps(event_out) + "----" + json.dumps(ordered_events) + "----" + json.dumps(emit_events)
