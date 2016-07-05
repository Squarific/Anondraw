function DrawTogether (container, settings) {
	// Normalize settings, set container
	this.container = container;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	this.userSettings = QuickSettings.create(0, 0, "settings");
	this.userSettings.setDraggable(false);
	this.userSettings.setCollapsible(false);

	// Set default values untill we receive them from the server
	this.playerList = [];
	this.moveQueue = [];
	this.ink = 0;
	this.previousInk = Infinity;

	this.lastInkWarning = 0;        // Last time we showed that we are out of ink
	this.lastBrushSizeWarning = 0;  // Last time we showed the warning that our brush is too big
	this.lastZoomWarning = 0;       // Last time we showed the zoom warning
	this.lastViewDeduction = 0;     // Time since we last deducted someones viewscore

	this.lastScreenMove = Date.now();    // Last time we moved the screen
	this.lastScreenMoveStartPosition;    // Last start position

	this._forceFollow;      // The playerid that should be followed
	this._autoMoveScreen;   // Boolean, should we move the screen automatically?
	this._followingPlayer;  // The player the view is currently following

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
	} else if (this.settings.mode == "askjoin") {
		this.changeRoom("main");
		this.openModeSelector();
	} else if (this.settings.mode == "join") {
		if (this.settings.room.indexOf("private_") == 0) {
			if (this.settings.room.indexOf("private_game_") == 0) {
				ga("send", "event", "autojoin", "privategame");
			} else {
				ga("send", "event", "autojoin", "private");
			}
		} else if (this.settings.room.indexOf("game_")) {
			ga("send", "event", "autojoin", "game");
		} else {
			ga("send", "event", "autojoin", "public");
		}
		this.changeRoom(this.settings.room,
			            undefined,
			            this.settings.leftTopX,
			            this.settings.leftTopY,
			            true);
	} else  if (this.settings.mode == "private") {
		this.settings.room = "private_" + Math.random().toString(36).substr(2, 5); // Random 5 letter room;
		this.changeRoom(this.settings.room, undefined, 0, 0, true);
	} else if (this.settings.mode == "member") {
		this.changeRoom("member-main");
	} else if (this.settings.mode == "auto") {
		this.changeRoom("main");
	}

	requestAnimationFrame(this.drawLoop.bind(this));
	this.needsClear = false;

	document.addEventListener("keydown", function (event) {
		if (event.target !== document.body) return;
		// On "esc"
		if (event.keyCode == 27) {
			this.closeAccountWindow();
			this.closeShareWindow();
			this.closeRoomWindow();
			this.closeSettingsWindow();
		}

		if (event.keyCode == 65) {
			this.advancedOptions.toggleVisibility();
		}
	}.bind(this));

	setInterval(this.displayTip.bind(this), 5 * 60 * 1000);
	setTimeout(this.autoMoveScreen.bind(this), 0);
}

// Hardcoded values who should probably be refactored to the server
DrawTogether.prototype.KICKBAN_MIN_REP = 50;

// Currently only client side enforced
DrawTogether.prototype.BIG_BRUSH_MIN_REP = 5;
DrawTogether.prototype.ZOOMED_OUT_MIN_REP = 2;
DrawTogether.prototype.CLIENT_VERSION = 2;

DrawTogether.prototype.defaultSettings = {
	mode: "ask",                           // Mode: public, private, oneonone, join, game, main, ask, defaults to public
	room: "main",                          // Room to join at startup
	leftTopX: 0,
	leftTopY: 0,
	loadbalancer: "http://direct.anondraw.com:3552",
	accountServer: "http://direct.anondraw.com:4552",
	imageServer: "http://direct.anondraw.com:5552"
};

DrawTogether.prototype.defaultUserSettings = [{
		title: "Mute chat",
		type: "boolean",
		value: false
	}, {
		title: "Show tips",
		type: "boolean",
		value: true
	}, {
		title: "Show welcome",
		type: "boolean",
		value: true
	}
];

DrawTogether.prototype.drawingTypes = ["line", "brush", "block"];
DrawTogether.prototype.drawingTypesByName = {"line": 0, "brush": 1, "block": 2};

DrawTogether.prototype.drawLoop = function drawLoop () {
	// Draw all user interactions of the last 2 seconds
	if (this.needsClear) {
		this.userCtx.clearRect(0, 0, this.userCtx.canvas.width, this.userCtx.canvas.height);
		this.needsClear = false
	}


	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].lastPosition && Date.now() - this.playerList[k].lastPosition.time < 6000) {
			this.drawPlayerInteraction(this.playerList[k].name, this.playerList[k].lastPosition.pos);
			this.needsClear = true;
		}
	}

	this.handleMoveQueue();

	// Recall the drawloop
	requestAnimationFrame(this.drawLoop.bind(this));
};

DrawTogether.prototype.handleMoveQueue = function handleMoveQueue () {
	if (this.moveQueue.length > 0) {
		if (Date.now() - this.lastScreenMove >= this.moveQueue[0].duration) {
			this.lastScreenMove = Date.now();
			this.lastScreenMoveStartPosition = this.moveQueue[0].position;

			this.paint.goto(this.moveQueue[0].position[0], this.moveQueue[0].position[1]);
			this.moveQueue.shift();
			return;
		}

		var delta = Date.now() - this.lastScreenMove;
		var relativeDistance = delta / this.moveQueue[0].duration;
		var distances = [relativeDistance * (this.moveQueue[0].position[0] - this.lastScreenMoveStartPosition[0]),
		                 relativeDistance * (this.moveQueue[0].position[1] - this.lastScreenMoveStartPosition[1])];

		this.paint.goto(distances[0] + this.lastScreenMoveStartPosition[0],
		                distances[1] + this.lastScreenMoveStartPosition[1]);
	}
};

DrawTogether.prototype.autoMoveScreen = function autoMoveScreen () {
	if (this._forceFollow) {

		this.moveScreenTo(this._forceFollow);
		this._followingPlayer = null;

	} else if (this._autoMoveScreen) {

		if (!this._followingPlayer) {
			this._followingPlayer = this.getMaxViewScorePlayer();
			this.lastViewDeduction = Date.now();
		}

		var viewDeductionDelta = Date.now() - this.lastViewDeduction;
		
		for (var k = 0; k < this.playerList.length; k++) {
			this.playerList[k].id == this._followingPlayer;
			this.playerList[k].viewScore -= viewDeductionDelta;
			break;
		}

		this.lastViewDeduction += viewDeductionDelta;

		this.moveScreenTo(this._followingPlayer);
		this._followingPlayer = this.getMaxViewScorePlayer();

	} else {
		this._followingPlayer = null;
	}

	setTimeout(this.autoMoveScreen.bind(this), 5000);
};

// Move to the given player in 1 second
// If the player is close (1 screen difference in every direction) we just move to it
// If the player is farther we start moving in its direction for half a second
// then jump close (.5 screen) to him and then move from the close point to the player
DrawTogether.prototype.moveScreenTo = function moveScreenTo (playerid) {
	var player = this.playerFromId(playerid);
	if (!player || !player.lastPosition || !player.lastPosition.pos) return;

	var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
	                  this.paint.public.canvas.height / this.paint.public.zoom];

	var targetPosEnd = [player.lastPosition.pos[0] - screenSize[0] / 2,
	                    player.lastPosition.pos[1] - screenSize[1] / 2];

	var distances = [targetPosEnd[0] - this.paint.public.leftTopX,
	                 targetPosEnd[1] - this.paint.public.leftTopY];

	// If we are still well on the screen lets just not move
	if (Math.abs(distances[0]) < screenSize[0] * 0.35 &&
	    Math.abs(distances[1]) < screenSize[1] * 0.35) {
		return;
	}

	// If we are only like a screen away, lets move quickly
	if (Math.abs(distances[0]) < screenSize[0] &&
	    Math.abs(distances[1]) < screenSize[1]) {
		this.moveScreenToPosition(targetPosEnd, 3500);
		return;
	}

	var targetPosStart = [this.paint.public.leftTopX + 0.15 * distances[0],
	                      this.paint.public.leftTopY + 0.15 * distances[1]];

	var targetPosMiddle = [targetPosEnd[0] - distances[0] * 0.15,
	                       targetPosEnd[1] - distances[1] * 0.15];

	this.moveScreenToPosition(targetPosStart, 500);
	this.moveScreenToPosition(targetPosMiddle, 0);
	this.moveScreenToPosition(targetPosEnd, 500);
};

