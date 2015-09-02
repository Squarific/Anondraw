var names = require("./names.js");
var GameRoom = require("./GameRoom.js");

var room_regex = /^[a-z0-9_]+$/i;

// User settings
var MAX_USERS_IN_ROOM = 30;
var MAX_USERS_IN_GAMEROOM = 8;

// Reputation settings
var KICKBAN_MIN_REP = 50;                 // Reputation required to kickban
var REQUIRED_REP_DIFFERENCE = 20;         // Required reputation difference to be allowed to kickban someone
var UPVOTE_MIN_REP = 6;
var MEMBER_MIN_REP = UPVOTE_MIN_REP;
var SHARE_IP_MIN_REP = UPVOTE_MIN_REP;

// Ink settings
var MAX_INK = 50000;
var BASE_GEN = 2300;
var PER_REP_GEN = 500;

var SAME_IP_INK_MESSAGE = "You will not get any ink because someone else on your ip has already gotten some.";

function Protocol (io, drawtogether, imgur, players, register) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.players = players;
	this.register = register;
	this.bindIO();

	this.gameRooms = {};
	setInterval(this.inkTick.bind(this), 20 * 1000);
}

Protocol.prototype.inkTick = function inkTick () {
	var ips = [];

	for (var id in this.io.nsps['/'].connected) {
		var socket = this.io.nsps['/'].connected[id];

		if (ips.indexOf(socket.ip) !== -1 && socket.reputation < SHARE_IP_MIN_REP) {
			if (Date.now() - socket.lastIpInkMessage > 30000) {
				this.informClient(socket, SAME_IP_INK_MESSAGE);
				socket.lastIpInkMessage = Date.now();
			}
			continue;
		}

		// If ink is NaN we need to reset it
		if (socket.ink !== socket.ink) socket.ink = 0;

		var extra = BASE_GEN + PER_REP_GEN * (socket.reputation || 0);
		socket.ink = Math.min(socket.ink + extra, MAX_INK);

		socket.emit("setink", socket.ink);
		ips.push(socket.ip);
	}
};

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
		socket.ink = 2500;
		socket.ip = socket.client.conn.remoteAddress;
		if (!socket.ip) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "No ip found!"
			});
			socket.disconnect();
		}

		protocol.players.isBanned(socket.ip, function (err, banned, enddate, reason) {
			if (err) {
				console.error("Error checking if banned on connect", err);
				return;
			}

			if (banned) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You have been banned till " + new Date(enddate) + ". Reason: " + reason
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
			if (!uKey) {
				delete socket.uKey;
				socket.reputation = 0;
				socket.emit("setreputation", socket.reputation);
				return;
			}
			
			socket.uKey = uKey;
			protocol.players.getReputationFromUKey(uKey, function (err, rep) {
				socket.reputation = rep;
				socket.emit("setreputation", socket.reputation);
				protocol.io.to(socket.room).emit("reputation", {
					id: socket.id,
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

			if (socket.reputation < UPVOTE_MIN_REP) {
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You need at least " + UPVOTE_MIN_REP + "R yourself before you can give others!"
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
					targetSocket.reputation = reputation;
					targetSocket.emit("setreputation", targetSocket.reputation);
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
					message: socket.name + " changed name to " + name
				});
			}

			protocol.io.to(socket.room).emit("playernamechange", {
				id: socket.id,
				oldname: socket.username,
				newname: name
			});

			socket.name = name;
			socket.lastNameChange = Date.now();
			callback(null, name);
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

			if (socket.room.indexOf("member_") == 0 && (!socket.reputation || socket.reputation < MEMBER_MIN_REP)) {
				callback();
				if (!socket.lastMemberOnlyWarning || Date.now() - socket.lastMemberOnlyWarning > 5000) {
					protocol.informClient(socket, "This is a member only room, you need at least 5 rep!")
					socket.lastMemberOnlyWarning = Date.now();
				}
				return;
			}

			// If we aren't in a private room, check our ink
			if (socket.room.indexOf("private_") !== 0) {
				var usage = protocol.drawTogether.inkUsageFromDrawing(drawing);

				if (socket.ink < usage) {
					protocol.informClient(socket, "Not enough ink!");
					callback();
					return;
				}

				socket.ink -= usage;
			}
			
			protocol.drawTogether.addDrawing(socket.room, drawing, function () {
				protocol.sendDrawing(socket.room, socket.id, drawing);
				callback();
			});
		});
	
		// Startpath, endpath and pathpoint handlers
		socket.on("sp", function (color, size) {
			if (size > 50 || size < 0) return;
			protocol.drawTogether.addPath(socket.room, socket.id, {type: "path", color: color, size: size});
			socket.lastPathSize = size;
			delete socket.lastPathPoint;
			socket.broadcast.emit("sp", {socket.id, color: color, size: size});
		});

		socket.on("ep", function (callback) {
			protocol.drawTogether.finalizePath(socket.room, socket.id, callback);
			socket.broadcast.emit("ep", socket.id);
		});

		socket.on("pp", function (point, callback) {
			if (!point || point.length !== 2) {
				callback();
				return;
			}

			// If we aren't in a private room, check our ink
			if (socket.room.indexOf("private_") !== 0) {
				var usage = protocol.drawTogether.inkUsageFromPath(point, socket.lastPathPoint, socket.lastPathSize);

				if (socket.ink < usage) {
					protocol.informClient(socket, "Not enough ink!");
					callback();
					return;
				}

				socket.ink -= usage;
			}

			protocol.drawTogether.addPathPoint(socket.room, socket.id, point);
			socket.broadcast.emit("pp", socket.id, point);
		});

		socket.on("changeroom", function (room, callback) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.
			// Callback (err, drawings)
			callback = callback || function () {};

			if (!room_regex.test(room)) {
				callback("The room can only exist of lowercase letters, numbers and _");
				return;
			}

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
					callback("Wrong server");
					console.log("[JOIN] Someone tried joining a room that wasn't ours", room)
					return;
				}

				// Leave our current room
				protocol.io.to(socket.room).emit("leave", { id: socket.id });
				socket.leave(socket.room);

				// Join this room
				socket.join(room);
				socket.room = room;

				console.log("[CHANGEROOM] " + socket.name + " changed room to " + room);

				protocol.register.updatePlayerCount();
				protocol.io.to(socket.room).emit("playerlist", protocol.getUserList(room));

				protocol.drawTogether.getDrawings(room, function (err, drawings) {
					callback(null, drawings);
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

			callback({success: "Banning player " + targetSocket.name + " ..."});

			if (options[2] == "both" || options[2] == "account") {
				protocol.players.kickbanAccount(targetSocket.uKey, socket.uKey, options[1], options[3], function (err) {
					if (err) {
						protocol.informClient(socket, "Error while trying to kickban account: " + err);
						return;
					}

					protocol.informClient(socket, "You banned " + targetSocket.name);
					protocol.informClient(targetSocket, "You have been kickbanned for " + options[1] + " minutes. Reason: " + options[3]);
					targetSocket.disconnect();
				});
			}

			if (options[2] == "both" || options[2] == "ip") {
				protocol.players.kickbanIp(targetSocket.ip, socket.uKey, options[1], options[3], function (err) {
					if (err) {
						protocol.informClient(socket, "Error while trying to kickban ip: " + err);
						return;
					}

					protocol.informClient(socket, "You banned " + targetSocket.ip);
					protocol.informClient(targetSocket, "You have been kickbanned for " + options[1] + " minutes. Reason: " + options[3]);
					targetSocket.disconnect();
				});
			}
		});

		socket.on("disconnect", function () {
			protocol.io.to(socket.room).emit("leave", { id: socket.id });
			setTimeout(protocol.register.updatePlayerCount.bind(protocol.register), 500);
			protocol.drawTogether.finalizePath(socket.room, socket.id);
		});
	}.bind(this));
};

module.exports = Protocol;