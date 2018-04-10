function PrivateChats (container, server, account, messages) {
	this.container = container;
	this.account = account;
	this.messages = messages;
	
	this.gui = new Gui(this.container);
	this.socket = io(server, { transports: ['websocket'] });
	this.bindSocketListeners();

	this.windows = {};
	
	//Visibility compatibility 
	// Set the name of the hidden property and the change event for visibility
	//var this.hidden, this.visibilityChange; 
	if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
		this.hidden = "hidden";
		this.visibilityChange = "visibilitychange";
	} else if (typeof document.msHidden !== "undefined") {
		this.hidden = "msHidden";
		this.visibilityChange = "msvisibilitychange";
	} else if (typeof document.webkitHidden !== "undefined") {
		this.hidden = "webkitHidden";
		this.visibilityChange = "webkitvisibilitychange";
	}
}

/*
	Binds the eventhandlers for the socket
	Also registers us to listen to new messages
	message fromId, toId, send, text
*/
PrivateChats.prototype.bindSocketListeners = function bindSocketListeners () {
	this.socket.on("message", function (fromId, toId, sendDate, message) {
		console.log("Message received", fromId, toId, sendDate, message);
		
		if (this.isUserBlocked(fromId)) {
			console.log("Private message from " + fromId + " was blocked.");
			return;
		}
	
		this.addMessage(fromId, true, sendDate, message);
		
		if (Notification.permission !== "granted")
			Notification.requestPermission();
		else {
			var notification = new Notification("PM: ", {
				icon: 'https://www.anondraw.com/favicon.ico',
				body: message,
			});
		}
	}.bind(this));
	
	this.socket.emit("listen", this.account.uKey);
	this.account.addEventListener("change", function () {
		this.socket.emit("listen", this.account.uKey);
	}.bind(this));
};

/*
	Creates a chat window if one does not exist yet for the
	given userid
*/
PrivateChats.prototype.createChatWindow = function createChatWindow (userId, name) {
	if (!userId) { console.log("No userId provided when creating chat window"); return; }
	if (this.windows[userId] && this.windows[userId].parent) {
		console.log("A window for user " + userId + " was already open.");
		return;
	}
	
	this.windows[userId] = this.gui.createWindow({ title: "Chat with " + (name ? name : userId)});
	
	this.setupChatWindow(userId);
	
	if (!name)
		this.messages.getName(userId, function (err, data) {
			while (this.windows[userId].children[0].children[0].firstChild)
				this.windows[userId].children[0].children[0].removeChild(
					this.windows[userId].children[0].children[0].firstChild);
					
			this.windows[userId].children[0].children[0].appendChild(
				document.createTextNode("Chat with " + data.name));
		}.bind(this));
};

/*
	Returns if user is blocked given userid
*/
PrivateChats.prototype.isUserBlocked = function isUserBlocked (userId) {
	var chatFilterByPlayerArrStringified = localStorage.getItem("chatFilterByPlayerArr");
	if (chatFilterByPlayerArrStringified)
		var chatFilterByPlayerArr = JSON.parse(chatFilterByPlayerArrStringified);
	if (chatFilterByPlayerArr)
		for (var k = 0; k < chatFilterByPlayerArr.length; k++) {
			if (chatFilterByPlayerArr[k].userid && chatFilterByPlayerArr[k].userid == userId)
				if (chatFilterByPlayerArr[k].visibility == 0)
					return true;
		}
	return false;
};

/*
	Creates the dom elements in the given userid window
*/
PrivateChats.prototype.setupChatWindow = function setupChatWindow (userId) {
	this.setupMessages(userId);
	this.setupInput(userId);	
};

PrivateChats.prototype.setupMessages = function setupMessages (userId) {
	// Container for the messages
	var messageContainer = this.windows[userId].appendChild(document.createElement("div"));
	messageContainer.className = "pmwindowcontent";
	
	this.windows[userId].messageContainer = messageContainer;
};

PrivateChats.prototype.setupInput = function setupInput (userId) {
	var messageInput = this.windows[userId].appendChild(document.createElement("input"));
	messageInput.focus();
	messageInput.maxLength = 1024;
	messageInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13 && messageInput.value !== "") {
			this.messages.sendMessage(userId, messageInput.value, function (err, data) {
				if (err) {
					this.addError(userId, "Could not send message: " + err);
					console.log(err);
					return;
				}
			}.bind(this));
			
			this.addMessage(userId, false, Date.now(), messageInput.value);
			messageInput.value = "";
		}
	}.bind(this));
};

/*
	Adds a message to the given window
*/
PrivateChats.prototype.addMessage = function addMessage (userId, partner, sendDate, text) {
	if (!this.windows[userId] || !this.windows[userId].parentNode) this.createChatWindow(userId);
	
	var message = this.windows[userId].messageContainer.appendChild(document.createElement("div"));
	message.className = "message " + (partner ? "fromPartner" : "");
	message.appendChild(document.createTextNode(text));
	message.title = (new Date(sendDate)).toLocaleString();
	
	// Scroll the new message into view
	this.windows[userId].messageContainer.scrollTop =
		this.windows[userId].messageContainer.scrollHeight -
		this.windows[userId].messageContainer.getBoundingClientRect().height;
};

/*
	Adds an error message to the given window
*/
PrivateChats.prototype.addError = function addError (userId, text) {
	if (!this.windows[userId] || !this.windows[userId].parentNode) this.createChatWindow(userId);
	
	var message = this.windows[userId].messageContainer.appendChild(document.createElement("div"));
	message.className = "message error";
	message.appendChild(document.createTextNode(text));
	
	// Scroll the new message into view
	this.windows[userId].messageContainer.scrollTop =
		this.windows[userId].messageContainer.scrollHeight -
		this.windows[userId].messageContainer.getBoundingClientRect().height;
};