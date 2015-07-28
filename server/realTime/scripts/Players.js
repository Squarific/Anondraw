var http = require("http");
var querystring = require("querystring");
var kickbancode = require("./kickban_password.js");

function Players (server) {
	this.server = server;
}

Players.prototype._kickban = function _kickban (options, callback) {
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/kickban?" + options
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				callback(data.error);
				return;
			}

			callback(null);
		});
	});

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
};

// Kickban the given uKey
// callback()
Players.prototype.kickbanAccount = function kickbanAccount (target, by, minutes, reason, callback) {
	var options = querystring.stringify({
		target: target,
		by: by,
		minutes: minutes,
		reason: reason,
		kickbancode: kickbancode
	});

	this._kickban(options, callback);	
};

// Kickban the given ip
// callback()
Players.prototype.kickbanIp = function kickbanAccount (target, by, minutes, reason, callback) {
	var options = querystring.stringify({
		ip: target,
		by: by,
		minutes: minutes,
		reason: reason,
		kickbancode: kickbancode
	});

	this._kickban(options, callback);	
};

// Callback (err, banned, till)
Players.prototype.isBanned = function isBanned (ip, callback) {
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/isbanned?ip=" + encodeURIComponent(ip)
	}, function (res) {
		res.on("data", function (chunk) {
			data = JSON.parse(chunk);

			if (data.error) {
				callback(data.error);
				return;
			}

			if (data.info)
				callback(null, data.banned, data.info.enddate, data.info.reason);
			else
				callback(null, data.banned);
		});
	});

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
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

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
}

Players.prototype.giveReputation = function giveReputation (fromUkey, toUkey, callback) {
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/givereputation?uKey=" + encodeURIComponent(fromUkey) + "&uKeyTo=" + encodeURIComponent(toUkey)
	}, function (res) {
		res.on("data", function (chunk) {
			callback(JSON.parse(chunk).error);
		});
	});

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
}

module.exports = Players;