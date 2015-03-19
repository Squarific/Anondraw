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

	// Ask the player what to do or connect to the server
	if (this.settings.mode == "ask") {
		this.openModeSelector();
	} else {
		if (this.settings.mode == "private") {
			this.settings.room = Math.random().toString(36).substr(2, 5); // Random 5 letter room;
		}
		this.connect();
	}

	requestAnimationFrame(this.drawLoop.bind(this));
}

DrawTogether.prototype.defaultSettings = {
	server: "http://127.0.0.1:8080",       // Server to connect to, best to add http://
	mode: "ask",                           // Mode: public, private, invite, game, ask, join, defaults to public
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

DrawTogether.prototype.drawLoop = function drawLoop () {
	// Draw all user interactions of the last 2 seconds
	this.userCtx.clearRect(0, 0, this.userCtx.canvas.width, this.userCtx.canvas.height);
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].lastPosition && Date.now() - this.playerList[k].lastPosition.time < 1500)
			this.drawPlayerInteraction(this.playerList[k].name, this.playerList[k].lastPosition.pos);
	}

	// Recall the drawloop
	requestAnimationFrame(this.drawLoop.bind(this));
};

DrawTogether.prototype.drawPlayerInteraction = function drawPlayerInteraction (name, position) {
	this.userCtx.font = "12px monospace";
	this.userCtx.strokeStyle = 'black';
    this.userCtx.lineWidth = 3;
    this.userCtx.strokeText(name, position[0] - this.userCtx.canvas.leftTopX, position[1] - 40 - this.userCtx.canvas.leftTopY);
    this.userCtx.fillStyle = 'white';
    this.userCtx.fillText(name, position[0] - this.userCtx.canvas.leftTopX, position[1] - 40 - this.userCtx.canvas.leftTopY);
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

		if (localStorage.getItem("drawtogether/email")) {
			socket.emit("login", {
				email: localStorage.getItem("drawtogether/email"),
				password: localStorage.getItem("drawtogether/pass")
			}, function (data) {
				if (data.success)
					self.chat.addMessage("ACCOUNT", data.success);
			});
		}
	});

	socket.on("disconnect", function () {
		self.chat.addMessage("CLIENT", "Lost connection to the server.");
	});

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
		var drawing = self.decodeDrawing(data.drawing);
		self.paint.drawDrawing("public", drawing);
		self.setPlayerPosition(data.socketid, [drawing.x, drawing.y], Date.now());
	});

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
		// If a user does not have a reputation set we should use their old value
		// if we had no old value we should use 0
		for (var k = 0; k < list.length; k++) {
			if (typeof list[k].reputation == "undefined") {
				for (var nk = 0; nk < self.playerList.length; nk++) {
					if (self.playerList[nk].id == list[k].id) {
						list[k].reputation = self.playerList[nk].reputation || 0;
					}
				}
			}
		}
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
	});

	socket.on("reputation", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				self.playerList[k].reputation = player.reputation;
			}
		}

		self.updatePlayerList();
	});

	// Inform events
	socket.on("forcename", self.setName);

	socket.on("setink", function (amount) {
		self.ink = amount;
		self.updateInk();
	})

	socket.on("changeink", function (amount) {
		self.ink = Math.min(self.ink + amount, 30000);
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
	plTitle.textContent = "PlayerList (" + this.playerList.length + ")";
	plTitle.className = "drawtogether-pl-title";

	for (var k = 0; k < this.playerList.length; k++) {
		this.playerListDom.appendChild(this.createPlayerDom(this.playerList[k]));
	}
};

DrawTogether.prototype.setPlayerPosition = function setPlayerPosition (id, position, time) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].id == id) {
			this.playerList[k].lastPosition = this.playerList[k].lastPosition || {};
			this.playerList[k].lastPosition.pos = position;
			this.playerList[k].lastPosition.time = time;
		}
	}
};

