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
// var register = new Register("direct.anondraw.com", require("./join_code_password.js"), io, port, server);
var register = new Register("localhost", require("./join_code_password.js"), io, port, server);
// var register = {isOurs: function (room, callback) {callback(null, true);}, updatePlayerCount: function () {}};

// Library to check login/register and skins
var Players = require("./scripts/Players.js");
var players = new Players("direct.anondraw.com");
// var players = new Players("localhost");

var Background = require("./scripts/Background.js");
// var background = new Background("direct.anondraw.com", require("./draw_password.js"));
var background = new Background("localhost", require("./draw_password.js"));

// Drawtogether library
var DrawTogether = require("./scripts/DrawTogether.js");
var drawTogether = new DrawTogether(background);

var imgur = require("imgur");
imgur.setClientId("8fd93ca8e547c10");


var Protocol = require("./scripts/Network.js");
var protocol = new Protocol(io, drawTogether, imgur, players, register);