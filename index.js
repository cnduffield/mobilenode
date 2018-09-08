app.get('/', function(req, res){
    //res.sendfile('default.html', { root: __dirname + "/relative_path_of_file" } );
	res.sendfile('default.html', { root: __dirname } );
});