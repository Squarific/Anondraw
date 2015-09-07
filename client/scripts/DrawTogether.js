function DrawTogether (container, settings) {
	// Hardcoded values who should probably be refactored
	this.KICKBAN_MIN_REP = 50;

	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	// Set default values untill we receive them from the server
	this.playerList = [];
	this.ink = 2500;
	this.lastInkWarning = Date.now();

	this.network = new Network(this.settings.loadbalancer);
	this.account = new Account(this.settings.accountServer);
	this.bindSocketHandlers();

	// Initialize the dom elements
	this.initDom();
	this.gui = new Gui(container);
	this.updateInk();

	// Ask the player what to do or connect to the server
	if (this.settings.mode == "ask") {
		this.openModeSelector();
	} else if (this.settings.mode == "join") {
		this.changeRoom(this.settings.room);
	} else  if (this.settings.mode == "private") {
		this.settings.room = "private_" + Math.random().toString(36).substr(2, 5); // Random 5 letter room;
		this.changeRoom(this.settings.room);
	} else if (this.settings.mode == "member") {
		this.changeRoom("member-main");
	}

	requestAnimationFrame(this.drawLoop.bind(this));
	this.needsClear = false;

	document.addEventListener("keydown", function (event) {
		// On "esc"
		if (event.keyCode == 27) {
			this.closeAccountWindow();
			this.closeShareWindow();
			this.closeRoomWindow();
		}
	}.bind(this));
}

DrawTogether.prototype.defaultSettings = {
	mode: "ask",                           // Mode: public, private, oneonone, join, game, main, ask, defaults to public
	room: "main",                          // Room to join at startup
	loadbalancer: "http://direct.anondraw.com:3552",
	accountServer: "http://direct.anondraw.com:4552",
	imageServer: "http://direct.anondraw.com:5552"
};

DrawTogether.prototype.drawingTypes = ["line", "brush", "block"];
DrawTogether.prototype.drawingTypesByName = {"line": 0, "brush": 1, "block": 2};

DrawTogether.prototype.drawLoop = function drawLoop () {
	// Draw all user interactions of the last 2 seconds
	if (this.needsClear) {
		this.userCtx.clearRect(0, 0, this.userCtx.canvas.width, this.userCtx.canvas.height);
		this.needsClear = false
	}


	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].lastPosition && Date.now() - this.playerList[k].lastPosition.time < 3000) {
			this.drawPlayerInteraction(this.playerList[k].name, this.playerList[k].lastPosition.pos);
			this.needsClear = true;
		}
	}

	// Recall the drawloop
	requestAnimationFrame(this.drawLoop.bind(this));
};

DrawTogether.prototype.drawPlayerInteraction = function drawPlayerInteraction (name, position) {
	this.userCtx.font = "12px monospace";
	this.userCtx.strokeStyle = 'black';
    this.userCtx.lineWidth = 3;
    this.userCtx.strokeText(name, (position[0] - this.userCtx.canvas.leftTopX) * this.paint.public.zoom, (position[1] - this.userCtx.canvas.leftTopY) * this.paint.public.zoom - 40);
    this.userCtx.fillStyle = 'white';
    this.userCtx.fillText(name, (position[0] - this.userCtx.canvas.leftTopX) * this.paint.public.zoom, (position[1] - this.userCtx.canvas.leftTopY) * this.paint.public.zoom - 40);
};

