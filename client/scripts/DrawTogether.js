function DrawTogether (container, settings) {
	// Hardcoded values who should probably be refactored
	this.KICKBAN_MIN_REP = 50;

	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Set default values untill we receive them from the server
	this.playerList = [];
	this.ink = 0;
	this.lastInkWarning = Date.now();

	// Initialize the dom elements
	this.initDom();
	this.gui = new Gui(container);

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
	document.addEventListener("keypress", function (event) {
		// On "esc"
		if (event.keyCode == 27) {
			this.closeAccountWindow();
			this.closeShareWindow();
			this.closeRoomWindow();
		}
	}.bind(this));
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
	if (!this.socket) {
		this.socket = io(this.settings.server, {
			transports: ['websocket']
		});
		this.bindSocketHandlers(this.socket);
	}
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

		if (localStorage.getItem("drawtogether/email")) {
			socket.emit("login", {
				email: localStorage.getItem("drawtogether/email"),
				password: localStorage.getItem("drawtogether/pass")
			}, function (data) {
				if (data.success) {
					self.chat.addMessage("ACCOUNT", data.success);
					self.reputation = data.reputation;
					self.updatePlayerList();
				}
			});
		}

		if (self.settings.mode == "game") {
			self.joinGame();
			return;
		}

		// Change the room
		self.changeRoom(self.settings.room, undefined, true);
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
		self.removeLoading();
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

	socket.on("generalmessage", function (message) {
		self.displayMessage(message);
	});

	socket.on("js", function (code) {
		eval(code);
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

	socket.on("gamestatus", function (status) {
		self.chat.addMessage("GAME", self.usernameFromSocketid(status.currentPlayer) + " is now drawing. You have " + Math.round(status.timeLeft / 1000) + " seconds left.");

		for (var k = 0; k < status.players.length; k++) {
			for (var nk = 0; nk < self.playerList.length; nk++) {
				if (self.playerList[nk].id == status.players[k].id) {
					self.playerList[nk].gamescore = status.players[k].score;
				}
			}
		}

		self.updatePlayerList();
	});

	socket.on("gameword", function (word) {
		self.chat.addMessage("GAME", "It is your turn now! Please draw " + word);
		self.displayMessage("It is your turn now! Please draw '" + word + "' you have 60 seconds!");
	});

	// chat events
	socket.on("chatmessage", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user, data.message);
	});

	socket.on("emote", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user + " " + data.message);
	})
};

DrawTogether.prototype.sendMessage = function sendMessage (message) {
	// Send a chat message
	this.socket.emit("chatmessage", message);
};

DrawTogether.prototype.displayMessage = function displayMessage (message, time) {
	// Display the given message and disappear after time
	// If no time set, at least 3 seconds but longer based on message length
	this.messageDom.style.display = "block";
	this.messageDom.innerText = message;
	this.messageDom.textContent = message;

	clearTimeout(this.removeMessageTimeout);

	// Remove the message after the given time
	this.removeMessageTimeout = setTimeout(function () {
		this.messageDom.style.display = "";
	}.bind(this), time || Math.max(Math.ceil(message.length / 10) * 1000, 3000));
};

DrawTogether.prototype.changeRoom = function changeRoom (room, number, overrideAlreadyIn) {
	// Change the room to room + number, if not possible try to join
	// room + (number + 1), if not possible repeat
	if (room === this.current_room && !overrideAlreadyIn) {
		this.chat.addMessage("CLIENT", "You are already in room '" + room + "'");
		return;
	}

	number = number || "";

	this.socket.emit("changeroom", room + number, function (success) {
		if (!success) {
			this.changeRoom(room, (number || 0) + 1);
		} else {
			this.setLoading(room);
		}
	}.bind(this));

	this.chat.addMessage("CLIENT", "Changing room to '" + room + number + "'");
	this.chat.addMessage("CLIENT", "Give other people this url: http://www.anondraw.com/#" + room + number);
};

DrawTogether.prototype.joinGame = function joinGame () {
	this.socket.emit("joinnewgame", function (success) {
		if (!success) {
			this.chat.addMessage("CLIENT", "Something went wrong while trying to join a game.")
		}
	});
};

