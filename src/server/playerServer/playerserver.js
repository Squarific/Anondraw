require("../common/nice_console_log.js");
var config = require("../common/config.js");
var emailTemplate = require("./emailTemplate.js");

var http = require("http");
var mysql = require("mysql");
var mailgun = require('mailgun-send');
var fs = require('fs');

var kickbancode = config.service.player.password.kickban;
var statuscode = config.service.player.password.status;

var database = mysql.createConnection({
	host: config.mysql.host,
	user: config.mysql.user,
	password: config.mysql.password,
	database: config.mysql.database,
	multipleStatements: true
});

mailgun.config({
	key: config.mail.key,
	domain: config.mail.domain,
	sender: config.mail.sender
});

var PlayerDatabase = require("./scripts/PlayerDatabase.js");
var MessageDatabase = require("./scripts/MessageDatabase.js");
var Sessions = require("./scripts/Sessions.js");

var playerDatabase = new PlayerDatabase(database);
var messageDatabase = new MessageDatabase(database);
var sessions = new Sessions();

var forgot = {};
var MAX_STORY_LENGTH = 4096;

var KB = 1024;
var MB = 1024 * KB;

// Ips from coinbase
var ALLOWED_PAYMENT_IPS = ["54.243.226.26", "54.175.255.192", "54.175.255.193", "54.175.255.194",
"54.175.255.195", "54.175.255.196", "54.175.255.197", "54.175.255.198", "54.175.255.199",
"54.175.255.200", "54.175.255.201", "54.175.255.202", "54.175.255.203", "54.175.255.204",
"54.175.255.205", "54.175.255.206", "54.175.255.207", "54.175.255.208", "54.175.255.209",
"54.175.255.210", "54.175.255.211", "54.175.255.212", "54.175.255.213", "54.175.255.214",
"54.175.255.215", "54.175.255.216", "54.175.255.217", "54.175.255.218", "54.175.255.219",
"54.175.255.220", "54.175.255.221", "54.175.255.222", "54.175.255.223"];

function randomString (length) {
	var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
	var string = "";

	for (var k = 0; k < length; k++)
		string += chars[Math.floor(Math.random() * chars.length)];

	return string;
}

