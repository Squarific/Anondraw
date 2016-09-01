var names = require("./names.js");
var GameRoom = require("./GameRoom.js");

var rbush = require("rbush");
var SAT = require('sat');

var room_regex = /^[a-z0-9_]+$/i;
var shadowbanned = [];

// User settings
var MAX_USERS_IN_ROOM = 40;
var MAX_USERS_IN_GAMEROOM = 12;

// Reputation settings
var KICKBAN_MIN_REP = 50;                 // Reputation required to kickban
var REQUIRED_REP_DIFFERENCE = 20;         // Required reputation difference to be allowed to kickban someone

var BIG_BRUSH_MIN_REP = 5;
var MEMBER_MIN_REP = 15;
var UPVOTE_MIN_REP = 7;                  // Has to be changed in the playerserver too
var SHARE_IP_MIN_REP = MEMBER_MIN_REP;

var DRAWING_TYPES = ["brush", "line", "block", "path", "text"];

// Ink settings
var MAX_INK = 200000;
var MAX_GUEST_INK = 5000;

var BASE_GEN = 300;
var PER_REP_GEN = 1500;

// When do we forget the sockets that left
var FORGET_SOCKET_AFTER = 18 * 60 * 1000;

var INFORM_CLIENT_TIME_BETWEEN_MESSAGE = 1000;

var SAME_IP_INK_MESSAGE = "You will not get any ink because someone else on your ip has already gotten some.";

var PERMISSIONS = {
	DRAWING: 1,
	KICKBAN: 2,
	CHANGE_PERMISSIONS: 4
};

function deepCopyWithoutFunctions (target, alreadyDone) {
	var newObject = {};
	if (!alreadyDone) alreadyDone = [];

	if (typeof target !== "object" || target == null) return target;

	if (target.length) {
		newObject = [];
		for (var k = 0; k < target.length; k++) {
			newObject[k] = target[k];
		}
	}

	for (var key in target) {
		if (typeof target[key] == "function"){
			newObject[key] = function () {};
		// } else if (typeof target[key] == "object") {
		// 	if (alreadyDone.indexOf(target[key]) !== -1) continue;
		// 	alreadyDone.push(target[key]);
		// 	newObject[key] = deepCopyWithoutFunctions(target[key], alreadyDone)
		} else {
			newObject[key] = target[key]
		}
	}

	return newObject;
}

function Protocol (io, drawtogether, imgur, players, register) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.imgur = imgur;
	this.players = players;
	this.register = register;
	this.protectedRegions = {};
	this.bindIO();

	this.drawTogether.onFinalize = function (room, amountToKeep) {
		this.io.to(room).emit("finalize", amountToKeep);
		console.log(room + " has been finalized. And we send it.");
	}.bind(this);

	this.gameRooms = {};
	this.leftSocketIpAndId = {};  // socketid: {ip: "", uKey: "", rep: rep, time: Date.now()}
	setInterval(this.inkTick.bind(this), 5 * 1000);
	setInterval(this.clearLeftTick.bind(this, 180 * 1000));
}

Protocol.prototype.updateProtectedRegions = function updateProtectedRegions (room) {
	this.players.request('getprotectedregions', {
		room: room
	}, function (err, data) {
		if (err) {
			throw "Can't get protected regions for room " + room + " Err:" + JSON.stringify(err);
		}

		if (typeof data.length !== "number") {
			throw "Data was not an array";
		}

		this.protectedRegions[room] = rbush();

		for (var k = 0; k < data.length; k++) {
			var base = new SAT.Vector(data[k].minX, data[k].minY);

			var width = data[k].maxX - data[k].minX;
			var height = data[k].maxY - data[k].minY;

			data[k].satBox = new SAT.Polygon(new SAT.Vector(), [
				new SAT.Vector(data[k].minX, data[k].minY),
				new SAT.Vector(data[k].maxX, data[k].minY),
				new SAT.Vector(data[k].maxX, data[k].maxY),
				new SAT.Vector(data[k].minX, data[k].maxY),
			]);

			this.protectedRegions[room].insert(data[k]);
		}
	}.bind(this));
};

