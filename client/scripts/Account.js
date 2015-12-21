function Account (server, uKey) {
	this.uKey = uKey || localStorage.getItem("drawtogether-uKey") || "";
	this.mail = localStorage.getItem("drawtogether-mail");
	this.server = server;
	setInterval(this.checkLogin.bind(this), 30 * 60 * 1000);
}

// Callback (err)
Account.prototype.login = function login (email, unhashedPass, callback) {
	this.loginNoHash(email, CryptoJS.SHA256(unhashedPass).toString(CryptoJS.enc.Base64), callback);
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
			this.mail = email;
			localStorage.setItem("drawtogether-uKey", data.uKey);
			localStorage.setItem("drawtogether-mail", email);
			localStorage.setItem("drawtogether-pass", pass);
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

	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				callback(data.error)						
				return;
			}

			this.uKey = data.uKey;
			this.mail = email;
			localStorage.setItem("drawtogether-uKey", data.uKey);
			localStorage.setItem("drawtogether-mail", email);
			localStorage.setItem("drawtogether-pass", pass);
			setTimeout(callback, 0);
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", this.server + "/register?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
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
				if (data.error == "Not logged in") {
					delete this.uKey;
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
					return;
				}
				callback(data.error);			
				return;
			}

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
Account.prototype.request = function request (path, options, callback) {
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

	req.open("GET", this.server + path + optionString);
	req.send();
};

// Parses the server returned data as a JSON object
// Callback gives err if err was already defined or if the JSON parsing failed
// Callback (err, data)
Account.prototype.parseData = function parseData (err, request, callback) {
	if (err) {
		callback(err);
		return;
	}

	try {
		var data = JSON.parse(request.responseText);
	} catch (e) {
		err = "JSON Parse error. Server response was: " + request.responseText;
	}

	callback(err, data);
};