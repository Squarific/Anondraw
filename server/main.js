var mysql = require("mysql");

var database = mysql.createConnection({
	host: "localhost",
	user: "drawtogheter",
	password: 'uf892fj389f23f9j',
	database: "drawtogheter"
});

var io = require("socket.io")(8080);
var drawTogether = new require("./drawtogether.js")(database);
var protocol = new require("./network.js")(io, drawTogether);