DrawTogether.prototype.updateInk = function updateInk () {
	this.inkDom.innerText = "Ink: " + Math.floor(this.ink) + "/30000";
	this.inkDom.textContent = "Ink: " + Math.floor(this.ink) + "/30000";
	this.inkDom.style.width = Math.floor(Math.max(this.ink / 300, 0)) + "%"; // = ink / 10000 * 100
	if (this.ink < 3000) {
		this.inkDom.classList.add("drawtogether-ink-low");
		this.inkDom.classList.remove("drawtogether-ink-middle");
	} else if (this.ink < 8000) {
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
	playerDom.className = "drawtogether-player";

	var upvoteButton = document.createElement("span");
	upvoteButton.className = "drawtogether-upvote-button"

	upvoteButton.innerText = "▲";
	upvoteButton.textContent = "▲";

	upvoteButton.addEventListener("click", function (playerid, event) {
		this.socket.emit("upvote", playerid);
	}.bind(this, player.id));

	var nameText = document.createElement("span");
	nameText.className = "drawtogether-player-name";

	if (typeof player.reputation !== "undefined") {
		var rep = " (" + player.reputation + ")";
	} else {
		rep = "";
	}

	nameText.innerText = player.name + rep;
	nameText.textContent = player.name + rep;

	playerDom.appendChild(upvoteButton);
	playerDom.appendChild(nameText);

	return playerDom;
};

DrawTogether.prototype.createChat = function createChat () {
	var chatContainer = this.container.appendChild(document.createElement("div"));
	chatContainer.className = "drawtogether-chat-container";
	this.chat = new Chat(chatContainer, this.sendMessage.bind(this));
	this.chatContainer = chatContainer;
};

DrawTogether.prototype.createDrawZone = function createDrawZone () {
	var drawContainer = this.container.appendChild(document.createElement("div"));
	drawContainer.className = "drawtogether-paint-container";
	this.paint = new Paint(drawContainer);
	this.userCtx = this.paint.newCanvasOnTop("userinteraction").getContext("2d");
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
	this.infoContainer = infoContainer;

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

	var formContainer = accWindow.appendChild(document.createElement("div"));
	formContainer.className = "drawtogether-account-formcontainer";

	this.loginMessage = formContainer.appendChild(document.createElement("div"));

	var emailInput = formContainer.appendChild(document.createElement("input"));
	emailInput.type = "email";
	emailInput.placeholder = "Email";
	this.emailInput = emailInput;

	var passInput = formContainer.appendChild(document.createElement("input"));
	passInput.type = "password";
	passInput.placeholder = "Password";
	this.passInput = passInput;

	var loginButton = formContainer.appendChild(document.createElement("div"));
	loginButton.innerText = "Login/Register";
	loginButton.textContent = "Login/Register";
	loginButton.className = "drawtogether-button drawtogether-login-button";
	loginButton.addEventListener("click", function () {
		var email = this.emailInput.value;
		var pass = CryptoJS.SHA256(this.passInput.value).toString(CryptoJS.enc.Base64);
		this.accountError(undefined);
		this.socket.emit("login", {
			email: email,
			password: pass
		}, function (data) {
			if (data.error)
				this.accountError(data.error);

			if (data.success) {
				this.accountSuccess(data.success);
				localStorage.setItem("drawtogether/email", email);
				localStorage.setItem("drawtogether/pass", pass);
			}

			// if (data.register) {
			// 	while (this.loginMessage.firstChild)
			// 		this.loginMessage.removeChild(this.loginMessage.firstChild);

			// 	var message = this.loginMessage.appendChild(document.createElement("div"));
			// 	message.className = "drawtogether-message drawtogether-login-message";
			// 	message.innerText = "No account found with this email, do you want to register?";

			// 	var registerButton = this.loginMessage.appendChild(document.createElement("div"));
			// 	registerButton.innerText = "Register";
			// 	registerButton.className = "drawtogether-button drawtogether-register-button";
			// 	registerButton.addEventListener("click", function () {
			// 		this.registerAccount({
			// 			email: this.emailInput.value,
			// 			password: CryptoJS.SHA256(this.passInput.value).toString(CryptoJS.enc.Base64)
			// 		})
			// 	}.bind(this));
			// }
		}.bind(this));
	}.bind(this));

	var close = formContainer.appendChild(document.createElement("div"));
	close.innerText = "Close login window";
	close.textContent = "Close login window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeAccountWindow.bind(this));
};

DrawTogether.prototype.createControls = function createControls () {
	var controlContainer = this.container.appendChild(document.createElement("div"));
	controlContainer.className = "drawtogether-control-container";
	this.controls = new Controls(controlContainer, this.createControlArray());

	var sharediv = controlContainer.appendChild(document.createElement("div"));
	sharediv.className = "addthis_sharing_toolbox";

	this.controls.byName["share-button"].input.classList.add("drawtogether-flashy");
	this.controls.byName["toggle-chat"].input.classList.add("drawtogether-display-on-small");
	this.controls.byName["toggle-info"].input.classList.add("drawtogether-display-on-small");
};

// DrawTogether.prototype.registerAccount = function registerAccount (data) {
// 	this.socket.emit("register", data, function (data) {
// 		if (data.error)
// 			this.accountError(data.error);

// 		if (data.success)
// 			this.accountSuccess(data.success);
// 	}.bind(this));
// };

DrawTogether.prototype.accountError = function accountError (msg) {
	while (this.loginMessage.firstChild)
		this.loginMessage.removeChild(this.loginMessage.firstChild);

	if (!msg) return;

	var err = this.loginMessage.appendChild(document.createElement("div"));
	err.className = "drawtogether-error drawtogether-login-error";
	err.innerText = msg;
	err.textContent = msg;
};

DrawTogether.prototype.accountSuccess = function accountSuccess (success) {
	while (this.loginMessage.firstChild)
		this.loginMessage.removeChild(this.loginMessage.firstChild);

	if (!success) return;

	var msg = this.loginMessage.appendChild(document.createElement("div"));
	msg.className = "drawtogether-success drawtogether-login-success";
	msg.innerText = success;
	msg.textContent = success;
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
	errorMessage.textContent = error;
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

DrawTogether.prototype.toggleChat = function toggleChat () {
	if (this.chatContainer.classList.contains("drawtogether-unhide-on-mobile"))
		this.chatContainer.classList.remove("drawtogether-unhide-on-mobile");
	else
		this.chatContainer.classList.add("drawtogether-unhide-on-mobile");
};

DrawTogether.prototype.toggleInfo = function toggleInfo () {
	if (this.infoContainer.classList.contains("drawtogether-unhide-on-mobile"))
		this.infoContainer.classList.remove("drawtogether-unhide-on-mobile");
	else
		this.infoContainer.classList.add("drawtogether-unhide-on-mobile");
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
	upload.textContent = "Upload image to imgur";
	upload.addEventListener("click", this.uploadImage.bind(this));

	var share = shareWindow.appendChild(document.createElement("a"));
	share.className = "drawtogether-button drawtogether-share-button";
	share.innerText = "Share image to reddit";
	share.textContent = "Share image to reddit";
	share.href = "#";
	this.shareToRedditButton = share;

	var close = shareWindow.appendChild(document.createElement("div"));
	close.innerText = "Close share window";
	close.textContent = "Close share window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeShareWindow.bind(this));
};

DrawTogether.prototype.createModeSelector = function createModeSelector () {
	var selectWindow = this.container.appendChild(document.createElement("div"));
	selectWindow.className = "drawtogether-selectwindow";
	this.selectWindow = selectWindow;

	var text = selectWindow.appendChild(document.createElement("h1"));
	text.innerText = "Draw online with friends and strangers.";
	text.textContent = "Draw online with friends and strangers.";
	text.className = "drawtogether-welcome-text";

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
		name: "toggle-chat",
		type: "button",
		value: "",
		text: "Chat",
		title: "Toggle chat",
		action: this.toggleChat.bind(this)
	}, {
		name: "toggle-info",
		type: "button",
		value: "",
		text: "Info",
		title: "Toggle room info",
		action: this.toggleInfo.bind(this)
	}, {
		name: "room",
		type: "text",
		value: "",
		text: "Room",
		title: "Change the room",
		action: function (event) {
			console.log(event);
		}
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
		action: function (event) {
			console.log(event);
		}
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
	}, {
		name: "account",
		type: "button",
		text: "Account",
		action: this.openAccountWindow.bind(this)
	}, /*{
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