Protocol.prototype.satObjectsFromBrush = function satObjectsFromBrush (point1, point2, size) {
	var satObjects = [];

	satObjects.push(
		new SAT.Circle(
			new SAT.Vector(point1[0], point1[1]),
			size
		)
	);

	satObjects.push(
		new SAT.Circle(
			new SAT.Vector(point2[0], point2[1]),
			size
		)
	);

	// Move the points such that point1 is at 0, 0
	var newPoint2 = new SAT.Vector(point2[0] - point1[0],
	                               point2[1] - point1[1]);

	// Rotate such that the line is on the x axis
	var angle = Math.atan2(newPoint2.y, newPoint2.x);
	newPoint2.rotate(-angle);

	// Calculate the 4 points
	var points = [
		new SAT.Vector(0, -size / 2),
		new SAT.Vector(0, size / 2),
		new SAT.Vector(newPoint2.x, size / 2),
		new SAT.Vector(newPoint2.x, -size / 2)
	];

	// Rotate back and move to the original location
	var point1Sat = new SAT.Vector(point1[0], point1[1]);
	for (var k = 0; k < points.length; k++) {
		points[k].rotate(angle);
		points[k].add(point1Sat);
	}

	satObjects.push(
		new SAT.Polygon(
			new SAT.Vector(),
			points
		)
	);

	return satObjects;
};

Protocol.prototype.getRegionSearchFromSat = function getRegionSearchFromSat (satObject) {
	if (satObject.r) {
		return {
			minX: satObject.pos.x - satObject.r,
			minY: satObject.pos.y - satObject.r,
			maxX: satObject.pos.x + satObject.r,
			maxY: satObject.pos.y + satObject.r,
		};
	} else {
		var minX = Infinity,
		    maxX = -Infinity,
		    minY = Infinity,
		    maxY = -Infinity;

		for (var k = 0; k < satObject.calcPoints.length; k++) {
			minX = Math.min(minX, satObject.calcPoints[k].x);
			maxX = Math.max(maxX, satObject.calcPoints[k].x);
			minY = Math.min(minY, satObject.calcPoints[k].y);
			maxY = Math.max(maxY, satObject.calcPoints[k].y);
		}

		return {
			minX: minX,
			maxX: maxX,
			minY: minY,
			maxY: maxY
		};
	}
};

Protocol.prototype.isInsideProtectedRegion = function isInsideProtectedRegion (owner, satObjects, room) {
	if (!this.protectedRegions[room]) return false;

	for (var k = 0; k < satObjects.length; k++) {
		var searchRegion = this.getRegionSearchFromSat(satObjects[k]);
		var relevantRegions = this.protectedRegions[room].search(searchRegion);

		for (var i = 0; i < relevantRegions.length; i++) {
			if (relevantRegions[i].owner === owner) continue;

			if (satObjects[k].r) {
				if (SAT.testPolygonCircle(relevantRegions[i].satBox, satObjects[k])) {
					return true;
				}
			} else {
				if (SAT.testPolygonPolygon(relevantRegions[i].satBox, satObjects[k])) {
					return true
				}
			}
		}
	}

	return false;
};

Protocol.prototype.clearLeftTick = function clearLeftTick () {
	for (var socketId in this.leftSocketIpAndId) {
		if (Date.now() - this.leftSocketIpAndId[socketId].time > FORGET_SOCKET_AFTER) {
			delete this.leftSocketIpAndId[socketId];
		}
	}
};

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
		socket.ink = Math.min(socket.ink + extra, socket.uKey ? MAX_INK : MAX_GUEST_INK);

		socket.emit("setink", socket.ink);

		if (socket.reputation < SHARE_IP_MIN_REP)
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
	if (socket.messages[message] &&
	    Date.now() - socket.messages[message] < INFORM_CLIENT_TIME_BETWEEN_MESSAGE) {
		return;
	}

	socket.emit("chatmessage", {
		user: "SERVER",
		message: message
	});

	socket.messages[message] = Date.now();
};

