function Network (mainServer) {
	this.mainServer = mainServer;
	this.socket;
	this.oldSockets = {};

	this.callbacks = {};
}

// LoadRoom
// Params:

// room: string
// Name of the room you want to join

// callback: function (err, drawings)
// Function that gets an err: string and
// drawings: [drawingObject, ...]

Network.prototype.loadRoom = function loadRoom (room, callback) {
	this.getServerFromRoom(room, function (err, server) {
		if (err) {
			callback(err);
			return;
		}

		// Change to the server
		console.log("Room '" + room + "' is on server: " + server);
		this.changeServer(server, function (err) {
			if (err) {
				callback(err);
			}

			// Change our room
			this.socket.emit("changeroom", room, callback);
		}.bind(this));
	}.bind(this));
};

Network.prototype.getRooms = function getRooms (callback) {
	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);
			callback(null, data.rooms);
		} else if (req.readyState == 4) {
			callback("There was an error trying to find a server to play on. Are you connected to the internet? Status code: " + req.status);
		}
	});

	req.open("GET", this.mainServer + "/getrooms");
	req.send();
};

Network.prototype.getServerFromRoom = function getServerFromRoom (room, callback) {
	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback("There was an error trying to find a server to play on. Server response: " + data.error)						
				return;
			}

			callback(null, data.server);
			
		} else if (req.readyState == 4) {
			callback("There was an error trying to find a server to play on. Are you connected to the internet? Status code: " + req.status);
		}
	});

	req.open("GET", this.mainServer + "/getserver?room=" + encodeURIComponent(room));
	req.send();
};

// If we are not connected to the given server, change our socket
Network.prototype.changeServer = function changeServer (server, callback) {
	if (server.indexOf("http://") == -1) server = "http://" + server;

	// If the current socket is to the right server, just callback
	if (this.socket && this.socket.io.uri == server) {
		callback();
		return;
	}

	// We are on another server, disconnect
	if (this.socket) {
		this.socket.disconnect();
	}

	this.socket = io(server, { transports: ['websocket'], forceNew: true });
	this.reBindHandlers();
	callback();
};

// Register an event
Network.prototype.on = function on (name, callback) {
	this.callbacks[name] = this.callbacks[name] || [];

	// The callback is already registered
	if (this.callbacks[name].indexOf(callback) !== -1) return;
	this.callbacks[name].push(callback);

	// Bind the callback on our socket if it exists
	this.socket && this.socket.on(name, callback);
};

// Bind the handlers on our socket
Network.prototype.reBindHandlers = function reBindHandlers () {
	// Only do this once per socket
	if (!this.socket || this.socket.DT_handlersBound) return;

	// Bind the handlers on our socket
	for (var name in this.callbacks)
		for (var k = 0; k < this.callbacks[name].length; k++)
			this.socket.on(name, this.callbacks[name][k]);

	this.socket.DT_handlersBound = true;
};