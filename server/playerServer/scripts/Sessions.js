var seconds = 1000;
var minutes = 60 * 1000;
var hours = 60 * 60 * 1000;

var STAY_LOGGED_IN = 30 * minutes; // How long should a session stay valid?
var MAX_SESSIONS = 50; // How many sessions can one user open?

function randomString (length) {
	var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
	var string = "";

	for (var k = 0; k < length; k++)
		string += chars[Math.floor(Math.random() * chars.length)];

	return string;
}

function Sessions (settings) {
	// Contains users
	// {id: Number, email: String, uKey: String, lastUpdate: Date.now()} //uKey is used for identification
	this.loggedInUsers = [];
	
	this.settings = settings || {};
	this.normalizeSettings();

	setInterval(this.cleanUsers.bind(this), 10 * 60 * 1000);
}

Sessions.prototype.normalizeSettings = function normalizeSettings () {
	this.settings.stayLoggedIn = this.settings.stayLoggedIn || STAY_LOGGED_IN;
	this.settings.maxSessions = this.settings.maxSessions || MAX_SESSIONS;
};

Sessions.prototype.getUser = function getUser (prop, value) {
	for (var k = 0; k < this.loggedInUsers.length; k++)
		if (this.loggedInUsers[k][prop] == value)
			return this.loggedInUsers[k];
		
	return null;
};

Sessions.prototype.addSession = function addSession (id, email) {
	var uKey = randomString(32);

	if (!this.getUser("uKey", uKey))
		console.log("Generated uKey was already in use.", uKey, this.loggedInUsers.length);

	this.loggedInUsers.push({
		id: id,
		email: email,
		uKey: uKey,
		lastUpdate: Date.now()
	});

	return uKey;
};

Sessions.prototype.logout = function logout (uKey) {

};

Sessions.prototype.loggedIn = function loggedIn (uKey) {
	for (var k = 0; k < this.loggedInUsers.length; k++) {
		if (this.loggedInUsers[k].uKey == uKey)
			return true;
	}

	return false;
};

Sessions.prototype.cleanUsers = function cleanUsers () {
	for (var k = 0; k < this.loggedInUsers.length; k++) {
		if (Date.now() - this.loggedInUsers[k].lastUpdate > this.settings.stayLoggedIn) {
			this.loggedInUsers.splice(k, 1);
			k--;
		}
	}
};

Sessions.prototype.tooManySessions = function tooManySessions (email) {
	var sessions = 0;
	for (var k = 0; k < this.loggedInUsers.length; k++)
		if (this.loggedInUsers[k].email == email) sessions++;

	return sessions >= this.settings.maxSessions;
};

module.exports = Sessions;