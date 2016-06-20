import os
import sys
import subprocess

# recorded folder to be copied and rewritten
recorded_folder = sys.argv[1]
rewritten_folder = sys.argv[2]
log = ""

if ( len(sys.argv) > 3 ):
    log_cmd = "python process_log.py " + sys.argv[3]
    proc = subprocess.Popen([log_cmd], stdout=subprocess.PIPE, shell=True)
    (log_out, log_err) = proc.communicate()
    log = log_out.strip("\n")

# temp folder to store rewritten protobufs
os.system("rm -rf rewritten")
os.system( "cp -r " + recorded_folder + " rewritten" )

files = os.listdir("rewritten")

for filename in files:
    print filename

    # convert response in protobuf to text (ungzip if necessary)
    command = "protototext rewritten/" + filename + " rewritten/tempfile"
    proc = subprocess.Popen([command], stdout=subprocess.PIPE, shell=True)
    (out, err) = proc.communicate()
    return_code = proc.returncode
    out = out.strip("\n")
    print out
    res_type = out.split("*")[0].split("=")[1]
    gzip = out.split("*")[2].split("=")[1]
    chunked = out.split("*")[1].split("=")[1]
    name = out.split("na--me=")[1]
    # need to still handle if response is chunked and gzipped (we can't just run gzip on it)!
    if ( ("html" in res_type) or ("javascript" in res_type) ): # html or javascript file, so rewrite
        if ( "true" in chunked ): # response chunked so we must unchunk
            os.system( "python unchunk.py rewritten/tempfile rewritten/tempfile1" )
            os.system( "mv rewritten/tempfile1 rewritten/tempfile" )
            # remove transfer-encoding chunked header from original file since we are unchunking
            os.system( "removeheader rewritten/" + filename + " Transfer-Encoding" )
        if ( "false" in gzip ): # html or javascript but not gzipped
            if ( "javascript" in res_type ):
                os.system('nodejs rewrite_window.js rewritten/tempfile rewritten/retempfile')
                os.system('mv rewritten/retempfile rewritten/tempfile')
                os.system('nodejs rewrite.js rewritten/tempfile rewritten/retempfile')
                os.system('mv rewritten/retempfile rewritten/tempfile')
                os.system('cp inline.js rewritten/prependtempfile')
                if ( log != "" ):
                    new_file = open("rewritten/prependtempfile", 'a')
                    new_file.write("var log_vals = " + log + ";\n")
                    new_file.close()
                os.system('cat rewritten/tempfile >> rewritten/prependtempfile')
                os.system('mv rewritten/prependtempfile rewritten/tempfile')

            if ( "html" in res_type ): # rewrite all inline js in html files
               os.system('python html_rewrite_linux_window.py rewritten/tempfile rewritten/htmltempfile')
               os.system('mv rewritten/htmltempfile rewritten/tempfile')
               os.system('python html_rewrite_linux.py rewritten/tempfile rewritten/htmltempfile')
               os.system('mv rewritten/htmltempfile rewritten/tempfile')
               body = open("rewritten/tempfile", 'r')
               first_line = body.readline()
               if ( "<!doctype html>" in first_line.lower() ):
                   new_file = open("rewritten/prependtempfile", 'a')
                   new_file.write("<!doctype html>\n")
                   new_file.close()
               body.close()
               os.system('cat inline.html >> rewritten/prependtempfile')
               if ( log != "" ):
                   new_file = open("rewritten/prependtempfile", 'a')
                   new_file.write("var log_vals = " + log + ";\n</script>")
                   new_file.close()
               else:
                   new_file = open("rewritten/prependtempfile", 'a')
                   new_file.write("</script>")
                   new_file.close()
               os.system('cat rewritten/tempfile >> rewritten/prependtempfile')
               os.system('mv rewritten/prependtempfile rewritten/tempfile')

            # get new length of response
            size = os.path.getsize('rewritten/tempfile')

            # convert modified file back to protobuf
            os.system( "texttoproto rewritten/tempfile rewritten/" + filename )

            # add new content length header
            os.system( "changeheader rewritten/" + filename + " Content-Length " + str(size) )
        else: # gzipped
            os.system("gzip -d -c rewritten/tempfile > rewritten/plaintext")
            if ( "javascript" in res_type ):
                os.system('nodejs rewrite_window.js rewritten/plaintext rewritten/retempfile')
                os.system('mv rewritten/retempfile rewritten/plaintext')
                os.system('nodejs rewrite.js rewritten/plaintext rewritten/retempfile')
                os.system('mv rewritten/retempfile rewritten/plaintext')
                os.system('cp inline.js rewritten/prependtempfile')
                if ( log != "" ):
                    new_file = open("rewritten/prependtempfile", 'a')
                    new_file.write("var log_vals = " + log + ";\n")
                    new_file.close()
                os.system('cat rewritten/plaintext >> rewritten/prependtempfile')
                os.system('mv rewritten/prependtempfile rewritten/plaintext')

            if ( "html" in res_type ): # rewrite all inline js in html files
                os.system('python html_rewrite_linux_window.py rewritten/plaintext rewritten/htmltempfile')
                os.system('mv rewritten/htmltempfile rewritten/plaintext')
                os.system('python html_rewrite_linux.py rewritten/plaintext rewritten/htmltempfile')
                os.system('mv rewritten/htmltempfile rewritten/plaintext')
                body = open("rewritten/plaintext", 'r')
                first_line = body.readline()
                if ( "<!doctype html>" in first_line.lower() ):
                    new_file = open("rewritten/prependtempfile", 'a')
                    new_file.write("<!doctype html>\n")
                    new_file.close()
                body.close()
                os.system('cat inline.html >> rewritten/prependtempfile')
                if ( log != "" ):
                    new_file = open("rewritten/prependtempfile", 'a')
                    new_file.write("var log_vals = " + log + ";\n</script>")
                    new_file.close()
                else:
                    new_file = open("rewritten/prependtempfile", 'a')
                    new_file.write("</script>")
                    new_file.close()
                os.system('cat rewritten/plaintext >> rewritten/prependtempfile')
                os.system('mv rewritten/prependtempfile rewritten/plaintext')

            # after modifying plaintext, gzip it again (gzipped file is 'finalfile')
            os.system( "gzip -c rewritten/plaintext > rewritten/finalfile" )

            # get new length of response
            size = os.path.getsize('rewritten/finalfile')

            # convert modified file back to protobuf
            os.system( "texttoproto rewritten/finalfile rewritten/" + filename )

            # add new content length header to the newly modified protobuf (name is filename)
            os.system( "changeheader rewritten/" + filename + " Content-Length " + str(size) )

            # delete temp files
            os.system("rm rewritten/plaintext")
            os.system("rm rewritten/finalfile")
    # delete original tempfile
    os.system("rm rewritten/tempfile")

os.system("mv rewritten " + rewritten_folder)
