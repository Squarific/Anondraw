var mysql = require("mysql");
var imgur = require("imgur");
//require("look").start();

var database = mysql.createConnection({
	host: "localhost",
	user: "drawtogether",
	password: 'uf892fj389f23f9j',
	database: "drawtogether"
});

var Protocol = require("./scripts/network.js");
var DrawTogether = require("./scripts/drawtogether.js");

var io = require("socket.io")(4958, {
	transports: ['websocket']
});
var drawTogether = new DrawTogether(database);
imgur.setClientId("8fd93ca8e547c10");

// imgur.createAlbum().then(function(json) {
//     console.log(json);
// })
// .catch(function (err) {
//     console.error(err.message);
// });

var protocol = new Protocol(io, drawTogether, imgur);