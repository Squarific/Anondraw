/*
	Events:
		change=the status of the ukey changed (logout, register, login, failed check, ...)
*/

function Account (server, uKey) {
	this.uKey = uKey || localStorage.getItem("drawtogether-uKey") || "";
	this.mail = localStorage.getItem("drawtogether-mail");
	this.lastLoginCheck; //Date.now() that we last checked if we were logged in
	this.server = server;
	setInterval(this.checkLogin.bind(this), 30 * 60 * 1000);
}

// Amount of time that we will assume we are logged in
Account.prototype.loginCheckTimeout = 45 * 60 * 1000;

// Same as checkLogin but caches result for loginCheckTimeout milliseconds
Account.prototype.isLoggedIn = function (callback) {
	if (Date.now() - this.lastLoginCheck < this.loginCheckTimeout) {
		callback(null, !!this.uKey);
		return;
	}
	
	this.checkLogin(callback);
};

// Callback (err)
Account.prototype.login = function login (email, unhashedPass, callback) {
	this.loginNoHash(email, CryptoJS.SHA256(unhashedPass).toString(CryptoJS.enc.Base64), callback);
};

// Takes in a base64 image and story, calls back with an id
Account.prototype.sharePicture = function sharePicture (image, story, callback) {
	this.request("/sharepicture", {
		uKey: this.uKey,
		story: story
	},
	image,
	this.parseData.bind(this, callback));
};

Account.prototype.setCoordFavorite = function (newX, newY, x, y, name, room, callback) {
	this.request("/setcoordfavorite", {
		uKey: this.uKey,
		room: room,
		newX: newX,
		newY: newY,
		x: x,
		y: y,
		name: name
	}, this.parseData.bind(this, callback));
};

Account.prototype.removeFavorite = function (x, y, name, room, callback) {
	this.request("/removefavorite", {
		uKey: this.uKey,
		room: room,
		x: x,
		y: y,
		name: name
	}, this.parseData.bind(this, callback));
};

Account.prototype.renameFavorite = function (x, y, name, room, callback) {
	this.request("/renamefavorite", {
		uKey: this.uKey,
		room: room,
		x: x,
		y: y,
		name: name
	}, this.parseData.bind(this, callback));
};

Account.prototype.createFavorite = function (x, y, name, room, callback) {
	this.request("/createfavorite", {
		uKey: this.uKey,
		room: room,
		x: x,
		y: y,
		name: name
	}, this.parseData.bind(this, callback));
};

Account.prototype.getFavorites = function (room, callback) {
	this.request("/getfavorites", {
		uKey: this.uKey,
		room: room
	}, this.parseData.bind(this, callback));
};

Account.prototype.forgot = function (email, callback) {
	this.request("/forgot", {
		email: email
	}, this.parseData.bind(this, callback));
};

/*
	Resets the pass for the given code
	Also logs us in with the new pass
	Callback (err, data) where data: {id, email, uKey}
*/
Account.prototype.reset = function (code, unhashedPass, callback) {
	var pass = CryptoJS.SHA256(unhashedPass).toString(CryptoJS.enc.Base64);
	this.request("/reset", {
		code: code,
		pass: pass
	}, this.parseData.bind(this, function (err, data) {
		if (err) {
			callback(err);
			return;
		}
		
		this.uKey = data.uKey;
		this.id = data.id;
		this.mail = data.email;
		this.lastLoginCheck = Date.now();
		
		localStorage.setItem("drawtogether-uKey", data.uKey);
		localStorage.setItem("drawtogether-mail", data.email);
		localStorage.setItem("drawtogether-pass", pass);
		
		this.dispatchEvent({ type: "change" });
		
		callback(null, data);
	}.bind(this)));
};

// Callback (err)
Account.prototype.loginNoHash = function loginNoHash (email, pass, callback) {
	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback(data.error)						
				return;
			}

			this.uKey = data.uKey;
			this.id = data.id;
			this.mail = email;
			this.lastLoginCheck = Date.now();
			localStorage.setItem("drawtogether-uKey", data.uKey);
			localStorage.setItem("drawtogether-mail", email);
			localStorage.setItem("drawtogether-pass", pass);
			this.dispatchEvent({ type: "change" });
			setTimeout(callback, 0);
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", this.server + "/login?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
	req.send();
};

// Callback(err)
Account.prototype.register = function register (email, pass, callback) {
	var req = new XMLHttpRequest();
	var pass = CryptoJS.SHA256(pass).toString(CryptoJS.enc.Base64);
	var ref = localStorage.getItem("drawtogether-referrer");

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback(data.error)						
				return;
			}

			this.uKey = data.uKey;
			this.id = data.id;
			this.mail = email;
			this.lastLoginCheck = Date.now();
			localStorage.setItem("drawtogether-uKey", data.uKey);
			localStorage.setItem("drawtogether-mail", email);
			localStorage.setItem("drawtogether-pass", pass);
			setTimeout(callback, 0);
			this.dispatchEvent({ type: "change" });
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", this.server + "/register?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass) + "&referral=" + encodeURIComponent(ref));
	req.send();
};

