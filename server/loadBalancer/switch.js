var http = require("http");
var urlParser = require("url");
var JOIN_CODE = require("./join_code_password.js");
var statuscode = require("./status_password.js");
var room_regex = /^[a-z0-9_]+$/i;

var Servers = require("./scripts/Servers.js");
var servers = new Servers(JOIN_CODE);

var MAX_USERS_PER_ROOM = 24;

var server = http.createServer(function (req, res) {
	var parsedUrl = urlParser.parse(req.url, true);

	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json"
	});

	if (parsedUrl.pathname == "/register") {
		if (parsedUrl.query.key !== JOIN_CODE) {
			res.end('{"error": "Wrong register \'key\'"}');
			return;
		}

		var url = parsedUrl.query.url;
		if (!url) {
			res.end('{"error": "No url provided"}');
			return;
		}

		var id = servers.add(url);
		res.end('{"success": "Registered", "id": "' + id + '"}');
		console.log("[REGISTERED]", id, url)
		return;
	}

	if (parsedUrl.pathname == "/getserver") {
		var room = parsedUrl.query.room;

		if (!room) {
			res.end('{"error": "You did not provid the requierd room query"}');
			return;
		}

		if (!room_regex.test(room)) {
			res.end('{"error": "Room names should only contain lowercase letters, numbers and _"}');
			return;
		}

		var server = servers.getServerFromRoom(room);
		if (!server) {
			res.end('{"error": "No server available!"}');
			return;
		}

		if (server.rooms[room] > MAX_USERS_PER_ROOM) {
			res.end('{"error": "Too many users"}');
			return;
		}
	
		res.end('{"server": "' + server.url + '"}');
		return;
	}

	if (parsedUrl.pathname == "/isourroom") {
		var room = parsedUrl.query.room;
		var id = parsedUrl.query.id;

		var server = servers.getServerFromRoom(room);
		if (!server) {
			res.end('{"error": "No server found"}');
			return;
		}

		if (server.id == id) {
			res.end('{"isours": true}');
			return;
		}

		res.end('{"isours": false}');
		return;
	}

	if (parsedUrl.pathname == "/getrooms") {
		var rooms = servers.getRooms();

		rooms.main = rooms.main || 0;
		rooms.member_main = rooms.member_main || 0;

		res.end('{"rooms": ' + JSON.stringify(rooms) + '}');
		return;
	}

	if (parsedUrl.pathname == "/update") {
		var id = parsedUrl.query.id;

		try {
			var rooms = JSON.parse(parsedUrl.query.rooms);
		} catch (e) {
			res.end('{"error": "Rooms was not valid JSON!"}');
			return;
		}

		if (!servers.setLoad(id, rooms)) {
			res.end('{"error": "No server with this id"}');
			return;
		}

		res.end('{"success": "Player count updated"}');
		return;
	}

	if (parsedUrl.pathname == "/status") {
		var pass = parsedUrl.query.pass;
		if (pass !== statuscode) {
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.end('{"servers": ' + JSON.stringify(servers.servers) + '}');
		return;
	}

	console.log("[URL REQUEST UNKOWN] ", req.connection.remoteAddress, parsedUrl);	
	res.end('{"error": "Unknown command"}');
}).listen(3552);