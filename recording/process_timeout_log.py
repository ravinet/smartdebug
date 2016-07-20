import os, sys, json

log = sys.argv[1]

# list of event handler types that we care about
event_types = ['setTimeout', 'setInterval']
nondeterminism_types = ['new window.Date', 'window.Date', 'Math.random']

# list of events to fire (in order)..entries are tuples (uniqueid, timeoutid, time)
#TODO: may want to change this to be time from start (rather than time)
ordered_events = []

# tuples ("EventType", "Event"(e.g., click), EventInit)
ordered_dom_events = []

# list of nondeterminism calls (date, random)...list of tuples (type, return_val)
return_list = []

with open(log) as file1:
    for line1 in file1:
        if ( "Listening on" not in line1 and "END OF LOG" not in line1 ): 
            curr_entry = json.loads(line1[0:len(line1)-1])
            if ( curr_entry.get('Function') in nondeterminism_types ):
                return_list.append((curr.get('Function'), curr.get('Return')))
            if ( curr_entry.get('Function') in event_types ):
                ordered_events.append((curr_entry.get('UniqueID'), curr_entry.get('TimeoutId'), curr_entry.get('Time')))
            if ( curr_entry.get('Type') == "DOMEvent" ):
                ordered_dom_events.append(curr_entry)

# go through ordered events and output in form that we can add to recorded pages
event_out = []
for e in ordered_events:
    curr_log = {'UniqueID': e[0], 'TimeoutID': e[1], 'Time': e[2]}
    event_out.append(curr_log)

print json.dumps(return_list)
print >> sys.stderr, json.dumps(event_out) + "----" + json.dumps(ordered_dom_events)