DrawTogether.prototype.moveScreenToPosition = function moveScreenToPosition (position, duration) {
	if (!this.lastScreenMoveStartPosition || this.moveQueue.length == 0) {
		this.lastScreenMoveStartPosition = [this.paint.public.leftTopX,
		                                    this.paint.public.leftTopY];
		this.lastScreenMove = Date.now();
	}

	if (isNaN(duration) || isNaN(position[0]) || isNaN(position[1]))
		throw "Duration or position was not a number";

	this.moveQueue.push({
		position: position,
		duration: duration
	});

	return true;
};

// Returns the playerid with the biggest viewscore
DrawTogether.prototype.getMaxViewScorePlayer = function getMaxViewScorePlayer () {
	if (this.playerList.length < 1) return null;

	var maxViewScore = -Infinity;
	var maxId = this.playerList[0].id;

	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].viewScore > maxViewScore) {
			maxViewScore = this.playerList[k].viewScore;
			maxId = this.playerList[k].id;
		}
	}

	return maxId;
};

DrawTogether.prototype.drawPlayerInteraction = function drawPlayerInteraction (name, position) {
	this.userCtx.font = "12px monospace";
    this.userCtx.lineWidth = 3;

	this.userCtx.strokeStyle = 'black';
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
			self.changeRoom(room, undefined, 0, 0, true);
		}
	});

	this.network.on("initname", function (name) {
		// Server gave us a guest name, set name only
		// if we didn't ask for a different one
		if (!localStorage.getItem("drawtogether-name")) {
			self.setName(name);
		}
	});

	this.network.on("finalize", function (amountToKeep) {
		self.paint.finalizeAll(amountToKeep);
	});

	this.network.on("clear", function () {
		self.paint.clear();
	});

	this.network.on("drawing", function (data) {
		var drawing = self.decodeDrawings([data.drawing])[0];
		self.paint.addPublicDrawing(drawing);
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

		// Instead of reassigning, remove players who arent on the new list
		// and update their data TODO
		self.playerList = list;
		self.updatePlayerList();
	});

	this.network.on("leave", function (player) {
		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == player.id) {
				self.chat.addElementAsMessage(self.createPlayerLeftDom(self.playerList[k]));
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

	this.network.on("undodrawings", function (id, all) {
		self.paint.undodrawings(id, all);
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

		if (status.letters == 0) {
			self.chat.addMessage("GAME", self.usernameFromSocketid(status.currentPlayer) + " is picking a word.");
		} else {
			self.chat.addMessage("GAME", "The word: " + Array(status.letters + 1).join("_ ") + "(" + status.letters + " letters)");
			self.displayMessage("The word: " + Array(status.letters + 1).join("_ ") + "(" + status.letters + " letters)");
		}

		for (var k = 0; k < self.playerList.length; k++) {
			if (self.playerList[k].id == status.currentPlayer) {
				self.playerList[k].currentPlayer = true;
			} else {
				self.playerList[k].currentPlayer = false;
			}
		}

		self.updatePlayerList();
	});

	this.network.on("words", function (words) {
		var promptContainer = self.gui.prompt("It is your turn! Pick a word to draw. You have 10 seconds.", words, function (word) {
			self.network.socket.emit("word", word);
		});

		setTimeout(function () {
			if (promptContainer.parentNode)
				promptContainer.parentNode.removeChild(promptContainer);
		}, 10 * 1000);
	});

	this.network.on("gameword", function (word) {
		self.displayMessage("You picked " + word);
		self.chat.addMessage("GAME", "You picked " + word);
		self.weAreCurrentPlayer = true;
	});

	this.network.on("endturn", function () {
		self.weAreCurrentPlayer = false;
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

	this.network.on("setmemberlevel", function (level) {
		self.memberlevel = level;
		console.log("We have memberlevel ", level);

		if (self.memberlevel > 0 && !localStorage.getItem("buyreported")) {
			goog_report_buy();
			ga("send", "event", "conversion", "buypremium");
			localStorage.setItem("buyreported", true);
		}
	});

	this.network.on("setreputation", function (rep) {
		self.reputation = rep;
		console.log("Our reputation is ", rep);
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

DrawTogether.prototype.displayTip = function displayTip () {
	if (!this.userSettings.getBoolean("Show tips")) return;

	var tips = [
		"Did you know you can use shortcuts? Press C to toggle the color selection!",
		"Tip: use B to switch to the brush tool. (Others: [l]ine, [c]olor, [p]icker, [g]rab, ...)",
		"Tip: You get ink faster if you register an account and get reputation!",
		"Did you know? You can easily upload your drawing to imgur, you can also share it to reddit!",
		"Did you know? Private rooms always start with private_",
		"Did you know? There is a member only room where only people with enough reputation can draw.",
		"Tip: If you type Nyan with a capital, a cat will appear.",
		"Tip: If you write Kappa with a capital you will get the twitch emote.",
		"Tip: There are a few commands, try typing /me or /help",
		"Need more ink? Try creating an account.",
		"Want to be shown on the frontpage? If you share to reddit it will get added automatically.",
		"Tip: Use transparency to get nicer effects.",
		"The ▲ next to peoples name is the upvote button.",
		"Did you know you can ban people once you have 50+ rep?",
		"Got feedback? There is a button at the left where you can leave it!",
		"Try some shortcuts: C, L, B, P, G",
		"If you click on someones name you will jump to their last draw position!",
		"Pressing the eye next to someones name will make your screen follow the player."
	];

	this.displayMessage(tips[Math.floor(Math.random() * tips.length)]);
};

// Try to change the room
// We will change it to the first parameter, if thta doesn't work we will go to
// room + number where number starts at 1 and raises with 1 for every full room
// If you make the third parameter true we will tell the server we really want
// to join that particular room and the fourth is a "secret" override that 
// ignores if a room is full
DrawTogether.prototype.changeRoom = function changeRoom (room, number, x, y, specific, override) {
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
	this.network.loadRoom(room + number, specific, override, function (err, drawings) {
		this.changingRoom = false;
		if (err && err.indexOf("Too many users") !== -1) {
			this.chat.addMessage("Room '" + room + number + "' is full! Trying " + room + ((number || 0) + 1));
			this.changeRoom(room, (number || 0) + 1, x, y);
			return;
		} else if (err) {
			this.chat.addMessage("Failed to load room '" + room + "'. Server error: " + err + ". Trying again in 5 seconds.");
			setTimeout(this.changeRoom.bind(this, room, number, x, y, specific, override), 5000);
		} else {
			this.setRoom(room + number);

			this.paint.clear();
			this.paint.goto(x || 0, y || 0);
			this.paint.changeTool("grab");
			this.paint.addPublicDrawings(this.decodeDrawings(drawings));
			this.chat.addMessage("Invite people", "http://www.anondraw.com/#" + room + number);

			// If we are new show the welcome window
			if (this.userSettings.getBoolean("Show welcome")) {
				this.openWelcomeWindow();

			// We are not new, check if we already saw all the awesome new features
			} else if (parseInt(localStorage.getItem("newfeaturewindowversion")) !== this.CLIENT_VERSION) {
				this.openNewFeatureWindow();
			}

			this.removeLoading();
		}
	}.bind(this));

	this.setLoading(room);
};

DrawTogether.prototype.joinGame = function joinGame () {
	ga("send", "event", "modeselector", "publicgame");
	this.network.joinGame(this.controls.byName.name.input.value == "Uberlord", function (err, room, drawings) {
		if (err && err.indexOf("Too many users") !== -1) {
			this.chat.addMessage("Couldn't join gameroom, too many users.");
			this.gui.prompt("With whom would you like to play?", ["Join strangers", "Create private room", "Cancel"], function (whom) {
				if (whom == "Cancel") this.openModeSelector();
				else if (whom == "Join strangers") this.joinGame();
				else if (whom == "Create private room") this.createPrivateGame();
			}.bind(this));
			return;
		} else if (err) {
			this.chat.addMessage("Failed to join game. Trying again in 5 seconds. Error: " + err);
			setTimeout(this.joinGame.bind(this), 5000);
		} else {
			this.setRoom(room);

			this.paint.clear();
			this.paint.drawDrawings("public", this.decodeDrawings(drawings));
			this.chat.addMessage("Welcome to anondraw, enjoy your game!");
			this.chat.addMessage("Invite friends:", "http://www.anondraw.com/#" + room);

			this.removeLoading();
		}
	}.bind(this));

	this.setLoading("game");
	this.chat.addMessage("Looking for game to join ...");
};

DrawTogether.prototype.createPrivateGame = function createPrivateGame () {
	ga("send", "event", "modeselector", "newprivategame");
	this.changeRoom("private_game_" + Math.random().toString(36).substr(2, 5));
};

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

		localStorage.setItem("drawtogether-name", realname);
	}.bind(this));
};

DrawTogether.prototype.changeNameDelayed = function () {
	clearTimeout(this.changeNameTimeout);
	this.changeNameTimeout = setTimeout(this.changeName.bind(this), 750);
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
			this.playerList[k].viewScore = this.playerList[k].viewScore || 0;

			this.playerList[k].lastPosition.pos = position;
			this.playerList[k].lastPosition.time = time;

			this.playerList[k].viewScore += 100;
		}
	}
};

DrawTogether.prototype.updateInk = function updateInk () {
	// Remove the previous text
	while (this.inkDom.firstChild) this.inkDom.removeChild(this.inkDom.firstChild);
	this.inkDom.appendChild(document.createTextNode("Ink: " + Math.floor(this.ink) + "/200000"));

	var width = Math.floor(Math.max(this.ink / 2000, 0));
	if (!this.lastInkWidth || this.lastInkWidth !== width) {
		this.inkDom.style.width = width + "%";
		this.lastInkWidth = width;
	}

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
	location.hash = room + "," +
	                this.paint.public.leftTopX.toFixed() + "," +
	                this.paint.public.leftTopY.toFixed();
};

DrawTogether.prototype.openSettingsWindow = function openSettingsWindow () {
	this.settingsWindow.style.display = "block";
	ga("send", "event", "openwindow", "settings");
};

DrawTogether.prototype.openShareWindow = function openShareWindow () {
	this.shareWindow.style.display = "block";
	ga("send", "event", "openwindow", "share");

	this.preview.width = this.shareWindow.offsetWidth * 0.9;
	this.preview.height = this.preview.width * (this.paint.public.canvas.height / this.paint.public.canvas.width);

	var ctx = this.preview.getContext("2d");
	ctx.drawImage(this.paint.background.canvas, 0, 0, this.preview.width, this.preview.height);
	ctx.drawImage(this.paint.public.canvas, 0, 0, this.preview.width, this.preview.height);
};

DrawTogether.prototype.openRoomWindow = function openRoomWindow () {
	this.roomWindow.style.display = "block";
	ga("send", "event", "openwindow", "rooms");

	this.network.getRooms(function (err, rooms) {
		while (this.publicRoomsContainer.firstChild)
			this.publicRoomsContainer.removeChild(this.publicRoomsContainer.firstChild);

		var sorted = Object.keys(rooms).sort();
		for (var k = 0; k < sorted.length; k++) {
			var name = sorted[k];
			var roomButton = this.publicRoomsContainer.appendChild(document.createElement("div"));
			roomButton.className = "drawtogether-button drawtogether-room-button";
			roomButton.appendChild(document.createTextNode(name + " (" + rooms[name] + " users)"))
			roomButton.addEventListener("click", function (name, event) {
				this.changeRoom(name, undefined, 0, 0, true);
				this.closeRoomWindow();
			}.bind(this, name));
		}
	}.bind(this));
};

DrawTogether.prototype.openAccountWindow = function openAccountWindow () {
	this.accWindow.style.display = "block";
	ga("send", "event", "openwindow", "account");
};

DrawTogether.prototype.openModeSelector = function openModeSelector () {
	this.selectWindow.style.display = "block";
};

DrawTogether.prototype.closeSettingsWindow = function closeSettingsWindow () {
	this.settingsWindow.style.display = "";
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
	this.createSettingsWindow();
};

DrawTogether.prototype.usernameFromSocketid = function usernameFromSocketid (socketid) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].id == socketid) {
			return this.playerList[k].name;
		}
	}

	return "[Not found]";
};

