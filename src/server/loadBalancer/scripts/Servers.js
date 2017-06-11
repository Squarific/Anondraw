var http = require("http");
var url = require('url');
var TIMEOUT = 140 * 1000;
var MAX_GAME_MEMBERS = 8;

// Rebalance when the most loaded has this
// much more load than the least loaded
// 400 = one room of 20 people or about 8 rooms of one person
var REBALANCE_LOAD = 400;
var CHECK_REBALANCE_EVERY = 40 * 1000; //ms

function randomString (length) {
	var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
	var string = "";

	for (var k = 0; k < length; k++)
		string += chars[Math.floor(Math.random() * chars.length)];

	return string;
}

function Servers (code) {
	this.code = code;
	this.servers = [];
	setInterval(this.clean.bind(this), TIMEOUT);
	setInterval(this.rebalance.bind(this), CHECK_REBALANCE_EVERY);
}

Servers.prototype.getRooms = function getRooms () {
	var rooms = {};
	for (var k = 0; k < this.servers.length; k++) {
		for (var name in this.servers[k].rooms) {
			// Don't return private rooms
			if (name.indexOf("private_") == 0) continue;

			rooms[name] = rooms[name] || 0;
			rooms[name] += this.servers[k].rooms[name];
		}
	}
	return rooms;
};

Servers.prototype.getServer = function getServer (field, value) {
	for (var k = 0; k < this.servers.length; k++) {
		if (this.servers[k][field] == value)
			return this.servers[k];
	}

	return null;
};

// Finds a free public gameroom or if none found creates one
// Returns {server: "url", room: "name"}, serverurl can also be null
Servers.prototype.getFreePublicGameRoom = function getFreePublicGameRoom () {
	for (var k = 0; k < this.servers.length; k++) {
		for (var name in this.servers[k].rooms) {
			// Discards none game_ rooms and private_game_ rooms
			if (name.indexOf("game_") !== 0) continue;
			if (this.servers[k].rooms[name] >= MAX_GAME_MEMBERS) continue;
			return {
				room: name,
				server: this.servers[k]
			};
		}
	}

	var room = "game_" + randomString(6);
	return {
		room: room,
		server: this.getServerFromRoom(room)
	};
};

// This function returns an array of all servers that
// claim to have the given room
Servers.prototype.getServersFromRoom = function getServersFromRoom (room) {
	var servers = [];

	for (var k = 0; k < this.servers.length; k++) {
		if (typeof this.servers[k].rooms[room] == "number") {
			servers.push(this.servers[k]);
		}
	}

	return servers;
};

// Get the server that should be used for this room
// Returns the server with the room or the least loaded
// If multiple servers have the room, cleans up and returns the real server
// If no servers available returns null
Servers.prototype.getServerFromRoom = function getServerFromRoom (room) {
	// Get all servers that have this room
	var servers = this.getServersFromRoom(room);

	// If no server has this room, just return the least loaded
	if (servers.length == 0) {
		var target = this.getLeastLoad();
		if (!target) return target;

		// Reserve this server so if someone asks again and noone has connected yet
		// and the loads have been changed then we still give back this one
		target.rooms[room] = 0;

		return target;
	}
	
	if (servers.length == 1) return servers[0];

	// Multiple servers have this room, should not happen
	// but if it does we need to take care of it
	console.log("[GETSERVER][MULITPLE ROOMS]", room, servers);
	return this.retargetRoom(room);
};

// Removes the room from all servers and moves it to the least loaded
// Returns the server that the room will be moved to, null if not enough servers
Servers.prototype.retargetRoom = function retargetRoom (room) {
	var target = this.getLeastLoad();
	var servers = this.getServersFromRoom(room);

	var key = servers.indexOf(target);
	if (key !== -1)
		servers.splice(key, 1);

	this.sendCloseRoom(servers, room);
	target.rooms[room] = 0;
	return target;
};

Servers.prototype.sendCloseRoom = function sendCloseRoom (servers, room) {
	for (var k = 0; k < servers.length; k++) {
		this.sendCloseRoomServer(servers[k], room);
	}
};

