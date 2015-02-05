function DrawTogether (container, settings) {
	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Initialize the dom elements
	this.initDom();

	// Connect to the server and bind socket events
	this.socket = io(this.settings.server);
	this.bindSocketHandlers(this.socket);
}

DrawTogether.prototype.defaultSettings = {
	server: "http://127.0.0.1:8080",       // Server to connect to, best to add http://
	mode: "public",                        // Mode: public, private, invite, game
	room: "main",                          // Room to join at startup
	locked_room: false                     // Is the user allowed to change the room?
	                                       // If the room is full it retries after 45sec
};

DrawTogether.prototype.drawingTypes = ["line", "brush", "block"];
DrawTogether.prototype.drawingTypesByName = {"line": 0, "brush": 1, "block": 2};

DrawTogether.prototype.bindSocketHandlers = function bindSocketHandlers (socket) {
	// Bind all socket events
	var self = this;

	socket.on("connect", function () {
		self.chat.addMessage("CLIENT", "Connected to " + self.settings.server);

		if (localStorage.getItem("drawtogether-name"))
			self.changeName(localStorage.getItem("drawtogether-name"));

		self.changeRoom(self.settings.room);
	});

	socket.on("disconnect", function () {
		self.chat.addMessage("CLIENT", "Lost connection to the server.");
	});

	socket.on("reconnect", function () {
		self.chat.addMessage("CLIENT", "Reconnected to " + self.settings.server);
	})

	socket.on("drawings", function (data) {
		self.setRoom(data.room);
		self.paint.clear();
		self.paint.drawDrawings("public", self.decodeDrawings(data.drawings));
		self.chat.addMessage("CLIENT", "===== READY TO DRAW =====");
	});

	socket.on("drawing", function (drawing) {
		self.paint.drawDrawing("public", self.decodeDrawing(drawing));
	})

	socket.on("initname", function (name) {
		// Server gave us a guest name, set name only
		// if we didn't ask for a different one
		if (!localStorage.getItem("drawtogether-name")) {
			self.setName(name);
		}
	});

	socket.on("forcename", self.setName)

	socket.on("chatmessage", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user, data.message);
	});
};

DrawTogether.prototype.sendMessage = function sendMessage (message) {
	this.socket.emit("chatmessage", message);
};

DrawTogether.prototype.changeRoom = function changeRoom (room) {
	room = room || this.controls.byName.room.input.value;
	this.socket.emit("changeroom", room);
	this.chat.addMessage("CLIENT", "Changing room to '" + room + "'");
};

DrawTogether.prototype.changeName = function changeName (name) {
	name = name || this.controls.byName.name.input.value;
	this.socket.emit("changename", name);
	localStorage.setItem("drawtogether-name", name);
};

DrawTogether.prototype.sendDrawing = function sendDrawing (drawing, callback) {
	this.socket.emit("drawing", this.encodeDrawing(drawing), callback);
};

DrawTogether.prototype.encodeDrawing = function encodeDrawing (drawing) {
	var newDrawing = [this.drawingTypesByName[drawing.type], drawing.x, drawing.y, drawing.size, drawing.color];
	if (drawing.x1) newDrawing.push(drawing.x1);
	if (drawing.y1) newDrawing.push(drawing.y1);
	return newDrawing; 
};

DrawTogether.prototype.decodeDrawing = function decodeDrawing (drawing) {
	var newDrawing = {
		type: this.drawingTypes[drawing[0]],
		x: drawing[1],
		y: drawing[2],
		size: drawing[3],
		color: drawing[4]
	};

	if (drawing[5]) newDrawing.x1 = drawing[5];
	if (drawing[6]) newDrawing.y1 = drawing[6];

	return newDrawing;
};

DrawTogether.prototype.decodeDrawings = function decodeDrawings (drawings) {
	for (var dKey = 0; dKey < drawings.length; dKey++) {
		drawings[dKey] = this.decodeDrawing(drawings[dKey]);
	}
	return drawings;
};

DrawTogether.prototype.setName = function setName (name) {
	// Set the input field to our username, mention in chat and save to storage
	this.controls.byName.name.input.value = name;
	this.chat.addMessage("SERVER", "Name set to '" + name + "'");
	localStorage.setItem("drawtogether-name", name);
};

DrawTogether.prototype.setRoom = function setRoom (room) {
	this.controls.byName.room.input.value = room;
};

DrawTogether.prototype.initDom = function initDom () {
	// Create the chat, drawzone and controls
	this.createChat();
	this.createDrawZone();
	this.createControls();
};

DrawTogether.prototype.createChat = function createChat () {
	var chatContainer = this.container.appendChild(document.createElement("div"));
	chatContainer.className = "drawtogether-chat-container";
	this.chat = new Chat(chatContainer, this.sendMessage.bind(this));
};

DrawTogether.prototype.createDrawZone = function createDrawZone () {
	var drawContainer = this.container.appendChild(document.createElement("div"));
	drawContainer.className = "drawtogether-paint-container";
	this.paint = new Paint(drawContainer);
	this.paint.addEventListener("userdrawing", function (event) {
		this.sendDrawing(event.drawing, function () {
			event.removeDrawing();
		});
	}.bind(this));
};

DrawTogether.prototype.createControls = function createControls () {
	var controlContainer = this.container.appendChild(document.createElement("div"));
	controlContainer.className = "drawtogether-control-container";
	this.controls = new Controls(controlContainer, this.createControlArray());
};

DrawTogether.prototype.createControlArray = function createControlArray () {
	return [{
		name: "room",
		type: "text",
		value: "",
		text: "Room",
		title: "Change the room"
	}, {
		name: "room-button",
		type: "button",
		text: "Change room",
		action: this.changeRoom.bind(this)
	}, {
		name: "name",
		type: "text",
		text: "Username",
		value: localStorage.getItem("drawtogether-name") || "",
		title: "Change your name",
		action: function () {}
	}, {
		name: "name-button",
		type: "button",
		text: "Change name",
		action: this.changeName.bind(this)
	}/*, {
		name: "private",
		type: "button",
		text: "Random one-on-one",
		value: "private",
		action: this.changeMode.bind(this)
	}, {
		name: "invite",
		type: "button",
		text: "Friend room",
		value: "invite",
		action: this.changeMode.bind(this)
	}, {
		name: "game",
		type: "button",
		text: "Play game",
		value: "game",
		action: this.changeMode.bind(this)
	}*/];
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