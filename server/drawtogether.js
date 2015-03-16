var SHA256 = require("crypto-js/sha256");

//TODO when log in send reputation

function DrawTogether (database) {
	this.database = database;
}

DrawTogether.prototype.rgbToHex = function rgbToHex (r, g, b) {
	var hex = ((r << 16) | (g << 8) | b).toString(16);
	return "#" + ("000000" + hex).slice(-6);
};

DrawTogether.prototype.getReputationFromUserId = function getReputationFromUserId (userid, callback) {
	// Returns the amount of reputation given to the userid
	this.database.query("SELECT COUNT(*) as reputation FROM reputations WHERE to_id = ?", [userid], function (err, rows) {
		if (err) callback(err);
		else callback(null, rows[0].reputation);
	});
};

DrawTogether.prototype.getReputationsFromUserIds = function getreputationsFromUserIds (userids, callback) {
	// Returns err as first argument, if null gives rows as second argument
	// rows example: [{to_id: 1, reputation: 5}, ...]
	if (typeof userids !== "object" || userids.length < 1) {
		callback(null, []);
		return;
	}
	this.database.query("SELECT to_id, COUNT(*) as reputation FROM reputations WHERE to_id IN (?) GROUP BY to_id", [userids], callback)
};

DrawTogether.prototype.vote = function vote (fromid, toid, callback) {
	this.database.query("INSERT INTO reputation (from_id, to_id) VALUES (?, ?)", [fromid, toid], function (err) {
		callback(err, (err) ? false : true);
	});
};

DrawTogether.prototype.addChatMessage = function addChatMessage (room, data) {
	this.database.query("INSERT INTO msg SET ?", {
		room: room,
		user: data.user,
		message: data.message,
		now: new Date()
	}, function (err) {
		if (err)
			console.error(err);
	});
};

DrawTogether.prototype.getInkFromIp = function getInkFromIp (ip, callback) {
	// Get the ink from the given ip, callback params are err, amount
	// If the given ip was not in the database, then it gets added and
	// the default amount is returned

	if (!ip) {
		callback("Getting ink from no ip", -1);
		console.error("Getting ink from no ip");
		return;
	}

	this.database.query("SELECT ink FROM ink WHERE ip = ?", [ip], function (err, rows) {
		if (err) {
			callback(err);
			return;
		}

		if (rows.length == 0) {
			this.database.query("INSERT INTO ink SET ?", {ip: ip, ink: 5000}, function (err) {
				if (err)
					console.error("[GETINKFROMIPERROR]", err);
			});
			callback(null, 5000);
		} else {
			callback(null, rows[0].ink);
		}
	}.bind(this));
};

DrawTogether.prototype.lowerInkFromIp = function changeInkFromIp (drawing, ip, callback) {
	// Change the ink from a given ip, 5 will lower the ink with 5
	// Callback param is err

	if (!ip) {
		callback("Lowering ink from no ip");
		console.error("Lowering ink from no ip");
		return;
	}
	this.database.query("UPDATE ink SET ink = ink - ? WHERE ip = ?", [this.inkUsageFromDrawing(drawing), ip], callback);
};

DrawTogether.prototype.raiseInkFromIp = function raiseInkFromIp (amount, ip, callback) {
	// Raise ink with amount for given ip, caps out at 30000
	if (!ip) {
		callback("Raising ink from no ip");
		console.error("Raising ink from no ip");
		return;
	}
	this.database.query("UPDATE ink SET ink = LEAST(30000, ink + ?) WHERE ip = ?", [amount, ip], callback);
};

DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
	// If its a brush the ink usage is ceil(size * size / 100)
	// If it is a line the ink usage is ceil(size * length * 2 / 100)
	var length = drawing[3];

	if (typeof drawing[5] == "number")
		length = this.utils.distance(drawing[1], drawing[2], drawing[5], drawing[6]) * 2;

	return Math.ceil(drawing[3] * length / 100);
};