DrawTogether.prototype.bindSocketHandlers = function bindSocketHandlers () {
	// Bind all socket events
	var self = this;

	// Startup events
	this.network.on("connect", function () {
		if (localStorage.getItem("drawtogether-name"))
			self.changeName(localStorage.getItem("drawtogether-name"));

		if (self.account.uKey)
			self.network.socket.emit("uKey", self.account.uKey);
	});

	this.network.on("disconnect", function () {
		if (self.current_room) {
			var room = self.current_room;
			delete self.current_room;
			self.changeRoom(room);
		}
	});

	this.network.on("initname", function (name) {
		// Server gave us a guest name, set name only
		// if we didn't ask for a different one
		if (!localStorage.getItem("drawtogether-name")) {
			self.setName(name);
		}
	});

	this.network.on("drawing", function (data) {
		var drawing = self.decodeDrawing(data.drawing);
		self.paint.drawDrawing("public", drawing);
		self.setPlayerPosition(data.socketid, [drawing.x, drawing.y], Date.now());
	});

	this.network.on("sp", function (props) {
		props.color = tinycolor(props.color);
		self.paint.addPath(props.id, props);
	});

	this.network.on("ep", function (id) {
		self.paint.finalizePath(id);
	});

	this.network.on("pp", function (id, point) {
		self.paint.addPathPoint(id, point);
		self.setPlayerPosition(id, point, Date.now());
	});

	this.network.on("paths", function (paths) {
		for (var id in paths) {
			self.paint.addPath(id, paths[id]);
		}
	});

	// Player(list) events

	this.network.on("playernamechange", function (data) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == data.id) {
				self.playerList[k].name = data.newname;
			}
		}
		self.updatePlayerList();
	});

	this.network.on("playerlist", function (list) {
		self.playerList = list;
		self.updatePlayerList();
	});

	this.network.on("leave", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				self.playerList.splice(k, 1);
				k--;
			}
		}

		self.updatePlayerList();
	});

	this.network.on("join", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				return;
			}
		}

		self.playerList.push(player);
		self.updatePlayerList();
	});

	this.network.on("reputation", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				self.playerList[k].reputation = player.reputation;
			}
		}

		self.updatePlayerList();
	});

	this.network.on("generalmessage", function (message) {
		self.displayMessage(message);
	});

	this.network.on("gamestatus", function (status) {
		self.chat.addMessage("GAME", self.usernameFromSocketid(status.currentPlayer) + " is now drawing. You have " + Math.round(status.timeLeft / 1000) + " seconds left.");
		self.chat.addMessage("GAME", "The word contains some of the following letters: " + status.letters.join(", "));

		self.displayMessage("The word contains some of the following letters: " + status.letters.join(", "));

		for (var k = 0; k < status.players.length; k++) {
			for (var nk = 0; nk < self.playerList.length; nk++) {
				if (self.playerList[nk].id == status.players[k].id) {
					self.playerList[nk].gamescore = status.players[k].score;
				}
			}
		}

		self.updatePlayerList();
	});

	this.network.on("gameword", function (word) {
		self.chat.addMessage("GAME", "It is your turn now! Please draw " + word);
		self.displayMessage("It is your turn now! Please draw '" + word + "' you have 60 seconds!");
	});

	// chat events
	this.network.on("chatmessage", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user, data.message);
	});

	this.network.on("emote", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user + " " + data.message);
	});

	this.network.on("setreputation", function (rep) {
		self.reputation = rep;
	});

	this.network.on("setink", function (ink) {
		self.ink = ink;
		self.updateInk();
	});
};

