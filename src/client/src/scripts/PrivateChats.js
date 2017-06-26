function PrivateChats (container, server, account, messages) {
	this.container = container;
	this.account = account;
	this.messages = messages;
	
	this.gui = new Gui(this.container);
	this.socket = io(server, { transports: ['websocket'] });
	this.bindSocketListeners();

	this.windows = {};
}

/*
	Binds the eventhandlers for the socket
	Also registers us to listen to new messages
	message fromId, toId, send, text
*/
PrivateChats.prototype.bindSocketListeners = function bindSocketListeners () {
	this.socket.on("message", function (fromId, toId, sendDate, message) {
		this.addMessage(fromId, true, sendDate, message);
	});
	
	this.socket.emit("listen", this.account.uKey);
	this.account.addEventListener("change", function () {
		this.socket.emit("listen", this.account.uKey);
	}.bind(this));
};

/*
	Creates a chat window if one does not exist yet for the
	given userid
*/
PrivateChats.prototype.createChatWindow = function createChatWindow (userId) {
	if (this.windows[userId]) {
		console.log("A window for user " + userId + " was already open.");
		return;
	}
	
	this.windows[userId] = this.gui.createWindow({ title: "chat" });
	
	this.setupChatWindow(this.windows[userId]);
};

/*
	Creates the dom elements in the given userid window
*/
PrivateChats.prototype.setupChatWindow = function setupChatWindow (userId) {
	this.setupMessages();
	this.SetupInput();	
};

PrivateChats.prototype.setupMessages = function setupMessages (userId) {
	// Container for the messages
	var messageContainer = this.windows[userId].appendChild(document.createElement("div"));
	messageContainer.className = "messageContainer";
	
	this.windows[userId].messageContainer = messageContainer;
};

PrivateChats.prototype.setupInput = function setupInput (userId) {
	var messageInput = this.windows[userId].appendChild(document.createElement("input"));
	messageInput.focus();
	messageInput.maxLength = 1024;
	messageInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) {
			this.messages.sendMessage(userId, messageInput.value, function (err, data) {
				if (err) {
					this.addError("Could not send message: " + err);
					console.log(err);
					return;
				}
			});
			
			this.addMessage(userId, false, Date.now(), messageInput.value);
			messageInput.value = "";
		}
	}.bind(this));
};

/*
	Adds a message to the given window
*/
PrivateChats.prototype.addMessage = function addMessage (userId, partner, sendDate, message) {
	if (!this.windows[userId]) this.createChatWindow();
	
	var message = this.windows[userId].messageContainer.appendChild(document.createElement("div"));
	message.className = "message " + partner ? "fromPartner" : "";
	message.appendChild(document.createTextNode(message));
	message.title = (new Date(sendDate)).toLocaleString();
	
	// Scroll the new message into view
	this.windows[userId].messageContainer.scrollTop =
		this.windows[userId].messageContainer.scrollHeight -
		this.windows[userId].messageContainer.getBoundingClientRect().height;
};

/*
	Adds an error message to the given window
*/
PrivateChats.prototype.addError = function addError (message) {
	if (!this.windows[userId]) this.createChatWindow();
	
	var message = this.windows[userId].messageContainer.appendChild(document.createElement("div"));
	message.className = "message error";
	message.appendChild(document.createTextNode(message));
	
	// Scroll the new message into view
	this.windows[userId].messageContainer.scrollTop =
		this.windows[userId].messageContainer.scrollHeight -
		this.windows[userId].messageContainer.getBoundingClientRect().height;
};