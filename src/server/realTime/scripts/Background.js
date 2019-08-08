var config = require("../../common/config.js");
var https = require("https");

function Background (server, httpListenServer, drawcode) {
	this.server = server;
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
};

module.exports = Background;
