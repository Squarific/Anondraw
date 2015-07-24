var http = require("http");
var JOIN_CODE = require("join_code_password.js");

var Servers = require("./scripts/Servers.js");
var servers = new Servers(JOIN_CODE);

var server = http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);

	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Content-Type", "application/json");

	if (parsedUrl.pathname == "/register") {
		if (parsedUrl.query.key !== JOIN_CODE) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Wrong register \'key\'"}');
			return;
		}

		var url = parsedUrl.query.url;
		if (!url) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No url provided"}');
			return;
		}

		var id = servers.add(url);
		
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"success": "Registered", "id": "' + id + '"}');

		console.log("[REGISTERED]", id, url)
		return;
	}

	if (parsedUrl.pathname == "/getserver") {
		var room = parsedUrl.query.room;

		if (!room) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "You did not provid the requierd room query"}');
			return;
		}

		var server = servers.getServerFromRoom(room);
		if (!server) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No server available!"}');
			return;
		}
	
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"server": "' + server.url + '"}');
		return;
	}

	if (parsedUrl.pathname == "/getrooms") {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"rooms": "' + JSON.stringify(servers.getRooms()) + '"}');
		return;
	}

	if (parsedUrl.pathname == "/update") {
		var id = parsedUrl.query.id;

		try {
			var rooms = JSON.parse(parsedUrl.query.rooms);
		} catch (e) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Rooms was not valid JSON!"}');
			return;
		}

		if (!servers.setLoad(id, rooms)) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No server with this id"}');
			return;
		}

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"success": "Player count updated"}');
		return;
	}

	if (parsedUrl.pathname == "/status") {
		var pass = parsedUrl.query.pass;
		if (pass !== "jafiwef24fj23") {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"servers": ' + JSON.stringify(servers.servers) + '}');
		return;
	}

	console.log("[URL REQUEST UNKOWN] ", req.connection.remoteAddress, parsedUrl);	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('{"error": "Unknown command"}');
}.bind(this)).listen(3552);