DrawTogether.prototype.sendMessage = function sendMessage (message) {
	// Send a chat message
	this.network.socket.emit("chatmessage", message);
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

// Try to change the room
DrawTogether.prototype.changeRoom = function changeRoom (room, number) {
	// Change the room to room + number, if not possible try to join
	// room + (number + 1), if not possible repeat
	if (room === this.current_room) {
		this.chat.addMessage("CLIENT", "You are already in room '" + room + "'");
		return;
	}

	// Don't change the room if we are still waiting for the server
	if (this.changingRoom) return;
	this.changingRoom = true;
	var changingRoomTimeout = setTimeout(function () {
		this.changingRoom = false;
	}.bind(this), 2000);

	number = number || "";
	this.network.loadRoom(room + number, function (err, drawings) {
		this.changingRoom = false;
		if (err && err.indexOf("Too many users") !== -1) {
			this.changeRoom(room, (number || 0) + 1);
			this.chat.addMessage("SERVER", "Room '" + room + number + "' is full! Trying " + room + ((number || 0) + 1));
			return;
		} else if (err) {
			this.chat.addMessage("SERVER", "Failed to load room '" + room + "'. Server error: " + err + ". Trying again in 5 seconds.");
			setTimeout(this.changeRoom.bind(this, room, number), 5000);
		} else {
			this.setRoom(room);

			this.paint.clear();
			this.paint.drawDrawings("public", this.decodeDrawings(drawings));
			this.chat.addMessage("CLIENT", "Invite: http://www.anondraw.com/#" + room + number);

			this.removeLoading();
		}
	}.bind(this));

	this.setLoading(room);
	this.chat.addMessage("CLIENT", "Changing room to '" + room + number + "'");
};

// DrawTogether.prototype.joinGame = function joinGame () {
// 	this.socket.emit("joinnewgame", function (success) {
// 		if (!success) {
// 			this.chat.addMessage("CLIENT", "Something went wrong while trying to join a game.")
// 		}
// 	});
// };

// DrawTogether.prototype.joinOneOnOne = function joinOneOnOne () {
// 	this.socket.emit("joinprivaterandom");
// };

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
	if (!name) {
		name = this.controls.byName.name.input.value;
		this.controls.byName.name.input.focus();
	}

	this.network.socket.emit("changename", name, function (err, realname) {
		if (err) {
			this.chat.addMessage("SERVER", err);
			return;
		}

		this.chat.addMessage("SERVER", "Your name is now " + realname);
		localStorage.setItem("drawtogether-name", realname);
	}.bind(this));
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
	// Remove the previous text
	while (this.inkDom.firstChild) this.inkDom.removeChild(this.inkDom.firstChild);

	this.inkDom.appendChild(document.createTextNode("Ink: " + Math.floor(this.ink) + "/50000"));
	this.inkDom.style.width = Math.floor(Math.max(this.ink / 500, 0)) + "%";

	// If ink is below 3000 => set class low
	// if ink is below 8000 => set class middle
	// otherwise remove classes
	// previousInk is used so we don't switch classes every time
	if (this.previousInk >= 3000 && this.ink < 3000) {
		this.inkDom.classList.add("drawtogether-ink-low");
		this.inkDom.classList.remove("drawtogether-ink-middle");
	} else if (this.previousInk >= 8000 && this.ink < 8000) {
		this.inkDom.classList.add("drawtogether-ink-middle");
		this.inkDom.classList.remove("drawtogether-ink-low");
	} else if (this.previousInk < 8000 && this.ink >= 8000) {
		this.inkDom.classList.remove("drawtogether-ink-middle");
		this.inkDom.classList.remove("drawtogether-ink-low");
	}
	
	this.previousInk = this.ink;
};

DrawTogether.prototype.sendDrawing = function sendDrawing (drawing, callback) {
	if (!this.network.socket) return;
	this.network.socket.emit("drawing", this.encodeDrawing(drawing), callback);
};

DrawTogether.prototype.encodeDrawing = function encodeDrawing (drawing) {
	var newDrawing = {};

	for (var k in drawing) {
		newDrawing[k] = drawing[k];
	}

	newDrawing.color = drawing.color.toHex8();

	return newDrawing; 
};

DrawTogether.prototype.decodeDrawings = function decodeDrawings (drawings) {
	for (var dKey = 0; dKey < drawings.length; dKey++) {
		drawings[dKey].color = tinycolor(drawings[dKey].color);
	}

	return drawings;
};

DrawTogether.prototype.setName = function setName (name) {
	// Set the input field to our username, mention in chat and save to storage
	this.controls.byName.name.input.value = name;
	this.chat.addMessage("SERVER", "Name set to '" + name + "'");
	localStorage.setItem("drawtogether-name", name);
};