var server = http.createServer(function (req, res) {
	var url = require("url");
	var parsedUrl = url.parse(req.url, true);
	
	console.log(req.url);

	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json"
	});
	
	if (parsedUrl.pathname == "/setbio") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var bio = parsedUrl.query.bio;

		if (!user) {
			res.end(JSON.stringify({ error: "User not logged in!" }));
			return;
		}
		
		if (bio.length > MAX_STORY_LENGTH) {
			res.end(JSON.stringify({ error: "Your bio is too long. Max " + MAX_STORY_LENGTH + " chars. Yours is: " +  bio.length }));
			return;
		}
		
		playerDatabase.setBio(user.id, bio, function (err) {
			res.end(JSON.stringify({
				error: err
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/getFullEntries") {
		var month = parsedUrl.query.month;
		var year = parsedUrl.query.year;
		
		playerDatabase.getFullEntries(month, year, function (err, data) {
			res.end(JSON.stringify({
				error: err,
				entries: data
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/getContestEntries") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		
		if (!user) {
			res.end(JSON.stringify({ error: "You need to be logged in to vote!" }));
			return;
		}
		
		if (new Date().getDate() <= 21) {
			res.end(JSON.stringify({ error: "Voting will be possible the 21nd of this month." }));
			return;
		} else if (new Date().getDate() > 27) {
			res.end(JSON.stringify({ error: "A new theme will be announced the first of next month. The 21nd of next month you will be able to vote again. For now, check out the winners!" }));
			return;
		}
		
		playerDatabase.getContestEntries(user.id, function (err, data) {
			res.end(JSON.stringify({
				error: err,
				entries: data
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/vote") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var imageId = parsedUrl.query.image;
		
		if (!user) {
			res.end(JSON.stringify({ error: "You need to be logged in to vote!" }));
			return;
		}
		
		if (new Date().getDate() <= 21) {
			res.end(JSON.stringify({ error: "Voting will be possible the 21nd of this month." }));
			return;
		} else if (new Date().getDate() > 27) {
			res.end(JSON.stringify({ error: "A new theme will be announced the first of next month. The 21nd of next month you will be able to vote again. For now, check out the winners!" }));
			return;
		}
		
		playerDatabase.vote(user.id, imageId, function (err) {
			res.end(JSON.stringify({
				error: err
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/getprofiledata") {
		var id = parsedUrl.query.id;
		playerDatabase.getProfileData(id, function (err, data) {
			res.end(JSON.stringify({
				error: err,
				profile: data
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/getpicturestories") {
		playerDatabase.getPictureStories(function (err, stories) {
			res.end(JSON.stringify({
				error: err,
				stories: stories
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/entercontest") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var names = parsedUrl.query.names;
		var socials = parsedUrl.query.socials;
		
		if (!user) {
			res.end(JSON.stringify({ error: "User not logged in!" }));
			return;
		}
		
		if (!names || !names.length) {
			res.end(JSON.stringify({ error: "No names provided." }));
			return;
		}
		
		if (new Date().getDate() > 21) {
			res.end(JSON.stringify({ error: "You can enter again the first of next month!" }));
			return;
		}
		
		// If only one name or social is provided it will get parsed as a string instead of an array
		if (!Array.isArray(names)) {
			names = [names];
		}
		
		if (!Array.isArray(socials)) {
			socials = [socials];
		}
		
		var team = [];
		for (var k = 0; k < names.length; k++) {
			team.push({ name: names[k], social: socials[k]});
		}
		
		var body = [];
		req.on('data', function (chunk) {
			body.push(chunk);
		}).on('end', function () {
			body = Buffer.concat(body).toString();
			
			if (body.length > 15 * MB) {
				res.end(JSON.stringify({ error: "Image is too large!" }));
				return;
			}
			
			var postId = randomString(48);
			var data = body.replace(/^data:image\/\w+;base64,/, "");
			fs.writeFile("images/" + postId + ".png", data, 'base64', function (err) {
				if (err) {
					res.end(JSON.stringify({ error: "Could not save image." }));
					console.log(err);
					return;
				}
			
				playerDatabase.enterContest(user.id, postId, team, function (err) {
					res.end(JSON.stringify({
						error: err
					}));
				});
			});
			
		}).on('error', function (err) {
			console.error(err);
			res.end(JSON.stringify({ error: "Something went wrong." }));
		});
		
		return;
	}
	
	if (parsedUrl.pathname == "/sharepicture") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var story = parsedUrl.query.story;
		var type = parsedUrl.query.type;

		if (!user) {
			res.end(JSON.stringify({ error: "User not logged in!" }));
			return;
		}
		
		if (story.length > MAX_STORY_LENGTH) {
			res.end(JSON.stringify({ error: "Your story is too long. Max " + MAX_STORY_LENGTH + " chars. Yours is: " +  story.length }));
			return;
		}

		var body = [];
		req.on('data', function (chunk) {
			body.push(chunk);
		}).on('end', function () {
			body = Buffer.concat(body).toString();
			
			if (body.length > 10 * MB) {
				res.end(JSON.stringify({ error: "Image is too large!" }));
				return;
			}
			
			var id = randomString(48);
			var data = body.replace(/^data:image\/\w+;base64,/, "");
			fs.writeFile("images/" + id + ".png", data, 'base64', function (err) {
				if (err) {
					res.end(JSON.stringify({ error: "Could not save image." }));
					console.log(err);
					return;
				}
			
				playerDatabase.sharePicture(user.id, id, story, type, function (err) {
					res.end(JSON.stringify({ error: err, id: id }));
				});
			});
			
		}).on('error', function (err) {
			console.error(err);
			res.end(JSON.stringify({ error: "Something went wrong." }));
		});

		return;
	}
	
	if (parsedUrl.pathname == "/profile") {
		var userId = parsedUrl.query.user;

		playerDatabase.getProfile(userId, function (err, data) {
			res.end(JSON.stringify({
				err: err,
				data: data
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/forgot") {
		var email = parsedUrl.query.email;
		
		if (forgot[req.connection.remoteAddress] &&
		    Date.now() - forgot[req.connection.remoteAddress] < 30000) {
			res.end(JSON.stringify({ err: "You are doing this too quickly." }));
			return;
		}
		
		if (!email) {
			res.end(JSON.stringify({ err: "No email provided" }));
			return;
		}
		
		forgot[req.connection.remoteAddress] = Date.now();
		
		var code = randomString(16);
		console.log("Forgot pass", req.connection.remoteAddress, email);

		var forgotLink = config.mail.forgotlink + '/reset?code=' + code;
		mailgun.send({
			subject: "Password reset for anondraw.com",
			recipient: email,
			body: emailTemplate.replace("$forgotlink", forgotLink)
		}, function (err) {
			if (err) console.log("Forgot send mail error:", err);
		});

		playerDatabase.forgot(email, req.connection.remoteAddress, code, function (err) {
			res.end(JSON.stringify({
				err: err
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/reset") {
		var code = parsedUrl.query.code;
		var pass = parsedUrl.query.pass;
		
		console.log("Resetting password", code, req.connection.remoteAddress, pass);

		playerDatabase.reset(code, pass, function (err, id, email) {
			if (err) {
				res.end('{"err": "' + err + '"}');
				return;
			}
			
			var uKey = sessions.addSession(id, email);
			playerDatabase.setOnline(id);
			res.end(JSON.stringify({
				uKey: uKey,
				id: id,
				email: email
			}));
		});
		return;
	}

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
			playerDatabase.setOnline(id);
			res.end(JSON.stringify({
				success: "Logged in",
				uKey: uKey,
				id: id
			}));
		});

		return;
	}

	if (parsedUrl.pathname == "/register") {
		var email = parsedUrl.query.email;
		var pass = parsedUrl.query.pass;
		var referral = parseInt(parsedUrl.query.referral);

		if (!email || !pass) {
			res.end('{"error": "No user or password provided"}');
			return;
		}
		
		if (referral !== referral) referral = 0;

		playerDatabase.isIpBanned(req.connection.remoteAddress, function (err, banned, info) {
			if (err) {
				res.end('{"error": "Couldn\'t check if your ip was banned."}');
				console.error(err);
				return;
			}

			if (banned) {
				res.end('{"error": "Your ip has been banned till ' + new Date(info.enddate) + '. Reason: ' + info.reason + '"}');
				return;
			}

			playerDatabase.register(email, pass, referral, function (err, id) {
				if (err) {
					res.end('{"error": "' + err + '"}');
					return;
				}

				var uKey = sessions.addSession(id, email);
				playerDatabase.setOnline(id);
				res.end(JSON.stringify({
					success: "Logged in",
					uKey: uKey,
					id: id
				}));
			});
		});

		return;
	}

	if (parsedUrl.pathname == "/getmemberlevel") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({ error: "User not logged in!" }));
			return;
		}

		playerDatabase.getMemberLevel(user.id, function (err, memberlevel, userid) {
			if (err) {
				res.end(JSON.stringify({ error: err }));
				return;
			}
			res.end(JSON.stringify({ memberlevel: memberlevel, userid: user.id }));
		});

		return;
	}

	if (parsedUrl.pathname == "/setpermission") {
		var roomid = parsedUrl.query.roomid;
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				err: "You are not logged in!"
			}));
			return;
		}

		if (user.id !== roomid) {
			res.end(JSON.stringify({
				err: "You can only change the premissions of your own room."
			}));
			return;
		}

		playerDatabase.setPermission(roomid, user.id, level, function (err) {
			if (err) {
				res.end(JSON.stringify({err: err}));
				return;
			}

			res.end(JSON.stringify({success: "Permission set!"}));
		});
		return;
	}

	if (parsedUrl.pathname == "/getpermission") {
		var uKey = parsedUrl.query.uKey;
		var roomid = parsedUrl.query.roomid;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({err: "User not logged in!"}));
			return;
		}

		playerDatabase.getPermission(roomid, user.id, function (err, level) {
			res.end(JSON.stringify({
				err: err,
				level: level
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/getpermissionlist") {
		var roomid = parsedUrl.query.roomid;
		
		playerDatabase.getPermissionList(roomid, function (err, list) {
			res.end(JSON.stringify({
				err: err,
				list: list
			}));
		});
		return;
	}
	
	if (parsedUrl.pathname == "/getname") {
		var userId = parsedUrl.query.userId;
		
		playerDatabase.getName(userId, function (err, name) {
			res.end(JSON.stringify({
				err: err,
				name: name
			}));
		});
		
		return;
	}
	
	if (parsedUrl.pathname == "/sendmessage") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var to = parsedUrl.query.to;
		var message = parsedUrl.query.message;
		
		if (!message) {
			res.end('{"error": "You need to put something in the message"}');
			return;
		}
		
		if (!to) {
			res.end('{"error": "You need to specify who you want to send a message to"}');
			return;
		}
		
		if (message.length > 1024) {
			res.end('{"error": "Messages should not be longer than 1024 characters"}');
			return;
		}

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		console.log("[SEND MESSAGE]", user.id, to, message);
		messageDatabase.addMessage(user.id, to, message, function (err, id) {
			res.end(JSON.stringify({
				err: err,
				id: id
			}));
			
			if (!err && listeners[to])
				for (var k = 0; k < listeners[to].length; k++)
					listeners[to][k].emit("message", user.id, to, new Date(), message);
		});
		return;
	}
	
	/*
		Returns the list of conversations for a given user
	*/
	if (parsedUrl.pathname == "/getmessagelist") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		messageDatabase.getMessageList(user.id, function (err, list) {
			res.end(JSON.stringify({
				err: err,
				list: list
			}));
		});
		return;
	}
	
	/*
		Returns the MESSAGES_PER_REQUEST messages before the given message
		if no message is given, gives the last MESSAGES_PER_REQUEST messages
	*/
	if (parsedUrl.pathname == "/getmessages") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var before = parseInt(parsedUrl.query.before);
		var partner = parsedUrl.query.partner;
		
		// If before is NaN, we force it to be undefined
		if (before !== before) before = undefined;

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		messageDatabase.getMessages(user.id, partner, before, function (err, messages) {
			res.end(JSON.stringify({
				err: err,
				messages: messages
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/setname") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var name = parsedUrl.query.name;

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		console.log("[SET NAME]", user.id, name);
		playerDatabase.setName(user.id, name);
		res.end('{"success": "done"}');
		return;
	}

	if (parsedUrl.pathname == "/reputationlist") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		playerDatabase.reputationList(user.id, function (err, list) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				console.log("[GETREPUTATIONLIST][ERROR]", err);
				return;
			}

			res.end('{"reputationlist": ' + JSON.stringify(list) + '}');
		});
		return;
	}

	if (parsedUrl.pathname == "/friendlist") {
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end('{"error": "You are not logged in!"}');
			return;
		}

		playerDatabase.friendList(user.id, function (err, list) {
			if (err) {
				res.end('{"error": "' + err + '"}');
				console.log("[FRIENDLIST][ERROR]", err);
				return;
			}

			res.end('{"friendlist": ' + JSON.stringify(list) + '}');
		});
		return;
	}


	if (parsedUrl.pathname == "/checklogin") {
		var uKey = parsedUrl.query.uKey;

		if (!uKey) {
			res.end('{"error": "No uKey provided"}');
			return;
		}

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end('{"error": "Not logged in."}');
			return;
		}

		playerDatabase.setOnline(user.id);
		res.end('{"success": "Logged in", "id": ' + user.id + '}');
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
			if (!user) {
				res.end('{"error": "No such session"}');
				return;
			}
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

	// Query params: target, by, minutes, reason, kickbancode
	if (parsedUrl.pathname == "/kickban") {
		if (parsedUrl.query.kickbancode !== kickbancode) {
			console.log("Unauthorized kickban request.", req.connection.remoteAddress);
			res.end('{"error": "Your kickbancode was wrong!"}');
			return;
		}

		var by = sessions.getUser("uKey", parsedUrl.query.by);
		if (!by) {
			res.end('{"error": "The person trying to ban is not logged in."}');
			return;
		}

		if (parsedUrl.query.target) {
			var target = sessions.getUser("uKey", parsedUrl.query.target);
			if (!target) {
				res.end('{"error": "The account you are trying to ban is not logged in"}');
				return;
			}

			playerDatabase.banId(target.id, by.id, parsedUrl.query.minutes, parsedUrl.query.reason, function (err) {
				if (err) {
					res.end('{"error": "Couldn\'t ban this person"}');
					console.log("[BANID][ERROR]", err, target);
					return;
				}

				res.end('{"success": "User banned"}');
				sessions.logout(target.ukey);
			});
			return;
		}

		if (!parsedUrl.query.ip) {
			res.end('{"error": "No target ukey or ip provided!"}');
			return;
		}

		playerDatabase.banIp(parsedUrl.query.ip, by.id, parsedUrl.query.minutes, parsedUrl.query.reason, function (err) {
			if (err) {
				res.end('{"error": "Couldn\'t ban this ip"}');
				console.log("[BANIP][ERROR]", err, parsedUrl.query.ip);
				return;
			}

			res.end('{"success": "Ip banned"}');
		});
		return;
	}

	if (parsedUrl.pathname == "/isbanned") {
		var ip = parsedUrl.query.ip;

		playerDatabase.isIpBanned(ip, function (err, banned, info) {
			res.end(JSON.stringify({
				error: err,
				banned: banned,
				info: info
			}));
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
		if (pass !== statuscode) {
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.end('{"players": ' + JSON.stringify(sessions.loggedInUsers) + '}');
		return;
	}
	if (parsedUrl.pathname == "/setcoordfavorite") {
		var x = parseInt( parsedUrl.query.x || "" );
		var y = parseInt( parsedUrl.query.y || "" );
		var newX = parseInt( parsedUrl.query.newX || "" );
		var newY = parseInt( parsedUrl.query.newY || "" );
		var room = parsedUrl.query.room;
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var name = parsedUrl.query.name;
		if(!user){
			res.end(JSON.stringify({
				error: "not logged in"
			}));
			return;
		}
		if( isNaN(x) || isNaN(y) || isNaN(newX) || isNaN(newY) ){
			res.end(JSON.stringify({
				error: "Bad number in x or y!"
			}));
			return;
		}
		playerDatabase.setCoordFavorite(user.id, newX, newY, x, y, name, room, function (err) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: true
			}));
		});

		return;
	}
	if (parsedUrl.pathname == "/removefavorite") {
		var x = parseInt( parsedUrl.query.x || "" );
		var y = parseInt( parsedUrl.query.y || "" );
		var room = parsedUrl.query.room;
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var name = parsedUrl.query.name;
		if(!user){
			res.end(JSON.stringify({
				error: "not logged in"
			}));
			return;
		}
		if( isNaN(x) || isNaN(y) ){
			res.end(JSON.stringify({
				error: "Bad number in x or y!"
			}));
			return;
		}
		playerDatabase.removeFavorite(user.id, x, y, name, room, function (err) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: true
			}));
		});

		return;
	}
	if (parsedUrl.pathname == "/renamefavorite") {
		var x = parseInt( parsedUrl.query.x || "" );
		var y = parseInt( parsedUrl.query.y || "" );
		var room = parsedUrl.query.room;
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		var name = parsedUrl.query.name;
		if(!user){
			res.end(JSON.stringify({
				error: "not logged in"
			}));
			return;
		}
		if( isNaN(x) || isNaN(y) ){
			res.end(JSON.stringify({
				error: "Bad number in x or y!"
			}));
			return;
		}
		playerDatabase.renameFavorite(user.id, x, y, name, room, function (err) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: true
			}));
		});

		return;
	}
	
	if (parsedUrl.pathname == "/getfavorites") {
		var room = parsedUrl.query.room;
		var uKey = parsedUrl.query.uKey;
		var user = sessions.getUser("uKey", uKey);
		if(!user){
			res.end(JSON.stringify({
				error: "not logged in"
			}));
			return;
		}
		playerDatabase.getFavorites(user.id, room, function (err, favorites) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify(favorites));
		});

		return;
	}
	if (parsedUrl.pathname == "/createfavorite") {
		var x = parseInt( parsedUrl.query.x || "" );
		var y = parseInt( parsedUrl.query.y || "" );
		var name = parsedUrl.query.name || "";		
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		
		var user = sessions.getUser("uKey", uKey);
		if(!user){
			res.end(JSON.stringify({
				error: "not logged in"
			}));
			return;
		}
		if( isNaN(x) || isNaN(y) ){
			res.end(JSON.stringify({
				error: "Bad number in x or y!"
			}));
			return;
		}
		playerDatabase.addFavorite(user.id, x, y, name, room, function (err) {
			if (err) {
				console.log('Create favorite database error', err, user.id, x, y);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			console.log("[FAVORITE ADDED]", user.id, x, y, err);
			res.end(JSON.stringify({
				success: 'Added favorite.',
				owner: user.id
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/createprotectedregion") {
		var from = parsedUrl.query.from || "";
		from = from.split(',');

		var to = parsedUrl.query.to || "";
		to = to.split(',');

		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;

		if (from.length !== 2 || to.length !== 2) {
			res.end(JSON.stringify({
				error: "From or to was not an array of length 2, format: from=5,4"
			}));
			return;
		}

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		from = [parseInt(from[0]), parseInt(from[1])];
		to = [parseInt(to[0]), parseInt(to[1])];

		if (from[0] !== from[0] || from[1] !== from[1] || to[0] !== to[0] || to[1] !== to[1]) {
			res.end(JSON.stringify({
				error: "Bad number in from or to array!"
			}));
			return;
		}

		playerDatabase.addProtectedRegion(user.id, from, to, room, function (err) {
			if (err) {
				console.log('Creat protected region database error', err, user.id, from, to);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			console.log("[PROTECTED REGION ADDED]", user.id, from, to);
			res.end(JSON.stringify({
				success: 'Added region.'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/resetprotectedregions") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.resetProtectedRegions(user.id, room, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: 'Reset your regions.'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/removeprotectedregion") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		var regionId = parsedUrl.query.regionId;
		var overrideOwner = (parsedUrl.query.overrideOwner === 'true'); //sent in as string. so we convert

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.removeProtectedRegion(user.id, room, regionId, overrideOwner, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: 'Remove your region.'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/getprotectedregions") {
		var room = parsedUrl.query.room;

		playerDatabase.getProtectedRegions(room, function (err, regions) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify(regions));
		});

		return;
	}
	
	if (parsedUrl.pathname == "/getProtectedRegionsAndPermissions") {
		var room = parsedUrl.query.room;

		playerDatabase.getProtectedRegionsAndPermissions(room, function (err, regions) {
			if (err) {
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify(regions));
		});

		return;
	}
	
	if (parsedUrl.pathname == "/setnameofprotectedregion") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		var name = parsedUrl.query.name;
		
		var regionId = parsedUrl.query.regionId;

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.setNameOfProtectedRegion(user.id, room, name, regionId, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}
			
			res.end(JSON.stringify({
				success: 'Renamed Region'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/adduserstomyprotectedregion") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		var userIdArr = parsedUrl.query.userIdArr;
		 // when userIdArr is only one element it's parsed as just a string of that number. idk why. -intOrFloat
		var regionId = parsedUrl.query.regionId;

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.addUsersToMyProtectedRegion(user.id, room, userIdArr, regionId, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}
			var responseStringValue = "1";
			if(typeof userIdArr !== 'string')
				responseStringValue = userIdArr.length;

			res.end(JSON.stringify({
				success: 'Added '+responseStringValue+' Permissions'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/removeUsersFromMyProtectedRegion") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		var userIdArr = parsedUrl.query.userIdArr;
		 // when userIdArr is only one element it's parsed as just a string of that number. idk why. -intOrFloat
		var regionId = parsedUrl.query.regionId;

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.removeUsersToMyProtectedRegion(user.id, room, userIdArr, regionId, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}
			var responseStringValue = "1";
			if(typeof userIdArr !== 'string')
				responseStringValue = userIdArr.length;

			res.end(JSON.stringify({
				success: 'removed '+responseStringValue+' Permissions'
			}));
		});
		return;
	}

	if (parsedUrl.pathname == "/setminimumrepinprotectedregion") {
		var uKey = parsedUrl.query.uKey;
		var room = parsedUrl.query.room;
		var repAmount = parsedUrl.query.repAmount;
		var regionId = parsedUrl.query.regionId;

		var user = sessions.getUser("uKey", uKey);

		if (!user) {
			res.end(JSON.stringify({
				error: "No user found with that uKey!"
			}));
			return;
		}

		playerDatabase.setMinimunRepInProtectedRegion(user.id, room, repAmount, regionId, function (err) {
			if (err) {
				console.log(err);
				res.end(JSON.stringify({
					error: err
				}));
				return;
			}

			res.end(JSON.stringify({
				success: 'Set minimum rep.'
			}));
		});
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

			console.log("[PAYMENT]", data, data.customer.email);
			res.end('{"success": "Payment applied!"}');
			return;
		});
	    return;
	}

	res.end('{"error": "Unknown command"}');
}.bind(this)).listen(config.service.player.port);

var app = http.createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(config.service.messages.port);

function handler (req, res) {
    res.writeHead(200);
    res.end("Sup");
}

var listeners = {};

function addListener (socket, userid) {
	listeners[userid] = listeners[userid] || [];
	listeners[userid].push(socket);

	socket.userid = userid;
}

function removeListener (socket) {
	if (listeners[socket.userid])
		while (listeners[socket.userid].indexOf(socket) != -1)
			listeners[socket.userid].splice(listeners[socket.userid].indexOf(socket), 1);
}

/*
	server events:    listen uKey
	client events:    message fromId, toId, send, text
*/
io.on('connection', function (socket) {
	socket.on('listen', function (uKey) {
		removeListener(socket);
		
		var user = sessions.getUser("uKey", uKey);
		if (!user) return;
		
		addListener(socket, user.id);		
	});
	
	socket.on('disconnect', function () {
		removeListener(socket);
	});
});
