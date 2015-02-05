var mysql = require("mysql");

var database = mysql.createConnection({
	host: "localhost",
	user: "drawtogether",
	password: 'uf892fj389f23f9j',
	database: "drawtogether"
});

var Protocol = require("./network.js");
var DrawTogether = require("./drawtogether.js");

var io = require("socket.io")(8080);
var drawTogether = new DrawTogether(database);
var protocol = new Protocol(io, drawTogether);