// After joining a room, make sure everything reflects
// that we joined the given room
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

	this.network.getRooms(function (err, rooms) {
		while (this.publicRoomsContainer.firstChild)
			this.publicRoomsContainer.removeChild(this.publicRoomsContainer.firstChild);

		for (var name in rooms) {
			var roomButton = this.publicRoomsContainer.appendChild(document.createElement("div"));
			roomButton.className = "drawtogether-button drawtogether-room-button";
			roomButton.appendChild(document.createTextNode(name + " (" + rooms[name] + " users)"))
			roomButton.addEventListener("click", function (name, event) {
				this.changeRoom(name);
				this.closeRoomWindow();
			}.bind(this, name));
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
		this.network.socket.emit("upvote", playerid);
	}.bind(this, player.id));

	if (this.reputation >= this.KICKBAN_MIN_REP) {
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
	this.gui.prompt("How long do you want to kickban this person for? (minutes)", ["freepick", "1 year", "1 week", "1 day", "1 hour", "Cancel"], function (minutes) {
		if (minutes == "Cancel") return;
		if (minutes == "1 year") minutes = 356 * 24 * 60;
		if (minutes == "1 week") minutes = 7 * 24 * 60;
		if (minutes == "1 day") minutes = 24 * 60;
		if (minutes == "1 hour") minutes = 60;
		this.gui.prompt("Should we ban the account, the ip or both?", ["account", "ip", "both", "Cancel"], function (type) {
			if (type == "Cancel") return;
			this.gui.prompt("What is the reason you want to ban him?", ["freepick", "Drawings swastikas", "Destroying drawings", "Being a dick in chat", "Spam", "Cancel"], function (reason) {
				if (reason == "Cancel") return;
				this.gui.prompt("Are you sure you want to ban " + this.usernameFromSocketid(playerid) + " (bantype: " + type + ") for " + minutes + " minutes. Reason: " + reason, ["Yes", "No"], function (confirmation) {
					if (confirmation == "Yes") {
						this.network.socket.emit("kickban", [playerid, minutes, type, reason], function (data) {
							this.chat.addMessage("SERVER", data.error || data.success);
						}.bind(this));
					}
				}.bind(this));
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

DrawTogether.prototype.setLoadImage = function setLoadImage (loadTime) {
	loadTime = loadTime || 5000;
	var loadImage = new Image();

	loadImage.onload = function () {
		this.paint.public.loadingImage = loadImage;
	}.bind(this);

	loadImage.onerror = function () {
		setTimeout(this.setLoadImage.bind(this, loadTime * 2), loadTime * 2);
	}.bind(this);

	loadImage.src = "images/loadingChunk.png?v=1";
};

DrawTogether.prototype.createDrawZone = function createDrawZone () {
	var drawContainer = this.container.appendChild(document.createElement("div"));
	drawContainer.className = "drawtogether-paint-container";
	this.paintContainer = drawContainer;

	this.paint = new Paint(drawContainer);
	this.userCtx = this.paint.newCanvasOnTop("userinteraction").getContext("2d");
	this.setLoadImage();

	this.paint.public.requestUserChunk = function requestUserChunk (chunkX, chunkY, callback) {
		var image = new Image();

		image.onload = function onChunkImageLoad (event) {
			callback(image);
		};

		image.onerror = function onChunkImageError (event) {
			console.error("Failed to load chunk ", chunkX, chunkY, " retrying in 5 seconds");
			setTimeout(function () {
				this.paint.public.requestUserChunk(chunkX, chunkY, callback);
			}.bind(this), 5000);
		}.bind(this);
		
		var room = encodeURIComponent(this.current_room);
		chunkX = encodeURIComponent(chunkX);
		chunkY = encodeURIComponent(chunkY);

		image.crossOrigin = "Anonymous";
		image.src = this.settings.imageServer + "/chunk?room=" + room + "&x=" + chunkX + "&y=" + chunkY;
	}.bind(this);

	this.paint.addEventListener("userdrawing", function (event) {
		// Lower our ink with how much it takes to draw this
		// Only do that if we are connected and in a room that does not start with private_ or game_
		if (this.current_room.indexOf("private_") !== 0) {

			// When a drawing is made check if we have ink left
			var usage = this.inkUsageFromDrawing(event.drawing);
			if (this.ink < usage) {
				if (Date.now() - this.lastInkWarning > 20000) {
					this.chat.addMessage("CLIENT", "Not enough ink! You will regain ink every 20 seconds.");
					this.chat.addMessage("CLIENT", "Tip: Small brushes use less ink.");
					this.chat.addMessage("CLIENT", "Tip: logged in users receive more ink");
					this.lastInkWarning = Date.now();
				}
				event.removeDrawing();
				return;
			}

			this.ink -= usage;
			this.updateInk();
		}

		// Send the drawing to the server and remove from the local
		// layer once we got a confirmation from the server
		this.sendDrawing(event.drawing, function () {
			event.removeDrawing();
		});
	}.bind(this));

	this.paint.addEventListener("startuserpath", function (event) {
		// start path
		this.network.socket.emit("sp", event.props.color.toHex8(), event.props.size);
		this.lastPathSize = event.props.size;
	}.bind(this));

	this.paint.addEventListener("enduserpath", function (event) {
		this.network.socket.emit("ep", function () {
			event.removePath(true);
		});
	}.bind(this));

	this.paint.addEventListener("userpathpoint", function (event) {
		// Lower our ink with how much it takes to draw this
		// Only do that if we are connected and in a room that does not start with private_ or game_
		if (this.current_room.indexOf("private_") !== 0) {

			// When a drawing is made check if we have ink left
			var usage = this.inkUsageFromPath(event.point, this.lastPathPoint, this.lastPathSize);
			if (this.ink < usage) {
				if (Date.now() - this.lastInkWarning > 20000) {
					this.chat.addMessage("CLIENT", "Not enough ink! You will regain ink every 20 seconds.");
					this.chat.addMessage("CLIENT", "Tip: Small brushes use less ink.");
					this.chat.addMessage("CLIENT", "Tip: logged in users receive more ink");
					this.lastInkWarning = Date.now();
				}
				event.removePathPoint();
				return;
			}

			this.ink -= usage;
			this.updateInk();
		}
		
		this.network.socket.emit("pp", event.point, function (success) {
			if (!success) event.removePathPoint();
		});
		this.lastPathPoint = event.point;
	}.bind(this));
};

DrawTogether.prototype.createMessage = function createMessage () {
	this.messageDom = this.container.appendChild(document.createElement("div"));
	this.messageDom.className = "drawtogether-general-message";
};

// Returns the inkusage for a pathpoint
// (point1, point2, size) or (point1, undefined, size)
DrawTogether.prototype.inkUsageFromPath = function inkUsageFromPath (point1, point2, size) {
	var length = size + (point2 ? this.utils.distance(point1[0], point1[1], point2[0], point2[1]) : 0);
	return Math.ceil(size * length / 100);
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
	if (this.accWindow) {
		this.accWindow.parentNode.removeChild(this.accWindow);
	}

	var accWindow = this.container.appendChild(document.createElement("div"));
	accWindow.className = "drawtogether-window drawtogether-accountwindow";
	this.accWindow = accWindow;
	this.accWindow.appendChild(document.createTextNode("Loading session data ..."));

	this.account.checkLogin(function (err, loggedIn) {
		var formContainer = accWindow.appendChild(document.createElement("div"));
		formContainer.className = "drawtogether-account-formcontainer";

		this.loginMessage = formContainer.appendChild(document.createElement("div"));

		if (this.account.mail) this.accountSuccess("Logged in as " + this.account.mail);
		if (err) this.accountError("Error getting session state: " + err);

		if (!loggedIn) {
			var emailInput = formContainer.appendChild(document.createElement("input"));
			emailInput.type = "email";
			emailInput.placeholder = "email@example.com";
			this.emailInput = emailInput;

			var passInput = formContainer.appendChild(document.createElement("input"));
			passInput.type = "password";
			passInput.placeholder = "*********";
			this.passInput = passInput;

			this.emailInput.addEventListener("keydown", function (event) {
				if (event.keyCode == 13) this.formLogin();
			}.bind(this));
			this.passInput.addEventListener("keydown", function (event) {
				if (event.keyCode == 13) this.formLogin();
			}.bind(this));

			var loginButton = formContainer.appendChild(document.createElement("div"));
			loginButton.appendChild(document.createTextNode("Login"));
			loginButton.className = "drawtogether-button drawtogether-login-button";
			loginButton.addEventListener("click", this.formLogin.bind(this));

			var registerButton = formContainer.appendChild(document.createElement("div"));
			registerButton.appendChild(document.createTextNode("Register"));
			registerButton.className = "drawtogether-button drawtogether-register-button";
			registerButton.addEventListener("click", this.formRegister.bind(this));
		} else {
			var logoutButton = formContainer.appendChild(document.createElement("div"));
			logoutButton.appendChild(document.createTextNode("Logout"));
			logoutButton.className = "drawtogether-button drawtogether-logout-button";
			logoutButton.addEventListener("click", function () {
				this.account.logout(function (err) {
					if (err) {
						this.accountError("Couldn't logout: " + err);
						return;
					}

					this.createAccountWindow();
					this.network.socket.emit("uKey", this.account.uKey);
				}.bind(this));
			}.bind(this));
		}
		
		var close = formContainer.appendChild(document.createElement("div"));
		close.innerText = "Close room window";
		close.textContent = "Close room window";
		close.className = "drawtogether-button drawtogether-close-button";
		close.addEventListener("click", this.closeAccountWindow.bind(this));
	}.bind(this));
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
	var pass = this.passInput.value;

	this.accountError(undefined); // Reset account error	

	this.account.login(email, pass, function (err) {
		if (err) {
			this.accountError("Couldn't login: " + err);
			return;
		}

		this.network.socket.emit("uKey", this.account.uKey);
		this.createAccountWindow();
	}.bind(this));
};

DrawTogether.prototype.formRegister = function formRegister () {
	var email = this.emailInput.value;
	var pass = this.passInput.value;

	this.accountError(undefined); // Reset account error	

	this.account.register(email, pass, function (err) {
		if (err) {
			this.accountError("Couldn't register: " + err);
			return;
		}

		this.network.socket.emit("uKey", this.account.uKey);
		this.createAccountWindow();
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

	this.showShareMessage("Uploading...");
	// Let the server upload the drawing to imgur and give us the url back
	this.network.socket.emit("uploadimage", this.paint.public.canvas.toDataURL().split(",")[1], function (data) {
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

DrawTogether.prototype.showShareMessage = function showShareMessage (msg) {
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}

	var urlMessage = this.imgurUrl.appendChild(document.createElement("div"));
	urlMessage.appendChild(document.createTextNode(msg));
	urlMessage.className = "drawtogether-share-url";
};

DrawTogether.prototype.showImgurUrl = function showImgurUrl (url) {
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}

	var urlMessage = this.imgurUrl.appendChild(document.createElement("div"));
	urlMessage.innerHTML = 'Uploaded on imgur: <a href="' + url + '">' + url + '</a>';
	urlMessage.className = "drawtogether-share-url";

	this.shareToRedditButton.target = "_blank";
	this.shareToRedditButton.href = "http://www.reddit.com/r/anondraw/submit?url=" + encodeURIComponent(url);
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

	// var text = selectWindow.appendChild(document.createElement("h1"));
	// text.innerText = "There is some heavier than usual load, so the server might lagg a bit.";
	// text.textContent = "There is some heavier than usual load, so the server might lagg a bit.";
	// text.className = "drawtogether-welcome-text-error";

	var text = selectWindow.appendChild(document.createElement("div"));
	text.appendChild(document.createTextNode("7 sept 2015 - New feature: transparency"));
	text.className = "drawtogether-welcome-text-box";

	var buttonContainer = selectWindow.appendChild(document.createElement("div"));
	buttonContainer.className = "drawtogether-buttoncontainer";

	var publicButton = buttonContainer.appendChild(document.createElement("div"));
	publicButton.className = "drawtogether-modeselect-button";
	publicButton.innerHTML = '<img src="images/multi.png"/><br/>Draw with strangers';
	publicButton.addEventListener("click", function () {
		this.changeRoom("main");
		this.selectWindow.style.display = "";
	}.bind(this));

	var privateButton = buttonContainer.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/invite.png"/><br/>Alone or with friends';
	privateButton.addEventListener("click", function () {
		this.settings.room = "private_" + Math.random().toString(36).substr(2, 5); // Random 5 letter room
		this.changeRoom(this.settings.room);
		this.selectWindow.style.display = "";
	}.bind(this));

	var privateButton = buttonContainer.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/member.png"/><br/>Members only room';
	privateButton.addEventListener("click", function () {
		this.changeRoom("member_main");
		this.selectWindow.style.display = "";
	}.bind(this));

	// var oneononeButton = selectWindow.appendChild(document.createElement("div"));
	// oneononeButton.className = "drawtogether-modeselect-button";
	// oneononeButton.innerHTML = '<img src="images/private.png"/><br/>Random One on One';
	// oneononeButton.addEventListener("click", function () {
	// 	this.settings.mode = "oneonone";
	// 	this.joinOneOnOne() : this.connect();
	// 	this.selectWindow.style.display = "";
	// }.bind(this));

	// var gameButton = selectWindow.appendChild(document.createElement("div"));
	// gameButton.className = "drawtogether-modeselect-button";
	// gameButton.innerHTML = '<img src="images/game.png"/><br/>Game';
	// gameButton.addEventListener("click", function () {
	// 	this.settings.mode = "game";
	// 	(this.socket) ? this.joinGame() : this.connect();
	// 	this.selectWindow.style.display = "";
	// }.bind(this));

	selectWindow.appendChild(this.createFAQDom());

	this.redditDrawings = selectWindow.appendChild(document.createElement("div"));
	this.redditDrawings.className = "drawtogether-redditdrawings";
	this.populateRedditDrawings();
};

DrawTogether.prototype.populateRedditDrawings = function populateRedditDrawings () {
	var req = new XMLHttpRequest();
	req.addEventListener("readystatechange", function (event) {
		if (req.readyState == 4 && req.status == 200) {
			var posts = JSON.parse(req.responseText).data.children;
			
			var title = this.redditDrawings.appendChild(document.createElement("a"));
			title.innerText = "/r/AnonDraw";
			title.href = "http://www.reddit.com/r/AnonDraw";
			title.className = "drawtogether-redditdrawings-title";

			for (var k = 0; k < posts.length; k++) {
				if (posts[k].data.thumbnail == "self" || posts[k].data.thumbnail == "default" || posts[k].data.thumbnail == "nsfw") continue;
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
	container.className = "drawtogether-redditpost";

	var title = container.appendChild(document.createElement("span"));
	title.className = "drawtogether-redditpost-title";
	title.appendChild(document.createTextNode(data.title));

	if (data.thumbnail !== "self" && data.thumbnail !== "default" && data.thumbnail !== "nsfw") {
		var thumb = container.appendChild(document.createElement("img"))
		thumb.className = "drawtogether-redditpost-thumb";
		thumb.src = data.thumbnail;
	} else {
		var filler = container.appendChild(document.createElement("div"));
		filler.className = "drawtogether-redditpost-thumbfiller";
		filler.appendChild(document.createTextNode("Text post"));
	}

	return container;
};

DrawTogether.prototype.createFAQDom = function createFAQDom () {
	var faq = document.createElement("div");
	faq.className = "drawtogether-faq";

	var questions = [{
		question: "What is anondraw?",
		answer: "It's a webapp where you can draw live with strangers or friends."
	},/* {
		question: "How do you play the game?",
		answer: "It's a drawsomething pictionairy like game. You play the game by drawing the word you get. Then other people have to guess what you draw. The person that guessed the drawing and the drawer get a point."
	},*/ {
		question: "Why can't I draw? How do I regain Ink?",
		answer: "You probably don't have any ink left. You can get more ink by waiting 30 seconds. If you still don't get enough ink try making an account, the more reputation you have the more ink you get."
	}, {
		question: "What is that number with an R behind peoples names?",
		answer: "That is the amount of reputation someone has. The more they have the more benefits they get."
	},/* {
		question: "What are those points behind some peoples names?",
		answer: "If you play the gamemode you can earn points by guessing what other people are drawing."
	},*/ {
		question: "What benefits does reputation give you?",
		answer: "\n At " + this.KICKBAN_MIN_REP + "+ reputation you can kickban people for a certain amount of time when they misbehave. \n At 6 reputation, you can join the member only rooms, give others reputation and share with multiple users under one ip."
	}, {
		question: "How do I get reputation?",
		answer: "Other people have to give you an upvote, every upvote is one reputation."
	}, {
		question: "Am I allowed to destroy drawings?",
		answer: "The goal is to let people draw together. You should never be afraid to help or change a drawing. However if you just want to destroy it refrain from doing so."
	}];

	for (var qKey = 0; qKey < questions.length; qKey++) {
		var question = faq.appendChild(document.createElement("div"));
		question.className = "drawtogether-question";

		var qhead = question.appendChild(document.createElement("h2"));
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
	var buttonList = [{
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
		action: function () {}
	}, {
		name: "name-button",
		type: "button",
		text: "Change name",
		action: this.changeName.bind(this)
	}, {
		name: "room-button",
		type: "button",
		text: "Room",
		action: this.openRoomWindow.bind(this)
	}, {
		name: "share-button",
		type: "button",
		text: "Put on imgur/reddit",
		action: this.openShareWindow.bind(this)
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
	if (location.toString().indexOf("kongregate") == -1) {
		buttonList.push({
			name: "account",
			type: "button",
			text: "Account",
			action: this.openAccountWindow.bind(this)
		});
	}
	return buttonList;
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
		    yDis = y1 - y2;
		return Math.sqrt(xDis * xDis + yDis * yDis);
	}
};