var http = require("http");

function Players (server) {
	this.server = server;
}

// Kickban the given target (uKey or ip)
Players.prototype.kickban = function kickban (target, minutes, callback) {
	
};

// Callback (err, banned, till)
Players.prototype.isBanned = function isBanned (uKeyOrIp, callback) {
		
};

Players.prototype.getReputationFromUKey = function getReputationFromUKey (uKey, callback) {
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/getreputation?uKey=" + encodeURIComponent(uKey)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				callback(data.error, [])
				return;
			}

			callback(null, data.rep);
		});
	});

	req.end();
}

Players.prototype.giveReputation = function giveReputation (fromUkey, toUkey, callback) {
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/givereputation?uKey=" + encodeURIComponent(uKey) + "&uKeyTo=" + encodeURIComponent(toUkey)
	}, function (res) {
		res.on("data", function (chunk) {
			callback(JSON.parse(chunk));
		});
	});

	req.end();
}

module.exports = Players;