var mysql = require("mysql");
var imgur = require("imgur");

var database = mysql.createConnection({
	host: "localhost",
	user: "drawtogether",
	password: 'uf892fj389f23f9j',
	database: "drawtogether"
});

var Protocol = require("./network.js");
var DrawTogether = require("./drawtogether.js");

var io = require("socket.io")(4958);
var drawTogether = new DrawTogether(database);
imgur.setClientId("8fd93ca8e547c10");

var protocol = new Protocol(io, drawTogether, imgur);