function DrawTogether (container, settings) {
	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Set tool values
	this.current_tool = this.TOOLS.BRUSH;
	this.current_color = [125, 125, 125];
	this.current_size = 5;

	// Connect to the server and bind socket events
	this.socket = io(this.settings.server);
	this.bindSocketHandlers(this.socket);

	// Initialize the dom elements
	this.initDom();
}

DrawTogether.prototype.defaultSettings = {
	server: "http://127.0.0.1:8080",       // Server to connect to, best to add http://
	mode: "public"                         // Mode: public, private, invite, game
	room: "main",                          // Room to join at startup
	locked_room: false                     // Is the user allowed to change the room?
	                                       // If the room is full it retries after 45sec
};

DrawTogheter.prototype.TOOLS = {
	"GRAB": 0,
	"LINE": 1,
	"BRUSH": 2,
	"BLOCK": 3
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
	var controls = this.createControlArray();
	this.controls = new Controls(controls, this.container).controls;
};

DrawTogether.prototype.createControlArray = function createControlArray () {
	return [{
		name: "grab",
		type: "button",
		image: "images/icons/grab.png",
		title: "Change tool to grab",
		value: "GRAB",
		action: this.changeTool.bind(this)
	}, {
		name: "line",
		type: "button",
		image: "images/icons/line.png",
		title: "Change tool to line",
		value: "LINE",
		action: this.changeTool.bind(this)
	}, {
		name: "brush",
		type: "button",
		image: "images/icons/brush.png",
		title: "Change tool to brush",
		value: "BRUSH",
		action: this.changeTool.bind(this)
	}, {
		name: "block",
		type: "button",
		image: "images/icons/block.png",
		title: "Change tool to block",
		value: "BLOCK",
		action: this.changeTool.bind(this)
	}, {
		name: "tool-size",
		type: "integer",
		min: 1,
		max: 50,
		value: 5,
		title: "Change the size of the tool",
		action: this.changeToolSize.bind(this)
	}, {
		name: "room",
		type: "text",
		value: "",
		title: "Change the room",
		button: "Change room",
		action: this.changeRoom.bind(this)
	}, {
		name: "name",
		type: "text",
		value: "",
		title: "Change your name",
		button: "Change name",
		action: this.changeName.bind(this)
	}, {
		name: "private",
		type: "button",
		text: "Random one-on-one",
		value: "private"
		action: this.changeMode.bind(this)
	}, {
		name: "invite",
		type: "button",
		text: "Friend room",
		value: "invite"
		action: this.changeMode.bind(this)
	}, {
		name: "game",
		type: "button",
		text: "Play game",
		value: "game"
		action: this.changeMode.bind(this)
	}];
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