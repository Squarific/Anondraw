function Messages (server, account) {
	this.account = account;
	this.server = server;
}

// Send a message
// Callback gives (err, data) where err is a string with an http error  or
// the error returned by the server in the parsed data object (data.error || data.err)
// data = the parsed json response text
Messages.prototype.sendMessage = function sendMessage (to, message, callback) {
	this.request("/sendmessage", {
		uKey: this.account.uKey,
		to: to,
		message: message
	}, this.parseData.bind(this, function (err, data) {
		if (err || !data || data.error || data.err) {
			callback(err || data.error || data.err, data);
			return;
		}

		callback(null, data);
	}));
};

// Get a list of all conversations we have had
// Callback gives (err, data) where err is a string with an http error  or
// the error returned by the server in the parsed data object (data.error || data.err)
// data = the parsed json response text
Messages.prototype.getMessageList = function getMessageList (to, message, callback) {
	this.request("/getmessagelist", {
		uKey: this.account.uKey
	}, this.parseData.bind(this, function (err, data) {
		if (err || !data || data.error || data.err) {
			callback(err || data.error || data.err, data);
			return;
		}

		callback(null, data);
	}));
};

// Get the messages for a given partner
// Callback gives (err, data) where err is a string with an http error  or
// the error returned by the server in the parsed data object (data.error || data.err)
// data = the parsed json response text
Messages.prototype.getMessages = function getMessages (partner, before, callback) {
	this.request("/getmessages", {
		uKey: this.account.uKey,
		partner: partner,
		before: before
	}, this.parseData.bind(this, function (err, data) {
		if (err || !data || data.error || data.err) {
			callback(err || data.error || data.err, data);
			return;
		}

		callback(null, data);
	}));
};

// Make a get request to the message server to the given path with the given options
// Callback returns (err, request) with error being a string with the http error (human readable)
// Request is the XMLHttpRequest with readyState == 4
Messages.prototype.request = function request (path, options, callback) {
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
Messages.prototype.parseData = function parseData (callback, err, request) {
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

	callback(err, data);
};
