var config = require("../../common/config.js");
var https = require("https");

function Background (server, playerServer, httpListenServer, drawcode) {
	this.server = server;
	this.playerServer = playerServer;
	this.drawcode = drawcode;
	this.httpListenServer = httpListenServer;
}

Background.prototype.sendDrawings = function (room, drawings, callback) {
	var req = https.request({
		hostname: this.server,
		port: config.service.image.port,
		method: "POST",
		path: "/drawings?drawcode=" + encodeURIComponent(this.drawcode) + "&room=" + encodeURIComponent(room),
		rejectUnauthorized: this.server.indexOf('localhost') !== 0
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				callback(data.error);
				return;
			}

			callback();

		}.bind(this));
	}.bind(this));

	req.on("error", function (e) {
		callback(e);
	});

	req.write(JSON.stringify(drawings));
	req.end();
	
	this.sendHistory(room, drawings);
};

Background.prototype.createHistory = function (drawings) {
	var history = {};
	
	history[] = history[] || ;
	history[][];
	
	return history;
};

Background.prototype.sendHistory = function (room, drawings) {
	var history = this.createHistory(drawings);
	
	var req = https.request({
		hostname: this.playerServer,
		port: config.service.player.port,
		method: "POST",
		path: "/history?drawcode=" + encodeURIComponent(this.drawcode) + "&room=" + encodeURIComponent(room),
		rejectUnauthorized: this.playerServer.indexOf('localhost') !== 0
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				console.log("SENDHISTORY FAILURE", room, data.error);
				return;
			}

		}.bind(this));
	}.bind(this));

	req.on("error", function (e) {
		console.log("SENDHISTORY FAILURE", room, e);
	});

	req.write(JSON.stringify(history));
	req.end();
};

module.exports = Background;
