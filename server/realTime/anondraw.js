var port = process.argv[2];
if (!port) throw "No port provided!";

// Socket library
var io = require('socket.io')(port, {
	transports: ['websocket']
});

var names = require("./scripts/names.js");
function randomName () {return names[Math.floor(Math.random() * names.length)]}

// Library to register to the main server
var Register = require("./scripts/Register.js");

var register = new Register("direct.anondraw.com", require("join_code_password.js"), io, port);
//var register = {updatePlayerCount: function () {}};

// Library to check login/register and skins
var Players = require("./scripts/Players.js");
var players = new Players("direct.anondraw.com");
//var players = new Players("localhost");

// Drawtogether library
var DrawTogether = require("./scripts/DrawTogether.js");
var drawTogether = new DrawTogether();

var imgur = require("imgur");
imgur.setClientId("8fd93ca8e547c10");

var Protocol = require(io, drawTogether, imgur, players);