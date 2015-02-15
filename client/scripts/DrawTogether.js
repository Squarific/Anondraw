function DrawTogether (container, settings) {
	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Set default values untill we receive them from the server
	this.playerList = [];
	this.ink = 5000;
	this.lastInkWarning = Date.now();

	// Initialize the dom elements
	this.initDom();

	if (this.settings.mode == "ask")
		this.openModeSelector();
	else
		this.connect();
}

DrawTogether.prototype.defaultSettings = {
	server: "http://127.0.0.1:8080",       // Server to connect to, best to add http://
	mode: "ask",                           // Mode: public, private, invite, game, ask
	room: "main",                          // Room to join at startup
	locked_room: false                     // Is the user allowed to change the room?
	                                       // If the room is full it retries after 45sec
};

DrawTogether.prototype.drawingTypes = ["line", "brush", "block"];
DrawTogether.prototype.drawingTypesByName = {"line": 0, "brush": 1, "block": 2};

DrawTogether.prototype.connect = function connect () {
	// Connect to the server and bind socket events
	this.socket = io(this.settings.server);
	this.bindSocketHandlers(this.socket);
};

DrawTogether.prototype.bindSocketHandlers = function bindSocketHandlers (socket) {
	// Bind all socket events
	var self = this;

	// Connection events
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

	// Startup events

	socket.on("initname", function (name) {
		// Server gave us a guest name, set name only
		// if we didn't ask for a different one
		if (!localStorage.getItem("drawtogether-name")) {
			self.setName(name);
		}
	});

	// Room events

	socket.on("drawings", function (data) {
		if (data.room !== self.current_room)
			self.paint.clear();

		self.setRoom(data.room);
		self.paint.drawDrawings("public", self.decodeDrawings(data.drawings));
		self.chat.addMessage("CLIENT", "Ready to draw.");
	});

	socket.on("drawing", function (data) {
		self.paint.drawDrawing("public", self.decodeDrawing(data.drawing));
	})

	// Player(list) events

	socket.on("playernamechange", function (data) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == data.id) {
				self.playerList[k].name = data.newname;
			}
		}
		self.updatePlayerList();
	});

	socket.on("playerlist", function (list) {
		self.playerList = list;
		self.updatePlayerList();
	});

	socket.on("leave", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				self.playerList.splice(k, 1);
				k--;
			}
		}

		self.updatePlayerList();
	});

	socket.on("join", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				return;
			}
		}

		self.playerList.push(player);
		self.updatePlayerList();
	})

	// Inform events
	socket.on("forcename", self.setName);

	socket.on("setink", function (amount) {
		self.ink = amount;
		self.updateInk();
	})

	socket.on("changeink", function (amount) {
		self.ink = Math.min(self.ink + amount, 10000);
		self.updateInk();
	});

	// chat events
	socket.on("chatmessage", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user, data.message);
	});
};

DrawTogether.prototype.sendMessage = function sendMessage (message) {
	this.socket.emit("chatmessage", message);
};

DrawTogether.prototype.changeRoom = function changeRoom (room, number) {
	// Change the room to room, if not possible try to join
	// room + number, if not possible, raise number with one and try again
	room = room || this.controls.byName.room.input.value;
	number = number || "";

	this.socket.emit("changeroom", room + number, function (success) {
		if (!success) {
			this.changeRoom(room, (number || 0) + 1);
		}
	}.bind(this));

	this.chat.addMessage("CLIENT", "Changing room to '" + room + number + "'");
	this.chat.addMessage("CLIENT", "Give other people this url: http://www.anondraw.com/#" + room + number);
};

DrawTogether.prototype.changeName = function changeName (name) {
	name = name || this.controls.byName.name.input.value;
	this.socket.emit("changename", name);
	localStorage.setItem("drawtogether-name", name);
};

