// var DRAWTOGETHER_ACCOUNT_SERVER = "http://direct.castlewar.net:4252";
var DRAWTOGETHER_ACCOUNT_SERVER = "http://localhost:4552";

function Account (uKey) {
	this.uKey = uKey || localStorage.getItem("drawtogether-uKey") || "";
	this.mail = localStorage.getItem("drawtogether-mail");
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

	req.open("GET", DRAWTOGETHER_ACCOUNT_SERVER + "/login?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
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
			localStorage.setItem("castlewar-uKey", data.uKey);
			localStorage.setItem("castlewar-mail", email);
			localStorage.setItem("castlewar-pass", pass);
			setTimeout(callback, 0);
		} else if (req.readyState == 4) {
			callback("Connection error, status code: " + req.status);
		}
	}.bind(this));

	req.open("GET", DRAWTOGETHER_ACCOUNT_SERVER + "/register?email=" + encodeURIComponent(email) + "&pass=" + encodeURIComponent(pass));
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

	req.open("GET", DRAWTOGETHER_ACCOUNT_SERVER + "/logout?uKey=" + encodeURIComponent(this.uKey));
	req.send();
};

// Check to see if we have an active session
// If we don't have one, try to login using old data
// if we could log in returns (null, true)
// if that fails returns (err, false)
// if there is no email/pass stored returns (null, false)
// Callback (err, loggedIn)
Account.prototype.checkLogin = function checkLogin (callback) {
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

	req.open("GET", DRAWTOGETHER_ACCOUNT_SERVER + "/checklogin?uKey=" + encodeURIComponent(this.uKey));
	req.send();
};