var http = require("http");
var urlParser = require("url");
var JOIN_CODE = require("./join_code_password.js");
var statuscode = require("./status_password.js");
var room_regex = /^[a-z0-9_]+$/i;

var Servers = require("./scripts/Servers.js");
var servers = new Servers(JOIN_CODE);

// This is the amount of people the autobalancer uses
// for the first joined room
var MAX_USERS_PER_ROOM = 15;

// How many people are allowed to really join when they ask for a specific room
var MAX_USERS_PER_ROOM_IF_SPECIFIC = 24;

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

		// This one means we wanted this room
		// Be a bit more lenient about the amount of people allowed
		var specificOverride = parsedUrl.query.specificoverride;

		var maxOverride = parsedUrl.query.maxoverride; // This one can be forced

		if (!room) {
			res.end('{"error": "You did not provide the required room query"}');
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

		if (server.rooms[room] > MAX_USERS_PER_ROOM && !maxOverride && !specificOverride) {
			res.end('{"error": "Too many users"}');
			return;
		}

		if (server.rooms[room] > MAX_USERS_PER_ROOM_IF_SPECIFIC && !maxOverride) {
			res.end('{"error": "Too many users in this room"}');
			return;
		}
	
		res.end('{"server": "' + server.url + '"}');
		return;
	}

	if (parsedUrl.pathname == "/getgameroom") {
		var maxOverride = parsedUrl.query.maxoverride;
		var data = servers.getFreePublicGameRoom();

		if (!data.server) {
			res.end('{"error": "No server found"}');
			return;
		}

		res.end(JSON.stringify({
			room: data.room,
			server: data.server.url
		}));
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