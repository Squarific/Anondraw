var names = require("./names.js");

function Protocol (io, drawtogether, imgur) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.bindIO();
	setInterval(this.updateInk.bind(this),  30 * 1000);
	setInterval(this.updateAllPlayerLists.bind(this), 10 * 60 * 1000);
}

Protocol.prototype.sendChatMessage = function sendChatMessage (room, data) {
	console.log("[CHAT][" + room + "] " + data.user + ": " + data.message);
	this.io.to(room).emit("chatmessage", data);
	this.drawTogether.addChatMessage(room, data);
};

Protocol.prototype.sendDrawing = function sendDrawing (room, drawing) {
	this.io.to(room).emit("drawing", {drawing: drawing});
};

Protocol.prototype.getUserCount = function getUserCount (room) {
	return Object.keys(this.io.nsps['/'].adapter.rooms[room] || {}).length;
};

Protocol.prototype.updateInk = function updateInk () {
	var amount = 3000;
	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		var ip = this.io.sockets.sockets[sKey].ip;
		this.drawTogether.raiseInkFromIp(amount, ip, function (err) {
			if (err)
				console.log("[UPDATEINK][ERROR]", err);
		});
	}
	this.io.emit("changeink", amount);
};

Protocol.prototype.getPlayerNameList = function getPlayerNameList (room) {
	var players = [];
	var room = this.io.nsps['/'].adapter.rooms[room];

	for (var id in room) {
		players.push({
			id: id,
			name: this.socketFromId(id).username
		});
	}

	return players;
};

Protocol.prototype.updateAllPlayerLists = function updateAllPlayerLists () {
	var roomsDone = {};
	for (var sKey = 0; sKey < this.io.sockets.sockets.length; sKey++) {
		var room = this.io.sockets.sockets[sKey].room;
		if (!roomsDone[room]) {
			this.io.to(room).emit("playerlist", this.getPlayerNameList(room));
		}
	}
};

Protocol.prototype.socketFromId = function socketFromId (id) {
	return this.io.nsps['/'].connected[id];
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;
	var manualIpBanList = ["86.24.220.131", "79.141.162.19", "62.210.94.133", "69.158.148.224"];
	// Banned people: First two ips: Guy called himself "SERVER", annoying person, draws big brushes over others to grief
	// Next two: Drew big red swastikas
	this.io.on("connection", function (socket) {
		// Give the user a name and send it to the client, then bind
		// all events so we can answer the client when it asks something

		socket.ip = socket.client.conn.remoteAddress;
		if (!socket.ip) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "No ip found!"
			});
			socket.disconnect();
		}

		if (manualIpBanList.indexOf(socket.ip) !== -1) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "You have been banned."
			});
			socket.disconnect();
		}

		socket.username = names[Math.floor(Math.random() * names.length)] + " " + names[Math.floor(Math.random() * names.length)];
		socket.emit("initname", socket.username);

		console.log("[CONNECTION] " + socket.ip);

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
			if (Date.now() - socket.lastImgurUpload < 2000) {
				return;
			}
			socket.lastImgurUpload = Date.now();
			console.log("Imgur upload request from " + socket.ip);

			callback = callback || function () {};
			protocol.imgur.uploadBase64(base64)
			.then(function (json) {
				console.log("[IMAGE UPLOAD] " + socket.ip + " " + json.data.link);
				callback({
					url: json.data.link
				});
			})
			.catch(function (err) {
				console.error("[IMAGE UPLOAD][ERROR] " + socket.ip + " " + err.message);
				callback({
					error: "Something went wrong while trying to upload the file to imgur."
				});
			});
		});

		socket.on("login", function (data, callback) {
			if (typeof callback !== "function")
				callback = function () {}

			protocol.drawTogether.login(data, function (err, success) {
				if (err) {
					callback({error: "Some error occured! [Login Check Error]"});
					console.log("[LOGIN][ERROR] ", err);
					return;
				}

				if (!success) {
					protocol.drawTogether.accountExists(data.email, function (err, exists) {
						if (err) {
							callback({error: "Some error occured! [Login Exists Error]"});
							console.log("[LOGIN][ERROREXISTS] ", err);
							return;
						}

						if (!exists) {
							callback({register: true});
						} else {
							callback({error: "Wrong password!"});
						}
					});
					return;
				}

				callback({success: success});
			});
		})

		socket.on("register", function (data, callback) {
			if (typeof callback !== "function")
				callback = function () {}
			drawTogether.register(data, function (err) {
				if (err) {
					console.log("[REGISTER][ERROR]", err);
					return;
				}
			})
		})

		socket.on("changename", function (name) {
			// Change the username
			if (name == "S᠎ERVER") {
				manualIpBanList.push(socket.ip);
				console.log("Server guy banned, ip: " + socket.ip);
				socket.disconnect();
			}

			name.replace(/[^\x00-\x7F]/g, "");
			if (name.length > 32)
				name = name.substr(0, 32);

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

			protocol.io.to(socket.room).emit("playernamechange", {
				id: socket.id,
				oldname: socket.username,
				newname: name
			});

			socket.username = name;
			socket.lastNameChange = Date.now();
		})

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the reast of the people in the room

			if (typeof callback !== "function")
				callback = function () {};

			protocol.drawTogether.getInkFromIp(socket.ip, function (err, amount) {
				if (err) {
					console.error("[DRAWING][GETINKERROR]", err);
					return;
				}
				if (amount < 0) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: "NO INK"
					});
					socket.emit("setink", amount);
					callback();
					return;
				}
				protocol.drawTogether.addDrawing(socket.room, drawing, function (err) {
					if (!err) {
						protocol.drawTogether.lowerInkFromIp(drawing, socket.ip, function (err) {
							if (err)
								console.log("[DRAWING][INKERROR]", err);
						});
						protocol.sendDrawing(socket.room, drawing);
					} else {
						socket.emit("chatmessage", {
							user: "SERVER",
							message: err
						});
					}

					callback();
				});
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

			protocol.io.to(socket.room).emit("join", {
				id: socket.id,
				name: socket.username
			});
			
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

				socket.emit("playerlist", protocol.getPlayerNameList(socket.room));
			});

			protocol.drawTogether.getInkFromIp(socket.ip, function (err, amount) {
				socket.emit("setink", amount);
			});

			callback(true);
		});

		socket.on("disconnect", function () {
			protocol.io.to(socket.room).emit("leave", { id: socket.id });
		});
	});
};

module.exports = Protocol;