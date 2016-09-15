var http = require('http');

// cross-user likes and dislikes counters
global.likes = 0;
global.dislikes = 0;

const port = 3000;

const server = http.createServer(function(request, response) {
    var body = [];
    request.on('data', function(chunk) {
      body.push(chunk);
    }).on('end', function() {
     body = Buffer.concat(body).toString();
     // add likes and dislikes to global counters
     var likes = parseInt(body.split("&")[0].split("=")[1]);
     var dislikes = parseInt(body.split("&")[1].split("=")[1]);
     global.likes += likes;
     global.dislikes += dislikes;
     var output = "Total Likes: " + global.likes + "\nTotal Dislikes: " + global.dislikes;
     response.setHeader("Access-Control-Allow-Origin", "*");
     var req_cookie = request.headers.cookie;
     if ( req_cookie ) {
        var client_clock = VectorClock.extractFromCookie(0, req_cookie);
        server_clock.update(client_clock);
        var response_cookie = "vector-clock=" + server_clock.toString();
        response.setHeader("Set-Cookie", response_cookie);
     }
     response.setHeader("Access-Control-Expose-Headers", "Set-Cookie, Content-Length, Connection, Date");
     response.end('<html><div>' + output + '</div></html>');
    });
}
);

server.listen(port);
