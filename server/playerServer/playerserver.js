var http = require("http");
var mysql = require("mysql");

var database = mysql.createConnection({
	host: "localhost",
	user: "anondraw",
	password: require("./mysql_password.js"),
	database: "anondraw",
	multipleStatements: true
});

var PlayerDatabase = require("./scripts/PlayerDatabase.js");
var Sessions = require("./scripts/Sessions.js");

var playerDatabase = new PlayerDatabase(database);
var sessions = new Sessions();

// Ips from coinbase
var ALLOWED_PAYMENT_IPS = ["54.243.226.26", "54.175.255.192", "54.175.255.193", "54.175.255.194",
"54.175.255.195", "54.175.255.196", "54.175.255.197", "54.175.255.198", "54.175.255.199",
"54.175.255.200", "54.175.255.201", "54.175.255.202", "54.175.255.203", "54.175.255.204",
"54.175.255.205", "54.175.255.206", "54.175.255.207", "54.175.255.208", "54.175.255.209",
"54.175.255.210", "54.175.255.211", "54.175.255.212", "54.175.255.213", "54.175.255.214",
"54.175.255.215", "54.175.255.216", "54.175.255.217", "54.175.255.218", "54.175.255.219",
"54.175.255.220", "54.175.255.221", "54.175.255.222", "54.175.255.223"];

var server = http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);

	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json"
	});

	if (parsedUrl.pathname == "/login") {
		var email = parsedUrl.query.email;
		var pass = parsedUrl.query.pass;

		if (!email || !pass) {
			res.end('{"error": "No user or password provided"}');
			return;
		}

		if (sessions.tooManySessions(email)) {
			res.end('{"error": "You have too many open sessions. Try logging out or waiting!"}');
			return;
		}

		playerDatabase.login(email, pass, function (err, id) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				return;
			}

			var uKey = sessions.addSession(id, email);
			res.end('{"success": "Logged in", "uKey": "' + uKey + '"}');
		});

		return;
	}

	if (parsedUrl.pathname == "/register") {
		var email = parsedUrl.query.email;
		var pass = parsedUrl.query.pass;

		if (!email || !pass) {
			res.end('{"error": "No user or password provided"}');
			return;
		}

		playerDatabase.register(email, pass, function (err, id) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				return;
			}

			var uKey = sessions.addSession(id, email);
			res.end('{"success": "Logged in", "uKey": "' + uKey + '"}');
		});

		return;
	}

	if (parsedUrl.pathname == "/checklogin") {
		var uKey = parsedUrl.query.uKey;

		if (!uKey) {
			res.end('{"error": "No uKey provided"}');
			return;
		}

		if (!sessions.loggedIn(uKey)) {
			res.end('{"error": "Not logged in"}');
			return;
		}

		res.end('{"success": "Logged in"}');
		return;
	}

	if (parsedUrl.pathname == "/getreputation") {
		var userId = parsedUrl.query.userid;

		if (!userId) {
			var uKey = parsedUrl.query.uKey;
			if (!uKey) {
				res.end('{"error": "No userid or ukey provided"}');
				return;
			}

			var user = sessions.getUser("uKey", uKey);
			userId = user.id;
		}

		playerDatabase.getReputation(userId, function (err, rep) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				return;
			}

			res.end('{"rep": ' + rep + '}');
			return;
		});
		return;
	}

	if (parsedUrl.pathname == "/givereputation") {
		var uKey = parsedUrl.query.uKey;
		var userid = parsedUrl.query.userid;
		var uKeyTo = parsedUrl.query.uKeyTo;

		if (!uKey || (!userid && !uKeyTo)) {
			res.end('{"error": "This command requires a uKey and (userid or uKeyTo) to be provided!"}');
			return;
		}

		var fromUser = sessions.getUser("uKey", uKey);
		if (!fromUser) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		if (!userid) {
			var toUser = sessions.getUser("uKey", uKeyTo);
			if (!toUser) {
				res.end('{"error": "That person is not logged in!"}');
				return;
			}
			userid = toUser.id;
		}

		playerDatabase.giveReputation(fromUser.id, userid, function (err) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				return;
			}

			res.end('{"success": "You gave reputation!"}');
			return;
		});
		return;
	}

	if (parsedUrl.pathname == "/logout") {
		var uKey = parsedUrl.query.uKey;
		sessions.logout(uKey);

		res.end('{"success": "You have been logged out."}');
		return;
	}

	if (parsedUrl.pathname == "/status") {
		var pass = parsedUrl.query.pass;
		if (pass !== "jafiwef24fj23") {
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.end('{"players": ' + JSON.stringify(sessions.loggedInUsers) + '}');
		return;
	}

	if (parsedUrl.pathname == "/payment") {
		if (ALLOWED_PAYMENT_IPS.indexOf(req.connection.remoteAddress) == -1) {
			res.end('{"error": "This method is restricted to certain ips"}');
			console.log("[Payment error] Got callback from unallowed ip", req.connection.remoteAddress);
			return;
		}

		if (req.method !== 'POST') {
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
		        console.log("[PAYMENT] Request too big!");
		    }
		});

		req.on('end', function () {
			try {
				var data = JSON.parse(body);
			} catch (e) {
				console.log("Error parsing json on payment", e, body);
				res.end('{"error": "Invalid json!"}');
				return;
			}
			
			if (typeof data.order !== "object" || typeof data.customer !== "object") {
				console.log("No order or cusomer object", data, body);
				res.end('{"error": "No order or cusomer object!"}');
				return;
			}

			if (data.order.status !== "completed") {
				res.end('{"success": "Nothing done"}');
				return;
			}

			console.log("[PAYMENT]", data.customer.email);
			res.end('{"success": "Payment applied!"}');
			return;
		});
	    return;
	}

	res.end('{"error": "Unknown command"}');
}.bind(this)).listen(4552);