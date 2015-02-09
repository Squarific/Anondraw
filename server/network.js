var names = require("./names.js");

function Protocol (io, drawtogether, imgur) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.bindIO();
}

Protocol.prototype.sendChatMessage = function sendChatMessage (room, data) {
	console.log("[CHAT][" + room + "] " + data.user + ": " + data.message);
	this.io.to(room).emit("chatmessage", data);
	this.drawTogether.addChatMessage(room, data);
};

Protocol.prototype.sendDrawing = function sendDrawing (room, drawing) {
	this.io.to(room).emit("drawing", drawing);
};

Protocol.prototype.getUserCount = function getUserCount (room) {
	return Object.keys(this.io.nsps['/'].adapter.rooms[room] || {}).length;
};

Protocol.prototype.getPlayerNameList = function getPlayerNameList (room) {
	var players = [];
	var room = this.io.nsps['/'].adapter.rooms[room];
	for (var id in room) {
		players.push(this.socketFromId(id).username);
	}
	return players;
};

Protocol.prototype.socketFromId = function socketFromId (id) {
	return this.io.nsps['/'].connected[id];
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;

	this.io.on("connection", function (socket) {
		// Give the user a name and send it to the client, then bind
		// all events so we can answer the client when it asks something

		socket.username = names[Math.floor(Math.random() * names.length)] + " " + names[Math.floor(Math.random() * names.length)];
		socket.emit("initname", socket.username);

		console.log("[CONNECTION] " + socket.request.connection.remoteAddress);

		socket.on("chatmessage", function (message) {
			// User is trying to send a message, if he is in a room
			// send the message to all other users, otherwise show an error

			if (!message) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: message
				});
				return;
			}

			if (!socket.room) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can't chat when not in room."
				});
				return;
			}

			if (Date.now() - socket.lastMessage < 1000) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Don't send messages too fast!."
				});
				return;
			}

			socket.lastMessage = Date.now()

			protocol.sendChatMessage(socket.room ,{
				user: socket.username,
				message: message
			});
		});

		socket.on("uploadimage", function (base64, callback) {
			callback = callback || function () {};
			protocol.imgur.uploadBase64(base64)
			.then(function (json) {
				console.log("[IMAGE UPLOAD] " + socket.request.connection.remoteAddress + " " + json.data.link);
				callback({
					url: json.data.link
				});
			})
			.catch(function (err) {
				console.error("[IMAGE UPLOAD][ERROR] " + socket.request.connection.remoteAddress + " " + err.message);
				callback({
					error: "Something went wrong while trying to upload the file to imgur."
				});
			});
		});

		socket.on("changename", function (name) {
			// Change the username
			name.replace(/[^\x00-\x7F]/g, "");
			if (name.toLowerCase().indexOf("server") !== -1) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Don't steal my name!"
				});
				return;
			}

			if (Date.now() - socket.lastNameChange < 1000) {
				socket.emit("chatemessage", {
					user: "SERVER",
					message: "Don't change your name so often!"
				});
				return;
			}

			console.log("[NAME CHANGE] " + socket.username + " to " + name);
			protocol.sendChatMessage(socket.room, {
				user: "SERVER",
				message: socket.username + " changed name to " + name
			})
			socket.username = name;
			socket.lastNameChange = Date.now();
		})

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the reast of the people in the room

			if (typeof callback !== "function")
				callback = function () {};

			protocol.drawTogether.addDrawing(socket.room, drawing, function (err) {
				if (!err) {
					protocol.sendDrawing(socket.room, drawing);
				} else {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					});
				}

				callback();
			});
		})

		socket.on("changeroom", function (room, callback) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.
			callback = callback || function () {};

			if (protocol.getUserCount(room) >= 30 && socket.username !== "UberLord") {
				socket.emit("chatmesage", {
					user: "SERVER",
					message: "Can't join room " + room + " too many users!"
				});
				callback(false);
				return;
			}

			console.log("[ROOM CHANGE] " + socket.username + " changed from " + socket.room + " to " + room + " there are now " + protocol.getUserCount(room) + " people here.");

			socket.leave(socket.room);
			socket.join(room);
			socket.room = room;

			socket.emit("chatmessage", {
				user: "SERVER",
				message: "Changed room to " + room + ", loading drawings..."
			});

			protocol.drawTogether.getDrawings(room, function (err, drawings) {
				if (err) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					});
					drawings = [];
				}

				socket.emit("drawings", {
					room: socket.room,
					drawings: drawings
				});

				protocol.sendChatMessage(socket.room, {
					user: "SERVER",
					message: socket.username + " joined " + socket.room + " there are now " + protocol.getUserCount(room) + " people here."
				});

				socket.emit("playerlist", protocol.getPlayerNameList(socket.room));
			});

			callback(true);
		});

		socket.on("disconnect", function () {
			protocol.sendChatMessage(socket.room, {
				user: "SERVER",
				message: socket.username + " disconnected."
			});
		});
	});
};

module.exports = Protocol;