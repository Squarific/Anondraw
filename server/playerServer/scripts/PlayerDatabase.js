var SHA256 = require("crypto-js/sha256");

function PlayerDatabase (database) {
	this.database = database;
}

// Callback(err, banned, {
//	  enddate: enddate,
//    reason: reason
// })
function isBannedHandler (callback, err, rows) {
	if (err) {
		callback(err);
		return;
	}

	if (rows.length == 0) {
		callback(null, false);
		return;
	}

	callback(null, true, {
		enddate: rows[0].enddate,
		reason: rows[0].reason
	});
}

// Callback see isbannedhandler
PlayerDatabase.prototype.isIpBanned = function isIpBanned (ip, callback) {
	this.database.query("SELECT enddate, reason FROM ipbans WHERE ip = ? AND enddate > ?", [ip, new Date()], isBannedHandler.bind(this, callback));
};

// Callback see isbannedhandler
PlayerDatabase.prototype.isIdBanned = function isIdBanned (id, callback) {
	this.database.query("SELECT enddate, reason FROM accountbans WHERE userid = ? AND enddate > ?", [id, new Date()], isBannedHandler.bind(this, callback));
};

PlayerDatabase.prototype.banIp = function banIp (ip, by, minutes, reason, callback) {
	var startdate = new Date();
	var enddate = new Date(Date.now() + parseInt(minutes) * 60 * 1000);

	this.database.query("INSERT INTO ipbans (ip, banned_by, startdate, enddate, reason) VALUES (?, ?, ?, ?, ?)", [ip, by, startdate, enddate, reason], function (err) {
		callback(err, !err);
	});
};

PlayerDatabase.prototype.banId = function banId (id, by, minutes, reason, callback) {
	var startdate = new Date();
	var enddate = new Date(Date.now() + parseInt(minutes) * 60 * 1000);

	this.database.query("INSERT INTO accountbans (userid, banned_by, startdate, enddate, reason) VALUES (?, ?, ?, ?, ?)", [id, by, startdate, enddate, reason], function (err) {
		callback(err, !err);
	});

};

// callback(err, id)
PlayerDatabase.prototype.login = function login (email, pass, callback) {
	var query = "select id, email, max(enddate) as endban, reason";
	query += " from users left join accountbans";
	query += " on users.id = accountbans.userid";
	query += " where email = ? AND pass = ?";
	query += " group by id";

	this.database.query(query, [email, SHA256(pass).toString()], function (err, rows) {
		if (err) {
			callback("Database error");
			console.log("[LOGIN ERROR] ", err);
			return;
		}

		if (rows.length < 1) {
			callback("This account/password combo was not found.");
			return;
		}

		if (rows[0].endban > new Date()) {
			callback("You have been banned till " + rows[0].endban + ". Reason: " + rows[0].reason);
			return;
		}

		callback(null, rows[0].id);
	});
};

PlayerDatabase.prototype.register = function register (email, pass, callback) {
	this.database.query("INSERT INTO users (email, pass, register_datetime) VALUES (?, ?, ?)", [email, SHA256(pass).toString(), new Date()], function (err, result) {
		if (err) {
			if (err.code == "ER_DUP_ENTRY") {
				callback("Already registered!");
				return;
			}
			callback("Database error");
			console.log("[REGISTER ERROR]", err);
			return;
		}

		console.log("[REGISTER] ", email);
		callback(null, result.insertId);
	}.bind(this));
};

PlayerDatabase.prototype.getReputation = function getReputation (userid, callback) {
	this.database.query("SELECT COUNT(*) as reputation FROM reputations WHERE to_id = ?", [userid], function (err, rows) {
		if (err) {
			callback("Database error (#1) while getting reputation.");
			console.log("[GETREPUTATION] Database error: ", err);
			return;
		}

		if (rows.length == 0) {
			callback("Database error (#2) while getting reputation");
			console.log("[GETREPUTATION] Rows length was 0 on a query that should always return at least one row!", rows);
			return;
		}

		callback(null, rows[0].reputation);
	});
};

PlayerDatabase.prototype.giveReputation = function giveReputation (fromId, toId, callback) {
	this.database.query("SELECT id FROM reputations WHERE from_id = ? AND to_id = ?", [fromId, toId], function (err, rows) {
		if (err) {
			callback("Database error (#1) trying to give reputation.");
			console.log("[GIVEREPUTATION] Database error while checking uniqueness: ", err);
			return;
		}

		if (rows.length > 0 && fromId !== 1) {
			callback("You already gave reputation!");
			return;
		}

		this.database.query("INSERT INTO reputations (from_id, to_id) VALUES (?, ?)", [fromId, toId], function (err, rows) {
			if (err) console.log("[GIVEREPUTATION] Database error inserting reputation");
			callback(err ? "Database error (#2) trying to give reputation." : null);
		});
	}.bind(this));
};

PlayerDatabase.prototype.setName = function setName (id, name) {
	this.database.query("UPDATE users SET last_username = ?, last_online = ? WHERE id = ?", [name, new Date(), id]);
};

PlayerDatabase.prototype.setOnline = function setOnline (id) {
	this.database.query("UPDATE users SET last_online = ? WHERE id = ?", [new Date(), id]);
};

PlayerDatabase.prototype.reputationList = function reputationList (id, callback) {
	var query = "SELECT u.last_username, u.last_online FROM reputations ";
	query += "JOIN users u ON to_id = u.id ";
	query += "WHERE from_id = ?";

	this.database.query(query, id, callback);
};

PlayerDatabase.prototype.setPermission = function setPermission (roomid, userid, level, callback) {
	this.database.query("SELECT roomid FROM permissions WHERE roomid = ? AND userid = ?",
	                    [roomid, userid], function (err, rows) {
		if (err) {
			callback(err);
			return;
		}

		if (rows.length > 1) {
			console.log("REPUTATION ERROR: Too many rows", roomid, userid);
			callback("An internal error occured.");
		} else if (rows.length == 1) {
			this.database.query("UPDATE premissions SET level = ? WHERE roomid = ? AND userid = ?",
			                    [level, roomid, userid], callback);
		} else {
			this.database.query("INSERT INTO permissions VALUES (?, ?, ?)",
			                    [roomid, userid, level], callback);
		}
	});
};

PlayerDatabase.prototype.getPermissionList = function getPermissionList (roomid, callback) {
	this.database.query(
		"SELECT last_username, last_online, level FROM permissions JOIN users ON id = userid WHERE roomid = ?",
		[roomid],
		callback
	);
};

PlayerDatabase.prototype.getPermission = function getPermission (roomid, userid, callback) {
	this.database.query(
		"SELECT level FROM permissions WHERE roomid = ? AND userid = ?",
		[roomid, userid],
		function (err, rows) {
			callback(err, rows && rows[0] && rows[0].level);
		}
	);
};

module.exports = PlayerDatabase;