DrawTogether.prototype.addDrawing = function addDrawing (room, drawing, callback) {
	// Put the given drawing in the database for the given room, returns err if error

	if (!drawing || !drawing[4] || typeof drawing[4].substr !== "function") {
		console.log("INVALID DRAWING", drawing)
		callback("Drawing should be an array with a string on the fourth index.");
		return;
	}

	if (drawing[3] > 100) {
		callback("Don't try to cheat the system please!");
		return;
	}

	if (drawing[3] < 1) {
		callback("Nice try but that won't fly!");
		return;
	}

	if (typeof drawing[5] == "number" && typeof drawing[6] && this.sqDistance([drawing[1], drawing[2]], [drawing[5], drawing[6]]) > 9000000) {
		callback("That's a bit long don't you think?");
		return;
	}

	this.database.query("INSERT INTO drawings SET ?", {
		room: room,
		type: drawing[0],
		x: drawing[1],
		y: drawing[2],
		size: drawing[3],
		r: parseInt(drawing[4].substr(1, 2), 16),
		g: parseInt(drawing[4].substr(3, 2), 16),
		b: parseInt(drawing[4].substr(5, 2), 16),
		x1: drawing[5],
		y1: drawing[6],
		now: new Date()
	}, function (err) {
		if (err) {
			callback("Something went wrong trying to write your drawing into the database, it has been removed!");
			return;
		}
		callback();
	});
};

DrawTogether.prototype.sqDistance = function sqDistance (point1, point2) {
	var xDist = point1[0] - point2[0];
	var yDist = point1[1] - point2[1];
	return xDist * xDist + yDist * yDist;
};

DrawTogether.prototype.getDrawings = function getDrawings (room, callback) {
	// Return a list of network transmittable drawings

	var self = this;
	this.database.query("SELECT * FROM (SELECT id, type, x, y, x1, y1, size, r, g, b, room FROM drawings WHERE room = ? ORDER BY id DESC LIMIT 50000) AS T ORDER BY id ASC", room, function (err, rows) {
		if (err) {
			console.log(err);
			callback("Something went wrong while trying to retrieve the drawings from the database!");
			return;
		}
		self.encodeDrawings(rows, function (drawings) {
			callback(undefined, drawings);
		});
	});
	// callback(undefined, [])
};

DrawTogether.prototype.login = function login (data, callback) {
	// Check if an account with data.email and data.password exists
	
	this.database.query("SELECT id FROM users WHERE email = ? AND password = ?", [data.email, SHA256(data.password).toString()], function (err, rows) {
		if (err) callback(err);
		else callback(null, rows.length !== 0, (rows.length !== 0) ? rows[0].id : null);
	});
};

DrawTogether.prototype.accountExists = function accountExists (email, callback) {
	// Check if an account with the given email exists

	this.database.query("SELECT * FROM users WHERE email = ?", [email], function (err, rows) {
		callback(err, rows.length !== 0);
	});
};

DrawTogether.prototype.register = function register (data, callback) {
	// Add a user with the given data.email and data.password

	this.database.query("INSERT INTO users SET ?", {
		email: data.email,
		password: SHA256(data.password).toString()
	}, callback);
};

DrawTogether.prototype.encodeDrawings = function encodeDrawings (drawings, callback) {
	// Turn the drawing objects from the database into arrays
	// so they take less space when send to the client

	var new_drawings = [];

	for (var key = 0; key < drawings.length; key++) {
		new_drawings[key] = this.encodeDrawing(drawings[key]);
	}

	callback(new_drawings);
};

DrawTogether.prototype.encodeDrawing = function encodeDrawing (drawing) {
	// Turn a single drawing into an array so it takes less
	// space when transmitting over the network

	var newDrawing = [drawing.type, drawing.x, drawing.y, drawing.size, this.rgbToHex(drawing.r, drawing.g, drawing.b)];

	if (drawing.x1) newDrawing.push(drawing.x1);
	if (drawing.y1) newDrawing.push(drawing.y1);

	return newDrawing; 
};

DrawTogether.prototype.utils = {
	distance: function (x1, y1, x2, y2) {
		// Returns the distance between (x1, y1) and (x2, y2)
		var xDis = x1 - x2,
		    yDis = y1 - y1;
		return Math.sqrt(xDis * xDis + yDis * yDis);
	}
};

module.exports = DrawTogether;