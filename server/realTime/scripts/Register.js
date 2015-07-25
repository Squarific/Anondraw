var getIp = require('external-ip')();
var http = require('http');

function Register (server, key, io, port) {
	this.server = server;
	this.key = key;
	this.port = port;
	this.io = io;

	this.updateInterval;

	getIp(function (err, ip) {
		if (err) throw err;

		console.log("[STARTUP] Our ip is ", ip);
		this.ip = ip;
		this.register();
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
				// If the error is that we have already registered we are gonna
				// wait for a timeout
				if (data.error.indexOf("already been registered") == -1) {
					throw data.error;
				} else{
					console.log("Already registered. Just ignoring the error.")
				}
			}

			console.log("[REGISTER] Our id is ", data.id);
			this.id = data.id;

			clearInterval(this.updateInterval);
			this.updateInterval = setInterval(this.updatePlayerCount.bind(this), 120 * 1000);
		}.bind(this));
	}.bind(this));

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

	req.end();
};

module.exports = Register;