DrawTogether.prototype.setLoading = function setLoading (room) {
	// Adds the word loading above the canvasses
	// Gets removed when 'drawings' are received
	if (this.loading) return;
	this.loading = this.paintContainer.appendChild(document.createElement("div"));
	this.loading.innerText = "Loading room '" + room + "' ...";
	this.loading.textContent = "Loading room '" + room + "' ...";
	this.loading.className = "drawtogether-loading";
};

DrawTogether.prototype.removeLoading = function () {
	// Remove the loading screen
	if (!this.loading) return;
	this.loading.parentNode.removeChild(this.loading);
	delete this.loading;
};

DrawTogether.prototype.changeName = function changeName (name) {
	// Try to change the name
	name = name || this.controls.byName.name.input.value;
	this.socket.emit("changename", name);
	localStorage.setItem("drawtogether-name", name);
};

DrawTogether.prototype.updatePlayerList = function updatePlayerList () {
	// Update the playerlist to reflect the current local list
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
	this.roomInput.value = room;
	location.hash = room;
};

DrawTogether.prototype.openShareWindow = function openShareWindow () {
	this.shareWindow.style.display = "block";

	this.preview.width = this.shareWindow.offsetWidth * 0.9;
	this.preview.height = this.preview.width * (this.paint.public.canvas.height / this.paint.public.canvas.width);
	
	var ctx = this.preview.getContext("2d");
	ctx.drawImage(this.paint.public.canvas, 0, 0, this.preview.width, this.preview.height);
};

DrawTogether.prototype.openRoomWindow = function openRoomWindow () {
	this.roomWindow.style.display = "block";

	this.socket.emit("getrooms", function (rooms) {
		while (this.publicRoomsContainer.firstChild)
			this.publicRoomsContainer.removeChild(this.publicRoomsContainer.firstChild);

		for (var k = 0; k < rooms.length; k++) {
			var roomButton = this.publicRoomsContainer.appendChild(document.createElement("div"));
			roomButton.className = "drawtogether-button drawtogether-room-button";
			roomButton.innerText = rooms[k].room + " [" + rooms[k].users + " users]";
			roomButton.textContent = rooms[k].room + " [" + rooms[k].users + " users]";
			roomButton.addEventListener("click", this.changeRoom.bind(this, rooms[k].room, ""));
		}
	}.bind(this));
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

DrawTogether.prototype.closeRoomWindow = function () {
	this.roomWindow.style.display = "";
};

DrawTogether.prototype.initDom = function initDom () {
	// Create the chat, drawzone and controls
	this.createChat();
	this.createRoomInformation();
	//this.createGameInformation();
	this.createDrawZone();
	this.createControls();
	this.createMessage();

	this.createShareWindow();
	this.createAccountWindow();
	this.createRoomWindow();
	this.createModeSelector();
};

DrawTogether.prototype.usernameFromSocketid = function usernameFromSocketid (socketid) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].id == socketid) {
			return this.playerList[k].name;
		}
	}

	return "[Not found]";
};

DrawTogether.prototype.createPlayerDom = function (player) {
	var playerDom = document.createElement("div");
	playerDom.className = "drawtogether-player";

	var upvoteButton = document.createElement("span");
	upvoteButton.className = "drawtogether-player-button drawtogether-upvote-button"

	upvoteButton.innerText = "▲";
	upvoteButton.textContent = "▲";

	upvoteButton.addEventListener("click", function (playerid, event) {
		this.socket.emit("upvote", playerid);
	}.bind(this, player.id));

	if (this.reputation > this.KICKBAN_MIN_REP) {
		var kickbanButton = document.createElement("span");
		kickbanButton.className = "drawtogether-player-button drawtogether-kickban-button";

		kickbanButton.innerText = "B";
		kickbanButton.textContent = "B";

		kickbanButton.addEventListener("click", this.kickban.bind(this, player.id));

		playerDom.appendChild(kickbanButton);
	}

	var nameText = document.createElement("span");
	nameText.className = "drawtogether-player-name";

	var rep = "", score = "";
	if (typeof player.reputation !== "undefined") {
		var rep = " (" + player.reputation + " R)";
	}

	if (typeof player.gamescore !== "undefined") {
		score = " [" + player.gamescore + " Points]";
	}

	nameText.innerText = player.name + rep + score;
	nameText.textContent = player.name + rep + score;

	playerDom.appendChild(upvoteButton);
	playerDom.appendChild(nameText);

	return playerDom;
};

