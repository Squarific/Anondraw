var http = require("http");
var mysql = require("mysql");
var SHA256 = require("crypto-js/sha256");

var database = mysql.createConnection({
	host: "localhost",
	user: "anondraw",
	password: 'mafs8mfas9ma',
	database: "anondraw",
	multipleStatements: true
});

var seconds = 1000;
var minutes = 60 * 1000;
var hours = 60 * 60 * 1000;

var STAY_LOGGED_IN = 30 * minutes; // How long should a session stay valid?
var MAX_SESSIONS = 50; // How many sessions can one user open?

// Contains users
// {id: Number, email: String, uKey: String, lastUpdate: Date.now()} //uKey is used for identification
var loggedInUsers = [];

function getKeyByProp (array, prop, value) {
	for (var k = 0; k < array.length; k++)
		if (array[k][prop] == value)
			return k;
	return -1;
}

function randomString (length) {
	var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
	var string = "";

	for (var k = 0; k < length; k++)
		string += chars[Math.floor(Math.random() * chars.length)];

	return string;
}

function cleanUsers () {
	for (var k = 0; k < loggedInUsers.length; k++) {
		if (Date.now() - loggedInUsers[k].lastUpdate > STAY_LOGGED_IN) {
			loggedInUsers.splice(k, 1);
			k--;
		}
	}
}

setInterval(cleanUsers, 10 * 60 * 1000);

function register (email, pass, callback) {
	database.query("INSERT INTO users (email, pass) VALUES (?, ?)", [email, SHA256(pass).toString()], function (err, result) {
		if (err) {
			callback("Couldn't register, do you already have an account?");
			console.log("[REGISTER ERROR]", err);
			return;
		}

		console.log("[REGISTER]", email)
		login(email, pass, callback);
	});
}

// Logs in a user
// callback(err, uKey)
function login (email, pass, callback) {
	database.query("SELECT id FROM users WHERE email = ? AND pass = ?", [email, SHA256(pass).toString()], function (err, rows) {
		if (err) {
			callback("Database error");
			console.log("[LOGIN ERROR] ", err);
			return;
		}

		if (rows.length < 1) {
			callback("This account/password combo was not found.");
			return;
		}

		var uKey = randomString(32);

		if (getKeyByProp(loggedInUsers, "uKey", uKey) !== -1)
			throw "Duplicate uKey generated. Shutting down. uKey: " + uKey;

		loggedInUsers.push({
			id: rows[0].id,
			uKey: uKey,
			email: email,
			lastUpdate: Date.now()
		});

		callback(null, uKey);
		console.log("[LOGGED IN]", email, uKey)
		return;
	});
}

var server = http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);

	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Content-Type", "application/json");

	if (parsedUrl.pathname == "/login") {
		var email = parsedUrl.query.email;
		var pass = parsedUrl.query.pass;

		if (!email || !pass) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No user or password provided"}');
			return;
		}

		var sessions = 0;
		for (var k = 0; k < loggedInUsers.length; k++)
			if (loggedInUsers[k].email == email) sessions++;

		if (sessions > MAX_SESSIONS) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "You have too many open sessions. Try logging out!"}');
			return;
		}

		login(email, pass, function (err, uKey) {
			if (err) {	
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('{"error": "' + err + '"}');
				return;
			}

			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"success": "Logged in", "uKey": "' + uKey + '"}');
		});

		return;
	}

	if (parsedUrl.pathname == "/register") {
		var email = parsedUrl.query.email;
		var pass = parsedUrl.query.pass;

		if (!email || !pass) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No user or password provided"}');
			return;
		}

		register(email, pass, function (err, uKey) {
			if (err) {
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('{"error": "' + err + '"}');
				return;
			}

			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"success": "Logged in", "uKey": "' + uKey + '"}');
		});

		return;
	}

	if (parsedUrl.pathname == "/checklogin") {
		var uKey = parsedUrl.query.uKey;

		if (!uKey) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No ukey provided"}');
			return;
		}

		var key = getKeyByProp(loggedInUsers, "uKey", uKey);
		if (key == -1) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Not logged in"}');
			return;
		}

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"success": "Logged in"}');
		return;
	}

	if (parsedUrl.pathname == "/logout") {
		var uKey = parsedUrl.query.uKey;

		if (!uKey) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No ukey provided"}');
			return;
		}

		var key = getKeyByProp(loggedInUsers, "uKey", uKey);
		if (key == -1) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "Not logged in"}');
			return;
		}

		loggedInUsers.splice(key, 1);

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"success": "You have been logged out."}');
		return;
	}

	if (parsedUrl.pathname == "/status") {
		var pass = parsedUrl.query.pass;
		if (pass !== "jafiwef24fj23") {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('{"players": ' + JSON.stringify(loggedInUsers) + '}');
		return;
	}

	if (parsedUrl.pathname == "/payment") {
		// Ips from coinbase
		var allowedIps = ["54.243.226.26", "54.175.255.192", "54.175.255.193", "54.175.255.194",
		"54.175.255.195", "54.175.255.196", "54.175.255.197", "54.175.255.198", "54.175.255.199",
		"54.175.255.200", "54.175.255.201", "54.175.255.202", "54.175.255.203", "54.175.255.204",
		"54.175.255.205", "54.175.255.206", "54.175.255.207", "54.175.255.208", "54.175.255.209",
		"54.175.255.210", "54.175.255.211", "54.175.255.212", "54.175.255.213", "54.175.255.214",
		"54.175.255.215", "54.175.255.216", "54.175.255.217", "54.175.255.218", "54.175.255.219",
		"54.175.255.220", "54.175.255.221", "54.175.255.222", "54.175.255.223"];

		if (allowedIps.indexOf(req.connection.remoteAddress) == -1) {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "This method is restricted to certain ips"}');
			console.log("[Payment error] Got callback from unallowed ip", req.connection.remoteAddress);
			return;
		}

		if (req.method !== 'POST') {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"error": "This command is only supported using POST"}');
			console.log("[Payment error] request did not use post");
			return;
		}
		var body = '';

		req.on('data', function (data) {
		    body += data;

		    // If the body length is bigger than 1MB
		    // stop the connection
		    if (body.length > 1e6) {
		        req.connection.destroy();
		    }
		});

		req.on('end', function () {
			console.log("end");
			try {
				var data = JSON.parse(body);
			} catch (e) {
				console.log("Error parsing json on payment", e, body);
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('{"error": "Invalid json!"}');
				return;
			}
			
			if (typeof data.order !== "object" || typeof data.customer !== "object") {
				console.log("No order or cusomer object", data, body);
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('{"error": "No order or cusomer object!"}');
				return;
			}

			if (data.order.status !== "completed") {
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('{"success": "Nothing done"}');
				return;
			}

			console.log("[PAYMENT]", data.customer.email);
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end('{"success": "Payment applied!"}');
			return;
		});
	    return;
	}

	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('{"error": "Unknown command"}');
}.bind(this)).listen(4252);