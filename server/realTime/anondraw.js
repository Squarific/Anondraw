var port = process.argv[2];
if (!port) throw "No port provided!";

// Socket library
var io = require('socket.io')(port, {
	transports: ['websocket']
});

// Library to register to the main server
var Register = require("./scripts/Register.js");

var register = new Register("direct.anondraw.com", require("join_code_password.js"), io, port);
//var register = {updatePlayerCount: function () {}};

// Library to check login/register and skins
var Players = require("./scripts/Players.js");
var players = new Players("direct.anondraw.com");
//var players = new Players("localhost");

// Anondraw library
var Anondraw = require("./scripts/Anondraw.js");
var anondraw = new Anondraw();

io.on("connection", function (socket) {
	socket.on("");

	socket.on("joinroom", function (room, callback) {
		// Check if this room should be on this server
		anondraw.isOurs(room, function (err, ours) {
			if (err) {
				callback("Unknown error, try again later.");
				console.log("[JOIN][ERROR]", err);
				return;
			}

			if (!ours) {
				callback("Wrong server!");
				console.log("[JOIN] Someone tried joining a room that wasn't ours", room)
				return;
			}

			socket.leave(socket.room);
			socket.join(room);
		});
	});
});