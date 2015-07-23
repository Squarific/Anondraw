var http = require("http");
var JOIN_CODE = require("join_code_password.js");

var Servers = require("./scripts/Servers.js");
var servers = new Servers();

var server = http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);

	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Content-Type", "application/json");

	if (parsedUrl.pathname == "/register") {
		if (parsedUrl.query.key !== JOIN_CODE) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Wrong register key"}');
			return;
		}

		var ip = parsedUrl.query.ip;
		var port = parsedUrl.query.port;
		var url = ip + ":" + port;

		if (!ip || !port) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No ip or port provided"}');
			return;
		}

		var id = servers.add(url);
		
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"success": "Registered", "id": "' + id + '"}');

		console.log("[REGISTERED]", id, url)
		return;
	}

	if (parsedUrl.pathname == "/getserver") {
		var mostKey = -1;
		var mostPlayers = -1;
		for (var k = 0; k < servers.length; k++) {
			if (Date.now() - servers[k].lastUpdate > TIMEOUT_MS) continue;
			if (servers[k].userCount > mostPlayers && servers[k].userCount <= MAX_PER_SERVER) {
				mostKey = k;
				mostPlayers = servers[k].userCount;
			}
		}

		if (mostKey == -1) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No server available!"}');
			return;
		}
	
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"server": "' + servers[mostKey].url + '"}');
		return;
	}

	if (parsedUrl.pathname == "/update") {
		var id = parsedUrl.query.id;
		var key = getServerKeyByProp("id", id);

		if (key == -1) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No server with this id"}');
			return;
		}

		try {
			var rooms = JSON.parse(parsedUrl.query.rooms);
			servers.setLoad(id, rooms);
		} catch (e) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Error while trying to set load, maybe invalide rooms json?"}');
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
		res.end('{"servers": ' + JSON.stringify(servers) + '}');
		return;
	}

	console.log(req.connection.remoteAddress);
	console.log("[URL REQUEST UNKOWN] ", parsedUrl);
	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('{"error": "Unknown command"}');
}.bind(this)).listen(3252);