DrawTogether.prototype.updatePlayerList = function updatePlayerList () {
	while (this.playerListDom.firstChild)
		this.playerListDom.removeChild(this.playerListDom.firstChild)

	var plTitle = this.playerListDom.appendChild(document.createElement("span"));
	plTitle.innerText = "PlayerList (" + this.playerList.length + ")";
	plTitle.className = "drawtogether-pl-title";

	for (var k in this.playerList) {
		this.playerListDom.appendChild(this.createPlayerDom(this.playerList[k]));
	}
};

DrawTogether.prototype.updateInk = function updateInk () {
	this.inkDom.innerText = "Ink: " + this.ink + "/10000";
	this.inkDom.style.width = Math.floor(this.ink / 100) + "%"; // = ink / 10000 * 100
	if (this.ink < 1000) {
		this.inkDom.classList.add("drawtogether-ink-low");
		this.inkDom.classList.remove("drawtogether-ink-middle");
	} else if (this.ink < 3000) {
		this.inkDom.classList.add("drawtogether-ink-middle");
		this.inkDom.classList.remove("drawtogether-ink-low");
	} else {
		this.inkDom.classList.remove("drawtogether-ink-middle");
		this.inkDom.classList.remove("drawtogether-ink-low");
	}
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
	if (drawing[4].length == 6)
		drawing[4] = "#" + drawing[4]

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
	this.current_room = room;
	this.controls.byName.room.input.value = room;
	location.hash = room;
};

DrawTogether.prototype.openShareWindow = function openShareWindow () {
	this.shareWindow.style.display = "block";

	this.preview.width = this.shareWindow.offsetWidth * 0.9;
	this.preview.height = this.preview.width * (this.paint.public.canvas.height / this.paint.public.canvas.width);
	
	var ctx = this.preview.getContext("2d");
	ctx.drawImage(this.paint.public.canvas, 0, 0, this.preview.width, this.preview.height);
};

DrawTogether.prototype.openAccountWindow = function openAccountWindow () {
	this.accWindow.style.display = "block";
};

DrawTogether.prototype.openModeSelector = function openModeSelector () {
	this.selectWindow.style.display = "block";
};

DrawTogether.prototype.closeShareWindow = function closeShareWindow () {
	this.shareWindow.style.display = "";
};

DrawTogether.prototype.closeAccountWindow = function closeAccountWindow () {
	this.accWindow.style.display = "";
};

DrawTogether.prototype.initDom = function initDom () {
	// Create the chat, drawzone and controls
	this.createChat();
	this.createRoomInformation();
	this.createDrawZone();
	this.createControls();

	this.createShareWindow();
	this.createAccountWindow();
	this.createModeSelector();
};

DrawTogether.prototype.createPlayerDom = function (player) {
	var playerDom = document.createElement("div");
	playerDom.playerId = player.id;
	playerDom.innerText = player.name;
	playerDom.className = "drawtogether-player";
	return playerDom;
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
		// When a drawing is made check if we have ink left
		if (this.ink < 0) {
			if (Date.now() - this.lastInkWarning > 5000) {
				this.chat.addMessage("CLIENT", "No ink left! You will regain ink every 2 minutes. Tip: Small brushes use less ink.");
				this.lastInkWarning = Date.now();
			}
			event.removeDrawing();
			return;
		}

		// Lower our ink with how much it takes to draw this
		this.ink -= this.inkUsageFromDrawing(event.drawing);
		this.updateInk();

		// Send the drawing to the server and remove from the local
		// layer once we got a confirmation from the server
		this.sendDrawing(event.drawing, function () {
			console.log("removing drawing");
			event.removeDrawing();
		});
	}.bind(this));
};

DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
	// If its a brush the ink usage is (size * size)
	// If it is a line the ink usage is (size * length * 2)
	var length = drawing.size;

	if (typeof drawing.x1 == "number")
		length = this.utils.distance(drawing.x, drawing.y, drawing.x1, drawing.y1) * 2;

	return Math.ceil(drawing.size * length / 100);
};

