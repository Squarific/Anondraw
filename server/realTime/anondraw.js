var port = process.argv[2];
if (!port) throw "No port provided!";

var http = require("http");

var server = http.createServer();
server.listen(port);

// Socket library
var io = require('socket.io')(server, {
	transports: ['websocket']
});

// Library to register to the main server
var Register = require("./scripts/Register.js");
var register = new Register("direct.anondraw.com", require("./join_code_password.js"), io, port, server);
// var register = new Register("localhost", require("./join_code_password.js"), io, port, server);
// var register = {isOurs: function (room, callback) {callback(null, true);}, updatePlayerCount: function () {}};

// Library to check login/register and skins
var Players = require("./scripts/Players.js");
var players = new Players("direct.anondraw.com");
// var players = new Players("localhost");

var Background = require("./scripts/Background.js");
var background = new Background("direct.anondraw.com", undefined, require("./draw_password.js"));
//var background = new Background("localhost", undefined, require("./draw_password.js"));

// Drawtogether library
var DrawTogether = require("./scripts/DrawTogether.js");
var drawTogether = new DrawTogether(background);

var imgur = require("imgur");
imgur.setClientId("8fd93ca8e547c10");
//imgur.setCredentials("anondraw", require("./imgur_password.js"));

var Protocol = require("./scripts/Network.js");
var protocol = new Protocol(io, drawTogether, imgur, players, register);

// Shut down, send drawings and stop all connections
process.on("SIGTERM", function () {
	var rooms = 0;
	for (var room in drawTogether.drawings) {
		rooms++;

		background.sendDrawings(room, drawTogether.drawings[room], function () {
			rooms--;
			if (rooms == 0) process.exit(0);
		});
	}

	io.emit("chatmessage", "===== SERVER IS RESTARTING =====");
	io.emit("chatmessage", "You will automatically reconnect.");
	server.close();
});