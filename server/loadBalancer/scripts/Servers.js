var TIMEOUT = 140 * 1000;

function Servers () {
	this.servers = [];
	setInterval(this.clean, TIMEOUT);
}

Servers.prototype.getServer = function getServer (field, value) {
	for (var k = 0; k < this.servers.length; k++) {
		if (this.servers[k][field] == value)
			return this.servers[k];
	}

	return null;
};

// Removes all servers that have timed out
Servers.prototype.clean = function clean () {
	for (var k = 0; k < this.servers.length; k++) {
		if (Date.now() - this.servers[k].lastUpdate > TIMEOUT) {
			this.servers[k].splice(k, 1);
			k--;
		}
	}
};

// Set the load for the given server using the usercount in all rooms
Servers.prototype.setLoad = function (id, rooms) {
	var server = this.getServer("id", id);

	server.rooms = rooms
	server.lastUpdate = Date.now();

	server.load = 0;
	for (var name in rooms) {
		server.load += rooms[name] * rooms[name];
	}
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
		room: {},
		load: 0
	});
};

module.exports = Servers;