DrawTogether.prototype.createRoomInformation = function createRoomInformation () {
	var infoContainer = this.container.appendChild(document.createElement("div"));
	infoContainer.className = "drawtogether-info-container";

	var inkContainer = infoContainer.appendChild(document.createElement("div"));
	inkContainer.className = "drawtogether-ink-container";

	this.inkDom = inkContainer.appendChild(document.createElement("div"));
	this.inkDom.className = "drawtogether-ink";

	this.playerListDom = infoContainer.appendChild(document.createElement("div"));
	this.playerListDom.className = "drawtogether-info-playerlist";
};

DrawTogether.prototype.createAccountWindow = function createAccountWindow () {
	var accWindow = this.container.appendChild(document.createElement("div"));
	accWindow.className = "drawtogether-accountwindow";
	this.accWindow = accWindow;

	this.loginMessage = accWindow.appendChild(document.createElement("div"));

	var formContainer = accWindow.appendChild(document.createElement("div"));
	formContainer.className = "drawtogether-account-formcontainer";

	var emailInput = formContainer.appendChild(document.createElement("input"));
	emailInput.type = "email";
	emailInput.placeholder = "Email";
	this.emailInput = emailInput;

	var passInput = formContainer.appendChild(document.createElement("input"));
	passInput.type = "password";
	passInput.placeholder = "Password";
	this.passInput = passInput;

	var loginButton = formContainer.appendChild(document.createElement("div"));
	loginButton.innerText = "Login";
	loginButton.className = "drawtogether-button drawtogether-login-button";
	loginButton.addEventListener("click", function () {
		this.socket.emit("login", {
			email: this.emailInput.value,
			password: this.passInput.value
		}, function (data) {
			if (data.success)
				this.closeAccountWindow();

			if (data.error)
				this.accountError(data.error);

			if (data.register) {
				while (this.loginMessage.firstChild)
					this.loginMessage.removeChild(this.loginMessage.firstChild);

				var message = this.loginMessage.appendChild(document.createElement("div"));
				message.className = "drawtogether-message drawtogether-login-message";
				message.innerText = "No account found with this email, do you want to register?";

				this.loginMessage.appendChild(document.createElement("br"));

				var registerButton = this.loginMessage.appendChild(document.createElement("div"));
				registerButton.innerText = "Register";
				registerButton.className = "drawtogether-button drawtogether-register-button";
				registerButton.addEventListener("click", this.registerAccount({
					email: this.emailInput.value,
					password: this.passInput.value
				}));
			}
		}.bind(this));
	}.bind(this));

	var close = formContainer.appendChild(document.createElement("div"));
	close.innerText = "Close login window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeAccountWindow.bind(this));
};

DrawTogether.prototype.createControls = function createControls () {
	var controlContainer = this.container.appendChild(document.createElement("div"));
	controlContainer.className = "drawtogether-control-container";
	this.controls = new Controls(controlContainer, this.createControlArray());

	var sharediv = controlContainer.appendChild(document.createElement("div"));
	sharediv.className = "addthis_sharing_toolbox";

	this.controls.byName["share-button"].input.className += " drawtogether-flashy";
};

DrawTogether.prototype.registerAccount = function registerAccount (data) {
	this.socket.emit("register", data, function (data) {
		if (data.error)
			this.accountError(data.error);

		if (data.success)
			this.closeAccountWindow();
	});
};

DrawTogether.prototype.accountError = function accountError (msg) {
	while (this.loginMessage.firstChild)
		this.loginMessage.removeChild(this.loginMessage.firstChild);

	var err = this.loginMessage.appendChild(document.createElement("div"));
	err.className = "drawtogether-error drawtogether-login-error";
	err.innerText = msg;
};

DrawTogether.prototype.uploadImage = function uploadImage () {
	// Remove the previous url
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}

	// Let the server upload the drawing to imgur and give us the url back
	this.socket.emit("uploadimage", this.paint.public.canvas.toDataURL().split(",")[1], function (data) {
		if (data.error) {
			this.showShareError(data.error);
			return;
		}

		this.showImgurUrl(data.url);
	}.bind(this));
};

