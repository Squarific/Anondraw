var http = require("http");
var querystring = require("querystring");
var kickbancode = require("./kickban_password.js");

function Players (server) {
	this.server = server;
}

// Kickban the given uKey
// callback()
Players.prototype.kickbanAccount = function kickbanAccount (target, by, minutes, reason, callback) {
	this.request("kickban", {
		target: target,
		by: by,
		minutes: minutes,
		reason: reason,
		kickbancode: kickbancode
	}, callback);
};

// Kickban the given ip
// callback()
Players.prototype.kickbanIp = function kickbanAccount (target, by, minutes, reason, callback) {
	this.request("kickban", {
		ip: target,
		by: by,
		minutes: minutes,
		reason: reason,
		kickbancode: kickbancode
	}, callback);
};

// Callback (err, banned, till)
Players.prototype.isBanned = function isBanned (ip, callback) {
	this.request("isbanned", {
		ip: ip
	}, callback);
};

Players.prototype.getReputationFromUKey = function getReputationFromUKey (uKey, callback) {
	this.request("getreputation", {
		uKey: uKey
	}, callback);
};

Players.prototype.giveReputation = function giveReputation (fromUkey, toUkey, callback) {
	this.requet("givereputation", {
		uKey: fromUkey,
		uKeyTo: toUkey
	}, callback);
};

Player.prototype.setName = function setName (uKey, name, callback) {
	this.request("setname", {
		uKey: uKey,
		name: name
	}, callback);
};

Player.prototype.request = function request (method, urlArguments, callback) {
	typeof callback !== "function" && callback = function () {};
	
	var req = http.request({
		hostname: this.server,
		port: 4552,
		method: "GET",
		path: "/" + encodeURIComponent(method) + "?" + querystring.stringify(urlArguments)
	}, function (res) {
		var data = "";
		res.on("data", function (chunk) {
			data += chunk;
		});

		res.on("done", function () {
			var parsed = JSON.parse(data);
			callback(parsed.error, parsed);
		})
	});

	req.on("error", function (e) {
		callback(e.message);
	});

	req.end();
};

module.exports = Players;