/*app.get('/', function(req, res){
    //res.sendfile('default.html', { root: __dirname + "/relative_path_of_file" } );
	res.sendfile('default.html', { root: __dirname } );
});*/
var path = require('path');
var express = require('express');
var app = express();
var port = 8080;
var htmlPath = path.join(__dirname, 'html');

app.use(express.static(htmlPath));

app.get('/', function (req, res, next) {
 res.sendFile( __dirname + '/index.html');
});

app.listen(port, '0.0.0.0', function() {
 console.log('Server running at port ' + port);
});
