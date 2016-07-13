import os, sys, json

log = sys.argv[1]

# list of event handler types that we care about
event_types = ['setTimeout', 'setInterval']

# list of events to fire (in order)..entries are tuples (uniqueid, timeoutid, time)
#TODO: may want to change this to be time from start (rather than time)
ordered_events = []

with open(log) as file1:
    for line1 in file1:
        if ( "Listening on" not in line1 and "END OF LOG" not in line1 ): 
            curr_entry = json.loads(line1[0:len(line1)-1])
            if ( curr_entry.get('Function') in event_types ):
                ordered_events.append((curr_entry.get('UniqueID'), curr_entry.get('TimeoutId'), curr_entry.get('Time')))

# go through ordered events and output in form that we can add to recorded pages
for e in ordered_events:
    curr_log = {'UniqueID': e[0], 'TimeoutID': e[1], 'Time': e[2]}
    print json.dumps(curr_log)