DrawTogether.prototype.playerFromId = function playerFromId (id) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].id == id) {
			return this.playerList[k];
		}
	}

	return null;
};

DrawTogether.prototype.createPlayerLeftDom = function createPlayerLeftDom (player) {
	var playerDom = document.createElement("div");
	playerDom.className = "drawtogether-player";

	if (this.reputation >= this.KICKBAN_MIN_REP) {
		var kickbanButton = document.createElement("span");
		kickbanButton.className = "drawtogether-player-button drawtogether-kickban-button";

		kickbanButton.innerText = "B";
		kickbanButton.textContent = "B";

		kickbanButton.addEventListener("click", this.kickban.bind(this, player.id));

		playerDom.appendChild(kickbanButton);
	}

	var upvoteButton = document.createElement("span");
	upvoteButton.className = "drawtogether-player-button drawtogether-upvote-button"
	upvoteButton.appendChild(document.createTextNode("▲"));

	upvoteButton.addEventListener("click", function (playerid, event) {
		this.network.socket.emit("upvote", playerid);
	}.bind(this, player.id));

	var nameText = document.createElement("span");
	nameText.className = "drawtogether-player-name";

	var rep = "", score = "";
	if (typeof player.reputation !== "undefined") {
		var rep = " (" + player.reputation + " R)";
	}

	if (typeof player.gamescore !== "undefined") {
		score = " [" + player.gamescore + " Points]";
	}

	nameText.appendChild(document.createTextNode(player.name + rep + score + " has left."))

	playerDom.appendChild(upvoteButton);
	playerDom.appendChild(nameText);

	return playerDom;
};

DrawTogether.prototype.createPlayerDom = function createPlayerDom (player) {
	var playerDom = document.createElement("div");
	playerDom.className = "drawtogether-player " + (player.currentPlayer ? "currentplayer" : "");
	playerDom.setAttribute("data-snap-ignore", "true");

	playerDom.addEventListener("click", function (playerid, event) {
		this.moveQueue.length = 0;
		this.moveScreenTo(playerid);
	}.bind(this, player.id));

	var followButton = playerDom.appendChild(document.createElement("span"));
	followButton.className = "drawtogether-player-button drawtogether-follow-button";
	if (player.id == this._forceFollow) followButton.classList.add("drawtogether-activated");

	var img = followButton.appendChild(document.createElement("img"));
	img.src = "images/icons/eye.png";

	followButton.addEventListener("click", function (playerid, event) {
		this.moveQueue.length = 0;

		if (this._forceFollow == playerid) {
			this._forceFollow = null;
		} else {
			this._forceFollow = playerid;
		}

		this.updatePlayerList();
	}.bind(this, player.id));

	var upvoteButton = document.createElement("span");
	upvoteButton.className = "drawtogether-player-button drawtogether-upvote-button"
	upvoteButton.appendChild(document.createTextNode("▲"));

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

	var rep = "", score = "", drawing = "", icons = "";
	if (typeof player.reputation !== "undefined") {
		var rep = " (" + player.reputation + " R)";
	}

	if (typeof player.gamescore !== "undefined") {
		score = " [" + player.gamescore + " Points]";
	}

	if (player.currentPlayer) {
		drawing = " | DRAWING"
	}

	if (player.memberlevel == 1) {
		icons += "♥";
		nameText.className += " premium";
	}

	nameText.appendChild(document.createTextNode(player.name + rep + score + drawing))

	playerDom.appendChild(upvoteButton);
	playerDom.appendChild(nameText);

	var iconDom = document.createElement("span");
	iconDom.appendChild(document.createTextNode(icons));
	iconDom.className = "icons";
	playerDom.appendChild(iconDom);

	return playerDom;
};

