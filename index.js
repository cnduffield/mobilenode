/*app.get('/', function(req, res){
    //res.sendfile('default.html', { root: __dirname + "/relative_path_of_file" } );
	res.sendfile('default.html', { root: __dirname } );
});*/
var path = require('path');
var express = require('express');
var http = require('http');
var url = require('url');
var fs = require('fs');
var envTypeColor = process.env.color;

var app = express();
var port = 8080;
var htmlPath = path.join(__dirname, 'images');

//app.use(express.static(htmlPath));




http.createServer(function (req, res) {
	  var q = url.parse(req.url, true);
	  var filename = "." + q.pathname;
	  fs.readFile(filename, function(err, data) {
	    if (err) {
	      res.writeHead(200, {'Content-Type': 'text/html'});
	      if(envTypeColor == null || envTypeColor == 'BLUE'  || envTypeColor == 'blue')
	    	  return res.end("<html><body bgcolor=#ADD8E6><font color=white><h1 >Hello Blue world!</h1></font><p><a href='index.html'>Click Here to start</a></p></body></html>");
	    	  
	      else if (envTypeColor == 'GREEN' || envTypeColor == 'green')
	    	  return res.end("<html><body bgcolor=#32CD32><font color=white><h1 >Hello Green world!</h1></font><p><a href='index.html'>Click Here to start</a></p></body></html>");
	    	
	    }  
	    res.writeHead(200, {'Content-Type': 'text/html'});
	    res.write(data);
	    return res.end();
	  });
	}).listen(port);

/*app.get('/', function (req, res, next) {
	 res.sendFile( __dirname + '/index.html');
	});*/

/*app.listen(port, '0.0.0.0', function() {
 console.log('Server running at port ' + port);
});
*/