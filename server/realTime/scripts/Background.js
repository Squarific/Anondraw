var http = require("http");

function Background (server, drawcode) {
	this.server = server;
	this.drawcode = drawcode;
}

Background.prototype.sendDrawings = function (room, drawings, callback) {
	var req = http.request({
		hostname: this.server,
		port: 5552,
		method: "POST",
		path: "/drawings?drawcode=" + encodeURIComponent(this.drawcode) + "&room=" + encodeURIComponent(room)
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