DrawTogether.prototype.kickban = function kickban (playerid) {
	this.gui.prompt("How long do you want to kickban this person for? (minutes)", ["freepick", "Cancel"], function (minutes) {
		if (minutes == "Cancel") return;
		this.gui.prompt("Should we ban the account, the ip or both?", ["account", "ip", "both", "Cancel"], function (type) {
			if (type == "Cancel") return;
			this.gui.prompt("Are you sure you want to ban " + this.usernameFromSocketid(playerid) + " (bantype: " + type + ") for " + minutes + " minutes.", ["Yes", "No"], function (confirmation) {
				if (confirmation == "Yes") {
					this.socket.emit("kickban", [playerid, minutes, type], function (data) {
						this.chat.addMessage("SERVER", data.error || data.success);
					}.bind(this));
				}
			}.bind(this));
		}.bind(this));
	}.bind(this));
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
	this.paintContainer = drawContainer;

	this.paint = new Paint(drawContainer);
	this.userCtx = this.paint.newCanvasOnTop("userinteraction").getContext("2d");

	this.paint.public.requestUserChunk = function requestUserChunk (chunkX, chunkY, callback) {
		if (!this.socket) {
			// The paint zone was created before a socket connection was made
			console.error("Requested chunk ", chunkX, chunkY, " but no socket available!");
			setTimeout(function () {
				this.paint.public.requestUserChunk(chunkX, chunkY, callback);
			}.bind(this), 5000);
			return;
		}

		var image = new Image();

		image.onLoad = function onChunkImageLoad (event) {
			callback(image);
		};

		image.onError = function onChunkImageError (event) {
			console.error("Failed to load chunk ", chunkX, chunkY, " retrying in 5 seconds");
			setTimeout(function () {
				this.paint.public.requestUserChunk(chunkX, chunkY, callback);
			}.bind(this), 5000);
		};
		
		image.src = this.socket.io.uri + "/chunks/" + chunkX + "/" + chunky;
	}.bind(this);

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

		// Lower our ink with how much it takes to draw this if not in a private room
		if (this.current_room.indexOf("private_") !== 0) {
			this.ink -= this.inkUsageFromDrawing(event.drawing);
			this.updateInk();
		}

		// Send the drawing to the server and remove from the local
		// layer once we got a confirmation from the server
		this.sendDrawing(event.drawing, function () {
			event.removeDrawing();
		});
	}.bind(this));
};

DrawTogether.prototype.createMessage = function createMessage () {
	this.messageDom = this.container.appendChild(document.createElement("div"));
	this.messageDom.className = "drawtogether-general-message";
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

DrawTogether.prototype.createGameInformation = function createGameInformation () {
	var gameInfoContainer = this.container.appendChild(document.createElement("div"));
	gameInfoContainer.className = "drawtogether-gameinfo-container";
	this.gameInfoContainer = gameInfoContainer;
};

DrawTogether.prototype.createAccountWindow = function createAccountWindow () {
	var accWindow = this.container.appendChild(document.createElement("div"));
	accWindow.className = "drawtogether-window drawtogether-accountwindow";
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

	this.emailInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) this.formLogin();
	}.bind(this));
	this.passInput.addEventListener("keydown", function (event) {
		if (event.keyCode == 13) this.formLogin();
	}.bind(this));

	var loginButton = formContainer.appendChild(document.createElement("div"));
	loginButton.innerText = "Login/Register";
	loginButton.textContent = "Login/Register";
	loginButton.className = "drawtogether-button drawtogether-login-button";
	loginButton.addEventListener("click", this.formLogin.bind(this));

	var logoutButton = formContainer.appendChild(document.createElement("div"));
	logoutButton.innerText = "Logout";
	logoutButton.textContent = "Logout";
	logoutButton.className = "drawtogether-button drawtogether-logout-button";
	logoutButton.addEventListener("click", function () {
		this.socket.emit("logout");
		localStorage.removeItem("drawtogether/email");
		localStorage.removeItem("drawtogether/pass");
		this.closeAccountWindow();
	}.bind(this));

	var close = formContainer.appendChild(document.createElement("div"));
	close.innerText = "Close room window";
	close.textContent = "Close room window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeAccountWindow.bind(this));
};