DrawTogether.prototype.kickban = function kickban (playerid) {
	this.gui.prompt("How long do you want to kickban this person for? (minutes)", ["freepick", "10 year", "1 year", "1 week", "1 day", "1 hour", "5 minutes", "1 minute", "Cancel"], function (minutes) {
		if (minutes == "Cancel") return;
		if (minutes == "10 year") minutes = 10 * 356 * 24 * 60;
		if (minutes == "1 year") minutes = 356 * 24 * 60;
		if (minutes == "1 week") minutes = 7 * 24 * 60;
		if (minutes == "1 day") minutes = 24 * 60;
		if (minutes == "1 hour") minutes = 60;
		if (minutes == "5 minutes") minutes = 5;
		if (minutes == "1 minute") minutes = 1;
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
	this.chat = new Chat(chatContainer, this.sendMessage.bind(this), this.userSettings);
	this.chatContainer = chatContainer;
	this.chat.addMessage("Welcome to anondraw, the free interactive group drawing app.");

	var snapper = new Snap({
		element: chatContainer,
		disable: "left",
		minPosition: -275,
		maxPosition: 0,
		slideIntent: 40
	});
};

DrawTogether.prototype.setLoadImage = function setLoadImage (loadTime) {
	loadTime = loadTime || 5000;
	var loadImage = new Image();

	loadImage.onload = function () {
		this.paint.background.loadingImage = loadImage;
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

	this.paint.background.requestUserChunk = function requestUserChunk (chunkX, chunkY, callback, time) {
		var image = new Image();
		var time = time || 0;
		time += 5000 * Math.random() + 2500;

		image.onload = function onChunkImageLoad (event) {
			callback(image);
		};

		image.onerror = function onChunkImageError (event) {
			console.error("Failed to load chunk ", chunkX, chunkY, " retrying in " + Math.round(time / 1000) + " seconds");
			setTimeout(function () {
				this.paint.background.requestUserChunk(chunkX, chunkY, callback, time);
			}.bind(this), time);
		}.bind(this);
		
		var room = encodeURIComponent(this.current_room);
		chunkX = encodeURIComponent(chunkX);
		chunkY = encodeURIComponent(chunkY);

		image.crossOrigin = "Anonymous";
		if (!this.current_room) {
			callback(image);
			return;
		}
		image.src = this.settings.imageServer + "/chunk?room=" + room + "&x=" + chunkX + "&y=" + chunkY + "&t=" + (this.lastImageUpdate || Date.now());
	}.bind(this);

	this.paint.addEventListener("userdrawing", function (event) {
		if ((this.current_room.indexOf("game_") === 0 ||
		    this.current_room.indexOf("private_game_") === 0) &&
		    !this.weAreCurrentPlayer) {
			this.displayMessage("Not your turn!");
			event.removeDrawing();
			return;
		}

		// Lower our ink with how much it takes to draw this
		// Only do that if we are connected and in a room that does not start with private_ or game_
		if (this.current_room.indexOf("private_") !== 0 && this.current_room.indexOf("game_") !== 0) {
			if (!(this.reputation > this.BIG_BRUSH_MIN_REP) &&
			    ((event.drawing.size > 10 && typeof event.drawing.text == "undefined") || event.drawing.size > 20)) {
				if (Date.now() - this.lastBrushSizeWarning > 5000) {
					this.chat.addMessage("Brush sizes above 10 and text sizes above 20 require an account with " + this.BIG_BRUSH_MIN_REP + " reputation! Registering is free and easy. You don't even need to confirm your email!");
					this.lastBrushSizeWarning = Date.now();
				}

				event.removeDrawing();
				return;
			}

			// When a drawing is made check if we have ink left
			var usage = this.inkUsageFromDrawing(event.drawing);
			if (this.ink < usage) {
				if (Date.now() - this.lastInkWarning > 5000) {
					this.chat.addMessage("Not enough ink! You will regain ink every few seconds.");
					this.chat.addMessage("Tip: Small brushes use less ink.");
					this.chat.addMessage("Tip: logged in users receive more ink");
					this.lastInkWarning = Date.now();
				}
				event.removeDrawing();
				return;
			}

			// If we are logged out we aren't allowed to draw zoomed out
			if (this.reputation < this.ZOOMED_OUT_MIN_REP && this.paint.public.zoom < 1) {
				if (Date.now() - this.lastZoomWarning > 5000) {
					this.chat.addMessage("Drawing while zoomed out this far is only allowed if you have more than " + this.ZOOMED_OUT_MIN_REP + " reputation.");
				}
				this.lastZoomWarning = Date.now();

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

	this.paint.addEventListener("undo", function (event) {
		this.network.socket.emit("undo");
	}.bind(this));

	this.paint.addEventListener("startuserpath", function (event) {
		// start path
		this.network.socket.emit("sp", event.props.color.toHex8(), event.props.size);
		this.lastPathSize = event.props.size;
	}.bind(this));

	this.paint.addEventListener("enduserpath", function (event) {
		this.network.socket.emit("ep", function (id) {
			event.removePath(true, id);
		});
	}.bind(this));

	this.paint.addEventListener("userpathpoint", this.handlePaintUserPathPoint.bind(this));

	this.paint.addEventListener("select", this.handlePaintSelection.bind(this));

	function setHash () {
		location.hash = this.current_room + "," +
		                this.paint.public.leftTopX.toFixed() + "," +
		                this.paint.public.leftTopY.toFixed();
	}

	var hashTimeout;
	var boundSetHash = setHash.bind(this);

	this.paint.addEventListener("move", function (event) {
		clearTimeout(hashTimeout);
		hashTimeout = setTimeout(boundSetHash, 100);
	});

	this.paint.changeTool("grab");
};

DrawTogether.prototype.handlePaintUserPathPoint = function handlePaintUserPathPoint (event) {
	if ((this.current_room.indexOf("game_") === 0 ||
	    this.current_room.indexOf("private_game_") === 0) &&
	    !this.weAreCurrentPlayer) {
		this.displayMessage("Not your turn!");
		event.removePathPoint();
		return;
	}

	// Lower our ink with how much it takes to draw this
	// Only do that if we are connected and in a room that does not start with private_ or game_
	if (this.current_room.indexOf("private_") !== 0 && this.current_room.indexOf("game_") !== 0) {
		if (!(this.reputation > this.BIG_BRUSH_MIN_REP) && this.lastPathSize > 10) {
			if (Date.now() - this.lastBrushSizeWarning > 5000) {
				this.chat.addMessage("Brush sizes above 10 and text sizes above 20 require an account with " + this.BIG_BRUSH_MIN_REP + " reputation! Registering is free and easy. You don't even need to confirm your email!");
				this.lastBrushSizeWarning = Date.now();
			}

			event.removePathPoint();
			return;
		}

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

		// If we are logged out we aren't allowed to draw zoomed out
		if (this.reputation < this.ZOOMED_OUT_MIN_REP && this.paint.public.zoom < 1) {
			if (Date.now() - this.lastZoomWarning > 5000) {
				this.chat.addMessage("Drawing while zoomed out this far is only allowed if you have more than " + this.ZOOMED_OUT_MIN_REP + " reputation.");
				this.lastZoomWarning = Date.now();
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
};

DrawTogether.prototype.handlePaintSelection = function handlePaintSelection (event) {
	this.gui.prompt("What do you want to do with your selection?", [
		"Export in high quality",
		"Create protected region",
		"Cancel"
	], function (answer) {
		if (answer === "Cancel") return;

		var handlers = {
			"Export in high quality": this.exportImage.bind(this),
			"Create protected region": this.createProtectedRegion.bind(this)
		};

		handlers[answer](event.from, event.to);
	}.bind(this));
};

DrawTogether.prototype.createProtectedRegion = function (from, to) {
	this.chat.addMessage("This feature is not ready yet, check back soon!");
	return;

	if (!this.memberlevel) {
		this.chat.addMessage("Creating a protected region is a member only feature.");
		return;
	}

	this.network.emit("createprotectedregion", from, to);
};

DrawTogether.prototype.resetProtectedRegions = function () {
	this.network.emit("resetprotectedregions");
};

DrawTogether.prototype.exportImage = function (from, to) {
	var img = document.createElement("img");
	img.src = this.paint.exportImage(from, to);
	img.alt = "Exported image";
	
	var exportwindow = this.gui.createWindow({ title: "Exported image (right click to save)" });
	exportwindow.classList.add("exportwindow");
	exportwindow.appendChild(img);
};

DrawTogether.prototype.createMessage = function createMessage () {
	this.messageDom = this.container.appendChild(document.createElement("div"));
	this.messageDom.className = "drawtogether-general-message";
};

// Returns the inkusage for a pathpoint
// (point1, point2, size) or (point1, undefined, size)
DrawTogether.prototype.inkUsageFromPath = function inkUsageFromPath (point1, point2, size) {
	var length = size + (point2 ? this.utils.distance(point1[0], point1[1], point2[0], point2[1]) : 0);
	return Math.ceil(size * length / 25);
};

DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
	// If its a brush the ink usage is (size * size)
	// If it is a line the ink usage is (size * length * 2)
	var length = drawing.size;

	if (typeof drawing.x1 == "number")
		length = this.utils.distance(drawing.x, drawing.y, drawing.x1, drawing.y1) * 2;

	if (typeof drawing.text == "string")
		length *= drawing.text.length;

	return Math.ceil(drawing.size * length / 25);
};

DrawTogether.prototype.createRoomInformation = function createRoomInformation () {
	var infoContainer = this.container.appendChild(document.createElement("div"));
	infoContainer.className = "drawtogether-info-container";
	this.infoContainer = infoContainer;

	var inkContainer = infoContainer.appendChild(document.createElement("div"));
	inkContainer.className = "drawtogether-ink-container";
	inkContainer.setAttribute("data-intro", "Here you can see how much ink you have left. Drawing uses ink and once you hit 0 you can no longer draw.");

	this.inkDom = inkContainer.appendChild(document.createElement("div"));
	this.inkDom.className = "drawtogether-ink";

	this.playerListDom = infoContainer.appendChild(document.createElement("div"));
	this.playerListDom.className = "drawtogether-info-playerlist";
	this.playerListDom.setAttribute("data-intro", "Here is a list of people currently in the room. If you want to watch them you can click their name. The eye icon can be used as a stalker mode.");

	var snapper = new Snap({
		element: infoContainer,
		disable: "left",
		minPosition: -275,
		maxPosition: 0,
		slideIntent: 40
	});
};

DrawTogether.prototype.createGameInformation = function createGameInformation () {
	var gameInfoContainer = this.container.appendChild(document.createElement("div"));
	gameInfoContainer.className = "drawtogether-gameinfo-container";
	this.gameInfoContainer = gameInfoContainer;
};

DrawTogether.prototype.createSettingsWindow = function createSettingsWindow () {
	if (this.settingsWindow)
		this.settingsWindow.parentNode.removeChild(this.settingsWindow);

	var settingsWindow = this.container.appendChild(document.createElement("div"));
	settingsWindow.className = "drawtogether-window drawtogether-settingswindow";
	this.settingsWindow = settingsWindow;

	var settingsContainer = settingsWindow.appendChild(document.createElement("div"));
	settingsContainer.className = "drawtogether-settingswindow-container";

	for (var k = 0; k < this.defaultUserSettings.length; k++) {
		this.userSettings.addControl(this.defaultUserSettings[k]);
	}

	var advancedOptions = QuickSettings.create(30, 10, "Advanced options");
	advancedOptions.hide();
	this.advancedOptions = advancedOptions;

	var rotation = 0;
	var horizontal = false;
	var vertical = false;

	advancedOptions.addInfo("Tip 1:", "Press ESC to undo anything out of this menu.");
	advancedOptions.addInfo("Tip 2:", "U can also use the keys mentioned between the ( and ).");

	advancedOptions.addRange("Rotation (e and r)", -180, 180, 0, 1, function (value) {
		this.paint.setRotation(value);
	}.bind(this));

	advancedOptions.addBoolean("Flip horizontal (m)", false, function (value) {
		this.paint.setHorizontalMirror(value);
	}.bind(this));

	advancedOptions.addBoolean("Flip vertical (k)", false, function (value) {
		this.paint.setVerticalMirror(value);
	}.bind(this));

	advancedOptions.addButton("Close (a)", function () {
		advancedOptions.hide();
	});

	this.paint.addEventListener("canvaschange", function (event) {
		var rotation = event.rotation;
		if (event.rotation > 180) rotation = -360 + event.rotation;
		advancedOptions.setRangeValue("Rotation (r)", rotation, false);
		advancedOptions.setBoolean("Flip horizontal (m)", event.scale[0] == -1, false);
		advancedOptions.setBoolean("Flip vertical (k)", event.scale[1] == -1, false);
	});

	settingsContainer.appendChild(this.userSettings._panel);

	var openAdvancedButton = settingsContainer.appendChild(document.createElement("div"));
	openAdvancedButton.appendChild(document.createTextNode("Open advanced settings (a)"));
	openAdvancedButton.className = "drawtogether-button";
	openAdvancedButton.addEventListener("click", function () {
		this.closeSettingsWindow();
		advancedOptions.show();
	}.bind(this));
	
	var close = settingsContainer.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Close settings window"))
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeSettingsWindow.bind(this));
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
			var resetButton = formContainer.appendChild(document.createElement("div"));
			resetButton.appendChild(document.createTextNode("Reset protected regions"));
			resetButton.className = "drawtogether-button";
			resetButton.addEventListener("click", function () {
				this.resetProtectedRegions();
			}.bind(this));

			var premiumButton = formContainer.appendChild(document.createElement("div"));
			premiumButton.appendChild(document.createTextNode("Premium"));
			premiumButton.className = "drawtogether-button";
			premiumButton.addEventListener("click", function () {
				this.closeAccountWindow();
				this.openPremiumBuyWindow();
			}.bind(this));

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
		close.appendChild(document.createTextNode("Close account window"));
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
	roomText.appendChild(document.createTextNode("Public group rooms:"));
	roomText.className = "drawtogether-room-text"

	this.publicRoomsContainer = roomWindowConentContainer.appendChild(document.createElement("div"));
	this.publicRoomsContainer.className = "drawtogether-publicroomscontainer";

	var roomText = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomText.appendChild(document.createTextNode("Manual room:"))

	roomText.className = "drawtogether-room-text"

	this.roomInput = roomWindowConentContainer.appendChild(document.createElement("input"));
	this.roomInput.type = "text";
	this.roomInput.placeholder = "Room name";
	
	var roomButton = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomButton.appendChild(document.createTextNode("Create public room"));
	roomButton.className = "drawtogether-button";
	roomButton.addEventListener("click", function (event) {
		if (this.roomInput.value == this.current_room)
			this.changeRoom("main", undefined, 0, 0, true, this.controls.byName.name.input.value == "Uberlord");
		else
			this.changeRoom(this.roomInput.value);
		this.closeRoomWindow();
	}.bind(this));
	
	var roomButton = roomWindowConentContainer.appendChild(document.createElement("div"));
	roomButton.appendChild(document.createTextNode("Create private room"));
	roomButton.className = "drawtogether-button create-private-room";
	roomButton.addEventListener("click", function (event) {
		this.changeRoom("private_" + Math.random().toString(36).substr(2, 5), undefined, 0, 0, true);
		this.closeRoomWindow();
	}.bind(this));

	var close = roomWindowConentContainer.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Close room window"));
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeRoomWindow.bind(this));
};

DrawTogether.prototype.createControls = function createControls () {
	var controlContainer = this.container.appendChild(document.createElement("div"));
	controlContainer.className = "drawtogether-control-container";
	this.controls = new Controls(controlContainer, this.createControlArray());

	var sharediv = controlContainer.appendChild(document.createElement("div"));
	sharediv.className = "addthis_sharing_toolbox";

	for (var name in this.controls.byName) {
		this.controls.byName[name].input.setAttribute("data-snap-ignore", "true");
	}

	var snapper = new Snap({
		element: controlContainer,
		disable: "right",
		minPosition: 0,
		maxPosition: 275,
		slideIntent: 40
	});
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

		goog_report_register();
		ga("send", "event", "conversion", "register");
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
	err.appendChild(document.createTextNode(msg));
};

DrawTogether.prototype.accountSuccess = function accountSuccess (success) {
	while (this.loginMessage.firstChild)
		this.loginMessage.removeChild(this.loginMessage.firstChild);

	if (!success) return;

	var msg = this.loginMessage.appendChild(document.createElement("div"));
	msg.className = "drawtogether-success drawtogether-login-success";
	msg.appendChild(document.createTextNode(success));
};

DrawTogether.prototype.uploadImage = function uploadImage () {
	// Remove the previous url
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}

	this.showShareMessage("Uploading...");
	// Let the server upload the drawing to imgur and give us the url back
	this.network.socket.emit("uploadimage", this.preview.toDataURL().split(",")[1], function (data) {
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
	errorMessage.appendChild(document.createTextNode(error));
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

DrawTogether.prototype.toggleFollow = function toggleFollow () {
	this._autoMoveScreen = !this._autoMoveScreen;

	if (this._autoMoveScreen)
		this.displayMessage("Your screen will now move around automatically.");
	else {
		this.displayMessage("You now have to move the camera manually.");
		this.moveQueue.length = 0;
	}
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
	upload.appendChild(document.createTextNode("Upload image to imgur"))
	upload.addEventListener("click", this.uploadImage.bind(this));

	var share = shareWindow.appendChild(document.createElement("a"));
	share.className = "drawtogether-button drawtogether-share-button";
	share.appendChild(document.createTextNode("Share image to reddit"))
	share.href = "#";
	this.shareToRedditButton = share;
	share.addEventListener("click", function (shareButton) {
		if (shareButton.href.indexOf("reddit") === -1) {
			this.showShareError("First upload the image to imgur before uploading it to reddit!");
		}
	}.bind(this, share));

	var close = shareWindow.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Close share window"));
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeShareWindow.bind(this));
};

DrawTogether.prototype.createModeSelector = function createModeSelector () {
	var selectWindow = this.container.appendChild(document.createElement("div"));
	selectWindow.className = "drawtogether-selectwindow";
	this.selectWindow = selectWindow;

	var text = selectWindow.appendChild(document.createElement("h1"));
	text.appendChild(document.createTextNode("Draw with friends or strangers!"));
	text.className = "drawtogether-welcome-text";

	// var text = selectWindow.appendChild(document.createElement("h1"));
	// text.innerText = "There is some heavier than usual load, so the server might lagg a bit.";
	// text.textContent = "There is some heavier than usual load, so the server might lagg a bit.";
	// text.className = "drawtogether-welcome-text-error";

	var text = selectWindow.appendChild(document.createElement("div"));
	text.appendChild(document.createTextNode("Realtime in private or public chat rooms with an unlimited canvas. Choose with whom you want to draw:"));
	text.className = "drawtogether-welcome-text-box";

	//var text = selectWindow.appendChild(document.createElement("div"));
	//text.appendChild(document.createTextNode("New feature (march 2016): zoom tool, tiles now also fade in! And we got a new chat layout."));
	//text.className = "drawtogether-notification-text-box";

	var buttonContainer = selectWindow.appendChild(document.createElement("div"));
	buttonContainer.className = "drawtogether-buttoncontainer";

	var publicButton = buttonContainer.appendChild(document.createElement("div"));
	publicButton.className = "drawtogether-modeselect-button";
	publicButton.innerHTML = '<img src="images/multi.png"/><br/>Draw with everyone';
	publicButton.addEventListener("click", function () {
		this.changeRoom("main");
		ga("send", "event", "modeselector", "strangers");
		this.selectWindow.style.display = "";
		goog_report_join();
	}.bind(this));

	var privateButton = buttonContainer.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/invite.png"/><br/>Alone or with friends';
	privateButton.addEventListener("click", function () {
		this.settings.room = "private_" + Math.random().toString(36).substr(2, 5); // Random 5 letter room
		this.changeRoom(this.settings.room, undefined, 0, 0, true);
		ga("send", "event", "modeselector", "private");
		this.selectWindow.style.display = "";
		goog_report_join();
	}.bind(this));

	/*var privateButton = buttonContainer.appendChild(document.createElement("div"));
	privateButton.className = "drawtogether-modeselect-button";
	privateButton.innerHTML = '<img src="images/member.png"/><br/>Members only room';
	privateButton.addEventListener("click", function () {
		this.changeRoom("member_main");
		ga("send", "event", "modeselector", "member");
		this.selectWindow.style.display = "";
		goog_report_join();
	}.bind(this));*/

	var gameButton = buttonContainer.appendChild(document.createElement("div"));
	gameButton.className = "drawtogether-modeselect-button";
	gameButton.innerHTML = '<img src="images/game.png"/><br/>Play guess word (NEW!)';
	gameButton.addEventListener("click", function () {
		this.gui.prompt("With whom would you like to play?", ["Join strangers", "Create private room", "Cancel"], function (whom) {
			if (whom == "Cancel") this.openModeSelector();
			else if (whom == "Join strangers") this.joinGame();
			else if (whom == "Create private room") this.createPrivateGame();
		}.bind(this));
		ga("send", "event", "modeselector", "game");
		this.selectWindow.style.display = "";
		goog_report_join();
	}.bind(this));

	selectWindow.appendChild(this.createFAQDom());

	this.redditDrawings = selectWindow.appendChild(document.createElement("div"));
	this.redditDrawings.className = "drawtogether-redditdrawings";
	this.populateRedditDrawings();

	var contactInfo = selectWindow.appendChild(document.createElement("div"));
	contactInfo.appendChild(document.createTextNode("Feedback/contact: info@anondraw.com"));
	contactInfo.classList.add("contactinfo");
};

DrawTogether.prototype.populateRedditDrawings = function populateRedditDrawings () {
	var req = new XMLHttpRequest();
	req.addEventListener("readystatechange", function (event) {
		if (req.readyState == 4 && req.status == 200) {
			var posts = JSON.parse(req.responseText).data.children;
			
			var title = this.redditDrawings.appendChild(document.createElement("a"));
			title.appendChild(document.createTextNode("Reddit gallery (/r/anondraw)"))
			title.href = "http://www.reddit.com/r/anondraw";
			title.className = "drawtogether-redditdrawings-title";

			//this.redditDrawings.appendChild(this.createThumbLink("http://nyrrti.tumblr.com/", "Nyrrtis tumblr", "http://40.media.tumblr.com/fafb08a2535fa9e32cd54d5add9321d0/tumblr_o3w1sm1NYg1tyibijo1_1280.png"));
			//this.redditDrawings.appendChild(this.createThumbLink("http://dojaboys.tumblr.com/", "Dojaboys (alien) tumblr", "http://40.media.tumblr.com/222bcca3dcd8d86ba27d02a9e8cba560/tumblr_o3zfyfHJfj1u8vwn5o1_1280.png"));
			var div = document.createElement("div");
			div.innerHTML = '<iframe width="560" height="315" src="https://www.youtube.com/embed/VOxqb3_0IpE?start=261" frameborder="0" allowfullscreen></iframe>';
			this.redditDrawings.appendChild(div);

			for (var k = 0; k < posts.length; k++) {
				//if (posts[k].data.thumbnail == "self" || posts[k].data.thumbnail == "default" || posts[k].data.thumbnail == "nsfw") continue;
				this.redditDrawings.appendChild(this.createRedditPost(posts[k].data));
			}
		}
	}.bind(this));
	req.open("GET", "https://www.reddit.com/r/anondraw/.json");
	req.send();
};

DrawTogether.prototype.createThumbLink = function createThumbLink (url, text, imageurl) {
	var container = document.createElement("a");
	container.href = url;
	container.target = "_blank";
	container.className = "drawtogether-redditpost";

	var title = container.appendChild(document.createElement("span"));
	title.className = "drawtogether-redditpost-title";
	title.appendChild(document.createTextNode(text));

	var thumb = container.appendChild(document.createElement("img"))
	thumb.className = "drawtogether-redditpost-thumb";
	thumb.src = imageurl;

	return container;
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
		if (data.thumbnail == "nsfw") {
			var thumb = container.appendChild(document.createElement("img"))
			thumb.className = "drawtogether-redditpost-thumb";
			thumb.src = data.url;
		} else {
			var filler = container.appendChild(document.createElement("div"));
			filler.className = "drawtogether-redditpost-thumbfiller";
		}
	}

	return container;
};

DrawTogether.prototype.openDiscordWindow = function openDiscordWindow () {
	var discordWindow = this.gui.createWindow({ title: "Voice chat: Discord"});

	var container = discordWindow.appendChild(document.createElement("div"));
	container.innerHTML = '<iframe src="https://discordapp.com/widget?id=187008981837938689&theme=dark" width="350" height="500" allowtransparency="true" frameborder="0"></iframe>';	
};

DrawTogether.prototype.openPremiumBuyWindow = function openPremiumBuyWindow () {
	var premiumBuyWindow = this.gui.createWindow({ title: "Premium" });

	var container = premiumBuyWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Getting premium."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Anondraw runs on very expensive unicorn juice, for that we need your help!"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Going premium costs 20 euro which will forever grant you extra features. It will also help us build new and better tools."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Current features:"));

	var ol = container.appendChild(document.createElement("ol"));

	var features = ["Support icon", "Rainbow colored name", "20 reputation", "Server hosting", "Future development"];
	for (var k = 0; k < features.length; k++) {
		var li = ol.appendChild(document.createElement("li"));
		li.appendChild(document.createTextNode(features[k]));
	}

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Have any premium feature ideas? Let us know!"));

	var p = container.appendChild(document.createElement("p"));
	if (!this.account.uKey) {
		html = "You should first login!";
	} else if (this.memberlevel == 1) {
		html = "Thank you for supporting us!";
	} else {
		var html = 'You are paying for the account: ' + this.account.mail + ' <br/><br/>';

		    html += 'This takes up to 1 day to confirm. If it takes longer contact premium@squarific.com <br/><br/>';
		 
		html += '<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">';
	    	html +=	'<input type="hidden" name="cmd" value="_s-xclick">';
	    	html += '<input type="hidden" name="hosted_button_id" value="RU7EGGG6RH4AG">';
	    	html += '<table style="display:none;">';
		    	html += '<tr><td><input type="hidden" name="on0" value="Account/Email">Account/Email</td></tr><tr><td><input type="text" value="' + this.account.mail + '" name="os0" maxlength="200"></td></tr>';
	    	html += '</table>';
	    	html += '<input type="image" style="margin-top:0.5em;" src="https://www.paypalobjects.com/en_US/BE/i/btn/btn_buynowCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">';
	    	html += '<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">';
	    html += '</form>';

	    html += '<br/>';
	    html += '<a class="coinbase-button" data-code="8be6985bf22cfd01ca0877cb6fb97249" data-button-style="custom_small" href="https://www.coinbase.com/checkouts/8be6985bf22cfd01ca0877cb6fb97249">Pay With Bitcoin</a>';

	    html += '<br/>';
	    html += 'Or via bank transfer: IBAN: BE59 0014 7710 8926<br/>';
	    html += 'Be sure to include your username/email!<br/>';
	    html += 'This might take a few days to clear, if you mail to premium@anondraw.com we will clear you faster.';
	}

	p.innerHTML = html;

	// Coinbase code
	(function(){var getHost,loadCookie,loadJQuery,main;loadJQuery=function(version,callback){var compatible,d,j,jMajor,jMinor,loaded,ref,script,vMajor,vMinor;ref=[null,null,false],j=ref[0],d=ref[1],loaded=ref[2];if(j=window.jQuery){vMajor=parseInt(version.split('.')[0])||0;vMinor=parseInt(version.split('.')[1])||0;jMajor=parseInt(j.fn.jquery.split('.')[0])||0;jMinor=parseInt(j.fn.jquery.split('.')[1])||0;compatible=(jMajor>vMajor)||(jMajor===vMajor&&jMinor>=vMinor);}
	if(!j||!compatible){script=document.createElement("script");script.type="text/javascript";script.src="https://code.jquery.com/jquery-1.8.3.min.js";script.onload=script.onreadystatechange=function(){if(!loaded&&(!(d=this.readyState)||d==="loaded"||d==="complete")){callback((j=window.jQuery).noConflict(1));return j(script).remove();}};return(document.getElementsByTagName("head")[0]||document.documentElement).appendChild(script);}else{return callback(j);}};getHost=function(env){if(env==='development'||env==='test'){return document.location.protocol+"//"+ document.location.host;}else if(env==='sandbox'){return"https://sandbox.coinbase.com";}else{return"https://www.coinbase.com";}};loadCookie=function($,callback){var host,script;if(window.coinbaseCookieLoaded){return callback($);}else if(window.coinbaseCookieLoading){return setTimeout((function(){return loadCookie($,callback);}),200);}else{host=getHost($('body').data('env'));window.coinbaseCookieLoading=true;script=document.createElement("script");script.src=host+"/checkouts/get_cookie.js";script.onload=script.onreadystatechange=function(){window.coinbaseCookieLoaded=true;window.coinbaseCookieLoading=false;$(script).remove();return callback($);};return(document.getElementsByTagName("head")[0]||document.documentElement).appendChild(script);}};main=function($){var buttonFrameLoaded,checkoutsFrameLoaded,default_height,default_width,host,receive_message;buttonFrameLoaded=false;checkoutsFrameLoaded=false;host=getHost($('body').data('env'));receive_message=function(e){var buttonId,command,ref;ref=e.data.split('|'),command=ref[0],buttonId=ref[1];buttonId=escape(buttonId);if(e.origin!==host){return;}
	if(command==="show modal iframe"){return $('#coinbase_modal_iframe_'+ buttonId).show();}else if(command==="coinbase_payment_complete"){$('#coinbase_button_iframe_'+ buttonId).attr('src',host+"/buttons/paid");return $(document).trigger('coinbase_payment_complete',buttonId);}else if(command==="coinbase_payment_mispaid"){return $(document).trigger('coinbase_payment_mispaid',buttonId);}else if(command==='coinbase_payment_expired'){return $(document).trigger('coinbase_payment_expired',buttonId);}else if(command==="hide modal"){$('#coinbase_modal_iframe_'+ buttonId).hide();return $(document).trigger('coinbase_modal_closed',buttonId);}else if(command==="signup redirect"){return document.location=host+"/users/verify";}else if(command==="button frame loaded"){buttonFrameLoaded=true;if(checkoutsFrameLoaded){return $(document).trigger('coinbase_button_loaded',buttonId);}}else if(command==="checkouts frame loaded"){checkoutsFrameLoaded=true;if(buttonFrameLoaded){return $(document).trigger('coinbase_button_loaded',buttonId);}}};default_width=function(button_style){switch(button_style){case'custom_large':return 276;case'custom_small':return 210;case'subscription_large':return 263;case'subscription_small':return 210;case'donation_large':return 189;case'donation_small':return 148;case'buy_now_large':return 211;case'buy_now_small':return 170;default:return 211;}};default_height=function(button_style){switch(button_style){case'custom_large':return 62;case'custom_small':return 48;default:return 46;}};window.addEventListener("message",receive_message,false);$('.coinbase-button').each((function(_this){return function(index,elem){var button,buttonFrame,buttonId,data,height,modalFrame,params,width;button=$(elem);data=button.data();data['referrer']=document.domain;params=$.param(data);buttonId=button.data('code');width=button.data('width')||default_width(button.data('button-style'));height=button.data('height')||default_height(button.data('button-style'));host=getHost(button.data('env'));buttonFrame="<iframe src='"+ host+"/buttons/"+ buttonId+"?"+ params+"' id='coinbase_button_iframe_"+ buttonId+"' name='coinbase_button_iframe_"+ buttonId+"' style='width: "+ width+"px; height: "+ height+"px; border: none; overflow: hidden;' scrolling='no' allowtransparency='true' frameborder='0'></iframe>";modalFrame="<iframe src='"+ host+"/checkouts/"+ buttonId+"/widget?"+ params+"' id='coinbase_modal_iframe_"+ buttonId+"' name='coinbase_modal_iframe_"+ buttonId+"' style='background-color: transparent; border: 0px none transparent; display: none; position: fixed; visibility: visible; margin: 0px; padding: 0px; left: 0px; top: 0px; width: 100%; height: 100%; z-index: 9999;' scrolling='no' allowtransparency='true' frameborder='0'></iframe>";if(button.data('button-style')==='none'){buttonFrameLoaded=true;}else{button.replaceWith(buttonFrame);}
	return $('body').append(modalFrame);};})(this));return $(document).on('coinbase_show_modal',function(e,buttonId){if($("#coinbase_modal_iframe_"+ buttonId).length>0){$("#coinbase_modal_iframe_"+ buttonId).show();return frames["coinbase_modal_iframe_"+ buttonId].postMessage("show modal|"+ buttonId,host);}});};loadJQuery("1.7",function($){return loadCookie($,main);});}).call(this);
};

DrawTogether.prototype.openWelcomeWindow = function openWelcomeWindow () {
	var welcomeWindow = this.gui.createWindow({ title: "Welcome!", onclose: function () {
		this.userSettings.setBoolean("Show welcome", false, true);
	}.bind(this)});
	welcomeWindow.classList.add("welcome-window");

	var container = welcomeWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Hey you seem to be new!"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode(
		"Anondraw is a website where artists of all skill levels come together to draw. " +
		"All drawings are allowed so that means this website might contain NSFW (18+) images. " +
		"If you do not feel comfortable with that, you should not join the public rooms."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("License: You give us the non-exclusive, transferable right to display and modify all the content you create using this website. In the public rooms, aka the rooms that do not start with private_ you also give everyone the Creative Commons share alike license for non commercial use."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Lastly we like to create, not destroy. Griefing will result in a ban of up to 10 years."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Regards,"));
	p.appendChild(document.createElement("br"));
	p.appendChild(document.createTextNode("Anondraw Team"));

	var tutorial = container.appendChild(document.createElement("div"));
	tutorial.appendChild(document.createTextNode("Tutorial"))
	tutorial.className = "drawtogether-button";
	tutorial.addEventListener("click", function () {
		if (welcomeWindow.parentNode) 
			welcomeWindow.parentNode.removeChild(welcomeWindow);

		introJs()
		.setOptions({ 'tooltipPosition': 'auto', 'showProgress': true })
		.onchange(function () {
			ga("send", "event", "tutorial", "next");
		})
		.onexit(function () {
			ga("send", "event", "tutorial", "exit");
			this.openWelcomeWindow();
		}.bind(this))
		.oncomplete(function () {
			ga("send", "event", "tutorial", "complete");
			this.openWelcomeWindow();
		}.bind(this))
		.start();
	}.bind(this));

	var close = container.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Close welcome window"))
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", function () {
		if (welcomeWindow.parentNode)
			welcomeWindow.parentNode.removeChild(welcomeWindow);

		this.userSettings.setBoolean("Show welcome", false, true);
	}.bind(this));
};

DrawTogether.prototype.openFeedbackWindow = function openFeedbackWindow () {
	var feedbackWindow = this.gui.createWindow({title: "Feedback"});
	feedbackWindow.classList.add("feedback-window");

	var container = welcomeWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Feedback"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Hey we would like to ask you a question!"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("What feature would you want before you'd consider becoming a premium user?"));

	var form = container.appendChild(document.createElement("form"));
	var textarea = form.appendChild(document.createElement("textarea"));

	var send = container.appendChild(document.createElement("div"));
	send.appendChild(document.createTextNode("Send"))
	send.className = "drawtogether-button";
	send.addEventListener("click", function () {
		this.account.feedback(textarea);
	}.bind(this));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Regards,"));
	p.appendChild(document.createElement("br"));
	p.appendChild(document.createTextNode("Anondraw Team"));
};

DrawTogether.prototype.openNewFeatureWindow = function openNewFeatureWindow () {
	localStorage.setItem("newfeaturewindowversion", this.CLIENT_VERSION);
	var featureWindow = this.gui.createWindow({ title: "New features!"});

	featureWindow.classList.add("feature-window");

	var container = featureWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("We just had an update!"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Current new features:"));

	var ol = container.appendChild(document.createElement("ol"));

	var features = ["Export in high quality"];
	for (var k = 0; k < features.length; k++) {
		var li = ol.appendChild(document.createElement("li"));
		li.appendChild(document.createTextNode(features[k]));
	}

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Regards,"));
	p.appendChild(document.createElement("br"));
	p.appendChild(document.createTextNode("Anondraw Team"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Ps. want more features?"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Getting premium helps us pay for development time and the server hosting."));

	var premiumButton = container.appendChild(document.createElement("div"));
	premiumButton.appendChild(document.createTextNode("Get premium!"));
	premiumButton.className = "drawtogether-button";
	premiumButton.addEventListener("click", function () {
		if (featureWindow.parentNode)
			featureWindow.parentNode.removeChild(featureWindow);

		this.openPremiumBuyWindow();
	}.bind(this));
};

DrawTogether.prototype.createFAQDom = function createFAQDom () {
	var faq = document.createElement("div");
	faq.className = "drawtogether-faq";

	var questions = [{
		question: "What is anondraw?",
		answer: "It's a website where you can draw or doodle in group with friends or strangers. Join one of the rooms and start drawing and collaborating with the group. The interactive drawing works on the iPad and other android tablets. You can also doodle on phones."
	}, {
		question: "How do I chat?",
		answer: "There is a chat to the right or if you are on mobile you can click on the chat button."
	}, {
		question: "How big is the canvas?",
		answer: "The interactive canvas has an infinite size. You could move as far away from the center as you'd like."
	}, {
		question: "I want to draw privately with some people, is that possible?",
		answer: "Yes, in the home screen click on draw with friends and then share the invite url printed in the chat. If you are already in a room, simply click on the room button and then click create private room after giving it a name."
	}, /* {
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
		answer: "At " + this.ZOOMED_OUT_MIN_REP + " reputation, you are allowed to draw while zoomed out. \n" +
		        "At " + this.BIG_BRUSH_MIN_REP + " reputation, you are allowed to use brush sizes bigger than 10. \n" +
		        "At 15 reputation, you can join the member only rooms and share an ip with other users without affecting your ink. \n" +
		        "At 20 reputation, you can give upvotes to other people who have less reputation than you. \n" +
		        "At " + this.KICKBAN_MIN_REP + "+ reputation, you can kickban people for a certain amount of time when they misbehave. \n "
	}, {
		question: "How do I get reputation?",
		answer: "Other people have to give you an upvote, every upvote is one reputation."
	}, {
		question: "Am I allowed to destroy doodles or drawings?",
		answer: "The goal is to let people draw together. You should never be afraid to help or change a drawing. However griefing on purpose is not allowed."
	}, {
		question: "I want to draw in group but I don't want people to destroy my drawing/doodle.",
		answer: "Move away from the center where there are less people then get some reputation from your drawings and use the member rooms."
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
		action: this.openModeSelector.bind(this),
		data: {
			intro: "Use this to return to the FAQ and mode selection."
		}
	}, {
		name: "toggle-view",
		type: "button",
		value: "",
		text: "Auto Camera",
		title: "Toggle the camera to follow where people are drawing.",
		action: this.toggleFollow.bind(this),
		data: {
			intro: "This button toggles auto view, in auto view mode the camera will switch between everyone who is drawing."
		}
	}, {
		name: "name",
		type: "text",
		text: "Username",
		value: localStorage.getItem("drawtogether-name") || "",
		title: "Change your name",
		action: this.changeNameDelayed.bind(this),
		data: {
			intro: "This is your current guest name. Change this to something you like!"
		}
	}, {
		name: "room-button",
		type: "button",
		text: "Room",
		action: this.openRoomWindow.bind(this),
		data: {
			intro: "Click here if you want to change the room."
		}
	}, {
		name: "share-button",
		type: "button",
		text: "Share",
		action: this.openShareWindow.bind(this),
		data: {
			intro: "Made something nice? Use this to upload to imgur. Then you can share the imgur link to reddit if you want. Sharing it to reddit will also put it on the frontpage."
		}
	}, {
		name: "settings",
		type: "button",
		text: "Settings",
		action: this.openSettingsWindow.bind(this),
		data: {
			intro: "In this window you can mute the chat, hide tips and open the advanced settings window where you can rotate and mirror the canvas."
		}
	}];

	if (location.toString().indexOf("kongregate") == -1) {
		buttonList.push({
			name: "account",
			type: "button",
			text: "Account",
			action: this.openAccountWindow.bind(this),
			data: {
				intro: "Creating an account gives you the option to earn reputation. Reputation gives certain benefits like bigger brushes, drawing while zoomed out, member room access, banning, ..."
			}
		});
	}

	buttonList.push({
		name: "discord",
		type: "button",
		text: "Voice chat",
		action: this.openDiscordWindow.bind(this),
		data: {
			intro: "We also have a voice chat using discord!"
		}
	});

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