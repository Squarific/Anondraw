Error.stackTraceLimit = Infinity;
require("../common/nice_console_log.js");
var config = require("../common/config.js");
var http = require("http");

var port = process.argv[2];
if (!port) throw "No port provided!";

var server = http.createServer();
server.listen(port);

// Socket library
var io = require('socket.io')(server, {
	transports: ['websocket']
});

// Library to register to the main server
var Register = require("./scripts/Register.js");
var register = new Register(config.service.loadbalancer.host, config.service.loadbalancer.password.join, io, server.address().port, server);

// Library to check login/register and skins
var Players = require("./scripts/Players.js");
var players = new Players(config.service.player.host);

var Background = require("./scripts/Background.js");
var background = new Background(config.service.image.host, undefined, config.service.image.password.draw);

// Drawtogether library
var DrawTogether = require("./scripts/DrawTogether.js");
var drawTogether = new DrawTogether(background);

var imgur = require("imgur");
imgur.setCredentials(config.service.realtime.imgur.user, config.service.realtime.imgur.password);

var Protocol = require("./scripts/Network.js");
var protocol = new Protocol(io, drawTogether, imgur, players, register, saveAndShutdown);

var roomCount = -1;

function roomSavedCallback (room, attempts, err) {
	if(err && attempts < 2 ) {
		background.sendDrawings(room, drawTogether.drawings[room], roomSavedCallback.bind(this, room, ++attempts));
	}
	roomCount--;
	console.log("ROOM", room, "HAS BEEN SAVED", roomCount, "ROOMS TO GO");
	if (roomCount == 0) process.exit(0);
}

function saveAndShutdown () {
	console.log("SAVING AND SHUTTING DOWN");
	var rooms = Object.keys(drawTogether.drawings);
	
	rooms.sort(function(roomNameA, roomNameB) {// sorts least to greatest 1, 5, 6, 10
		return protocol.getUserCount(roomNameA) - protocol.getUserCount(roomNameB);
	}.bind(this));
	
	roomCount = rooms.length;

	for (var k = 0; k < rooms.length; k++) {
		var room = rooms[k];
		var attempts = 1;

		console.log("SAVING ROOM", room);
		background.sendDrawings(room, drawTogether.drawings[room], roomSavedCallback.bind(this, room, attempts));
	}

	console.log("LETTING THE CLIENTS KNOW");
	io.emit("chatmessage", {
		user: "SERVER",
		message: "SERVER IS RESTARTING"
	});

	io.emit("chatmessage", {
		user: "SERVER",
		message: "You will automatically reconnect."
	});
	
	server.close();

	// If there were no rooms, just shutdown now
	if (rooms.length === 0) {
		process.exit(0);
	}
}

// Shut down, send drawings and stop all connections
process.on("SIGTERM", saveAndShutdown);

// Restart the server every so often
setTimeout(saveAndShutdown, 4 * 60 * 60 * 1000 + Math.floor(Math.random() * 3 * 60 * 60 * 1000));