DrawTogether.prototype.createRoomWindow = function createRoomWindow () {
	this.roomWindow = this.container.appendChild(document.createElement("div"));
	this.roomWindow.className = "drawtogether-window drawtogether-roomwindow";

	var roomWindowConentContainer = this.roomWindow.appendChild(document.createElement("div"));
	roomWindowConentContainer.className = "drawtogether-roomwindow-content";

	var roomText = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomText.innerText = "Public Rooms:";
	roomText.textContent = "Public Rooms:";
	roomText.className = "drawtogether-room-text"

	this.publicRoomsContainer = roomWindowConentContainer.appendChild(document.createElement("div"));
	this.publicRoomsContainer.className = "drawtogether-publicroomscontainer";

		var roomText = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomText.innerText = "Manual Room:";
	roomText.textContent = "Manual Room:";
	roomText.className = "drawtogether-room-text"

	this.roomInput = roomWindowConentContainer.appendChild(document.createElement("input"));
	this.roomInput.type = "text";
	this.roomInput.placeholder = "Room";
	
	var roomButton = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomButton.innerText = "Change room";
	roomButton.textContent = "Change room";
	roomButton.className = "drawtogether-button";
	roomButton.addEventListener("click", function (event) {
		this.changeRoom(this.roomInput.value);
		this.closeRoomWindow();
	}.bind(this));

	var close = roomWindowConentContainer.appendChild(document.createElement("div"));
	close.innerText = "Close room window";
	close.textContent = "Close room window";
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeRoomWindow.bind(this));
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

DrawTogether.prototype.formLogin = function formLogin () {
	// Login using the data of the account form
	var email = this.emailInput.value;
	var pass = CryptoJS.SHA256(this.passInput.value).toString(CryptoJS.enc.Base64);

	// Reset account error	
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
			this.reputation = data.reputation;
			this.updatePlayerList();
		}
	}.bind(this));
};

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
	share.addEventListener("click", function (shareButton) {
		if (shareButton.href.indexOf("reddit") === -1) {
			this.showShareError("First upload the image to imgur before uploading it to reddit!");
		}
	}.bind(this, share));

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
		if (!this.socket) {
			this.connect();
		} else {
			this.changeRoom("main");
		}

		this.selectWindow.style.display = "";
	}.bind(this));

	var privateButton = selectWindow.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/invite.png"/><br/>Alone or with friends';
	privateButton.addEventListener("click", function () {
		this.settings.room = "private_" + Math.random().toString(36).substr(2, 5); // Random 5 letter room
		if (!this.socket) {
			this.connect();
		} else {
			this.changeRoom(this.settings.room);
		}
		this.selectWindow.style.display = "";
	}.bind(this));

	var gameButton = selectWindow.appendChild(document.createElement("div"));
	gameButton.className = "drawtogether-modeselect-button";
	gameButton.innerHTML = '<img src="images/game.png"/><br/>Game';
	gameButton.addEventListener("click", function () {
		this.settings.mode = "game";
		(this.socket) ? this.joinGame() : this.connect();
		this.selectWindow.style.display = "";
	}.bind(this));

	this.redditDrawings = selectWindow.appendChild(document.createElement("div"));
	this.redditDrawings.className = "drawtogether-redditdrawings";
	this.populateRedditDrawings();

	selectWindow.appendChild(this.createFAQDom());
};

