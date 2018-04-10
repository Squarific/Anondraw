var config = require("../../common/config.js");
var getIp = require('external-ip')();
var https = require('https');
var urlParse = require("url");

var options = {
  key: fs.readFileSync(config.permfolder + '/privkey.pem'),
  cert: fs.readFileSync(config.permfolder + '/cert.pem'),
  ca: fs.readFileSync(config.permfolder + '/chain.pem')
};

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
			
			ip = ip.replace(/(^\w+:|^)\/\//, '');
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
			console.log("[CLOSEROOM] Sent close room for room:", room);

			// Disconnect all clients in the room
			var sRoom = this.io.nsps['/'].adapter.rooms[room];
			for (var id in sRoom.sockets) {
				if (this.io.nsps['/'].connected[id])
					this.io.nsps['/'].connected[id].disconnect();
			}
	
			res.end('{"success": "Disconnected all clients in room ' + room + '"}');
			return;
		}
	}.bind(this));
}

Register.prototype.isOurs = function isOurs (room, callback) {
	var req = https.request({
		hostname: this.server,
		port: config.service.loadbalancer.port,
		method: "GET",
		path: "/isourroom?room=" + encodeURIComponent(room) + "&id=" + encodeURIComponent(this.id)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);
			if (data.error) {
				if (data.error.indexOf("No server") !== -1) this.register();
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
	var req = https.request({
		hostname: this.server,
		port: config.service.loadbalancer.port,
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

Register.prototype.getUserListCount = function getUserListCount (room) {
	// Returns [{
	//     id: socketid,
	//     name: username,
	//     reputation: accountrep //optional
	//     gamescore: score //Only in gamerooms
	// }, ...]
	var sroom = this.io.nsps['/'].adapter.rooms[room];
	var users = 0;

	for (var id in sroom.sockets) {
		if (!this.io.nsps['/'].connected[id]) continue;
		users++;
	}

	return users;
};

Register.prototype.updatePlayerCount = function updatePlayerCount () {
	var rooms = {};

	for (var id in this.io.sockets.sockets) {
		var socket = this.io.sockets.sockets[id];
		if (!socket.room || rooms[socket.room]) continue;
		rooms[socket.room] = this.getUserListCount(socket.room);
	}

	var req = https.request({
		hostname: this.server,
		port: config.service.loadbalancer.port,
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