Protocol.prototype.getUserList = function getUserList (room) {
	// Returns [{
	//     id: socketid,
	//     name: name,
	//     reputation: accountrep //optional
	//     gamescore: score //Only in gamerooms
	// }, ...]
	if (!this.io.nsps['/'].adapter.rooms[room]) {
		console.log("Room", room, "does not exist");
		return [];
	}
	var sroom = this.io.nsps['/'].adapter.rooms[room].sockets;
	var users = [];

	for (var id in sroom) {
		var socket = this.socketFromId(id);
		if (!socket) continue;
		users.push({
			id: socket.id,
			name: socket.name,
			reputation: socket.reputation,
			memberlevel: socket.memberlevel,
			gamescore: socket.gamescore
		});
	}

	return users;
};

Protocol.prototype.socketFromId = function socketFromId (id) {
	if (this.io.nsps['/'].connected[id])
		return this.io.nsps['/'].connected[id];

	return this.leftSocketIpAndId[id];
};

Protocol.prototype.setPermission = function setPermission (fromsocket, socketid, level) {
	var targetSocket = this.socketFromId(socketid);
	if (!targetSocket) {
		fromsocket.emit("chatmessage", "Could not set permission. Player was not online.");
		return;
	}

	if (!targetSocket.uKey) {
		fromsocket.emit("chatmessage", "You can only set the permission for logged in users. Ask the other person to create an account first.")
		return;
	}

	this.players.request("setpermission", {
		uKey: targetSocket.uKey,
		roomid: socketid,
		level: level
	}, function (err, data) {

	});
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;

	this.io.on("connection", function (socket) {
		socket.ink = 50;
		socket.emit("setink", socket.ink);

		socket.permissions = {}; //{someid: true/false}
		socket.messages = {};
		socket.ip = socket.client.conn.remoteAddress;

		if (!socket.ip) {
			socket.emit("chatmessage", {
				user: "SERVER",
				message: "No ip found!"
			});
			socket.disconnect();
		}

		protocol.players.isBanned(socket.ip, function (err, data) {
			if (err) {
				console.error("Error checking if banned on connect", err);
				return;
			}

			if (data.banned) {
				if (typeof data.info !== "object") {
					console.log("ERROR: No info object in ban data", data);
					return;
				}
				socket.emit("chatmessage", {
					user: "SERVER",
					message: "You have been banned till " + new Date(data.info.enddate) + ". Reason: " + data.info.reason + ". Unjustified? Email: banned@anondraw.com include your enddate + time!"
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
						"/me [text] - Emote",
						"/shortcuts - Show the shortcuts"
					];
					for (var k = 0; k < helpText.length; k++) {
						socket.emit("chatmessage", {
							user: "SERVER",
							message: helpText[k]
						});
					}
				} else if (message.indexOf("/shortcuts") == 0) {
					var helpText = [
						"The following shortcuts are avaialble:",
						"0-9: Change transparency",
						"[ and ]: Change brushsize",
						"v or p: Color picker",
						"b: brush",
						"t: text",
						"l: line"
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

			if (protocol.gameRooms[socket.room]) {
			 	if (protocol.gameRooms[socket.room].chatmessage(socket, message)) {
			 		// Word was found, don't send the rest
			 		// We should update the playerlist
			 		protocol.io.to(socket.room).emit("playerlist", protocol.getUserList(socket.room));
					return;
			 	}
			}

			protocol.sendChatMessage(socket.room ,{
				user: socket.name,
				message: message
			});
		});

		socket.on("uploadimage", function (base64, callback) {
			if (Date.now() - socket.lastImgurUpload < 10000) {
				callback({ error: "You are uploading too quickly! Wait a few seconds."})
				return;
			}

			socket.lastImgurUpload = Date.now();
			console.log("Imgur upload request from " + socket.ip);

			callback = (typeof callback == "function") ? callback : function () {};
			protocol.imgur.uploadBase64(base64, "L3ntm")
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
				socket.emit("setmemberlevel", socket.memberlevel);
				return;
			}
			
			socket.uKey = uKey;
			protocol.players.setName(socket.uKey, socket.name);

			protocol.players.getReputationFromUKey(uKey, function (err, data) {
				if (err) {
					console.log("GET REP ERROR:", err); 
					return;
				}

				console.log("[REPUTATION] ", socket.name, " has ", data.rep);
				socket.reputation = data.rep;

				socket.emit("setreputation", socket.reputation);
				protocol.io.to(socket.room).emit("reputation", {
					id: socket.id,
					reputation: data.rep
				});
			});

			protocol.players.request("getmemberlevel", {
				uKey: uKey
			}, function (err, data) {
				if (err || data.err || data.error) {
					console.log("Error getting member level", uKey, err, data);
					return;
				}

				socket.memberlevel = data.memberlevel;
				socket.userid = data.userid;
				socket.emit("setmemberlevel", socket.memberlevel);
				protocol.io.to(socket.room).emit("playerlist", protocol.getUserList(socket.room));
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
					message: "Hey don't try cheating, you can't give yourself reputation!"
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
	
				protocol.players.getReputationFromUKey(targetSocket.uKey, function (err, data) {
					if (err) {
						console.error("[VOTE][GETREPUTATION]", err);
						return;
					}

					protocol.io.to(socket.room).emit("reputation", {
						id: targetSocket.id,
						reputation: data.rep
					});
					targetSocket.reputation = data.rep;
					targetSocket.emit("setreputation", targetSocket.reputation);
				});
			});
		});

		socket.on("changename", function (name, callback) {
			if (!name) return;

			// Remove all bad characters
			name.replace(/[^\x00-\x7F]/g, "");

			if (name.length > 32)
				name = name.substr(0, 32);

			if (name.toLowerCase() == "server") {
				callback("Don't steal my name!");
				return;
			}

			if (Date.now() - socket.lastNameChange < 1000) {
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
				oldname: socket.name,
				newname: name
			});

			socket.name = name;
			socket.lastNameChange = Date.now();
			callback(null, name);

			if (socket.uKey)
				protocol.players.setName(socket.uKey, socket.name);
		});

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the rest of the people in the room

			callback = (typeof callback == "function") ? callback : function () {};

			if (!socket.room) {
				callback();
				protocol.informClient(socket, "You can't draw when not in a room!");
				return;
			}

			if (socket.room.indexOf("member_") == 0 && (!socket.reputation || socket.reputation < MEMBER_MIN_REP)) {
				callback();
				if (!socket.lastMemberOnlyWarning || Date.now() - socket.lastMemberOnlyWarning > 5000) {
					protocol.informClient(socket, "This is a member only room, you need at least " + MEMBER_MIN_REP + " rep!")
					socket.lastMemberOnlyWarning = Date.now();
				}
				return;
			}

			var permission = socket.permissions[parseInt(socket.room.slice(5))];
			// If this is a user room and we don't have a permission set or we aren't allowed to draw
			// Notify the client
			if (socket.room.indexOf("user_") == 0 && (!permission || !(permission & PERMISSIONS.DRAWING) )) {
				if (!socket.lastNoUserPermissionWarning || Date.now() - socket.lastNoUserPermissionWarning > 5000) {
					protocol.informClient(socket, "You don't have permission for this room. Ask the owner to grant it to you.");
					socket.lastNoUserPermissionWarning = Date.now();
				}
				callback();
				return;
			}

			if (DRAWING_TYPES.indexOf(drawing.type) == -1) {
				callback();
				return;
			}

			if (protocol.gameRooms[socket.room] && protocol.gameRooms[socket.room].currentPlayer !== socket &&
			    (Date.now() - socket.lastTurnMessage > 5000 || !socket.lastTurnMessage)) {
				callback();
				protocol.informClient(socket, "Not your turn!");
				socket.lastTurnMessage = Date.now();
				return;
			}

			var objects = protocol.satObjectsFromBrush(
				[drawing.x, drawing.y],
				[drawing.x1 || drawing.x, drawing.y1 || drawing.y],
				drawing.size
			);

			if (protocol.isInsideProtectedRegion(socket.userid, objects, socket.room)) {
				protocol.informClient(socket, "This region is protected!");
				callback();
				return;
			}

			// If we aren't in a private room, check our ink
			if (socket.room.indexOf("private_") !== 0 && socket.room.indexOf("game_") !== 0) {
				var usage = protocol.drawTogether.inkUsageFromDrawing(drawing);

				if (socket.ink < usage) {
					protocol.informClient(socket, "Not enough ink!");
					callback();
					return;
				}

				socket.ink -= usage;
			}

			drawing.socketid = socket.id;
			protocol.drawTogether.addDrawing(socket.room, drawing, function () {
				protocol.sendDrawing(socket.room, socket.id, drawing);
				callback();
			});
		});
	
		// Startpath, endpath and pathpoint handlers
		socket.on("sp", function (color, size) {
			if (size > 50 || size < 0) return;
			protocol.drawTogether.addPath(socket.room, socket.id, {socketid: socket.id, type: "path", color: color, size: size});
			socket.lastPathSize = size;
			delete socket.lastPathPoint;
			socket.broadcast.to(socket.room).emit("sp", {id: socket.id, color: color, size: size});
		});

		socket.on("ep", function (callback) {
			protocol.drawTogether.finalizePath(socket.room, socket.id, callback.bind(undefined, socket.id));
			socket.broadcast.to(socket.room).emit("ep", socket.id);
		});

		socket.on("pp", function (point, callback) {
			if (typeof callback !== "function")
				callback = function () {};

			if (!socket.room) {
				callback(false);
				protocol.informClient(socket, "You can't draw when not in a room!");
				return;
			}

			// Shadow bans
			if (shadowbanned.indexOf(socket.name) != -1) {
				callback(true);
				return;
			}

			if (socket.room.indexOf("member_") == 0 && (!socket.reputation || socket.reputation < MEMBER_MIN_REP)) {
				callback(false);
				if (!socket.lastMemberOnlyWarning || Date.now() - socket.lastMemberOnlyWarning > 5000) {
					protocol.informClient(socket, "This is a member only room, you need at least 5 rep!")
					socket.lastMemberOnlyWarning = Date.now();
				}
				return;
			}

			if (socket.room.indexOf("user_") == 0 && (!permission || !(permission & PERMISSIONS.DRAWING) )) {
				if (!socket.lastNoUserPermissionWarning || Date.now() - socket.lastNoUserPermissionWarning > 5000) {
					protocol.informClient(socket, "You don't have permission for this room. Ask the owner to grant it to you.");
					socket.lastNoUserPermissionWarning = Date.now();
				}
				callback();
				return;
			}

			if (!point || point.length !== 2) {
				callback(false);
				return;
			}

			if (protocol.gameRooms[socket.room] && protocol.gameRooms[socket.room].currentPlayer !== socket) {
				callback();
				protocol.informClient(socket, "Not your turn!");
				return;
			}

			var objects = protocol.satObjectsFromBrush(point, socket.lastPathPoint || point, socket.lastPathSize);

			if (protocol.isInsideProtectedRegion(socket.userid, objects, socket.room)) {
				protocol.informClient(socket, "This region is protected!");
				callback();
				return;
			}

			// If we aren't in a private room, check our ink
			if (socket.room.indexOf("private_") !== 0 && socket.room.indexOf("game_") !== 0) {
				var usage = protocol.drawTogether.inkUsageFromPath(point, socket.lastPathPoint, socket.lastPathSize);

				// Always set latpathpoint even if we failed to draw
				socket.lastPathPoint = point;

				if (socket.ink < usage) {
					protocol.informClient(socket, "Not enough ink!");
					callback(false);
					return;
				}

				socket.ink -= usage;
			}

			protocol.drawTogether.addPathPoint(socket.room, socket.id, point);
			callback(true);
			socket.broadcast.to(socket.room).emit("pp", socket.id, point);
		});

		socket.on("changeroom", function (room, callback) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.
			// Callback (err, drawings)
			callback = (typeof callback == "function") ? callback : function () {};

			if (!room_regex.test(room)) {
				callback("The room can only exist of lowercase letters, numbers and _");
				return;
			}

			if (room == socket.room) {
				callback("You are already in " + socket.room);
				return;
			}

			if (protocol.getUserCount(room) > MAX_USERS_IN_ROOM && socket.name.toLowerCase() !== "uberlord") {
				callback("Too many users");
				return;
			}

			if (room.indexOf("user_") == 0) {
				if (parseInt(socket.room.slice(5)) === socket.id) {
					socket.permissions[parseInt(socket.room.slice(5))] = Number.MAX_SAFE_INTEGER;
					handleRoom();
					return;
				}

				protocol.players.request("getpermission", {
					roomid: parseInt(socket.room.slice(5)),
					uKey: socket.uKey
				}, function (err, data) {
					if (err || data.err)
						console.log("Get permission error", data.err);
					
					socket.permissions[parseInt(socket.room.slice(5))] =
						parseInt((data && data.level) || 0);

					handleRoom();
				});
			} else {
				handleRoom();
			}

			function handleRoom () {
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
					protocol.drawTogether.finalizePath(socket.room, socket.id);
					socket.broadcast.to(socket.room).emit("ep", socket.id);

					// If this is a GameRoom, create one for it
					// or register our socket if it exists, we should also
					// leave the previous one
					if (protocol.gameRooms[socket.room]) {
						protocol.gameRooms[socket.room].leave(socket);

						if (protocol.gameRooms[socket.room].players.length == 0) {
							delete protocol.gameRooms[socket.room];
						}
					}

					// Update the rooms protected regions
					if (!protocol.protectedRegions[room]) {
						protocol.updateProtectedRegions(room);
					}

					// Join this room
					socket.join(room);
					socket.room = room;

					console.log("[CHANGEROOM] " + socket.name + " changed room to " + room);

					protocol.register.updatePlayerCount();
					protocol.io.to(socket.room).emit("playerlist", protocol.getUserList(socket.room));

					if (protocol.gameRooms[room])
						protocol.gameRooms[room].join(socket);
					else if (room.indexOf("game_") == 0 || room.indexOf("private_game_") == 0) {
						protocol.gameRooms[room] = new GameRoom(room, protocol.io);
						protocol.gameRooms[room].addEventListener("newgame", function (event) {
							protocol.drawTogether.clear();
							protocol.io.to(room).emit("clear");
						});
						protocol.gameRooms[room].join(socket);
					}

					protocol.drawTogether.getDrawings(room, function (err, drawings) {
						callback(null, drawings);
						protocol.drawTogether.getPaths(room, function (err, paths) {
							socket.emit("paths", paths);
						});
					});
				});
			}
		});

		socket.on("undo", function () {
			protocol.drawTogether.undoDrawings(socket.room, socket.id);
			protocol.io.to(socket.room).emit("undodrawings", socket.id);
		});

		socket.on("kickban", function (options, callback) {
			// Options = [socketid, minutes, bantype]
			callback = (typeof callback == "function") ? callback : function () {};
			var targetSocket = protocol.socketFromId(options[0]);

			if (!targetSocket) {
				callback({error: "No user online with this socketid"});
				return;
			}

			if (!socket.uKey || typeof socket.reputation !== "number") {
				callback({error: "You can only kickban someone if you are logged in!"});
				return;
			}

			if (socket.reputation < KICKBAN_MIN_REP) {
				callback({error: "You need at least " + KICKBAN_MIN_REP + " reputation to kickban someone."});
				console.error("[KICKBAN][ERROR] " + socket.name + " tried to ban " + targetSocket.name + " but only had " + rep + " reputation.");
				return;
			}

			if (socket.reputation < (targetSocket.reputation || 0) + REQUIRED_REP_DIFFERENCE) {
				callback({error: "You need to have at least " + REQUIRED_REP_DIFFERENCE + " more reputation than the person you are trying to kickban."});
				console.error("[KICKBAN][ERROR] " + socket.name + " (rep: " + socket.reputation + ") tried to ban " + targetSocket.name + " (rep: " + targetSocket.reputation + ") rep difference " + (socket.reputation - targetSocket.reputation) + " required " + REQUIRED_REP_DIFFERENCE);
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

					protocol.drawTogether.undoDrawings(targetSocket.room, targetSocket.id, true);
					protocol.io.to(targetSocket.room).emit("undodrawings", targetSocket.id, true);
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

					protocol.drawTogether.undoDrawings(targetSocket.room, targetSocket.id, true);
					protocol.io.to(targetSocket.room).emit("undodrawings", targetSocket.id, true);
					targetSocket.disconnect();
				});
			}
		});

		socket.on("setpermission", function (socketid, level) {
			protocol.setPermission(socket, socketId, level);
		});
		socket.on("setcoordfavorite", function (newX, newY, x, y, name, callback) {
			protocol.players.request('setcoordfavorite', {
				uKey: socket.uKey,
				newX: newX,
				newY: newY,
				x: x,
				y: y,
				name: name,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
			});
		});
		socket.on("removefavorite", function (x, y, name, callback) {
			protocol.players.request('removefavorite', {
				uKey: socket.uKey,
				x: x,
				y: y,
				name: name,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
			});
		});
		socket.on("renamefavorite", function (x, y, name, callback) {
			protocol.players.request('renamefavorite', {
				uKey: socket.uKey,
				x: x,
				y: y,
				name: name,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
			});
		});
		socket.on("getfavorites", function (callback) {
			protocol.players.request('getfavorites', {
				uKey: socket.uKey,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
			});
		});
		socket.on("createfavorite", function (x, y, name, callback) {
			console.log("creating favorite network.js");
			protocol.players.request('createfavorite', {
				uKey: socket.uKey,
				x: x,
				y: y,
				name: name,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
			});
		});
		socket.on("createprotectedregion", function (from, to, callback) {
			console.log("network.js" + Date.now());
			if (typeof callback !== 'function') return;

			if (!from || typeof from.join !== 'function') {
				callback("From array was not in the correct format");
				return;
			}

			if (!to || typeof to.join !== 'function') {
				callback("To array was not in the correct format");
				return;
			}


			if (!socket.memberlevel) {
				callback("This feature is premium only!");
				return;
			}

			console.log("[REGIONS] Adding protected region for", socket.name, from, to);
			protocol.players.request('createprotectedregion', {
				uKey: socket.uKey,
				from: from.join(','),
				to: to.join(','),
				room: socket.room
			}, function (err, data) {
				callback(err, data);
				protocol.updateProtectedRegions(socket.room);
			});
		});

		socket.on("resetprotectedregions", function (callback) {
			if (typeof callback !== 'function') return;

			protocol.players.request('resetprotectedregions', {
				uKey: socket.uKey,
				room: socket.room
			}, function (err, data) {
				callback(err, data);
				protocol.updateProtectedRegions(socket.room);
			});
		});

		socket.on("disconnect", function () {
			protocol.io.to(socket.room).emit("leave", { id: socket.id });

			if (protocol.gameRooms[socket.room]) {
				protocol.gameRooms[socket.room].leave(socket);
				if (protocol.gameRooms[socket.room].players.length == 0) {
					delete protocol.gameRooms[socket.room];
				}
			}

			protocol.leftSocketIpAndId[socket.id] = deepCopyWithoutFunctions(socket);

			setTimeout(protocol.register.updatePlayerCount.bind(protocol.register), 500);

			protocol.drawTogether.finalizePath(socket.room, socket.id);
			socket.broadcast.to(socket.room).emit("ep", socket.id);
		});
	}.bind(this));
};

module.exports = Protocol;