Account.prototype.logout = function logout (callback) {
	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback("There was an error trying to logout: " + data.error)						
				return;
			}

			localStorage.removeItem("drawtogether-uKey");
			localStorage.removeItem("drawtogether-mail");
			localStorage.removeItem("drawtogether-pass");
			delete this.uKey;
			delete this.mail;
			delete this.id;
			this.dispatchEvent({ type: "change" });

			setTimeout(function () {
				callback(null, true)
			}, 0);
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", this.server + "/logout?uKey=" + encodeURIComponent(this.uKey));
	req.send();
};

// Check to see if we have an active session
// If we don't have one, try to login using old data
// if we could log in returns (null, true)
// if that fails returns (err, false)
// if there is no email/pass stored returns (null, false)
// Callback (err, loggedIn)
Account.prototype.checkLogin = function checkLogin (callback) {
	callback = callback || function () {};

	if (!this.uKey && localStorage.getItem("drawtogether-mail") && localStorage.getItem("drawtogether-pass")) {
		this.loginNoHash(localStorage.getItem("drawtogether-mail"), localStorage.getItem("drawtogether-pass"), function (err) {
			callback(err, !err);
		});
		return;
	}

	if (!this.uKey) {
		setTimeout(function () {
			callback(null, false);
		}, 0);
		return;
	}

	var req = new XMLHttpRequest();

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				if (data.error == "Not logged in.") {
					delete this.uKey;
					delete this.id;
					localStorage.removeItem("drawtogether-uKey");

					// Our uKey expired, try logging in again
					if (localStorage.getItem("drawtogether-mail") && localStorage.getItem("drawtogether-pass")) {
						this.loginNoHash(localStorage.getItem("drawtogether-mail"), localStorage.getItem("drawtogether-pass"), function (err) {
							callback(err, !err);
						});
						return;
					}
					
					// Our uKey expired and we don't have the email/pass in localstorage
					callback(null, false);
					this.dispatchEvent({ type: "change" });
					return;
				}
				callback(data.error);			
				return;
			}

			this.id = data.id;
			this.lastLoginCheck = Date.now();
			
			// Our uKey is still valid
			setTimeout(function () {
				callback(null, true)
			}, 0);
		} else if (req.readyState == 4) {
			callback("Connection error: Status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", this.server + "/checklogin?uKey=" + encodeURIComponent(this.uKey));
	req.send();
};

// Gets the reputation list (aka friend list)
// Callback gives (err, data) where err is a string with an http error  or
// the error returned by the server in the parsed data object (data.error || data.err)
// data = the parsed json response text
Account.prototype.getReputationList = function getReputationList (callback) {
	this.request("/getreputationlist", {}, this.parseData.bind(this, function (err, data) {
		if (err || !data || data.error || data.err) {
			callback(err || data.error || data.err, data);
			return;
		}

		callback(null, data);
	}));
};

// Make a get request to the account server to the given path with the given options
// Options will be appended with {uKey: "The current ukey"}
// Callback returns (err, request) with error being a string with the http error (human readable)
// Request is the XMLHttpRequest with readyState == 4
// Two valid calls: request(path, options, callback) or request(path, options, body, callback)
// where callback has to be a function
Account.prototype.request = function request (path, options, body, callback) {
	if (!callback && typeof body == "function") {
		callback = body;
		body = null;
	}
	
	var req = new XMLHttpRequest();

	// Build the get parameter string
	var optionString = "?";

	// Add options to the string, uri encoded
	for (var k in options) {
		optionString += encodeURIComponent(k) + "=" + encodeURIComponent(options[k]) + "&";
	}

	// Remove trailing &
	optionString = optionString.slice(0, optionString.length - 1);


	req.addEventListener("readystatechange", function (event) {
		if (req.readyState == 4) {
			var err;

			if (req.status !== 200) {
				err = "Http error: " + req.status + " are you connected to the internet?";
			}

			callback(err, req);
		}
	});

	req.open(body ? "POST" : "GET", this.server + path + optionString);
	req.send(body);
};

// Parses the server returned data as a JSON object
// Callback gives err if err was already defined or if the JSON parsing failed
// Callback (err, data)
Account.prototype.parseData = function parseData (callback, err, request ) {
	if (err) {
		callback(err);
		return;
	}

	try {
		var data = JSON.parse(request.responseText);
	} catch (e) {
		err = "JSON Parse error. Server response was: " + request.responseText;
	}
	
	if (data.error) {
		callback(data.error)						
		return;
	}
	
	if (data.err) {
		callback(data.err);
		return;
	}

	callback(err, data);
};

/**
 * Event dispatcher
 * License mit
 * https://github.com/mrdoob/eventdispatcher.js
 * @author mrdoob / http://mrdoob.com/
 */

var EventDispatcher = function () {}

EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.addEventListener = EventDispatcher.prototype.addEventListener;
		object.hasEventListener = EventDispatcher.prototype.hasEventListener;
		object.removeEventListener = EventDispatcher.prototype.removeEventListener;
		object.dispatchEvent = EventDispatcher.prototype.dispatchEvent;

	},

	addEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) this._listeners = {};

		var listeners = this._listeners;

		if ( listeners[ type ] === undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	},

	hasEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return false;

		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {

			return true;

		}

		return false;

	},

	removeEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {

			var index = listenerArray.indexOf( listener );

			if ( index !== - 1 ) {

				listenerArray.splice( index, 1 );

			}

		}

	},

	dispatchEvent: function ( event ) {
			
		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [];
			var length = listenerArray.length;

			for ( var i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( var i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}

};

EventDispatcher.prototype.apply(Account.prototype);