Servers.prototype.sendCloseRoomServer = function sendCloseRoomServer (server, room) {
	if (server.url.indexOf("http") == -1) server.url = "http://" + server.url;
	var parsedUrl = url.parse(server.url);

	var req = http.request({
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		method: "GET",
		path: "/closeroom?room=" + encodeURIComponent(room) + "&code=" + encodeURIComponent(this.code)
	}, function (res) {
		res.on("data", function (chunk) {
			try {
				data = JSON.parse(chunk);	
			} catch (e) {
				data = {};
				data.error = "FAILED TO PARSE JSON. RESPONSE WAS: " + chunk;
			}

			if (data.error) {
				console.log("[CLOSEROOM][SERVER ERROR]", data.error);
				return;
			}

			console.log("[CLOSEROOM] " + server.url + " was made to close room " + room);
		});
	});
	req.end();

	server.load -= server.rooms[room] * server.rooms[room] + 50;
	delete server.rooms[room];
};

// Removes all servers that have timed out
Servers.prototype.clean = function clean () {
	for (var k = 0; k < this.servers.length; k++) {
		if (Date.now() - this.servers[k].lastUpdate > TIMEOUT) {
			this.servers.splice(k, 1);
			k--;
		}
		if (servers[k].url.indexOf("http://") == 0) {
			var url = servers[k].url.slice(7); // slice out 'http://'
			this.servers.splice(k, 1);
			var id = this.add(url);
			k--;
			console.log("[REMOVEDHTTP]", id, url);
		}
	}
};

Servers.prototype.rebalance = function rebalance () {
	var least = this.getLeastLoad();
	var most = this.getMostLoad();

	// Not enough servers
	if (!least || !most || least == most) return;

	// If the load of the most loaded server is bigger
	// than twice the least one, we should rebalance
	if (most.load > least.load + REBALANCE_LOAD) {
		// Find the room on the most loaded with the biggest load such that
		// placing it on the least loaded does not make the least loaded
		// the most loaded
		var currentTargetRoom;
		var maxTargetLoad = Math.floor((most.load - least.load) / 2); // Give some wiggle room

		for (var name in most.rooms) {
			if (most.rooms[name] * most.rooms[name] + 50 < maxTargetLoad &&
				(!currentTargetRoom || most.rooms[name].load > most.rooms[currentTargetRoom].load)) {
				currentTargetRoom = name;
			}
		}

		console.log("Unbalanced, retargeting room ", currentTargetRoom);
		this.retargetRoom(currentTargetRoom);
	}
};

// Set the load for the given server using the usercount in all rooms
// Load gets calculated by a fixed cost per room and a quadratic cost per players in the rooms
// Returns true if the load has been set, false if there is no server with this id
Servers.prototype.setLoad = function (id, rooms) {
	var server = this.getServer("id", id);
	if (!server) return false;

	server.rooms = rooms
	server.lastUpdate = Date.now();

	server.load = 0;
	for (var name in rooms) {
		server.load += 50;
		server.load += rooms[name] * rooms[name];
	}

	return true;
};

// Returns the server with the lowest load
// returns null if no servers available
Servers.prototype.getLeastLoad = function getLeastLoad () {
	if (this.servers.length < 1) return null;

	var lowestKey = 0;

	for (var k = 1; k < this.servers.length; k++) {
		if (this.servers[k].load < this.servers[lowestKey].load)
			lowestKey = k;
	}

	return this.servers[lowestKey];
};

// Returns the server with the highest load
// returns null if no servers available
Servers.prototype.getMostLoad = function getMostLoad () {
	if (this.servers.length < 1) return null;

	var highestKey = 0;

	for (var k = 1; k < this.servers.length; k++) {
		if (this.servers[k].load > this.servers[highestKey].load)
			highestKey = k;
	}

	return this.servers[highestKey];
};

// Adds the server to the list and returns the id
Servers.prototype.add = function add (url) {
	var server = this.getServer("url", url);

	// If the server is already in our list, reset the load and rooms
	if (server) {
		server.load = 0;
		server.rooms = {};
		server.lastUpdate = Date.now();
		return server.id;
	}

	var id = randomString(32);
	this.servers.push({
		id: id,
		url: url,
		lastUpdate: Date.now(),
		rooms: {},
		load: 0
	});

	return id;
};

module.exports = Servers;