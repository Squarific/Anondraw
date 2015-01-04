function DrawTogether (container, settings) {
	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Connect to the server and bind socket events
	this.socket = io(this.settings.server);
	this.bindSocketHandlers(this.socket);

	// Initialize the dom elements
	this.initDom();

	// Start the draw loop
	this.startLoop();
}

DrawTogether.prototype.defaultSettings = {
	server: "http://127.0.0.1:8080",       // Server to connect to, best to add http://
	room: "main",                          // Room to join at startup
	locked_room: false                     // Is the user allowed to change the room?
	                                       // If the room is full it retries after 45sec
};

DrawTogether.prototype.bindSocketHandlers = function bindSocketHandlers (socket) {
	// Bind all socket events
	socket.on();
};

DrawTogether.prototype.initDom = function initDom () {
	// Create the chat, drawzone and controls
	this.createChat();
	this.createDrawZone();
	this.createControls();
};

DrawTogether.prototype.createChat = function createChat () {
	var chatContainer = this.container.appendChild(document.createElement("div"));

};

DrawTogether.prototype.createDrawZone = function createDrawZone () {
	var drawContainer = this.container.appendChild(document.createElement("div"));
};

DrawTogether.prototype.createControls = function createControls () {
	var controlContainer = this.container.appendChild(document.createElement("div"));
};

DrawTogether.prototype.startLoop = function startLoop () {

};

// Utility functions, should be kept small
DrawTogether.prototype.utils = {
	copy: function (object) {
		// Returns a deep copy of the object
		var copied_object = {};
		for (var key in object) {
			if (typeof object[key] == "object") {
				copied_object[key] = this.copy(object[key]);
			} else {
				copied_object[key] = object[key];
			}
		}
		return copied_object;
	},
	merge: function (targetobject, object) {
		// All undefined keys from targetobject will be filled
		// by those of object (goes deep)
		if (typeof targetobject != "object") {
			targetobject = {};
		}

		for (var key in object) {
			if (typeof object[key] == "object") {
				targetobject[key] = this.merge(targetobject[key], object[key]);
			} else if (typeof targetobject[key] == "undefined") {
				targetobject[key] = object[key];
			}
		}

		return targetobject;
	}
};