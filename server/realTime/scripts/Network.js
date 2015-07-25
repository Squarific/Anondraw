var names = require("./names.js");
var GameRoom = require("./GameRoom.js");
var MAX_USERS_IN_ROOM = 25;
var MAX_USERS_IN_GAMEROOM = 8;
var KICKBAN_MIN_REP = 50;                 // Reputation required to kickban
var REQUIRED_REP_DIFFERENCE = 20;         // Required reputation difference to be allowed to kickban someone

function Protocol (io, drawtogether, imgur, players, register) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.players = players;
	this.register = register;
	this.bindIO();

	this.gameRooms = {};
}

Protocol.prototype.sendChatMessage = function sendChatMessage (room, data) {
	console.log("[CHAT][" + room + "] " + data.user + ": " + data.message);
	this.io.to(room).emit("chatmessage", data);
};

Protocol.prototype.sendEmote = function sendEmote (room, data) {
	console.log("[EMOTE][" + room + "] " + data.user + " " + data.message);
	this.io.to(room).emit("emote", data);
};

Protocol.prototype.sendDrawing = function sendDrawing (room, socketid, drawing) {
	this.io.to(room).emit("drawing", {socketid: socketid, drawing: drawing});
};

Protocol.prototype.getUserCount = function getUserCount (room) {
	return Object.keys(this.io.nsps['/'].adapter.rooms[room] || {}).length;
};

Protocol.prototype.updatePlayerList = function updatePlayerList (room) {
	// Update the player list for all clients in this room
};

Protocol.prototype.informClient = function informClient (socket, message) {
	socket.emit("chatmessage", {
		user: "SERVER",
		message: message
	});
};

Protocol.prototype.getUserList = function getUserList (room) {
	// Callback gets err as first param, if success returns null
	// Second argument is array of objects of the form {
	//     id: socketid,
	//     name: username,
	//     reputation: accountrep //optional
	//     gamescore: score //Only in gamerooms
	// }
	var sroom = this.io.nsps['/'].adapter.rooms[room];
	var users = [];

	for (var id in sroom) {
		var socket = this.socketFromId(id);
		users.push({
			id: socket.id,
			name: socket.name,
			reputation: socket.reputation
		});
	}

	return users;
};