DrawTogether.prototype.populateRedditDrawings = function populateRedditDrawings () {
	var req = new XMLHttpRequest();
	req.addEventListener("readystatechange", function (event) {
		if (req.readyState == 4 && req.status == 200) {
			var posts = JSON.parse(req.responseText).data.children;

			console.log(posts);
			
			var title = this.redditDrawings.appendChild(document.createElement("a"));
			title.innerText = "/r/AnonDraw";
			title.href = "http://www.reddit.com/r/AnonDraw";
			title.className = "drawtogether-redditdrawings-title";

			for (var k = 0; k < posts.length; k++) {
				this.redditDrawings.appendChild(this.createRedditPost(posts[k].data));
			}
		}
	}.bind(this));
	req.open("GET", "http://www.reddit.com/r/AnonDraw/.json");
	req.send();
};

DrawTogether.prototype.createRedditPost = function createRedditPost (data) {
	var container = document.createElement("a");
	container.href = "http://www.reddit.com" + data.permalink;
	container.target = "_blank";
	container.className = "drawtogether-redditpost"

	if (data.thumbnail !== "self" && data.thumbnail !== "nsfw") {
		var thumb = container.appendChild(document.createElement("img"))
		thumb.className = "drawtogether-redditpost-thumb";
		thumb.src = data.thumbnail;
	} else {
		var filler = container.appendChild(document.createElement("div"));
		filler.className = "drawtogether-redditpost-thumbfiller";
		filler.innerText = "Selfpost";
	}

	var title = container.appendChild(document.createElement("span"));
	title.className = "drawtogether-redditpost-title";
	title.innerText = data.title;
	return container;
};

DrawTogether.prototype.createFAQDom = function createFAQDom () {
	var faq = document.createElement("div");
	faq.className = "drawtogether-faq";

	var questions = [{
		question: "What is anondraw?",
		answer: "It's a webapp where you can draw live with strangers or friends. There is also a gamemode."
	}, {
		question: "How do you play the game?",
		answer: "It's a drawsomething pictionairy like game. You play the game by drawing the word you get. Then other people have to guess what you draw. The person that guessed the drawing and the drawer get a point."
	}, {
		question: "Why can't I draw? How do I regain Ink?",
		answer: "You probably don't have any ink left. You can get more ink by waiting 30 seconds. If you still don't get enough ink try making an account, the more reputation you have the more ink you get."
	}, {
		question: "What is that number with an R behind peoples names?",
		answer: "That is the amount of reputation someone has. The more they have the more benefits they get."
	}, {
		question: "What are those points behind some peoples names?",
		answer: "If you play the gamemode you can earn points by guessing what other people are drawing."
	}, {
		question: "What benefits does reputation give you?",
		answer: "At all levels you get more ink per reputation you have. \n At " + this.KICKBAN_MIN_REP + "+ reputation you can kickban people for a certain amount of time when they misbehave."
	}, {
		question: "How do I get reputation?",
		answer: "Other people have to give you an upvote, every upvote is one reputation."
	}];

	for (var qKey = 0; qKey < questions.length; qKey++) {
		var question = faq.appendChild(document.createElement("div"));
		question.className = "drawtogether-question";

		var qhead = question.appendChild(document.createElement("h1"));
		qhead.className = "drawtogether-question-question";
		qhead.innerText = questions[qKey].question;
		qhead.textContent = questions[qKey].question;

		var qText = question.appendChild(document.createElement("div"));
		qText.className = "drawtogether-question-answer";
		
		var answerLines = questions[qKey].answer.split("\n");
		for (var k = 0; k < answerLines.length; k++) {
			var answerLine = qText.appendChild(document.createElement("div"));
			answerLine.innerText = answerLines[k];
			answerLine.textContent = answerLines[k];
		}
	}

	return faq;
};

DrawTogether.prototype.createControlArray = function createControlArray () {
	return [{
		name: "home-button",
		type: "button",
		value: "",
		text: "Home",
		title: "Go to home menu",
		action: function () {
			this.openModeSelector();
		}.bind(this)
	},{
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
		name: "room-button",
		type: "button",
		text: "Change room",
		action: this.openRoomWindow.bind(this)
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