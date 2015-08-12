var getIp = require('external-ip')();
var http = require('http');
var urlParse = require("url");

function Register (server, key, io, port, listenServer) {
	this.server = server;
	this.listenServer = listenServer;

	this.key = key;
	this.port = port;
	this.io = io;

	this.updateInterval;

	if (server == "localhost") {
		this.ip = "localhost";
		this.register();
	} else {
		getIp(function (err, ip) {
			if (err) throw err;

			console.log("[STARTUP] Our ip is ", ip);
			this.ip = ip;
			this.register();
		}.bind(this));
	}

	this.listenServer.addListener("request", function (req, res) {
		var parsedUrl = urlParse.parse(req.url, true);

		res.writeHead(200, {
			"Access-Control-Allow-Origin": "*",
			"Content-Type": "application/json"
		});

		if (parsedUrl.pathname == "/closeroom") {
			var code = parsedUrl.query.code;
			var room = parsedUrl.query.room;

			if (code !== this.key) {
				res.end('{"error": "Invalid key"}');
				return;
			}

			var sRoom = this.io.nsps['/'].adapter.rooms[room];
			for (var id in sRoom) {
				this.io.nsps['/'].connected[id].disconnect();
			}
			
			res.end('{"success": "Disconnected all clients in room ' + room + '"}');
		}
	}.bind(this));
}

Register.prototype.isOurs = function isOurs (room, callback) {
	var req = http.request({
		hostname: this.server,
		port: 3552,
		method: "GET",
		path: "/isourroom?room=" + encodeURIComponent(room) + "&id=" + encodeURIComponent(this.id)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);
			if (data.error) {
				callback(data.error);
				return;
			}

			callback(null, data.isours);
		}.bind(this));
	}.bind(this));

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
};

Register.prototype.register = function register () {
	var req = http.request({
		hostname: this.server,
		port: 3552,
		method: "GET",
		path: "/register?key=" + encodeURIComponent(this.key) + "&url=" + encodeURIComponent(this.ip + ":" + this.port)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);
			if (data.error) {
				// If we can't register there is no point in staying online
				throw data.error;
			}

			console.log("[REGISTER] Our id is ", data.id);
			this.id = data.id;

			clearInterval(this.updateInterval);
			this.updateInterval = setInterval(this.updatePlayerCount.bind(this), 120 * 1000);
		}.bind(this));
	}.bind(this));

	req.on("error", function (e) {
		throw e.message;
	});

	req.end();
};

Register.prototype.updatePlayerCount = function updatePlayerCount () {
	var rooms = {};

	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		var socket = this.io.sockets.sockets[sKey];
		if (rooms[socket.room] || !socket.room) continue;

		rooms[socket.room] = Object.keys(this.io.nsps['/'].adapter.rooms[socket.room] || {}).length;
	}

	var req = http.request({
		hostname: this.server,
		port: 3552,
		method: "GET",
		path: "/update?id=" + encodeURIComponent(this.id) + "&rooms=" + JSON.stringify(rooms)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				console.log("[PLAYERUPDATECOUNT][ERROR]", data.error);
				console.log("Registering again...");
				this.register();
			}
		}.bind(this));
	}.bind(this));

	req.on("error", function (e) {
		console.log("Couldn't update player count " + e.message);
	});

	req.end();
};

module.exports = Register;