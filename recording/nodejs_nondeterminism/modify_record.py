import os
import sys
import subprocess

original_file = sys.argv[1]
new_file = sys.argv[2]

os.system("cat record_shims.js >> " + new_file)
os.system("cat " + original_file + " >> " + new_file)
