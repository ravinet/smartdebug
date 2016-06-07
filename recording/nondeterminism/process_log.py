import os, sys, json

log = sys.argv[1]

# array of tuples (first element is function type, second is return value)
return_list = []

with open(log) as f:
    for line in f:
        if ( line != "Listening on port 8090\n" and line != "END OF LOG\n" ):
            # remove double quotes wrapping dictionary and also newline
            curr = json.loads(line[0:len(line)-1])
            return_list.append((curr.get('Function'), curr.get('Return')))

print json.dumps(return_list)