Protocol.prototype.socketFromId = function socketFromId (id) {
	return this.io.nsps['/'].connected[id];
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;
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

		protocol.players.isBanned(socket.ip, function (err, banned, time) {
			if (err) {
				console.error("Error checking if banned on connect", err);
				return;
			}

			if (banned) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You have been banned till " + time
				});
				console.log("[BANNED] " + socket.ip + " tried to join.");
				socket.disconnect();
			}
		});

		socket.name = names[Math.floor(Math.random() * names.length)] + " " + names[Math.floor(Math.random() * names.length)];
		socket.emit("initname", socket.name);

		console.log("[CONNECTION] " + socket.ip);

		socket.on("chatmessage", function (message) {
			// User is trying to send a message, if he is in a room
			// send the message to all other users, otherwise show an error

			if (!message) return;

			if (!socket.room) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can't chat when not in room."
				});
				return;
			}

			if (Date.now() - socket.lastMessage < 600) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Don't send messages too fast!."
				});
				return;
			}

			if (message[0] == "/") {
				var command = message.split(" ");

				if (message.indexOf("/me") == 0) {
					var partial = command.slice(1).join(" ");

					socket.lastMessage = Date.now();
					if (message.length > 256) return;

					protocol.sendEmote(socket.room, {
						user: socket.name,
						message: partial
					});
				} else if (message.indexOf("/help") == 0) {
					var helpText = [
						"The following commands are avaialble:",
						"/me [text] - Emote"
					];
					for (var k = 0; k < helpText.length; k++) {
						socket.emit("chatmessage", {
							user: "SERVER",
							message: helpText[k]
						});
					}
				} else {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: "Command not found!"
					})
				}

				// If the message started with a '/' don't send it to the other clients 
				return;
			}

			socket.lastMessage = Date.now();
			if (message.length > 256) return;

			protocol.sendChatMessage(socket.room ,{
				user: socket.name,
				message: message
			});

			// if (protocol.gameRooms[socket.room]) {
			// 	protocol.gameRooms[socket.room].chatmessage(socket, message);
			// }
		});

		socket.on("uploadimage", function (base64, callback) {
			if (Date.now() - socket.lastImgurUpload < 10000) {
				callback({ error: "You are uploading too quickly! Wait a few seconds."})
				return;
			}

			socket.lastImgurUpload = Date.now();
			console.log("Imgur upload request from " + socket.ip);

			callback = callback || function () {};
			protocol.imgur.uploadBase64(base64, "HwxiL5OnjizcwpD")
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

		socket.on("uKey", function (uKey) {
			socket.uKey = uKey;
			protocol.players.getReputationFromUKey(uKey, function (err, rep) {
				socket.reputation = rep;
				protocol.io.to(socket.room).emit("reputation", {
					id: targetSocket.id,
					reputation: rep
				});
			});
		});

		socket.on("upvote", function (socketid) {
			var targetSocket = protocol.socketFromId(socketid);

			if (!targetSocket) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "No user logged in with this socket id."
				});
				return;
			}

			if (!socket.uKey) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You can only give someone positive reputation when you are logged in!"
				});
				return;
			}

			if (!targetSocket.uKey) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Ugh, " + targetSocket.name + " isn't logged in!"
				});

				targetSocket.emit("chatmessage", {
					user: "SERVER",
					message: socket.name + " tried giving you positive reputation but you aren't logged in :( #sadlife"
				});

				return;
			}

			if (socket.uKey == targetSocket.uKey) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "Hey don't try cheating you sneaky bastard!"
				});
				return;
			}

			protocol.players.giveReputation(socket.uKey, targetSocket.uKey, function (err) {
				if (err) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					});
					return;
				}

				protocol.sendChatMessage(socket.room, {
					user: "SERVER",
					message: socket.name + " gave " + targetSocket.name + " positive reputation! :D"
				});
	
				protocol.players.getReputationFromUKey(targetSocket.uKey, function (err, reputation) {
					if (err) {
						console.error("[VOTE][GETREPUTATION]", err);
						return;
					}

					protocol.io.to(socket.room).emit("reputation", {
						id: targetSocket.id,
						reputation: reputation
					});
				});
			});
		});

		socket.on("changename", function (name, callback) {
			// Remove all bad characters
			name.replace(/[^\x00-\x7F]/g, "");

			if (name.length > 32)
				name = name.substr(0, 32);

			if (name.toLowerCase() == "server") {
				callback("Don't steal my name!");
				return;
			}

			if (Date.now() - socket.lastNameChange < 5000) {
				callback("You are changing your name too quickly!");
				return;
			}

			if (socket.name == name) {
				callback("That is already your name!");
				return;
			}

			console.log("[NAME CHANGE] " + socket.name + " to " + name);
			if (typeof socket.room !== "undefined") {
				protocol.sendChatMessage(socket.room, {
					user: "SERVER",
					message: socket.username + " changed name to " + name
				});
			}

			protocol.io.to(socket.room).emit("playernamechange", {
				id: socket.id,
				oldname: socket.username,
				newname: name
			});

			socket.name = name;
			socket.lastNameChange = Date.now();
		});

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the rest of the people in the room

			if (typeof callback !== "function")
				callback = function () {};

			if (!socket.room) {
				callback();
				protocol.informClient(socket, "You can't draw when not in a room!");
				return;
			}

			protocol.drawTogether.addDrawing(socket.room, drawing, function () {
				protocol.sendDrawing(socket.room, socket.id, drawing);
				callback();
			});
		});

		socket.on("changeroom", function (room, callback) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.
			// Callback (err, drawings)
			callback = callback || function () {};

			if (socket.room == room) {
				callback("You are already in room " + room + "!");
				return;
			}

			if (protocol.getUserCount(room) > MAX_USERS_IN_ROOM) {
				callback("Too many users");
				return;
			}

			// Check if this room should be on this server
			protocol.register.isOurs(room, function (err, ours) {
				if (err) {
					callback("Unknown error, try again later. (Error asking the loadbalancer if we are on the right server)");
					console.log("[JOIN][ERROR]", err);
					return;
				}

				if (!ours) {
					callback("Wrong server!");
					console.log("[JOIN] Someone tried joining a room that wasn't ours", room)
					return;
				}

				// Leave our current room
				protocol.io.to(socket.room).emit("leave", { id: socket.id });
				socket.leave(socket.room);

				// Join this room
				socket.join(room);
				socket.room = room;
				protocol.register.updatePlayerCount();
				protocol.io.to(socket.room).emit("playerlist", protocol.getUserList(room));
				protocol.drawTogether.getDrawings(room, function (err, drawings) {
					callback(null, drawings, protocol.getUserList(room));
				});
			});
		});

		socket.on("kickban", function (options, callback) {
			// Options = [socketid, minutes, bantype]
			callback = callback || function () {};
			var targetSocket = protocol.socketFromId(options[0]);

			if (!targetSocket) {
				callback({error: "No user online with this socketid"});
				return;
			}

			if (!socket.uKey) {
				callback({error: "You can only kickban someone if you are logged in!"});
				return;
			}

			if (socket.reputation < KICKBAN_MIN_REP) {
				callback({error: "You need at least " + KICKBAN_MIN_REP + " reputation to kickban someone."});
				console.error("[KICKBAN][ERROR] " + socket.userid + " tried to ban " + targetSocket.userid + " but only had " + rep + " reputation.");
				return;
			}

			if (socket.reputation < (targetSocket.reputation || 0) + REQUIRED_REP_DIFFERENCE) {
				callback({error: "You need to have at least " + REQUIRED_REP_DIFFERENCE + " more reputation than the person you are trying to kickban."});
				console.error("[KICKBAN][ERROR] " + socket.userid + " (rep: " + rep + ") tried to ban " + targetSocket.userid + " (rep: " + targetrep + ") rep difference " + (rep - targetrep) + " required " + REQUIRED_REP_DIFFERENCE);
				return;
			}

			if (options[2] == "both" || options[2] == "account") {
				protocol.players.kickban(targetSocket.uKey, options[1], function (err) {
					if (err) {
						protocol.informClient(socket, "Error while trying to kickban: " + err);
						return;
					}

					protocol.informClient(socket, "You banned hes account!");
					targetSocket.disconnect();
				});
			}

			if (options[2] == "both" || options[2] == "ip") {
				protocol.players.kickban(targetSocket.ip, options[1], function (err) {
					if (err) {
						protocol.informClient(socket, "Error while trying to kickban: " + err);
						return;
					}

					protocol.informClient(socket, "You banned " + socket.ip);
					targetSocket.disconnect();
				});
			}
		});

		socket.on("disconnect", function () {
			protocol.io.to(socket.room).emit("leave", { id: socket.id });
			protocol.register.updatePlayerCount();
		});
	}.bind(this));
};

module.exports = Protocol;