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
     // will want this to be event-based eventually
     response.setHeader("Cookie", "vector-clock=0:3");
     response.setHeader("Access-Control-Expose-Headers", "Cookie, Content-Length, Connection, Date");
     response.end('<html><div>' + output + '</div></html>');
    });
}
);

server.listen(port);