DrawTogether.prototype.showShareError = function showShareError (error) {
	while (this.shareError.firstChild) {
		this.shareError.removeChild(this.shareError.firstChild);
	}

	var errorMessage = this.shareError.appendChild(document.createElement("div"));
	errorMessage.innerText = error;
	errorMessage.className = "drawtogether-error drawtogether-share-error";
};

DrawTogether.prototype.showImgurUrl = function showImgurUrl (url) {
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}

	var urlMessage = this.imgurUrl.appendChild(document.createElement("div"));
	urlMessage.innerHTML = 'Uploaded on imgur: <a href="' + url + '">' + url + '</a>';
	urlMessage.className = "drawtogether-share-url";

	this.shareToRedditButton.target = "_blank";
	this.shareToRedditButton.href = "http://www.reddit.com/r/anondraw/submit?title=[DRAWING]%20Description&url=" + encodeURIComponent(url);
};

DrawTogether.prototype.createShareWindow = function createShareWindow () {
	shareWindow = this.container.appendChild(document.createElement("div"));
	shareWindow.className = "drawtogether-sharewindow";
	this.shareWindow = shareWindow;

	this.shareError = shareWindow.appendChild(document.createElement("div"));
	this.imgurUrl = shareWindow.appendChild(document.createElement("div"));

	var preview = shareWindow.appendChild(document.createElement("canvas"));
	preview.className = "drawtogether-preview-canvas"
	this.preview = preview;

	var upload = shareWindow.appendChild(document.createElement("div"));
	upload.className = "drawtogether-button drawtogether-upload-button";
	upload.innerText = "Upload image to imgur";
	upload.addEventListener("click", this.uploadImage.bind(this));

	var share = shareWindow.appendChild(document.createElement("a"));
	share.className = "drawtogether-button drawtogether-share-button";
	share.innerText = "Share image to reddit";
	share.href = "#";
	this.shareToRedditButton = share;

	var close = shareWindow.appendChild(document.createElement("div"));
	close.innerText = "Close share window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeShareWindow.bind(this));
};

DrawTogether.prototype.createModeSelector = function createModeSelector () {
	var selectWindow = this.container.appendChild(document.createElement("div"));
	selectWindow.className = "drawtogether-selectwindow";
	this.selectWindow = selectWindow;

	// var text = selectWindow.appendChild(document.createElement("div"));
	// text.innerText = "Because of a sudden big increase of traffic the app is currently very unstable, this will hopefully be soon fixed.";
	// text.className = "drawtogether-welcome-text";

	selectWindow.appendChild(document.createElement("br"));

	var publicButton = selectWindow.appendChild(document.createElement("div"));
	publicButton.className = "drawtogether-modeselect-button";
	publicButton.innerHTML = '<img src="images/multi.png"/><br/>Draw with strangers';
	publicButton.addEventListener("click", function () {
		this.connect();
		this.selectWindow.style.display = "";
	}.bind(this));

	var privateButton = selectWindow.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/invite.png"/><br/>Alone or with friends';
	privateButton.addEventListener("click", function () {
		this.settings.room = Math.random().toString(36).substr(2, 5); // Random 5 letter room
		this.connect();
		this.selectWindow.style.display = "";
	}.bind(this));
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
	}, {
		name: "share-button",
		type: "button",
		text: "Put on imgur/reddit",
		action: this.openShareWindow.bind(this)
	}, /*{
		name: "account",
		type: "button",
		text: "Account",
		action: this.openAccountWindow.bind(this)
	}, {
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
	},
	distance: function (x1, y1, x2, y2) {
		// Returns the distance between (x1, y1) and (x2, y2)
		var xDis = x1 - x2,
		    yDis = y1 - y1;
		return Math.sqrt(xDis * xDis + yDis * yDis);
	}
};