function DrawTogether (container, settings, emotesHash, account, router, pms) {
	// Normalize settings, set container
	this.container = container;
	this.router = router;
	this.pms = pms;
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);

	this.userSettings = QuickSettings.create(0, 0, "settings");
	this.userSettings.setDraggable(false);
	this.userSettings.setCollapsible(false);
	
	this.videoExportSettings = QuickSettings.create(50, 50, "Video export settings");
	this.videoExportSettings.hide();

	// Set default values untill we receive them from the server
	this.playerList = [];
	this.moveQueue = [];
	this.favList = [];
	this.myRegions = [];
	this.clickableAreas = []; // [{ id, owner: id, url: "url or x,y", x: INT, y: INT, width: INT, height: INT, room: STRING, element: <HTML Element> }]
	this.myAnimations = this.getAnimationsFromCookie();
	this.ink = 0;
	this.nextTip = 0;
	this.previousInk = Infinity;

	this.MAX_REP_TO_DISPLAY = 300; // if a pregion's minRepAllowed is higher than this. don't mention it to user.

	this.lastInkWarning = 0;        // Last time we showed that we are out of ink
	this.lastBrushSizeWarning = 0;  // Last time we showed the warning that our brush is too big
	this.lastZoomWarning = 0;       // Last time we showed the zoom warning
	this.lastViewDeduction = 0;     // Time since we last deducted someones viewscore
	this.lastTimeoutError = 0;      // Last time since a socket timed out

	this.insideProtectedRegionWarningTimeout = null; // a setTimeout for the chat message warning

	this.lastScreenMove = Date.now();    // Last time we moved the screen
	this.lastScreenMoveStartPosition;    // Last start position

	this._forceFollow;      // The playerid that should be followed
	this._autoMoveScreen;   // Boolean, should we move the screen automatically?
	this._followingPlayer;  // The player the view is currently following
	
	this.favoritesContainer = null;
	this.regionsContainer = null;

	this.network = new Network(this.settings.loadbalancer);
	this.account = account || new Account(this.settings.accountServer);
	this.bindSocketHandlers();
	this.emotesHash = emotesHash;

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
	
	window.addEventListener("popstate", this.gotoHash.bind(this));

	setInterval(this.displayTip.bind(this), 5 * 60 * 1000);
	setTimeout(this.autoMoveScreen.bind(this), 0);
	
	
	setInterval(function () {
		if (!this.memberlevel) {
			// Fix for the ad that sometimes appears randomly
			var prevAd = document.getElementById("amzn-assoc-ad-123acff2-6857-4569-a250-fd703f6a941d");
			prevAd.parentNode.removeChild()
			
			// Amazon ad code
			var div = document.createElement("div");
			var ad = div.appendChild(document.createElement("div"));
			ad.id = "amzn-assoc-ad-123acff2-6857-4569-a250-fd703f6a941d";
			
			var script = div.appendChild(document.createElement("script"));
			script.src = "//z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US&adInstanceId=123acff2-6857-4569-a250-fd703f6a941d";
			this.chat.addElementAsMessage(div);
			
			// Fix for adding multiple ads with the same id
			setTimeout(function () {
				ad.id = "";
			}, 1000);
		}
	}.bind(this), 10 * 60 * 1000);
}

// Hardcoded values who should probably be refactored to the server
DrawTogether.prototype.KICKBAN_MIN_REP = 50;
DrawTogether.prototype.REGION_MIN_REP = 30;
DrawTogether.prototype.MODERATE_REGION_MIN_REP = 100;
DrawTogether.prototype.IGNORE_INK_REP = 50;

// After how much time should we remind moderators of their duty?
DrawTogether.prototype.MODERATORWELCOMEWINDOWOPENAFTER = 2 * 7 * 24 * 60 * 60 * 1000;
DrawTogether.prototype.SCUTTLERS_MESSAGE_EVERY = 6 * 24 * 60 * 60 * 1000;
DrawTogether.prototype.SUPPORT_MESSAGE_EVERY = 5 * 24 * 60 * 60 * 1000;
DrawTogether.prototype.PREMIUM_WINDOW_EVERY = 2 * 7 * 24 * 60 * 60 * 1000;

// Currently only client side enforced
DrawTogether.prototype.BIG_BRUSH_MIN_REP = 5;
DrawTogether.prototype.ZOOMED_OUT_MIN_REP = 2;
DrawTogether.prototype.CLIENT_VERSION = 14;

// How many miliseconds does the server have to confirm our drawing
DrawTogether.prototype.SOCKET_TIMEOUT = 10 * 1000;

DrawTogether.prototype.TIME_BETWEEN_TIMEOUT_WARNINGS = 5 * 1000;

DrawTogether.prototype.defaultSettings = {
	mode: "ask",                           // Mode: public, private, oneonone, join, game, main, ask, defaults to public
	room: "main",                          // Room to join at startup
	leftTopX: 0,
	leftTopY: 0,
	loadbalancer: "https://direct.anondraw.com:3552",
	accountServer: "https://direct.anondraw.com:4552",
	imageServer: "https://direct.anondraw.com:5552"
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
	}, {
		title: "Direct teleporting",
		type: "boolean",
		value: false
	}];

DrawTogether.prototype.defaultVideoExportSettings = [{
		title: "framerate",
		type: "range",
		min: 1,
		max: 144,
		step: 1,
		value: 10
	}, {
		title: "format",
		type: "dropdown",
		items: ["gif", "webm"],
		value: 0
	}, {
		title: "quality",
		type: "range",
		min: 0,
		max: 100,
		step: 1,
		value: 100
	}, {
		title: "motionBlurFrames",
		type: "range",
		min: 1,
		max: 10,
		step: 1,
		value: 1
	}, {
		title: "verbose",
		type: "boolean"
	}, {
		title: "display",
		type: "boolean"
	}, {
		title: "timeLimit",
		type: "range",
		min: 10,
		max: 3600,
		step: 10,
		value: 600
	}, {
		title: "autoSaveTime",
		type: "range",
		min: 30,
		max: 1800,
		step: 10,
		value: 600
	}, {
		title: "startTime",
		type: "range",
		min: 0,
		max: 3600,
		step: 1,
		value: 0
}];

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

DrawTogether.prototype.paintMoved = function paintMoved (event) {
	this.updateClickableAreas(event);
};

DrawTogether.prototype.setupClickableAreas = function () {
	while (this.clickableAreasContainer.firstChild)
		this.clickableAreasContainer.removeChild(this.clickableAreasContainer.firstChild);
	
	for (var k = 0; k < this.clickableAreas.length; k++) {
		this.clickableAreas[k].element = document.createElement("div")
		this.clickableAreasContainer.appendChild(this.clickableAreas[k].element);
		this.clickableAreas[k].element.className = "clickableArea";
		this.clickableAreas[k].element.addEventListener("click", this.clickClickableArea.bind(this, k));
	}
	
	this.updateClickableAreas();
};

DrawTogether.prototype.updateClickableAreas = function updateClickableAreas () {
	for (var k = 0; k < this.clickableAreas.length; k++) {
		this.clickableAreas[k].element.style.left = (this.clickableAreas[k].x - this.paint.public.leftTopX) * this.paint.public.zoom + "px";
		this.clickableAreas[k].element.style.top = (this.clickableAreas[k].y - this.paint.public.leftTopY) * this.paint.public.zoom + "px";
		this.clickableAreas[k].element.style.width = this.clickableAreas[k].width * this.paint.public.zoom + "px";
		this.clickableAreas[k].element.style.height = this.clickableAreas[k].height * this.paint.public.zoom + "px";
	}
};

DrawTogether.prototype.clickClickableArea = function clickClickableArea (index, event) {
	var coords = this.clickableAreas[index].url.split(",");

	if(event.shiftKey){ // Delete
		var myUserId = this.account.id;
		var ownerId = this.clickableAreas[index].owner;
		if(myUserId == ownerId){
			this.gui.prompt("You are about to delete your button. Are you sure you want to do that?", ["Yes", "No"], function (answer) {
				if (answer == "Yes") this.deleteClickableArea(index);
			}.bind(this));
		}
		else{
			this.chat.addMessage("You can only delete buttons you own");
		}
		return;
	}

	if (coords.length == 2 && parseInt(coords[0]) == parseInt(coords[0]) && parseInt(coords[1]) == parseInt(coords[1])) {
		this.handleGotoAndCenter(parseInt(coords[0]), parseInt(coords[1]));
	} else {
		this.gui.prompt("You are about to go to " + this.clickableAreas[index].url + ". Are you sure you want to do that?", ["Yeah I'm brave", "Nah that sounds dangerous"], function (answer) {
			if (answer == "Yeah I'm brave") window.open(this.clickableAreas[index].url);
		}.bind(this));
	}
};

DrawTogether.prototype.deleteClickableArea = function deleteClickableArea (index) {
	this.network.socket.emit("deleteclickablearea", index, function (err) {
	  if (err) {
	    this.gui.prompt(err, ["Ok"]);
	  }
	}.bind(this));
};

DrawTogether.prototype.handleGoto = function handleGoto (x, y) {
	this.paint.goto(x, y);
};

DrawTogether.prototype.handleGotoAndCenter = function handleGotoAndCenter (x, y) {
	var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
	                  this.paint.public.canvas.height / this.paint.public.zoom];

	var targetPosEnd = [x - screenSize[0] / 2,
	                    y - screenSize[1] / 2];
	this.handleGoto(targetPosEnd[0], targetPosEnd[1]);
};

DrawTogether.prototype.gotoHash = function gotoHash () {
	var urlInfo = location.hash.substr(1, location.hash.length).split(",");

	var room = urlInfo[0];
	var x = parseInt(urlInfo[1]);
	var y = parseInt(urlInfo[2]);
	
	var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
	                  this.paint.public.canvas.height / this.paint.public.zoom];
	
	if (room !== this.current_room) {
		this.changeRoom(room, undefined, x, y, true);
	} else if ((this.paint.public.leftTopX + screenSize[0] / 2).toFixed() !== x.toFixed() ||
	           (this.paint.public.leftTopY + screenSize[1] / 2).toFixed() !== y.toFixed()) {
		this.handleGotoAndCenter(x, y);
	}
};

DrawTogether.prototype.handleMoveQueue = function handleMoveQueue () {
	if (this.moveQueue.length > 0) {
		if (Date.now() - this.lastScreenMove >= this.moveQueue[0].duration) {
			this.lastScreenMove = Date.now();
			this.lastScreenMoveStartPosition = this.moveQueue[0].position;
			
			this.handleGoto(this.moveQueue[0].position[0], this.moveQueue[0].position[1]);
			this.moveQueue.shift();
			return;
		}

		var delta = Date.now() - this.lastScreenMove;
		var relativeDistance = delta / this.moveQueue[0].duration;
		var distances = [relativeDistance * (this.moveQueue[0].position[0] - this.lastScreenMoveStartPosition[0]),
		                 relativeDistance * (this.moveQueue[0].position[1] - this.lastScreenMoveStartPosition[1])];

		this.handleGoto(distances[0] + this.lastScreenMoveStartPosition[0],
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
			if (this.playerList[k].id == this._followingPlayer) {
				this.playerList[k].viewScore -= viewDeductionDelta;
				break;
			}
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
	if (this.userSettings.getBoolean("Direct teleporting")) {
		this.handleGotoAndCenter(player.lastPosition.pos[0], player.lastPosition.pos[1]);
		return;
	}
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
			self.changeRoom(room, undefined, self.paint.public.leftTopX || 0, self.paint.public.leftTopY || 0, true);
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
			paths[id].color = tinycolor(paths[id].color);
			self.paint.addPath(id, paths[id]);
		}
	});
	
	this.network.on("clickableareas", function (areas) {
		self.clickableAreas = areas;
		self.setupClickableAreas();
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
		if(localStorage.getItem("ban") && !data.extraPayload) { // we have a record of ban but server doesnt
			var banInfo = JSON.parse(localStorage.getItem("ban"));
			self.network.socket.emit("isMyOldIpBanned", banInfo.arg2);
		}
		if(data.extraPayload){
			localStorage.setItem(data.extraPayload.type, JSON.stringify(data.extraPayload));
		}
		self.chat.addMessage(data.user, data.message, data.userid, data.id);
	});
	
	this.network.on("chatanimation", function (data) {
		var data = data || {};
		self.chat.addAnimationMessage(data.animation, data.user, self);
	});

	this.network.on("emote", function (data) {
		var data = data || {};
		self.chat.addMessage(data.user + " " + data.message);
	});

	this.network.on("setmemberlevel", function (level) {
		self.memberlevel = level;
		console.log("We have memberlevel ", level);
		localStorage.setItem("wasPremium", true);

		if (self.memberlevel > 0 && !localStorage.getItem("buyreported")) {
			goog_report_buy();
			ga("send", "event", "conversion", "buypremium");
			localStorage.setItem("buyreported", true);
		}
	});

	this.network.on("setreputation", function (rep) {
		self.reputation = rep;
		console.log("Our reputation is ", rep);

		var lastOpen = localStorage.getItem('moderatorwelcomewindowlastopen');
		if (lastOpen) {
			lastOpen = parseInt(lastOpen);
			var remindTime = lastOpen + self.MODERATORWELCOMEWINDOWOPENAFTER;
			if (remindTime < Date.now()) {
				self.openModeratorWelcomeWindow();
			}
		} else {
			self.openModeratorWelcomeWindow();
		}

		var moderatorGuidelines = document.createElement("div");
		moderatorGuidelines.appendChild(document.createTextNode("Click here for the rules."));
		moderatorGuidelines.addEventListener("click", self.openModeratorWelcomeWindow.bind(self));
		moderatorGuidelines.style.cursor = "pointer";
		self.chat.addElementAsMessage(moderatorGuidelines);
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

	var textNode = document.createTextNode(message);
	if (this.messageDom.childNodes.length > 0) {
		this.messageDom.replaceChild(textNode, this.messageDom.childNodes[0]);
	} else {
		this.messageDom.appendChild(textNode);
	}

	clearTimeout(this.removeMessageTimeout);

	// Remove the message after the given time
	this.removeMessageTimeout = setTimeout(function () {
		this.messageDom.style.display = "";
	}.bind(this), time || Math.max(Math.ceil(message.length / 10) * 1000, 3000));
};

DrawTogether.prototype.displayTip = function displayTip () {
	if (!this.userSettings.getBoolean("Show tips")) return;

	/*var tips = [
		"Did you know you can use shortcuts? Press C to toggle the color selection!",
		"Tip: use B to switch to the brush tool. (Others: [l]ine, [c]olor, [p]icker, [g]rab, ...)",
		"Tip: You get ink faster if you register an account and get reputation!",
		"Did you know? Private rooms always start with private_",
		"Did you know? There is a member only room where only people with enough reputation can draw.",
		"Tip: If you type Nyan with a capital, a cat will appear.",
		"Tip: If you write Kappa with a capital you will get the twitch emote.",
		"Tip: There are a few commands, try typing /me or /help",
		"Need more ink? Try creating an account.",
		"Tip: Use transparency to get nicer effects.",
		"The ▲ next to peoples name is the upvote button.",
		"Did you know you can ban people once you have 50+ rep?",
		"Got feedback? There is a button at the left where you can leave it!",
		"Try some shortcuts: C, L, B, P, G",
		"If you click on someones name you will jump to their last draw position!",
		"Pressing the eye next to someones name will make your screen follow the player."
	];*/
	
	var tips = [
		"We organize a contest, check it out in the left menu.",
		"Hold alt for color picking",
		"Try some shortcuts: C, L, B, P, G",
		"Need more ink? Create an account.",
		"If you type nyan with a capital, a cat will appear.",
		"There are a few commands, try typing /me or /help",
		"If you write kappa with a capital you will get the twitch emote.",
		"Use transparency to get nicer effects.",
		"The ▲ next to peoples name is the upvote button.",
		"Did you know you can ban people once you have 50+ rep?",
		"Got feedback? There is a button at the left where you can leave it!",
		"If you click on someones name you will jump to their last draw position!",
		"Pressing the eye next to someones name will make your screen follow the player."
	];

	this.chat.addMessage(tips[this.nextTip++ % tips.length]);
};

// Get the current spawn point for a given room
DrawTogether.prototype.getSpawn = function getSpawn (room) {
	if (room.indexOf("main") !== 0) return [0, 0];
	
	var base = [311111, 338360];
	var baseTime = 1508155169891;
	var weeks = Math.floor((Date.now() - baseTime) / (2 * 7 * 24 * 60 * 60 * 1000));
	var width = 3840;
	
	return [base[0] + weeks * width, base[1]];
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
	this.network.loadRoom(room + number, specific, override, function (err, drawings, clickableAreas) {
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
			var spawn = this.getSpawn(room + number);
			this.handleGotoAndCenter(x || spawn[0], y || spawn[1]);
			this.paint.changeTool("grab");
			this.paint.addPublicDrawings(this.decodeDrawings(drawings));
			this.chat.addMessage("Invite people", "https://www.anondraw.com/#" + room + number);
			
			
			setTimeout(function () {
				if (!this.memberlevel) {
					// Fix for the ad that sometimes appears randomly
					var prevAd = document.getElementById("amzn-assoc-ad-123acff2-6857-4569-a250-fd703f6a941d");
					prevAd.parentNode.removeChild()
					// Amazon ad code
					var div = document.createElement("div");
					var ad = div.appendChild(document.createElement("div"));
					ad.id = "amzn-assoc-ad-123acff2-6857-4569-a250-fd703f6a941d";
					var script = div.appendChild(document.createElement("script"));
					script.src = "//z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US&adInstanceId=123acff2-6857-4569-a250-fd703f6a941d";
					this.chat.addElementAsMessage(div);
					setTimeout(function () {
						ad.id = "";
					}, 1000);
				}
			}.bind(this), 15000);
			
			if(this.account.uKey) {
				this.getFavorites();
				this.getMyProtectedRegions();
			}
			
			// If we are new show the welcome window
			// Currently disabled
			if (this.userSettings.getBoolean("Show welcome") && false) {
				this.openWelcomeWindow();

			// We are not new, check if we already saw all the awesome new features
			} else if (parseInt(localStorage.getItem("newfeaturewindowversion")) !== this.CLIENT_VERSION) {
				this.openNewFeatureWindow();
			
			// Premium window it is
			} else if (!localStorage.getItem("wasPremium") && (!localStorage.getItem("premium_window")
				|| Date.now() - parseInt(localStorage.getItem("premium_window")) > this.PREMIUM_WINDOW_EVERY)) {
				localStorage.setItem("premium_window", Date.now());
				this.openPremiumBuyWindow();
			
			// Ha lets just self promote scuttlers then
			} else if (!localStorage.getItem("scuttlers_released")
				|| Date.now() - parseInt(localStorage.getItem("scuttlers_released")) > this.SCUTTLERS_MESSAGE_EVERY) {
				localStorage.setItem("scuttlers_released", Date.now());
				this.createScuttlersOverlay();
			}

			this.clickableAreas = clickableAreas || [];
			this.setupClickableAreas();
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
			this.chat.addMessage("Invite friends:", "https://www.anondraw.com/#" + room);
			
			this.chat.addMessage("Check out my upcoming game scuttlers", "https://www.youtube.com/watch?v=pE737MO-8YQ");
			
			if (this.account.uKey) {
				this.getFavorites();
				this.getMyProtectedRegions();
			}

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
	this.loading.appendChild(document.createTextNode("Loading room '" + room + "' ..."));
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
	this.changeNameTimeout = setTimeout(this.changeName.bind(this), 1650);
};

DrawTogether.prototype.updatePlayerList = function updatePlayerList () {
	var isCatMeow = this.account.id === 3196;
	// Update the playerlist to reflect the current local list
	while (this.playerListDom.firstChild)
		this.playerListDom.removeChild(this.playerListDom.firstChild)

	var plTitle = this.playerListDom.appendChild(document.createElement("span"));
	plTitle.appendChild(document.createTextNode("PlayerList (" + this.playerList.length + ")"));
	plTitle.className = "drawtogether-pl-title";

	for (var k = 0; k < this.playerList.length; k++) {
		if(isCatMeow && this.playerList[k].userid === 2518) continue;
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
	
	var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
	                  this.paint.public.canvas.height / this.paint.public.zoom];
	
	location.hash = room + "," +
	                (this.paint.public.leftTopX + screenSize[0] / 2).toFixed() + "," +
	                (this.paint.public.leftTopY + screenSize[1] / 2).toFixed();
};

DrawTogether.prototype.openSettingsWindow = function openSettingsWindow () {
	this.settingsWindow.style.display = "block";
	ga("send", "event", "openwindow", "settings");
};

DrawTogether.prototype.openChatFilterWindow = function openChatFilterWindow () {
	this.chatFilterOptions.style.display = "block";
	ga("send", "event", "openwindow", "chatFilter");
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

DrawTogether.prototype.openExplainShareWindow = function openExplainShareWindow () {
	this.shareWindow.style.display = "block";
	ga("send", "event", "openwindow", "explainshare");

	
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
	this.selectWindow.style.display = "flex";
};

DrawTogether.prototype.closeChatFilterWindow = function closeChatFilterWindow () {
	this.chatFilterOptions.style.display = "";
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

DrawTogether.prototype.playerFromUserId = function playerFromUserId (id) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].userid == id) {
			return this.playerList[k];
		}
	}

	return null;
};

DrawTogether.prototype.playerFromId = function playerFromId (id) {
	for (var k = 0; k < this.playerList.length; k++) {
		if (this.playerList[k].id == id) {
			return this.playerList[k];
		}
	}

	return null;
};

DrawTogether.prototype.createPermissionChatMessageWithTimeout = function createPermissionChatMessageWithTimeout(messageFromServer){
	if(this.insideProtectedRegionWarningTimeout != null) {
		window.clearTimeout(this.insideProtectedRegionWarningTimeout);
	}

	this.insideProtectedRegionWarningTimeout = window.setTimeout(function(){
		this.chat.addElementAsMessage(this.createPermissionChatMessage(messageFromServer));
		this.insideProtectedRegionWarningTimeout = null
	}.bind(this), 2000);
};

DrawTogether.prototype.createPermissionChatMessage = function createPermissionChatMessage(messageFromServer){
	var PermissionDom = document.createElement("div");
	PermissionDom.className = "drawtogether-player";

	if (this.reputation >= this.MODERATE_REGION_MIN_REP) {
		var removeRegionButton = document.createElement("span");
		removeRegionButton.className = "drawtogether-player-button drawtogether-kickban-button";

		removeRegionButton.appendChild(document.createTextNode("Delete their region?"));

		removeRegionButton.addEventListener("click", this.removeProtectedRegion.bind(this, messageFromServer.regionid, false, true));

		PermissionDom.appendChild(removeRegionButton);
	}

	var messageText = document.createElement("span");
	messageText.className = "drawtogether-player-name";

	

	var owner = this.playerFromUserId(messageFromServer.ownerid) || messageFromServer;//messageFromServer.name can be outdated
				var ownerPermissionSentence = "";
				var reputationSentence = "";
				var loggedInSentence = "";

	if(!this.account.uKey)
		loggedInSentence = "You have to be logged in to draw in protected regions."
	else if(this.reputation < messageFromServer.minRepAllowed && messageFromServer.minRepAllowed <= this.MAX_REP_TO_DISPLAY)
		reputationSentence = "This region requires at least " + messageFromServer.minRepAllowed + " Reputation.";

	if(owner)
		ownerPermissionSentence = "You can ask for permission from " + owner.name + ".";
	else
	ownerPermissionSentence = "The region owner is offline.";
	

	var messageToUser = "This is a protected region. "
						+ loggedInSentence + " " 
						+ reputationSentence + " "
						+ ownerPermissionSentence;

	messageText.appendChild(document.createTextNode(messageToUser))

	PermissionDom.appendChild(messageText);

	return PermissionDom;
};

DrawTogether.prototype.createRegionProtectedWindow = function createRegionProtectedWindow () {
	if (this.regionProtectedWindowTimeout && Date.now() - this.regionProtectedWindowTimeout < 15000) return;
	this.regionProtectedWindowTimeout = Date.now();

	if (this.reputation && this.reputation > 10) return

	var protectedWindow = this.gui.createWindow({
		title: "Permission denied"
	});
	
	var content = protectedWindow.appendChild(document.createElement("div"));
	content.classList.add("content");
	
	var title = content.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Sorry, but you can't draw here."));
	
	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("To prevent grief, this region has been protected. We can find you an empty spot though. There you can draw and build up reputation."));
	
	var button = content.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button";
	button.appendChild(document.createTextNode("Go to a random location"));
	button.addEventListener("click", function () {
		var maxCoords = this.paint.MAX_RANDOM_COORDS;
		this.paint.goto(Math.random() * maxCoords * 2 - maxCoords, Math.random() * maxCoords * 2 - maxCoords);
		protectedWindow.parentNode.removeChild(protectedWindow);
	}.bind(this));
};

DrawTogether.prototype.createPlayerChatDom = function createPlayerChatDom (player, appendedText) {
	var playerDom = document.createElement("div");
	playerDom.className = "drawtogether-player";

	if (this.reputation >= this.KICKBAN_MIN_REP) {
		var kickbanButton = document.createElement("span");
		kickbanButton.className = "drawtogether-player-button drawtogether-kickban-button fa fa-trash";

		kickbanButton.addEventListener("click", this.kickban.bind(this, player.id));

		playerDom.appendChild(kickbanButton);
	}

	var upvoteButton = document.createElement("span");
	upvoteButton.className = "drawtogether-player-button drawtogether-upvote-button fa fa-caret-up";

	upvoteButton.addEventListener("click", function (playerid, event) {
		this.network.socket.emit("upvote", playerid);
	}.bind(this, player.id));
	
	var messageButton = document.createElement("span");
	messageButton.className = "drawtogether-player-button drawtogether-upvote-button fa fa-envelope";

	messageButton.addEventListener("click", function (userid, event) {
		this.pms.createChatWindow(userid, player.name);
	}.bind(this, player.userid));

	var nameText = document.createElement("span");
	nameText.className = "drawtogether-player-name";

	var rep = "", score = "";
	if (typeof player.reputation !== "undefined") {
		var rep = " (" + player.reputation + " R)";
	}

	if (typeof player.gamescore !== "undefined") {
		score = " [" + player.gamescore + " Points]";
	}

	nameText.appendChild(document.createTextNode(player.name + rep + score + appendedText))

	playerDom.appendChild(upvoteButton);
	playerDom.appendChild(messageButton);
	playerDom.appendChild(nameText);

	return playerDom;
};

DrawTogether.prototype.createPlayerDrewInAreaDom = function createPlayerDrewInAreaDom (player) {
	return this.createPlayerChatDom(player, " drew in this area.");
};

DrawTogether.prototype.createPlayerLeftDom = function createPlayerLeftDom (player) {
	return this.createPlayerChatDom(player, " has left.");
};

DrawTogether.prototype.createPlayerDom = function createPlayerDom (player) {
	var playerDom = document.createElement("div");
	playerDom.className = "drawtogether-player " + (player.currentPlayer ? "currentplayer" : "");

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
	upvoteButton.className = "drawtogether-player-button drawtogether-upvote-button fa fa-caret-up";

	upvoteButton.addEventListener("click", function (playerid, event) {
		this.network.socket.emit("upvote", playerid);
	}.bind(this, player.id));
	
	if (player.userid) {
		var messageButton = document.createElement("span");
		messageButton.className = "drawtogether-player-button fa fa-envelope";

		messageButton.addEventListener("click", function (userid, event) {
			this.pms.createChatWindow(userid, player.name);
		}.bind(this, player.userid));
	}

	if (this.reputation >= this.KICKBAN_MIN_REP) {
		var kickbanButton = document.createElement("span");
		kickbanButton.className = "drawtogether-player-button drawtogether-kickban-button fa fa-trash";

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
		icons += "❤";
		nameText.className += " premium";
	}

	nameText.appendChild(document.createTextNode(player.name + rep + score + drawing))

	playerDom.appendChild(upvoteButton);
	
	if (messageButton)
		playerDom.appendChild(messageButton);

	playerDom.appendChild(nameText);

	var iconDom = document.createElement("span");
	iconDom.appendChild(document.createTextNode(icons));
	iconDom.className = "icons";
	playerDom.appendChild(iconDom);

	return playerDom;
};

DrawTogether.prototype.createSnapshotChatDom = function createSnapshotChatDom (playerName) {
	var snapshotDom = document.createElement("div");
	
	var proofImgWindow = document.createElement("span");
	proofImgWindow.className = "drawtogether-player-button";
	proofImgWindow.textContent = "View image before/after proof";
	proofImgWindow.addEventListener("click", function (e) {
		this.exportImageFromSrc("Proof of grief by " + playerName + " (right click to save)", this.lastBanSnapshot);
	}.bind(this));
	
	snapshotDom.appendChild(proofImgWindow);
	return snapshotDom;
};

DrawTogether.prototype.kickban = function kickban (playerid) {
	var player = this.playerFromId(playerid);
	var personText = "this person";
	if(player && player.name) {
		personText = player.name;
	}
	this.gui.prompt("How long do you want to kickban "+ personText +" for? (minutes)", ["freepick", "10 year", "1 year", "1 month", "1 week", "1 day", "1 hour", "5 minutes", "1 minute", "Cancel"], function (minutes) {
		if (minutes == "Cancel") return;
		if (minutes == "10 year") minutes = 10 * 356 * 24 * 60;
		if (minutes == "1 year") minutes = 356 * 24 * 60;
		if (minutes == "1 month") minutes = 30 * 24 * 60;
		if (minutes == "1 week") minutes = 7 * 24 * 60;
		if (minutes == "1 day") minutes = 24 * 60;
		if (minutes == "1 hour") minutes = 60;
		if (minutes == "5 minutes") minutes = 5;
		if (minutes == "1 minute") minutes = 1;
		this.gui.prompt("Should we ban the account, the ip or both?", ["account", "ip", "both", "Cancel"], function (type) {
			if (type == "Cancel") return;
			this.gui.prompt("What is the reason you want to ban him?", ["freepick", "Destroying drawings", "Cancel"], function (reason) {
				if (reason == "Cancel") return;
				this.gui.prompt("Are you sure you want to ban " + this.usernameFromSocketid(playerid) + " (bantype: " + type + ") for " + minutes + " minutes. Reason: " + reason, ["Yes", "No"], function (confirmation) {
					if (confirmation == "Yes") {
						var tempSnapshotCanvas = document.createElement("canvas");
						var canvasHeight = this.paint.public.canvas.height
						var canvasWidth = this.paint.public.canvas.width;

						tempSnapshotCanvas.width = canvasWidth;
						tempSnapshotCanvas.height = canvasHeight * 2;

						var ctx = tempSnapshotCanvas.getContext("2d");
						ctx.drawImage(this.paint.background.canvas, 0, 0, canvasWidth, canvasHeight);
						ctx.drawImage(this.paint.public.canvas, 0, 0, canvasWidth, canvasHeight);
						this.lastBanSnapshot;
						
						this.network.socket.emit("kickban", [playerid, minutes, type, reason], function (data) {
							this.chat.addMessage("SERVER", data.error || data.success);
							if(data.success) {
								this.takeSnapshotTimeout = setTimeout(function () {
									ctx.drawImage(this.paint.background.canvas, 0, canvasHeight, canvasWidth, canvasHeight);
									ctx.drawImage(this.paint.public.canvas, 0, canvasHeight, canvasWidth, canvasHeight);
									this.lastBanSnapshot = tempSnapshotCanvas.toDataURL("image/png");
									this.uploadBanImage();
									this.chat.addElementAsMessage(this.createSnapshotChatDom(personText));
									this.takeSnapshotTimeout = undefined;
								}.bind(this), 2000);
							}
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
	this.chat = new Chat(chatContainer, this.sendMessage.bind(this), this.userSettings, this.emotesHash);
	this.chatContainer = chatContainer;
	this.chat.addMessage("Welcome to anondraw, the free interactive group drawing app.");
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

	loadImage.src = "images/loadingChunk.png";
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
		if (this.current_room.indexOf("private_") !== 0 && this.current_room.indexOf("game_") !== 0
			&& (this.reputation || 0) < this.IGNORE_INK_REP && !this.memberlevel) {

			if (!(this.reputation >= this.BIG_BRUSH_MIN_REP) &&
			    ((event.drawing.size > 20 && typeof event.drawing.text == "undefined") || event.drawing.size > 20)) {
				if (Date.now() - this.lastBrushSizeWarning > 5000) {
					this.chat.addMessage("Brush sizes above 20 and text sizes above 20 require an account with " + this.BIG_BRUSH_MIN_REP + " reputation! Registering is free and easy. You don't even need to confirm your email!");
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
		this.sendDrawing(event.drawing, function (success) {
			if(typeof success !== 'undefined' && typeof success.isAllowed !== 'undefined' && !success.isAllowed){
				this.createPermissionChatMessageWithTimeout(success);
				this.createRegionProtectedWindow();
			}
			else if (typeof success !== 'undefined' && typeof success.inSpawnArea !== 'undefined') {
				this.createRegionProtectedWindow();
			}

			event.removeDrawing();
		}.bind(this));
	}.bind(this));

	this.paint.addEventListener("undo", function (event) {
		this.network.socket.emit("undo");
	}.bind(this));

	this.paint.addEventListener("startuserpath", function (event) {
		// start path
		this.network.socket.emit("sp", event.props.color.toHex8(), event.props.size);
		this.lastPathSize = event.props.size;
		this.lastPathPoint = undefined;
	}.bind(this));

	this.paint.addEventListener("enduserpath", function (event) {
		this.network.socket.emit("ep", function (id, success) {
			event.removePath(success, id);
			this.lastPathPoint = undefined;
		});
	}.bind(this));

	this.paint.addEventListener("userpathpoint", this.handlePaintUserPathPoint.bind(this));

	this.paint.addEventListener("select", this.handlePaintSelection.bind(this));

	function setHash () {
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
	                  this.paint.public.canvas.height / this.paint.public.zoom];
		
		location.hash = this.current_room + "," +
		                (this.paint.public.leftTopX + screenSize[0] / 2).toFixed() + "," +
		                (this.paint.public.leftTopY + screenSize[1] / 2).toFixed();
	}

	var hashTimeout;
	var boundSetHash = setHash.bind(this);

	this.paint.addEventListener("move", function (event) {
		clearTimeout(hashTimeout);
		hashTimeout = setTimeout(boundSetHash, 100);
	});
	
	this.paint.addEventListener("move", this.paintMoved.bind(this));
	
	// Insert the clicableareascontainer right after the last canvas
	// Noob trap: lastcanvas is actually the second last canvas
	this.clickableAreasContainer = document.createElement("div");
	this.clickableAreasContainer.className = "clickableareas-container";
	this.paint.lastCanvas.parentNode.insertBefore(this.clickableAreasContainer, this.paint.lastCanvas.nextSibling.nextSibling);

	this.paint.changeTool("grab");
	
	//Spawn button 
	var spawnButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	spawnButton.className = "control-button spawn-button";
	
	var spawnButtonImage = spawnButton.appendChild(document.createElement("img"));
	spawnButtonImage.src = "images/icons/home.png";
	spawnButtonImage.alt = "Goto spawn";
	spawnButtonImage.title = "Goto spawn";
	spawnButton.addEventListener("click", function () {
		var spawn = this.getSpawn(this.current_room);
		this.handleGotoAndCenter(spawn[0], spawn[1]);
	}.bind(this));
	
	//Favorites button 
	var favoritesButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	favoritesButton.className = "control-button favorites-button";
	
	var favoritesButtonImage = favoritesButton.appendChild(document.createElement("img"));
	favoritesButtonImage.src = "images/icons/locations.png";
	favoritesButtonImage.alt = "Open Favorites Menu";
	favoritesButtonImage.title = "Open Favorites Menu";
	favoritesButton.addEventListener("click", function () {
		if($(".favorites-window").is(":visible")) {
			$(".favorites-window").hide();
		} else {
			this.updateFavoriteDom();
			$(".regions-window").hide();
			this.animationsWindow.classList.remove("show");
			//this.framesWindow.classList.remove("show");
			$(".favorites-window").show();
		}
	}.bind(this));
	
	var favoritesWindow = this.paint.container.appendChild(document.createElement("div"));
	favoritesWindow.className = "coords-window favorites-window";
	
	this.favoritesContainer = favoritesWindow.appendChild(document.createElement("div"));
	this.favoritesContainer.className = "favorites-container";	

	//Regions button
	var regionsButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	regionsButton.className = "control-button regions-button";
	regionsButton.addEventListener("click", function () {
		if($(".regions-window").is(":visible")) {
			$(".regions-window").hide();
			this.getMyProtectedRegions();
		} else {
			this.getMyProtectedRegions(function(){
				$(".favorites-window").hide();
				this.animationsWindow.classList.remove("show");
				//this.framesWindow.classList.remove("show");
				$(".regions-window").show();

				if(!this.myRegions || this.myRegions.length === 0){
					this.displayRegionTutorial(true);
				}
			}.bind(this));			
		}
	}.bind(this));

	var regionsButtonImage = regionsButton.appendChild(document.createElement("img"));
	regionsButtonImage.src = "images/icons/pregion.png";
	regionsButtonImage.alt = "Open Regions Menu";
	regionsButtonImage.title = "Open Regions Menu";

	var regionsWindow = this.paint.container.appendChild(document.createElement("div"));
	regionsWindow.className = "coords-window regions-window";
	
	this.regionTutorialContainer = regionsWindow.appendChild(document.createElement("div"));
	this.regionTutorialContainer.className = "region-tutorial";
	this.createRegionTutorialDom();
	
	this.regionsContainer = regionsWindow.appendChild(document.createElement("div"));
	this.regionsContainer.className = "regions-container";
	
	var animationsButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	animationsButton.className = "control-button anim-manager-button";
	animationsButton.addEventListener("click", this.toggleAnimationManager.bind(this));

	var animationButtonImage = animationsButton.appendChild(document.createElement("img"));
	animationButtonImage.src = "images/icons/frames.png";
	animationButtonImage.alt = "Open Animation Manager";
	animationButtonImage.title = "Open Animation Manager";
	
	this.createAnimationManager();
	
	var mapButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	mapButton.className = "control-button tilesmap-button";
	mapButton.addEventListener("click", this.openTilesMap.bind(this));

	var mapButtonImage = mapButton.appendChild(document.createElement("img"));
	mapButtonImage.src = "images/icons/map.png";
	mapButtonImage.alt = "Open the tile map";
	mapButtonImage.title = "Open the tile map";
	
	this.clickableAreaButton = this.paint.coordDiv.appendChild(document.createElement("div"));
	this.clickableAreaButton.className = "control-button clickablearea-button activated";
	this.clickableAreaButton.addEventListener("click", this.toggleClickableArea.bind(this));

	var clickableAreaButtonImage = this.clickableAreaButton.appendChild(document.createElement("img"));
	clickableAreaButtonImage.src = "images/icons/clickable.png";
	clickableAreaButtonImage.alt = "Toggle the canvas buttons";
	clickableAreaButtonImage.title = "Toggle the canvas buttons";
	
	var popout = this.paint.container.appendChild(document.createElement("img"));
	popout.className = "popout-button";
	popout.src = "images/icons/popout.png";
	popout.alt = "Popout";
	popout.title = "Popout";
	popout.addEventListener('click', this.toggleFullscreen.bind(this));
};

DrawTogether.prototype.toggleClickableArea = function toggleClickableArea () {
	var hidden = this.clickableAreasContainer.classList.toggle("hide");
	this.clickableAreaButton.classList.toggle("activated", !hidden);
};

DrawTogether.prototype.toggleFullscreen = function toggleFullscreen () {
	this.paint.container.classList.toggle("fullscreen");
	this.paint.resize();
	ga("send", "event", "fullscreen", "toggle");
};

DrawTogether.prototype.openTilesMap = function openTilesMap () {
	var tileWindow = this.gui.createWindow({ title: "TileMap for room " + this.current_room });
	
	var content = tileWindow.appendChild(document.createElement("div"));
	content.classList.add("content");
	
	var canvas = new RoomTileCanvas(this.favList);
	var mapCanvas = content.appendChild(canvas.container);
	canvas.resize();
	canvas.addEventListener("click", function (event) {
		this.handleGotoAndCenter(event.position[0], event.position[1]);
	}.bind(this));
	
	canvas.tiledCanvas.goto(
		this.paint.public.leftTopX / this.paint.public.settings.chunkSize * canvas.settings.tileSize,
		this.paint.public.leftTopY / this.paint.public.settings.chunkSize * canvas.settings.tileSize
	);
	
	this.tiles = this.tiles || {};
	if (this.tiles[this.current_room]) {
		canvas.useTiles(this.tiles[this.current_room]);
	} else {
		var room = this.current_room;
		canvas.requestData(this.settings.imageServer, room);
		canvas.callbacks.push(function () {
			this.tiles[room] = canvas.tiles;
		}.bind(this));
	}
};

DrawTogether.prototype.createFramesManager = function createFramesManager () {
	this.framesWindow = this.paint.container.appendChild(document.createElement("div"));
	this.framesWindow.className = "coords-window frames-window";
	this.updateFramesManager();
};

/*
	Adds the current frames to the manager and
	show location and options (disable/enable, delete, ...)
*/
DrawTogether.prototype.updateFramesManager = function updateFramesManager () {
	while (this.framesWindow.firstChild) this.framesWindow.removeChild(this.framesWindow.firstChild);
	
	var container = this.framesWindow.appendChild(document.createElement("div"));
	container.className = "container";
	
	if (this.paint.frames.length === 0) {
		container.appendChild(document.createTextNode("You haven't made any frames."));
	}
	
	for (var k = 0; k < this.paint.frames.length; k++) {
		container.appendChild(this.buildFrameButtons(this.paint.frames[k]));
	}
};

/*
	Returns a div containing buttons bounded with eventlisteners
	that control the given frame
*/
DrawTogether.prototype.buildFrameButtons = function buildFrameButtons (frame) {
	var container = document.createElement("div");
	
	var gotoButton = container.appendChild(document.createElement("div"));
	gotoButton.className = "coords-button position-button";
	gotoButton.appendChild(document.createTextNode(frame.leftTop[0] + ", " + frame.leftTop[1]));
	gotoButton.addEventListener("click", this.frameGotoHandler.bind(this, frame));
	
	container.appendChild(this.buildFrameOnOffButton(frame));
	container.appendChild(this.buildFrameRemoveButton(frame));
	
	return container;
};

DrawTogether.prototype.frameGotoHandler = function frameGotoHandler (frame, event) {
	this.handleGoto(frame.leftTop[0], frame.leftTop[1]);
};

DrawTogether.prototype.frameOnOffHandler = function frameOnOffHandler (frame, event) {
	frame.disabled = !frame.disabled;
	this.paint.redrawFrames();
	this.updateFramesManager();
};

DrawTogether.prototype.buildFrameOnOffButton = function buildFrameOnOffButton(frame) {
	var button = document.createElement("div");
	button.classList.add("coords-button");
	
	var image = document.createElement("img");
	image.src = frame.disabled ? "images/icons/hidden.png" : "images/icons/visible.png";
	button.appendChild(image);
	
	button.addEventListener("click", this.frameOnOffHandler.bind(this, frame));
	return button;
};

DrawTogether.prototype.frameRemoveHandler = function frameRemoveHandler (frame, button, event) {
	if (button.classList.contains("confirm")) {
		for (var k = 0; k < this.paint.frames.length; k++) {
			if (this.paint.frames[k] == frame) {
				this.paint.frames.splice(k, 1);
				this.paint.redrawFrames();
				this.updateFramesManager();
				return;
			}
		}
	} else {
		button.classList.add("confirm");
		
		setTimeout(function () {
			button.classList.remove("confirm");
		}, 3000);
	}
};

DrawTogether.prototype.buildFrameRemoveButton = function buildFrameRemoveButton(frame) {
	var button = document.createElement("div");
	button.classList.add("coords-button");

	var image = document.createElement("img");
	image.src = "images/icons/remove.png";
	button.appendChild(image);

	button.addEventListener("click", this.frameRemoveHandler.bind(this, frame, button));
	return button;
};

DrawTogether.prototype.toggleFramesManager = function toggleFramesManager () {
	if (this.framesWindow.classList.contains("show")) {
		this.framesWindow.classList.remove("show");
	} else {
		this.framesWindow.classList.add("show");
		$(".regions-window").hide();
		$(".favorites-window").hide();
		this.updateFramesManager();
	}
};

DrawTogether.prototype.getAnimationsFromCookie = function getAnimationsFromCookie () {
	var temp = localStorage.getItem('myAnimations');
	if(temp)
		return JSON.parse(temp);
	else
		return [];
};
DrawTogether.prototype.updateAnimationsCookieDelay = function updateAnimationsCookieDelay () {
	if(this.updateAnimationsCookieDelayTimeout)
		clearTimeout(this.updateAnimationsCookieDelayTimeout);
	
	this.updateAnimationsCookieDelayTimeout = setTimeout(this.updateAnimationsCookie.bind(this), 2000);
	
};

DrawTogether.prototype.updateAnimationsCookie = function updateAnimationsCookie () {
	localStorage.setItem('myAnimations', JSON.stringify(this.myAnimations));
};

DrawTogether.prototype.createAnimationManager = function createAnimationManager () {
	this.animationsWindow = this.paint.container.appendChild(document.createElement("div"));
	this.animationsWindow.className = "coords-window animation-window";
	this.updateAnimationManager();
};

DrawTogether.prototype.updateAnimationManager = function updateAnimationManager () {
	while (this.animationsWindow.firstChild) this.animationsWindow.removeChild(this.animationsWindow.firstChild);
	
	var container = this.animationsWindow.appendChild(document.createElement("div"));
	container.className = "container";
	
	if (this.myAnimations.length === 0) {
		container.appendChild(document.createTextNode("You haven't made any animations."));
	}
	
	for (var k = 0; k < this.myAnimations.length; k++) {
		container.appendChild(this.buildAnimationButtons(this.myAnimations[k], k));
	}
};
//keyframes, name(coords if empty), pencil, export, cloud icon, remove

DrawTogether.prototype.buildAnimationButtons = function buildAnimationButtons (myAnimation, index) {
	var container = document.createElement("div");
	
	var keyframeManagerButton = container.appendChild(document.createElement("div"));
	keyframeManagerButton.className = "coords-button";
	keyframeManagerButton.appendChild(document.createTextNode("Keyframe Manager"));
	keyframeManagerButton.addEventListener("click", this.openKeyframeManager.bind(this, myAnimation, index));
	
	
	var gotoButton = container.appendChild(document.createElement("div"));
	gotoButton.className = "coords-button position-button";
	var gototext = myAnimation.name || (myAnimation.leftTop[0] + ", " + myAnimation.leftTop[1]);
	gotoButton.appendChild(document.createTextNode(gototext));
	gotoButton.addEventListener("click", this.animationGotoHandler.bind(this, myAnimation));
	
	var sendToChatButton = container.appendChild(document.createElement("div"));
	sendToChatButton.className = "coords-button";
	sendToChatButton.appendChild(document.createTextNode("send to chat->"));
	sendToChatButton.addEventListener("click", this.sendAnimationToChat.bind(this, myAnimation));
	
	var exportButton = container.appendChild(document.createElement("div"));
	exportButton.className = "coords-button";
	
	exportButton.appendChild(document.createTextNode("export"));
	exportButton.addEventListener("click", this.exportMyAnimation.bind(this, myAnimation, index));
	
	container.appendChild(this.buildAnimationRemoveButton(myAnimation));
	
	return container;
};

DrawTogether.prototype.sendAnimationToChat = function sendAnimationToChat(myAnimation, event) {
	this.network.socket.emit("chatanimation", JSON.stringify(myAnimation));
};

DrawTogether.prototype.buildKeyframe = function buildKeyframe (i, frameType, totalCount, hasBufferFrames) {
	var labelBar = this.keyframeManager.keyframeNumberLabelBar.appendChild(document.createElement("div"));
	if( totalCount % 5 == 0)
		labelBar.appendChild(document.createTextNode(totalCount));
	else
		labelBar.appendChild(document.createTextNode('\u00A0')); //space character
	labelBar.className = "keyframe-labelbar";
	
	var dividerBorders = labelBar.appendChild(document.createElement("div"));
	dividerBorders.className = "keyframe-labelbar-digit-divider";
	
	var keyFrame = this.keyframeManager.keyframeBar.appendChild(document.createElement("div"));
	
	keyFrame.className = "keyframe-unit " + frameType + (hasBufferFrames ? " keyframe-hasBufferFrames" : "");
	if(frameType != '')
	keyFrame.addEventListener("click", function keyframeclick(e) {
		var element = e.srcElement || e.target;
		if(element.classList.contains("keyframe-selected")){
			element.classList.remove("keyframe-selected");
		}
		else {
			element.classList.add("keyframe-selected");
			this.keyframeGoto(this.myAnimations[this.keyframeManager.animationIndex], i);
		}
	}.bind(this));
	
	
	
};
DrawTogether.prototype.keyframeGoto = function keyframeGoto (myAnimation, keyframeindex) {
	var offset = keyframeindex * myAnimation.sqwidth + keyframeindex * myAnimation.gutter;
	this.handleGotoAndCenter(myAnimation.leftTop[0] + offset, myAnimation.leftTop[1]);
};
DrawTogether.prototype.openKeyframeManager = function openKeyframeManager (myAnimation, index, event) {
	if(!this.keyframeManager) this.createKeyframeManager();
	//this.keyframeManager.window.hidden = true;
	$(".keyframe-number-labelbar-container .keyframe-labelbar").remove();
	
	while (this.keyframeManager.keyframeBar.firstChild)
		this.keyframeManager.keyframeBar.removeChild(this.keyframeManager.keyframeBar.firstChild);
	
	var totalCount = 0;
	
	for(var i = 0; i < myAnimation.squares + 20; i++) {
		var frameType = ''; // non-allocated frame
		if(i < myAnimation.squares) 
			frameType = 'keyframe-full keyframe-full-keyed'; // keyframe
		var hasBufferFrames = myAnimation.bufferFrames && typeof myAnimation.bufferFrames[i] == "number" && myAnimation.bufferFrames[i] > 0;
		
		this.buildKeyframe(i, frameType, ++totalCount, hasBufferFrames);
		if(hasBufferFrames)
			for(var x = 0; x < myAnimation.bufferFrames[i]; x++){
				this.buildKeyframe(i, "keyframe-full", ++totalCount); // buffer frame
				
			}
		
	}
	
	this.keyframeManager.fpsInput.value = myAnimation.fps;
	this.keyframeManager.window.hidden = false;
	this.keyframeManager.animationIndex = index;
};
//keyframes manager
// fps: numeric updown, onion toggle, blank keyframe: +/-
// click keyframe to jump to it 
// 1  2  3  4  5
//[o][ ][o][o][o] //four frames with one blank filler frame
//
DrawTogether.prototype.createKeyframeManager = function createKeyframeManager () {
	this.keyframeManager = {
		window: this.gui.createWindow({ 
			title: "Keyframe Manager", thinTitlebar: true,
			isModal: true,
			onclose: function closemanager(ctx) { ctx.hidden = true }
		})
	};
	this.keyframeManager.window.hidden = true;
	
	var topControlsContainer = this.keyframeManager.window.appendChild(document.createElement("div"));
	topControlsContainer.className = "keyframe-top-control-container";
	
	var fpsLabel = topControlsContainer.appendChild(document.createElement("div"));
	fpsLabel.appendChild(document.createTextNode("fps:"));
	fpsLabel.className = "keyframe-control keyframe-control-label";
	
	var fpsInput = topControlsContainer.appendChild(document.createElement("input"));
	fpsInput.className = "keyframe-control keyframe-fps-input";
	fpsInput.type = "number";
	fpsInput.min = 1;
	fpsInput.max = Number.MAX_SAFE_INTEGER;
	fpsInput.defaultValue = 24;
	fpsInput.addEventListener("input", function (e) {
		this.myAnimations[this.keyframeManager.animationIndex].fps = parseInt(e.target.value);
		this.updateAnimationsCookieDelay();
	}.bind(this));
	this.keyframeManager.fpsInput = fpsInput;
	
	var onionButton = topControlsContainer.appendChild(document.createElement("div"));
	onionButton.className = "keyframe-control control-button";
	onionButton.appendChild(document.createTextNode("🌰"));
	this.keyframeManager.onionButton = onionButton;
	
	onionButton.addEventListener("click", function (){
		if(onionButton.classList.contains("keyframe-onion-toggle")){
			if(onionButton.classList.contains("keyframe-onion-toggle-loop")){
				onionButton.classList.remove("keyframe-onion-toggle-loop");
				onionButton.classList.remove("keyframe-onion-toggle");
				onionSliderLeft.style.display = "none";
				onionSliderRight.style.display = "none";
				this.keyframeManager.onionLoop = false;
				this.paint.frames = [];
				this.paint.redrawFrames();
			}
			else{
				onionButton.classList.add("keyframe-onion-toggle-loop");
				this.keyframeManager.onionLoop = true;
				this.onionLoopLastFrame();
			}
		}
		else{
			onionButton.classList.add("keyframe-onion-toggle");
			onionSliderLeft.style.display = "";
			onionSliderRight.style.display = "";
			this.slideSuccessful();
		}
			
	}.bind(this));
	
	var fpsLabel = topControlsContainer.appendChild(document.createElement("div"));
	fpsLabel.appendChild(document.createTextNode("Blank Keyframe:"));
	fpsLabel.className = "keyframe-control keyframe-fps-label";
	
	var plusButton = topControlsContainer.appendChild(document.createElement("div"));
	plusButton.className = "control-button keyframe-control keyframe-updown-button";
	plusButton.appendChild(document.createTextNode("+"));
	plusButton.addEventListener("click", this.addRemoveBufferFrames.bind(this, "add"))
	
	var minusButton = topControlsContainer.appendChild(document.createElement("div"));
	minusButton.className = "control-button keyframe-control keyframe-updown-button";
	minusButton.appendChild(document.createTextNode("-"));
	minusButton.addEventListener("click", this.addRemoveBufferFrames.bind(this, "remove"))
	
	var bottomControls = this.keyframeManager.window.appendChild(document.createElement("div"));
	bottomControls.className = "keyframe-bottom-control-container";
	var keyframeNumberLabelBar = bottomControls.appendChild(document.createElement("div"));
	keyframeNumberLabelBar.className = "keyframe-number-labelbar-container";

	this.keyframeManager.keyframeNumberLabelBar = keyframeNumberLabelBar;
	
	var onionSliderLeft = keyframeNumberLabelBar.appendChild(document.createElement("div"));
	onionSliderLeft.className = "keyframe-onion-slider keyframe-onion-slider-left";
	
	var leftTriangleTop = onionSliderLeft.appendChild(document.createElement("div"));
	leftTriangleTop.className = "keyframe-onion-triangle keyframe-onion-left-top-triangle";
	
	var leftTriangleBottom = onionSliderLeft.appendChild(document.createElement("div"));
	leftTriangleBottom.className = "keyframe-onion-triangle keyframe-onion-left-bottom-triangle";
	
	var onionSliderLeftBall = onionSliderLeft.appendChild(document.createElement("div"));
	onionSliderLeftBall.className = "keyframe-onion-slider-ball";
	
	var onionSliderRight = keyframeNumberLabelBar.appendChild(document.createElement("div"));
	onionSliderRight.className = "keyframe-onion-slider keyframe-onion-slider-right";
	
	var rightTriangleTop = onionSliderRight.appendChild(document.createElement("div"));
	rightTriangleTop.className = "keyframe-onion-triangle keyframe-onion-right-top-triangle";
	
	var rightTriangleBottom = onionSliderRight.appendChild(document.createElement("div"));
	rightTriangleBottom.className = "keyframe-onion-triangle keyframe-onion-right-bottom-triangle";
	
	var onionSliderRightBall = onionSliderRight.appendChild(document.createElement("div"));
	onionSliderRightBall.className = "keyframe-onion-slider-ball";
	
	this.makeSliderDraggable([onionSliderLeftBall], onionSliderLeft, bottomControls, true
	, function boundsCheck (newLeft) {
		var respectingOtherSlider = newLeft < (onionSliderRight.offsetLeft - 2);
		var respectingContainerLeft = newLeft >= 0;
		var respectingContainerRight = newLeft < bottomControls.getBoundingClientRect().width + bottomControls.scrollLeft;
		return respectingOtherSlider && respectingContainerLeft && respectingContainerRight;
	}, this.slideSuccessful.bind(this));

	this.makeSliderDraggable([onionSliderRightBall], onionSliderRight, bottomControls, true
	, function bounds(newLeft){
		var respectingOtherSlider = newLeft > (onionSliderLeft.offsetLeft + 2);;
		var respectingContainerLeft = newLeft > 0;
		var respectingContainerRight = newLeft < bottomControls.getBoundingClientRect().width + bottomControls.scrollLeft;
		return respectingOtherSlider && respectingContainerLeft && respectingContainerRight;
	}, this.slideSuccessful.bind(this));
	
	onionSliderLeft.style.display = "none";
	onionSliderRight.style.display = "none";
	
	var keyframeBar = bottomControls.appendChild(document.createElement("div"));
	keyframeBar.className = "keyframe-bar";
	
	this.keyframeManager.keyframeBar = keyframeBar;
	this.keyframeManager.onionSliderRight = onionSliderRight;
	this.keyframeManager.onionSliderLeft = onionSliderLeft;
	this.keyframeManager.onionLoop = false;
};
DrawTogether.prototype.onionLoopLastFrame = function onionLoopLastFrame(){
	var anim = this.myAnimations[this.keyframeManager.animationIndex];
	var lastFrame = anim.squares -1;
	var from = [anim.leftTop[0], anim.leftTop[1]];
	
	var step = (anim.sqwidth+anim.gutter) * lastFrame;
	
	var toOffsetX = anim.sqwidth * lastFrame;
	toOffsetX += anim.gutter * lastFrame - 1;
	var to = [anim.leftTop[0] + toOffsetX, anim.leftTop[1] + anim.sqheight];
	//this.paint.frames = [];
	
	this.paint.addFrame(from, to, frames, 0.3, anim.gutter, step, anim.sqwidth);
};
DrawTogether.prototype.slideSuccessful = function slideSuccessful (){
	var keyframes = $(".keyframe-full-keyed");
	var leftSlidersKeyframeIndex = 0;
	var rightSlidersKeyframeIndex = 0;
	for(var i = 0; i < keyframes.length; i++){
		if(keyframes[i].offsetLeft <= this.keyframeManager.onionSliderLeft.offsetLeft) {
			leftSlidersKeyframeIndex = i;
		}
		if(keyframes[i].offsetLeft <= this.keyframeManager.onionSliderRight.offsetLeft) {
			rightSlidersKeyframeIndex = i;
		}
	}
	var frames = rightSlidersKeyframeIndex - leftSlidersKeyframeIndex;
	if(frames <= 0){
		return;
	}
	//console.log(leftSlidersKeyframeIndex, rightSlidersKeyframeIndex)
	
	var anim = this.myAnimations[this.keyframeManager.animationIndex];
	var fromOffsetX = (anim.sqwidth + anim.gutter) * leftSlidersKeyframeIndex;
	
	//fromOffsetX -= anim.gutter * frames;
	//console.log("fromOffsetX",fromOffsetX)
	var from = [anim.leftTop[0] + fromOffsetX, anim.leftTop[1]];
	
	var toOffsetX = anim.sqwidth * rightSlidersKeyframeIndex;
	toOffsetX += anim.gutter * rightSlidersKeyframeIndex - 1;
	
	
	var to = [anim.leftTop[0] + toOffsetX, anim.leftTop[1] + anim.sqheight];
	this.paint.frames = [];
	this.paint.addFrame(from, to, frames, 0.3, anim.gutter, anim.sqwidth+ anim.gutter);
	
	if(this.keyframeManager.onionLoop)
		this.onionLoopLastFrame();
};

DrawTogether.prototype.makeSliderDraggable = function makeSliderDraggable(handleElements, elementToMove, container, step, boundsCheckFunction, successfulDragFunction) {
	//var offset = this.keyframeManager.window.offsetLeft;
	var handler = function handler (handleElement, targetElement){
		if (!handleElement) handleElement = targetElement;

		var startPos = [];
		var elementStartPos = [];
		var dragging = false;

		function handleStart (event) {
			dragging = true;
			var offset = this.keyframeManager.window.offsetLeft - $(".keyframe-bottom-control-container")[0].scrollLeft;
			
			startPos = [event.clientX || 0, event.clientY || 0];
			
			if (event.changedTouches && event.changedTouches[0])
				startPos = [event.changedTouches[0].clientX - offset || 0,
							event.changedTouches[0].clientY || 0]

			var boundingRect = targetElement.getBoundingClientRect();
			elementStartPos = [boundingRect.left, boundingRect.top];

			event.preventDefault();
		}

		function handleMove (event) {
			if (dragging) {
				var offset = this.keyframeManager.window.offsetLeft - $(".keyframe-bottom-control-container")[0].scrollLeft;
				if(step)
					var stepWidth = $(".keyframe-labelbar")[0].getBoundingClientRect().width
				//targetElement.style.left = elementStartPos[0] - startPos[0] + (event.clientX - offset || event.changedTouches[0].clientX  - offset) + "px";
				var newLeft = elementStartPos[0] - startPos[0] + (event.clientX || event.changedTouches[0].clientX ) - offset;
				newLeft -= newLeft % stepWidth; //snap
				newLeft -= 2;
				if(boundsCheckFunction(newLeft)){
					targetElement.style.left = newLeft + "px";
					successfulDragFunction();
				}
				//targetElement.style.top = elementStartPos[1] - startPos[1] + (event.clientY || event.changedTouches[0].clientY) + "px";
				event.preventDefault();
			}
		}

		handleElement.addEventListener("mousedown", handleStart.bind(this));
		handleElement.addEventListener("touchstart", handleStart.bind(this));

		document.addEventListener("mousemove", handleMove.bind(this));
		document.addEventListener("touchmove", handleMove.bind(this));

		function endDrag () {
			dragging = false;
			
		}
		handleElement.addEventListener("mouseup", endDrag);
		handleElement.addEventListener("touchend", endDrag);
		container.addEventListener("mouseup", endDrag);
		container.addEventListener("touchend", endDrag);
	}.bind(this);
	for(var i = 0; i < handleElements.length; i++){
		handler(handleElements[i], elementToMove);
	}
	
};

DrawTogether.prototype.addRemoveBufferFrames = function addRemoveBufferFrames(operation) {
	var fullFrames = $(this.keyframeManager.keyframeBar).children(".keyframe-full");
	var valueToAdd = 1;
	if(operation == "remove")
		valueToAdd = -1;
	//check for selectedIndexes
	var trueIndex = 0; // only count keyframes not buffers
	
	var selectedIndexes = new Array(this.myAnimations[this.keyframeManager.animationIndex].squares);
	for(var i = 0; i < fullFrames.length; i++){
		if(fullFrames[i].classList.contains("keyframe-full-keyed"))
			if(i != 0)
				trueIndex++;
		if(fullFrames[i].classList.contains("keyframe-selected")){
			if(typeof selectedIndexes[trueIndex] != "number")
				selectedIndexes[trueIndex] = 0;
			selectedIndexes[trueIndex]++;
			
			var bufferFramesAmt = this.myAnimations[this.keyframeManager.animationIndex].bufferFrames[trueIndex];
			

			if(isNaN(parseFloat(bufferFramesAmt))){
				bufferFramesAmt = 0;
				this.myAnimations[this.keyframeManager.animationIndex].bufferFrames[trueIndex] = 0;
			}
			bufferFramesAmt += valueToAdd * selectedIndexes[trueIndex];
			bufferFramesAmt = Math.max(0, bufferFramesAmt);
			this.myAnimations[this.keyframeManager.animationIndex].bufferFrames[trueIndex] = bufferFramesAmt;
			
		}
	}
	this.refreshAnimationManager(selectedIndexes);
};

DrawTogether.prototype.refreshAnimationManager = function refreshAnimationManager(selectedIndexes){
	$(".keyframe-unit").removeClass("keyframe-selected");
	this.openKeyframeManager(this.myAnimations[this.keyframeManager.animationIndex],this.keyframeManager.animationIndex);
	for(var i = 0; i < selectedIndexes.length; i++)
	{
		if(selectedIndexes[i] > 0)
			$(".keyframe-full-keyed").eq(i).addClass("keyframe-selected")
	}
	this.updateAnimationsCookieDelay();
}

DrawTogether.prototype.animationRemoveHandler = function animationRemoveHandler (myAnimation, button, event) {
	if (button.classList.contains("confirm")) {
		for (var k = 0; k < this.myAnimations.length; k++) {
			if (this.myAnimations[k] == myAnimation) {
				this.myAnimations.splice(k, 1);
				this.updateAnimationsCookie();
				this.updateAnimationManager();
				return;
			}
		}
	} else {
		button.classList.add("confirm");
		
		setTimeout(function () {
			button.classList.remove("confirm");
		}, 3000);
	}
};

DrawTogether.prototype.buildAnimationRemoveButton = function buildAnimationRemoveButton(myAnimation) {
	var button = document.createElement("div");
	button.classList.add("coords-button");

	var image = document.createElement("img");
	image.src = "images/icons/remove.png";
	button.appendChild(image);

	button.addEventListener("click", this.animationRemoveHandler.bind(this, myAnimation, button));
	return button;
};

DrawTogether.prototype.animationGotoHandler = function animationGotoHandler (myAnimation, event) {
	this.handleGoto(myAnimation.leftTop[0], myAnimation.leftTop[1]);
};

DrawTogether.prototype.toggleAnimationManager = function toggleAnimationManager () {
	if (this.animationsWindow.classList.contains("show")) {
		this.animationsWindow.classList.remove("show");
	} else {
		this.animationsWindow.classList.add("show");
		$(".regions-window").hide();
		$(".favorites-window").hide();
		this.updateAnimationManager();
	}
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
	if (this.current_room.indexOf("private_") !== 0 && this.current_room.indexOf("game_") !== 0
		&& (this.reputation || 0) < this.IGNORE_INK_REP && !this.memberlevel) {

		if (!(this.reputation >= this.BIG_BRUSH_MIN_REP) && this.lastPathSize > 20) {
			if (Date.now() - this.lastBrushSizeWarning > 5000) {
				this.chat.addMessage("Brush sizes above 20 and text sizes above 20 require an account with " + this.BIG_BRUSH_MIN_REP + " reputation! Registering is free and easy. You don't even need to confirm your email!");
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
	
	this.network.socket.emit("pp", event.point, timeoutCallback(function (success, timeOut) {


		if (typeof success === 'boolean' ? !success : !success.isAllowed){ 
			event.removePathPoint();

			if(typeof success.isAllowed !== 'undefined'){
				this.createPermissionChatMessageWithTimeout(success);
				this.outlineProtectedRegion(success, true);
				this.createRegionProtectedWindow();
			} else if (typeof success.inSpawnArea !== 'undefined') {
				this.createRegionProtectedWindow();
			}
			
			if(typeof timeOut !== 'undefined' && timeOut){
				var curr_time = Date.now();
				if(curr_time - this.lastTimeoutError > this.TIME_BETWEEN_TIMEOUT_WARNINGS){
					this.chat.addMessage("The server took longer than " + Math.round(this.SOCKET_TIMEOUT / 1000) + " seconds to respond. You should probably refresh your page.");
					this.lastTimeoutError = curr_time;
				}
			}
		}
	}.bind(this), this.SOCKET_TIMEOUT, this, [false, true]));//[,,]=[success,timeOut]

	this.lastPathPoint = event.point;
};

DrawTogether.prototype.handlePaintSelection = function handlePaintSelection (event) {
	this.gui.prompt("What do you want to do with your selection?", [
		{
			text: "Share to feed",
			icon: "images/icons/selectwindow/share.png"
		},
		{
			text: "Export video/gif",
			icon: "images/icons/selectwindow/video.png"
		},
		{
			text: "Create protected region",
			icon: "images/icons/selectwindow/region.png"
		},
		{
			text: "Create button",
			icon: "images/icons/selectwindow/clickable.png"
		},
		{
			text: "Inspect tool",
			icon: "images/icons/selectwindow/inspect.png"
		},
		{
			text: "Create grid",
			icon: "images/icons/selectwindow/grid.png"
		},
		{
			text: "Show video frames",
			icon: "images/icons/selectwindow/frames.png"
		},
		{
			text: "Enter the contest",
			icon: "images/icons/selectwindow/contest.png"
		},
		{
			text: "Cancel",
			icon: "images/icons/selectwindow/cancel.png"
		},
	], function (answer) {
		if (answer === "Cancel") return;

		var handlers = {
			"Share to feed": this.exportImage.bind(this),
			"Export video/gif": this.exportVideo.bind(this),
			"Create protected region": this.createProtectedRegion.bind(this),
			"Inspect tool": this.whoDrewInThisArea.bind(this),
			"Show video frames": this.showVideoFrames.bind(this),
			"Create grid": this.createGridInSelection.bind(this),
			"Enter the contest": this.enterTheContest.bind(this),
			"Create button": this.createClickableArea.bind(this)
		};

		handlers[answer](event.from, event.to);
	}.bind(this));
};

DrawTogether.prototype.createClickableArea = function createClickableArea (from, to) {
	this.gui.prompt("Where should this button take you?", ["A website", "A location on the canvas", "Cancel"], function (type) {
		if (type == "Cancel") return;
		var question = "Enter the coords (for example: 500,600)";
		if (type == "A website") question = "Enter the url, start with http(s)://";
		
		this.gui.prompt(question, ["freepick", "Cancel"], function (url) {
			if (url == "Cancel") return;
			
			if (!url) {
				this.gui.prompt("You need or provide a url or a location", ["Ok"]);
				return;
			}
			
			var pos = [
				Math.min(from[0], to[0]),
				Math.min(from[1], to[1])
			];
			
			var size = [
				Math.max(from[0], to[0]) - pos[0],
				Math.max(from[1], to[1]) - pos[1]
			];
			
			this.network.socket.emit("createclickablearea", from, size, url, function (err, data) {
				if (err) {
					this.gui.prompt(err, ["Ok"]);
				}
			}.bind(this));
		}.bind(this));		
	}.bind(this));
};

DrawTogether.prototype.showVideoFrames = function showVideoFrames (from, to) {
	var generationSettings = QuickSettings.create(50, 50, "Frame settings");
	generationSettings.addControl({
		type: "range",
		title: "Frames",
		min: 1,
		max: 50,
		value: 5,
		step: 1
	});
	
	generationSettings.addControl({
		type: "range",
		title: "Opacity",
		min: 0,
		max: 1,
		value: 0.5,
		step: 0.05
	});
	
	generationSettings.addButton("Show", function () {
		var frames = generationSettings.getRangeValue("Frames");
		var opacity = generationSettings.getRangeValue("Opacity");
		this.paint.addFrame(from, to, frames, opacity);
		this.updateFramesManager();
		generationSettings._panel.parentNode.removeChild(generationSettings._panel);
	}.bind(this));
	
	generationSettings.addButton("Cancel", function () {
		generationSettings._panel.parentNode.removeChild(generationSettings._panel);
	});
};

// Send null for unchanging value
DrawTogether.prototype.updateIndividualFavoriteDom = function updateIndividualFavoriteDom(newX, newY, newName, newOwner, element) {
	if(newX !== null)
		element.dataset.x = newX;
	if(newY !== null)
		element.dataset.y = newY;
	if(newName !== null)
		element.dataset.name = newName;
	if(newOwner !== null)
		element.dataset.owner = newOwner;
	
	var coordinateButton = element.getElementsByClassName("fav-coor-button")[0];
	var inputRename = element.getElementsByClassName("rename-input")[0];
	if ( (newName || element.dataset.name) === ""){
		inputRename.value = "";
		coordinateButton.textContent = (newX || element.dataset.x) + "," + (newY || element.dataset.y);
		coordinateButton.title = "";
	} else {
		inputRename.value = (newName || element.dataset.name);
		coordinateButton.textContent = (newName || element.dataset.name);
		coordinateButton.title = (newX || element.dataset.x) + "," + (newY || element.dataset.y);
	}
};

DrawTogether.prototype.createFavoriteDeleteButton = function createFavoriteDeleteButton () {
	var favoriteMinusButton = document.createElement("div");
	favoriteMinusButton.className = "coords-button fav-delete-button";
	favoriteMinusButton.textContent = "X";
	favoriteMinusButton.addEventListener("click", function (e) {
		var element = e.srcElement || e.target;
		if(element.classList.contains("fav-button-confirmation")){
			var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
			coord.dataset.tempConf = coord.innerHTML;
			element.classList.remove("fav-button-confirmation");
			
			var curFavContainer = element.parentNode;
			
			var x = curFavContainer.dataset.x;
			var y = curFavContainer.dataset.y;
			var name = curFavContainer.dataset.name;
			this.removeFavorite(x, y, name, curFavContainer);			
		}
		else {
			var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
			coord.dataset.tempConf = coord.innerHTML;
			coord.innerHTML = "Click again to delete";
			element.classList.add("fav-button-confirmation");
			setTimeout(function() {
				var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
				coord.innerHTML = coord.dataset.tempConf;
				element.classList.remove("fav-button-confirmation");
			}.bind(this), 4000);
		}
	}.bind(this));

	return favoriteMinusButton;
};

DrawTogether.prototype.createSetPositionButton = function createSetPositionButton () {
	var favoritePlusButton = document.createElement("div");
	favoritePlusButton.className = "coords-button fav-move-button";
	favoritePlusButton.textContent = "Set pos";
	
	favoritePlusButton.addEventListener("click", function (e) {
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
		                  this.paint.public.canvas.height / this.paint.public.zoom];

		var element = e.srcElement || e.target;
		var x = element.parentNode.dataset.x;
		var y = element.parentNode.dataset.y;
		var name = element.parentNode.dataset.name;
		var centerX = parseInt(this.paint.public.leftTopX + screenSize[0] / 2);
		var centerY = parseInt(this.paint.public.leftTopY + screenSize[1] / 2);   

		if(element.classList.contains("fav-button-confirmation")){
			var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
			coord.innerHTML = coord.dataset.tempConf;
			coord.dataset.tempConf = "5215random_string_tempconf5152";
			element.classList.remove("fav-button-confirmation");

			this.setCoordFavorite(centerX, centerY, x, y, name, element.parentNode);
		} else {
			var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
			coord.dataset.tempConf = coord.innerHTML;
			coord.innerHTML = "Change to " + centerX + "," + centerY + "?";
			element.classList.add("fav-button-confirmation");
			setTimeout(function() {
				var coord = element.parentNode.getElementsByClassName("fav-coor-button")[0];
				if(coord.dataset.tempConf !== "5215random_string_tempconf5152")
					coord.innerHTML = coord.dataset.tempConf;
				element.classList.remove("fav-button-confirmation");
			}.bind(this), 2000);
		}
	}.bind(this));

	favoritePlusButton.addEventListener("mouseover", function (e) {
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
		                  this.paint.public.canvas.height / this.paint.public.zoom];
		var element = e.srcElement || e.target;
		var centerX = parseInt(this.paint.public.leftTopX + screenSize[0] / 2);
		var centerY = parseInt(this.paint.public.leftTopY + screenSize[1] / 2);                   
		element.title = "Change to " + centerX + "," + centerY + " ?";
	}.bind(this));

	return favoritePlusButton;
};

DrawTogether.prototype.insertOneFavorite = function insertOneFavorite(x, y, name, owner) {
	var favoriteContainer = this.favoritesContainer.appendChild(document.createElement("div"));
	favoriteContainer.className = "favorite-container";
	favoriteContainer.dataset.x = x;
	favoriteContainer.dataset.y = y;
	favoriteContainer.dataset.name = name;
	favoriteContainer.dataset.owner = owner;

	var favoriteCoorButton = favoriteContainer.appendChild(document.createElement("div"));
	favoriteCoorButton.className = "coords-button fav-coor-button";
	favoriteCoorButton.addEventListener("click", function (e) {
		var element = e.srcElement || e.target;
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
		                  this.paint.public.canvas.height / this.paint.public.zoom];

		var x = parseInt(element.parentNode.dataset.x - screenSize[0] / 2);
		var y = parseInt(element.parentNode.dataset.y - screenSize[1] / 2);

		this.moveScreenToPosition([x,y],0);
	}.bind(this));
	
	var favoritePencilButton = favoriteContainer.appendChild(document.createElement("div"));
	favoritePencilButton.className = "coords-button fav-pencil-button";
	favoritePencilButton.textContent = "✎";
	
	var favoriteRenameContainer = favoriteContainer.appendChild(document.createElement("div"));
	favoriteRenameContainer.className = "rename-container";
	
	var favoriteRenameInput = favoriteRenameContainer.appendChild(document.createElement("input"));
	favoriteRenameInput.className = "rename-input";
	favoriteRenameInput.type = "text";
	favoriteRenameInput.placeholder = "Rename"
	
	var _favoriteRenameDelayTimeout;
	favoriteRenameInput.addEventListener("input", function (e) {
		var element = e.srcElement || e.target;
		if(_favoriteRenameDelayTimeout !== undefined)
			clearTimeout(_favoriteRenameDelayTimeout);
		_favoriteRenameDelayTimeout = setTimeout(function () {
			var newName = element.value;
			var curFavContainer = favoriteContainer;
			var x = curFavContainer.dataset.x;
			var y = curFavContainer.dataset.y;

			favoriteRenameContainer.style.visibility = "";
			favoriteRenameContainer.style.opacity = 0;

			this.renameFavorite(x, y, newName, curFavContainer);
		}.bind(this), 2500);
	}.bind(this));

	favoritePencilButton.addEventListener("click", function (e) {
		if (favoriteRenameContainer.style.visibility == "visible") {
			favoriteRenameContainer.style.visibility = "";
			favoriteRenameContainer.style.opacity = 0;
			var element = e.srcElement || e.target;
			var associatedInputBox = element.parentNode.getElementsByClassName("rename-input")[0];
			var newName = associatedInputBox.value;
			var curFavContainer = favoriteContainer;
			clearTimeout(_favoriteRenameDelayTimeout);
			this.renameFavorite(x, y, newName, curFavContainer);
		} else {
			favoriteRenameContainer.style.visibility = "visible";
			favoriteRenameContainer.style.opacity = 1;
			favoriteRenameInput.focus();
			favoriteRenameInput.select();
			favoriteRenameInput.setSelectionRange(0, favoriteRenameInput.value.length);
		}
	}.bind(this));
	
	if(name.length > 0){ 
		favoriteCoorButton.textContent = name;
		favoriteCoorButton.title = x + "," + y;
		favoriteRenameInput.value = name;
	} else {
		favoriteCoorButton.textContent = x + "," + y;
	}


	favoriteContainer.appendChild(this.createSetPositionButton());
	favoriteContainer.appendChild(this.createFavoriteDeleteButton());
};

DrawTogether.prototype.insertOneRegionToDom = function insertOneRegionToDom(owner, name, permissions, minX, minY, maxX, maxY, index) {
	var regionContainer = this.regionsContainer.appendChild(document.createElement("div"));
	regionContainer.className = "region-container";
	regionContainer.dataset.minX = minX;
	regionContainer.dataset.minY = minY;
	regionContainer.dataset.maxX = maxX;
	regionContainer.dataset.maxY = maxY;
	regionContainer.dataset.owner = owner;
	regionContainer.dataset.name = name;
	regionContainer.dataset.index = index;

	var regionPositionButton = regionContainer.appendChild(document.createElement("div"));
	regionPositionButton.className = "coords-button reg-position-button";
	regionPositionButton.textContent = minX + ", " + minY;
	regionPositionButton.addEventListener("click", function (e) {
		var element = e.srcElement || e.target;
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
		                  this.paint.public.canvas.height / this.paint.public.zoom];

		var x = parseInt(minX - screenSize[0] / 2);
		var y = parseInt(minY - screenSize[1] / 2);

		this.moveScreenToPosition([x,y],0);
	
	}.bind(this));	
	
	
	regionPositionButton.addEventListener("mouseover", function (e) {
		var region = {
			minX: minX,
			minY: minY,
			maxX: maxX,
			maxY: maxY
		};
		this.outlineProtectedRegion(region);
	
	}.bind(this));
	
	var regionRenameContainer = regionContainer.appendChild(document.createElement("div"));
	regionRenameContainer.className = "rename-container";
	
	var regionRenameInput = regionRenameContainer.appendChild(document.createElement("input"));
	regionRenameInput.className = "rename-input";
	regionRenameInput.type = "text";
	regionRenameInput.placeholder = "Rename"
	
	var regionPencilButton = regionContainer.appendChild(document.createElement("div"));
	regionPencilButton.className = "coords-button reg-pencil-button";
	regionPencilButton.textContent = "✎";
	
	if(name.length > 0){ 
		regionPositionButton.textContent = name;
		regionPositionButton.title = minX + ", " + minY;
		regionRenameInput.value = name;
	} else {
		regionPositionButton.textContent = minX + ", " + minY;
	}
	
	var _regionRenameDelayTimeout;
	regionRenameInput.addEventListener("input", function (e) {
		var element = e.srcElement || e.target;
		if(_regionRenameDelayTimeout !== undefined)
			clearTimeout(_regionRenameDelayTimeout);
		_regionRenameDelayTimeout = setTimeout(function () {
			var newName = element.value;
			var curRegContainer = regionContainer;
			var index = curRegContainer.dataset.index;
			var regionId = this.myRegions[index].regionId;

			regionRenameContainer.style.visibility = "";
			regionRenameContainer.style.opacity = 0;
			
			this.setNameOfProtectedRegion(newName, regionId, curRegContainer);
		}.bind(this), 2500);
	}.bind(this));
	
	regionPencilButton.addEventListener("click", function (e) {
		if (regionRenameContainer.style.visibility == "visible") {
			regionRenameContainer.style.visibility = "";
			regionRenameContainer.style.opacity = 0;
			var element = e.srcElement || e.target;
			var associatedInputBox = element.parentNode.getElementsByClassName("rename-input")[0];
			var newName = associatedInputBox.value;
			var curRegContainer = regionContainer;
			var regionId = this.myRegions[index].regionId;
			
			clearTimeout(_regionRenameDelayTimeout);
			this.setNameOfProtectedRegion(newName, regionId, curRegContainer);
		} else {
			regionRenameContainer.style.visibility = "visible";
			regionRenameContainer.style.opacity = 1;
			regionRenameInput.focus();
			regionRenameInput.select();
			regionRenameInput.setSelectionRange(0, regionRenameInput.value.length);
		}
		
	}.bind(this));

	var regionEditPermissionsButton = regionContainer.appendChild(document.createElement("div"));
	regionEditPermissionsButton.className = "coords-button reg-editpermissions-button";
	//regionEditPermissionsButton.textContent = "Permissions...";
	regionEditPermissionsButton.addEventListener("click", function (e) {
		var regionListIndex = regionEditPermissionsButton.parentNode.dataset.index;

		if(regionListIndex){
			if(typeof this.regionPermissionsWindow === "undefined")
				this.createRegionPermissionsWindow(regionListIndex);
			else
				this.regionPermissionsWindow.regionIndex = regionListIndex;
			this.regionPermissionsWindow.reload();
			this.regionPermissionsWindow.show();
		}
	
	}.bind(this));
	var permissionCounter = regionEditPermissionsButton.appendChild(document.createElement("div"));
	
	if(permissions.length > 0){
		permissionCounter.className = "reg-editpermissions-button-counter";
		permissionCounter.textContent = '\uD83D\uDC64' + permissions.length.toString(); //👤 BUST IN SILHOUETTE symbol
	}
	else if(this.myRegions[index].minRepAllowed < 300){
		permissionCounter.className = "reg-editpermissions-button-counter";
		permissionCounter.textContent = this.myRegions[index].minRepAllowed + 'R+';
	}

	var permissionsButtonImage = regionEditPermissionsButton.appendChild(document.createElement("img"));
	permissionsButtonImage.src = "images/icons/permission.png";
	permissionsButtonImage.alt = "Open Permissions Menu";
	permissionsButtonImage.title = "Open Permissions Menu";

	var regionDeleteButton = regionContainer.appendChild(document.createElement("div"));
	regionDeleteButton.className = "coords-button reg-delete-button";
	regionDeleteButton.textContent = "X";
	regionDeleteButton.addEventListener("click", function (e) {
		var element = e.srcElement || e.target;
		var regionListIndex = element.parentNode.dataset.index;

		if(element.classList.contains("reg-button-confirmation")){
			element.classList.remove("reg-button-confirmation");
			this.removeProtectedRegion(this.myRegions[regionListIndex].regionId, element.parentNode);		
		}
		else {
			var coord = element.parentNode.getElementsByClassName("reg-position-button")[0];
			coord.dataset.tempConf = coord.innerHTML;
			coord.innerHTML = "Click again to delete";
			element.classList.add("reg-button-confirmation");
			setTimeout(function() {
				var coord = element.parentNode.getElementsByClassName("reg-position-button")[0];
				coord.innerHTML = coord.dataset.tempConf;
				element.classList.remove("reg-button-confirmation");
			}.bind(this), 4000);
		}
	
	}.bind(this));
};

DrawTogether.prototype.permissionWindowVisibilityDom = function permissionWindowVisibilityDom(makeVisible){
	if(this.regionPermissionsWindow){
		if(makeVisible)
			this.regionPermissionsWindow.show();
		else 
			this.regionPermissionsWindow.hide();
	}
};

DrawTogether.prototype.displayRegionTutorial = function displayRegionTutorial(makeVisible){
	if(makeVisible)
		this.regionTutorialContainer.style.display = "block";
	else
		this.regionTutorialContainer.style.display = "none";
};

DrawTogether.prototype.createRegionTutorialDom = function createRegionTutorialDom() {
	this.regionTutorialContainer.appendChild(document.createTextNode("You currently have no regions. If you wish to create one, select the "));
	var permissionsButtonImage = this.regionTutorialContainer.appendChild(document.createElement("img"));
	permissionsButtonImage.src = "images/icons/select.png";
	permissionsButtonImage.alt = "Example select button";
	permissionsButtonImage.title = "Example select button";

	this.regionTutorialContainer.appendChild(document.createTextNode(" tool on the top of your screen. You can make one region at 30+ rep or unlimited with premium."));
};

DrawTogether.prototype.updateRegionsDom = function updateRegionsDom() {
	while (this.regionsContainer.firstChild)
		this.regionsContainer.removeChild(this.regionsContainer.firstChild)

	this.displayRegionTutorial(this.myRegions.length === 0);

	for(var k = this.myRegions.length - 1; k >= 0; k--) {
		this.insertOneRegionToDom(this.myRegions[k]['owner'], this.myRegions[k]['name'], this.myRegions[k]['permissions'], this.myRegions[k]['minX'], this.myRegions[k]['minY'], this.myRegions[k]['maxX'], this.myRegions[k]['maxY'], k);
	}

};

DrawTogether.prototype.updateFavoriteDom = function updateFavoriteDom() {
	while (this.favoritesContainer.firstChild)
		this.favoritesContainer.removeChild(this.favoritesContainer.firstChild)
	
	var addNewFavoriteElementButton = this.favoritesContainer.appendChild(document.createElement("div"));
	addNewFavoriteElementButton.className = "coords-button fav-add-new-fav";
	addNewFavoriteElementButton.textContent = "Add location";
	addNewFavoriteElementButton.title = "Add new Favorite."
	addNewFavoriteElementButton.addEventListener("click", function (e) {
		var screenSize = [this.paint.public.canvas.width / this.paint.public.zoom,
		                  this.paint.public.canvas.height / this.paint.public.zoom];

		var centerX = parseInt(this.paint.public.leftTopX + screenSize[0] / 2);
		var centerY = parseInt(this.paint.public.leftTopY + screenSize[1] / 2); 

		this.createFavorite(centerX, centerY, "");
	
	}.bind(this));
	for(var k = this.favList.length - 1; k >= 0; k--) {
		this.insertOneFavorite(this.favList[k]['x'], this.favList[k]['y'], this.favList[k]['name'], this.favList[k]['owner'])
	}
};

DrawTogether.prototype.setCoordFavorite = function (newX, newY, x, y, name, element) {
	this.account.setCoordFavorite(newX, newY, x, y, name, this.current_room, function (err, result) {
		if (err) {
			this.chat.addMessage("Changing coordinate of Favorite", "Error: " + err);
			return;
		}

		if (result.success) {
			this.updateIndividualFavoriteDom(newX, newY, null, null, element);
			this.getFavorites();
		}
	}.bind(this));
};

DrawTogether.prototype.removeFavorite = function (x, y, name, element) {
	this.account.removeFavorite(x, y, name, this.current_room, function (err, result) {
		if (err) {
			this.chat.addMessage("Removing Favorite", "Error: " + err);
			return;
		}
		if(result.success){
			element.remove();
			this.getFavorites();
			}
		return;
	}.bind(this));
};
DrawTogether.prototype.renameFavorite = function (x, y, name, element) {
	this.account.renameFavorite(x, y, name, this.current_room, function (err, result) {
		if (err) {
			this.chat.addMessage("Renaming Favorite", "Error: " + err);
			return;
		}

		if(result.success) {
			this.updateIndividualFavoriteDom(null, null, name, null, element);
			this.getFavorites();
		}
	}.bind(this));
};

DrawTogether.prototype.getFavorites = function () {
	this.account.getFavorites(this.current_room, function (err, result) {
		if (err) {
			this.chat.addMessage("Getting Favorites", "Error: " + err);
			return;
		}
		if(result){
			// sort favorites alphabetically
			this.favList = result.sort(function sortMyFavorites(a, b){ 
				if(a.name.toUpperCase() < b.name.toUpperCase()) return 1;
				if(a.name.toUpperCase() > b.name.toUpperCase()) return -1;
				return 0;
			});
		}
		else
			this.favList = [];
	}.bind(this));
};

DrawTogether.prototype.createFavorite = function (x, y, name) {
	if (!this.account.uKey){
		this.chat.addMessage("You must login to save or create favorites!");
		return;
	}
		
	if (!this.memberlevel && this.favList.length >= 5) {
		this.chat.addMessage("Buy premium to create more than 5 favorite locations.");
		return;
	}

	this.account.createFavorite(x, y, name, this.current_room, function (err, result) {
		if (err) {
			this.chat.addMessage("Favorite", "Error: " + err);
			return;
		}
		
		if (result.success) {
			this.chat.addMessage("Favorite added", result.success);
			this.insertOneFavorite(x, y, name, result.owner);
			this.getFavorites();
		}
	}.bind(this));
};

DrawTogether.prototype.whoDrewInThisArea = function (from, to) {
	var minX = Math.min(from[0], to[0]);
	var minY = Math.min(from[1], to[1]);
	var maxX = Math.max(from[0], to[0]);
	var maxY = Math.max(from[1], to[1]);

	var peopleWhoDrewInTheAreaHash = new Object();
	peopleWhoDrewInTheAreaHash.length = 0;
	for(var i = this.paint.publicdrawings.length - 1; i >= 0; i--) {
		var socketid = this.paint.publicdrawings[i].id || this.paint.publicdrawings[i].socketid;

		if(peopleWhoDrewInTheAreaHash[socketid]) continue; //already found user in region
		
		if(!this.paint.publicdrawings[i].points) {
			if(this.paint.publicdrawings[i].type === 'line') {
				if (( this.paint.publicdrawings[i].x >= minX
					&& this.paint.publicdrawings[i].x <= maxX
					&& this.paint.publicdrawings[i].y >= minY
					&& this.paint.publicdrawings[i].y <= maxY )
					|| 
					( this.paint.publicdrawings[i].x1 >= minX
					&& this.paint.publicdrawings[i].x1 <= maxX
					&& this.paint.publicdrawings[i].y1 >= minY
					&& this.paint.publicdrawings[i].y1 <= maxY )) {
						var player = this.playerFromId(socketid);
						peopleWhoDrewInTheAreaHash[socketid] = true;
						peopleWhoDrewInTheAreaHash.length++;
						if(player){
							this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(player));
						}
						else{
							this.network.socket.emit("playerfromsocketid", socketid, function (result) {
								if (result.error) {
									this.chat.addMessage("Inspect tool", "Error: " + result.error);
									return;
								}
								this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(result));
							}.bind(this));
						}
					}
				continue;
			} 
			else if(this.paint.publicdrawings[i].type === 'text') {
				if (( this.paint.publicdrawings[i].x >= minX
					&& this.paint.publicdrawings[i].x <= maxX
					&& this.paint.publicdrawings[i].y >= minY
					&& this.paint.publicdrawings[i].y <= maxY )
					|| 
					( this.paint.publicdrawings[i].x1 >= minX
					&& this.paint.publicdrawings[i].x1 <= maxX
					&& this.paint.publicdrawings[i].y + this.paint.publicdrawings[i].size >= minY
					&& this.paint.publicdrawings[i].y + this.paint.publicdrawings[i].size <= maxY )) {
						var player = this.playerFromId(socketid);
							peopleWhoDrewInTheAreaHash[socketid] = true;
							peopleWhoDrewInTheAreaHash.length++;
							if(player){
								this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(player));
							}
							else{
								this.network.socket.emit("playerfromsocketid", socketid, function (result) {
									if (result.error) {
										this.chat.addMessage("Inspect tool", "Error: " + result.error);
										return;
									}
									this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(result));
								}.bind(this));
							}
				}
				continue;
			}
			
		}
		
		

		var pointsamt = this.paint.publicdrawings[i].points.length || 0;
		
		//var checkEveryX = Math.round(pointsamt / 5);

		for (var k = pointsamt - 1; k >= 0; k--){//i -= checkEveryX){
			if (this.paint.publicdrawings[i].points[k][0] >= minX
				&& this.paint.publicdrawings[i].points[k][0] <= maxX
				&& this.paint.publicdrawings[i].points[k][1] >= minY
				&& this.paint.publicdrawings[i].points[k][1] <= maxY) {
					var player = this.playerFromId(socketid);
					peopleWhoDrewInTheAreaHash[socketid] = true;
					peopleWhoDrewInTheAreaHash.length++;
					if(player){
						this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(player));
					}
					else{
						this.network.socket.emit("playerfromsocketid", socketid, function (result) {
							if (result.error) {
								this.chat.addMessage("Inspect tool", "Error: " + result.error);
								return;
							}
							this.chat.addElementAsMessage(this.createPlayerDrewInAreaDom(result));
						}.bind(this));
					}
					break;
			}
		}
	}

	if(peopleWhoDrewInTheAreaHash.length === 0) {
		this.chat.addMessage("Inspect tool", "No recently drawn lines found in this area.");
	}
};

DrawTogether.prototype.createProtectedRegion = function (from, to) {
	if (!this.account.uKey) { 
		this.chat.addMessage("You must be logged in to create protected regions.");
		return;
	}
	var regionCount = this.myRegions.length || 0;

	if (!this.memberlevel) {
		if (this.reputation < this.REGION_MIN_REP) {
			
			this.chat.addMessage("You must have at least "+ this.REGION_MIN_REP +" rep!");
			return;
		}
		if (typeof this.myRegions !== 'undefined' && typeof this.myRegions.length === 'number') {
			if (this.myRegions.length > 1) {
				this.chat.addMessage("Having more than one region is premium only!");
				return;
			}
		}
	}

	this.network.socket.emit("createprotectedregion", from, to, function (err, result) {
		if (err) {
			this.chat.addMessage("Regions", "Error: " + err);
			return;
		}

		if (result.success) {
			setTimeout(this.getMyProtectedRegions.bind(this), 2000);
			this.chat.addMessage("Regions", result.success);
		}
	}.bind(this));
};

DrawTogether.prototype.resetProtectedRegions = function () {
	this.permissionWindowVisibilityDom(false);

	this.network.socket.emit("resetprotectedregions", function (err, result) {
		if (err) {
			this.chat.addMessage("Regions", "Reset Error: " + err);
			return;
		}
		this.getMyProtectedRegions();
		this.chat.addMessage("Regions", "Reset your regions");
	}.bind(this));
};

DrawTogether.prototype.removeProtectedRegion = function (regionId, element, override) {
	this.permissionWindowVisibilityDom(false);

	this.network.socket.emit("removeprotectedregion", regionId, override, function (err, result) {
		if (err) {
			this.chat.addMessage("Regions", "Reset Error: " + err);
			return;
		}
		if(element){
			if($('.region-container').length <= 1){
				this.displayRegionTutorial(true);
			}
			element.style.display = "none";
			element.parentNode.removeChild(element);
		}

		setTimeout(this.getMyProtectedRegions.bind(this), 2000);
		this.chat.addMessage("Regions", "Removed the region");
	}.bind(this));
};

DrawTogether.prototype.getMyProtectedRegions = function (callback) {
	if (!this.network.socket) {
		console.log("Network socket was not defined.");
		return;
	}
	this.network.socket.emit("getmyprotectedregions", function (err, result) {
		if (err) {
			this.chat.addMessage("Getting Protected Regions", "Error: " + err);
		}
		if(result){
			this.myRegions = result.sort(function sortMyRegionsById(a, b){
				return b.regionId - a.regionId;
			});
		}
		else
			this.myRegions = [];

		if(typeof callback == "function")
			callback();
		this.updateRegionsDom();
	}.bind(this));
};

DrawTogether.prototype.addUsersToMyProtectedRegion = function (userIdArr, regionId, callback) {
	this.network.socket.emit("adduserstomyprotectedregion", userIdArr, regionId, function (err, result) {
		if (err) {
			this.chat.addMessage("Adding users to protected region", "Error: " + err);
			return;
		}
		setTimeout(function(){
			this.getMyProtectedRegions(callback);
		}.bind(this), 1000);
		
		this.chat.addMessage("Regions", result.success);
	}.bind(this));
};

DrawTogether.prototype.removeUsersFromMyProtectedRegion = function (userIdArr, regionId, callback) {
	this.network.socket.emit("removeUsersFromMyProtectedRegion", userIdArr, regionId, function (err, result) {
		if (err) {
			this.chat.addMessage("Remove users to protected region", "Error: " + err);
			return;
		}
		setTimeout(function(){
			this.getMyProtectedRegions(callback);
		}.bind(this), 1000);

		this.chat.addMessage("Regions", result.success);
	}.bind(this));
};

DrawTogether.prototype.setNameOfProtectedRegion = function (newName, regionId, curRegContainer) {
	this.network.socket.emit("setnameofprotectedregion", newName, regionId, function (err, result) {
		if (err) {
			this.chat.addMessage("Set minimum rep", "Error: " + err);
			return;
		}
		curRegContainer.dataset.name = newName;
		
		var coordinateButton = curRegContainer.getElementsByClassName("reg-position-button")[0];
		var inputRename = curRegContainer.getElementsByClassName("rename-input")[0];
		inputRename.value = newName;
		coordinateButton.textContent = newName;
		
		setTimeout(function(){
			this.getMyProtectedRegions();
		}.bind(this), 1000);

		this.chat.addMessage("Regions", result.success);
	}.bind(this));
};

DrawTogether.prototype.setMinimumRepInProtectedRegion = function (repAmount, regionId) {
	this.network.socket.emit("setminimumrepinprotectedregion", repAmount, regionId, function (err, result) {
		if (err) {
			this.chat.addMessage("Set minimum rep", "Error: " + err);
			return;
		}
		setTimeout(function(){
			this.getMyProtectedRegions();
		}.bind(this), 1000);

		this.chat.addMessage("Regions", result.success);
	}.bind(this));
};

DrawTogether.prototype.enterTheContest = function (from, to) {
	var img = document.createElement("img");
	var imageBase64 = this.paint.exportImage(from, to);
	img.src = imageBase64;
	img.alt = "Exported image";
	
	ga("send", "event", "openwindow", "enterTheContest");
	
	var exportwindow = this.gui.createWindow({ title: "Enter the monthly contest" });
	exportwindow.classList.add("contestwindow");
	
	var content = exportwindow.appendChild(document.createElement("div"));
	content.className = "content";
	
	var imageContainer = content.appendChild(document.createElement("div"));
	imageContainer.className = "imagecontainer";
	imageContainer.appendChild(img);
	
	var form = content.appendChild(document.createElement("div"));
	form.classList.add("form");
	
	var status = form.appendChild(document.createElement("div"));
	status.classList.add("status");
	
	var infoInputs = [];
	for (var k = 0; k < 5; k++) {
		var memberInput = form.appendChild(document.createElement("input"));
		memberInput.placeholder = "Member " + (k + 1);
		
		var socialInput = form.appendChild(document.createElement("input"));
		socialInput.placeholder = "Twitch/FB/profile url";
		
		infoInputs.push({name: memberInput, social: socialInput});
	}
	
	var button = form.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button share-to-feed";
	button.appendChild(document.createTextNode("Enter"));
	
	button.addEventListener("click", function () {
		form.classList.add("disabled");
		var team = [];
		for (var k = 0; k < infoInputs.length; k++) {
			if (!infoInputs[k].name.value && !infoInputs[k].social.value) continue;
			team.push({name: infoInputs[k].name.value, social: infoInputs[k].social.value});
		}
		this.account.enterContest(imageBase64, team, function (err) {
			form.classList.remove("disabled");
			while (status.firstChild) status.removeChild(status.firstChild);
			
			if (err) {
				status.appendChild(document.createTextNode(err));
				status.classList.add("error");
				return;
			}
			
			status.classList.remove("error");
			
			for (var k = 0; k < infoInputs.length; k++) {
				infoInputs[k].name.parentNode.removeChild(infoInputs[k].name);
				infoInputs[k].social.parentNode.removeChild(infoInputs[k].social);
			}
			button.parentNode.removeChild(button);

			status.appendChild(document.createTextNode("Your entry has been registered!"));
		});
	}.bind(this));
};

DrawTogether.prototype.exportImage = function (from, to) {
	var img = document.createElement("img");
	var imageBase64 = this.paint.exportImage(from, to);
	img.src = imageBase64;
	img.alt = "Exported image";
	
	
	ga("send", "event", "openwindow", "exportImageShare");
	
	var exportwindow = this.gui.createWindow({ title: "Share image to feed" });
	exportwindow.classList.add("exportwindow");
	
	var content = exportwindow.appendChild(document.createElement("div"));
	content.className = "content";
	
	var imageContainer = content.appendChild(document.createElement("div"));
	imageContainer.className = "imagecontainer";
	imageContainer.appendChild(img);
	
	var form = content.appendChild(document.createElement("div"));
	form.classList.add("form");
	
	var status = form.appendChild(document.createElement("div"));
	status.classList.add("status");
	
	var textarea = form.appendChild(document.createElement("textarea"));
	textarea.placeholder = "Share your thoughts";
	
	var button = form.appendChild(document.createElement("div"));
	button.classList = "drawtogether-button share-to-feed";
	button.appendChild(document.createTextNode("Post"));
	
	button.addEventListener("click", function () {
		form.classList.add("disabled");
		this.account.sharePicture(imageBase64, textarea.value, function (err) {
			form.classList.remove("disabled");
			while (status.firstChild) status.removeChild(status.firstChild);
			
			if (err) {
				status.appendChild(document.createTextNode(err));
				status.classList.add("error");
				return;
			}
			
			status.classList.remove("error");
			textarea.parentNode.removeChild(textarea);
			button.parentNode.removeChild(button);
			status.appendChild(document.createTextNode("Your image has been posted!"));
		});
	}.bind(this));
};

DrawTogether.prototype.exportImageFromSrc = function (title, src) {
	var img = document.createElement("img");
	img.src = src
	img.alt = "Exported image";
	
	var exportwindow = this.gui.createWindow({ title: title });
	exportwindow.classList.add("exportwindow");
	exportwindow.appendChild(img);
};

DrawTogether.prototype.exportVideoRender = function (fileName, from, to, leftTop, squares, sqwidth, sqheight, gutter, bufferFrames) {
	
	var start = leftTop || [
		Math.min(from[0], to[0]),
		Math.min(from[1], to[1])
	];
	start[0] = Math.floor(start[0]);
	start[1] = Math.floor(start[1]);
	
	var endY = 0;
	if(leftTop)
		endY = leftTop[1] + sqheight;
	else
		endY = Math.max(from[1], to[1]);
	
	endY = Math.ceil(endY);
	
	var exportFuncs = {
			boolean: "getBoolean",
			range: "getRangeValue",
			dropdown: "getDropDownValue"
		};
	
	var captureSettings = {
		name: fileName,
		workersPath: ''
	};
	
	for (var k = 0; k < this.defaultVideoExportSettings.length; k++) {
		var funcName = exportFuncs[this.defaultVideoExportSettings[k].type];
		var value = this.videoExportSettings[funcName](this.defaultVideoExportSettings[k].title)
		if (typeof value == "object") value = value.value;
		captureSettings[this.defaultVideoExportSettings[k].title] = value;
	}
	
	console.log("CaptureSettings:", captureSettings);
	
	var capturer = new CCapture(captureSettings);
	capturer.start();
	
	var frames = squares;
	var gutter = gutter || 0;
	
	var frameWidth = 0;
	if (sqwidth)
		frameWidth = sqwidth
	else
		frameWidth = Math.abs(Math.abs(to[0] - from[0]) - ((frames - 1) * gutter)) / frames;
	
	frameWidth = Math.floor(frameWidth);
	
	for (var k = 0; k < frames; k++) {
		var tempFrom = [
			start[0] + frameWidth * k + k * gutter,
			start[1]
		];
		
		var tempTo = [
			tempFrom[0] + frameWidth,
			endY
		];
		
		if (captureSettings.verbose) {
			console.log("Capturing frame", k + 1, "of", frames, "Region", tempFrom, tempTo);
		}
		capturer.capture(this.paint.exportImage(tempFrom, tempTo, true));
		if(bufferFrames && !isNaN(bufferFrames[k])){
			var bufferFramesAmtAtKeyframe = bufferFrames[k];
			for(var m = 0; m < bufferFramesAmtAtKeyframe; m++){
				capturer.capture(this.paint.exportImage(tempFrom, tempTo, true));
			}
		}
	}

	capturer.stop();
	if(captureSettings.format === "webm") 
		capturer.save(); //directly save webm format
	else
		capturer.save( function( blob ) {
			var exportwindow = this.gui.createWindow({ title: "Exported animation (right click to save)" });

			var img = document.createElement("img");
			img.src = URL.createObjectURL(blob);
			img.alt = "Exported image";
		
			exportwindow.classList.add("exportwindow");
			exportwindow.appendChild(img);
		}.bind(this) );
};

DrawTogether.prototype.renderMyAnimation = function (myAnimation) {
	this.exportVideoRender(
		myAnimation.name || '',
		null, null,
		myAnimation.leftTop,
		myAnimation.squares,
		myAnimation.sqwidth,
		myAnimation.sqheight,
		myAnimation.gutter,
		myAnimation.bufferFrames);
};

DrawTogether.prototype.exportMyAnimation = function (myAnimation, index) {
	this.exportVideo(
		null, null,
		myAnimation.leftTop,
		myAnimation.squares,
		myAnimation.sqwidth,
		myAnimation.sqheight,
		myAnimation.gutter,
		index);
};

DrawTogether.prototype.exportVideo = function (from, to, leftTop, squares, sqwidth, sqheight, gutter, myAnimationIndex) {
	var exportVideoWindow = this.gui.createWindow({ title: "Export to video region: " + JSON.stringify(from) + JSON.stringify(to)});
	
	var settings = QuickSettings.create(0, 0, "Specific settings");
	var title =  "Your title";
	if(typeof myAnimationIndex == "number" && this.myAnimations[myAnimationIndex].name) 
		title = this.myAnimations[myAnimationIndex].name;
	var timeout = null;
	settings.addText("Name", title, function (value){
		if(typeof myAnimationIndex == "number"){
			this.myAnimations[myAnimationIndex].name = value;
			if(timeout)
				clearTimeout(timeout)
			timeout = setTimeout(this.updateAnimationManager.bind(this), 2000);
			this.updateAnimationsCookieDelay();
		}
	}.bind(this));
	settings.addRange("Frames", 1, squares || 200, squares || 10, 1);
	settings.addRange("Gutter", 0, 200, gutter || 0, 1);
	
	if(typeof myAnimationIndex == "number"){
		settings._controls.Frames.container.style.display = "none"
		settings._controls.Gutter.container.style.display = "none"
		var fps = this.myAnimations[myAnimationIndex].fps;
		this.videoExportSettings._controls.framerate.label.textContent = "framerate: " + fps
		this.videoExportSettings._controls.framerate.control.value = fps;
	}
	exportVideoWindow.appendChild(settings._panel);
	
	var container = exportVideoWindow.appendChild(document.createElement("div"))
	container.className = "content";
	
	var renderButton = container.appendChild(document.createElement("div"));
	renderButton.appendChild(document.createTextNode("Render"));
	renderButton.className = "drawtogether-button";
	renderButton.addEventListener("click", function () {
		this.exportVideoRender(settings.getText("Name"), from, to, leftTop, settings.getRangeValue("Frames"), sqwidth, sqheight, settings.getRangeValue("Gutter"), this.myAnimations[myAnimationIndex].bufferFrames);		
	}.bind(this));
	
	var settingsButton = container.appendChild(document.createElement("div"));
	settingsButton.appendChild(document.createTextNode("General export settings"));
	settingsButton.className = "drawtogether-button";
	settingsButton.addEventListener("click", function () {
		this.videoExportSettings.show();
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
	return Math.ceil(size * length / 25);
};

DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
	// If its a brush the ink usage is (size * size)
	// If it is a line the ink usage is (size * length)
	var length = drawing.size;

	if (typeof drawing.x1 == "number")
		length = this.utils.distance(drawing.x, drawing.y, drawing.x1, drawing.y1);

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
	inkContainer.setAttribute("data-intro", "You can only draw if you have ink. You will slowly get more ink. Creating an account gives you more ink.");

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

DrawTogether.prototype.createRegionPermissionsWindow = function createRegionPermissionsWindow (regionIndex) {
	var regionPermissionsWindow = QuickSettings.create(30, 10, "Region Permissions");
	regionPermissionsWindow.hide();

	regionPermissionsWindow.regionIndex = regionIndex;

	this.regionPermissionsWindow = regionPermissionsWindow; //only one.

	var regionPermissionsContainer = document.createElement("div");

	var regionListContainer = regionPermissionsContainer.appendChild(document.createElement("div"));
	regionListContainer.className = "region-list-container";


	var regionListBox1 = regionListContainer.appendChild(document.createElement("select"));
	regionListBox1.className = "region-listbox";
	regionListBox1.multiple = true;

	var clonedPlayerList = JSON.parse(JSON.stringify(this.playerList)); //static playerlist

	for(var i = 0; i < clonedPlayerList.length; i++) {
		var option = document.createElement("option");
		option.label = clonedPlayerList[i].name;
		regionListBox1.add(option);
	};
	
	var buttonContainers = regionListContainer.appendChild(document.createElement("div"));
	buttonContainers.className = "region-button-container";
	
	var regionAddButton = buttonContainers.appendChild(document.createElement("div"));
	regionAddButton.className = "region-window-permission-button";
	regionAddButton.textContent = "Add to permissions >";
	regionAddButton.addEventListener("click", function (e) {
		var temparr = [];
		for(var i = 0; i < regionListBox1.length; i++){
			if(regionListBox1.options[i].selected){
				var loggedIn = typeof clonedPlayerList[i].userid !=='undefined';

				if(!loggedIn)
					this.chat.addMessage("Regions", "User " + clonedPlayerList[i].name + " isn't logged in! Can't add permission.");

				var alreadyInPermissions = false;

				for(var x = 0; x < this.myRegions[this.regionPermissionsWindow.regionIndex].permissions.length; x++){
					if(clonedPlayerList[i].userid == this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[x].id )
						alreadyInPermissions = true;
				}

				var thereAreNoPermissionsYet = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions.length === 0;
				var notAddingMyself = clonedPlayerList[i].userid != this.myRegions[this.regionPermissionsWindow.regionIndex].owner;

				var readyToPush = loggedIn && (!alreadyInPermissions || thereAreNoPermissionsYet) && notAddingMyself;
				if(readyToPush){
					temparr.push(clonedPlayerList[i].userid);
				}
			}
		}
		if(temparr.length > 0){
			this.addUsersToMyProtectedRegion(temparr, this.myRegions[this.regionPermissionsWindow.regionIndex].regionId, function(){
				//regionlist should be updated
				for(var i = regionListBox2.length - 1; i >= 0 ; i--)
					regionListBox2.options.remove(i);
				
				for(var i = 0; i < this.myRegions[this.regionPermissionsWindow.regionIndex].permissions.length; i++) {
					var option = document.createElement("option");
					option.label = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
					option.textContent = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
					regionListBox2.add(option);
				};

			}.bind(this));
		}
		for(var i = regionListBox1.length - 1; i >= 0 ; i--)
			regionListBox1.options.remove(i);
		clonedPlayerList = JSON.parse(JSON.stringify(this.playerList)); //static playerlist

		for(var i = 0; i < clonedPlayerList.length; i++) {
			var option = document.createElement("option");
			option.label = clonedPlayerList[i].name;
			regionListBox1.add(option);
		};

	}.bind(this));
	


	var regionListBox2 = regionListContainer.appendChild(document.createElement("select"));
	regionListBox2.className = "region-listbox";
	regionListBox2.multiple = true;

	

	for(var i = 0; i < this.myRegions[this.regionPermissionsWindow.regionIndex].permissions.length; i++) {
		var option = document.createElement("option");
		option.label = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
		option.textContent = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
		regionListBox2.add(option);
	};

	var regionRemoveButton = regionPermissionsContainer.appendChild(document.createElement("div"));
	regionRemoveButton.className = "region-window-permission-button";
	regionRemoveButton.textContent = "Remove selected from permissions";

	regionRemoveButton.addEventListener("click", function (e) {
		var temparr = [];
		for(var i = 0; i < regionListBox2.length; i++){
			if(regionListBox2.options[i].selected){
				temparr.push(this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].id);
			}
		}
		if(temparr.length > 0){
			this.removeUsersFromMyProtectedRegion(temparr, this.myRegions[this.regionPermissionsWindow.regionIndex].regionId, function(){
				//regionlist should be updated
				for(var i = 0; i < temparr.length; i++)
					regionListBox2.remove(this.myRegions[this.regionPermissionsWindow.regionIndex][temparr[i]]);
			}.bind(this));
		}
	}.bind(this));

	regionPermissionsWindow.addElement("",regionPermissionsContainer);

	var rep = (this.myRegions[this.regionPermissionsWindow.regionIndex].minRepAllowed <= this.MAX_REP_TO_DISPLAY) ? this.myRegions[this.regionPermissionsWindow.regionIndex].minRepAllowed : this.MAX_REP_TO_DISPLAY;

	regionPermissionsWindow.addRange("Minimum Rep Allowed", 0, this.MAX_REP_TO_DISPLAY, rep, 1, function (value) {

		if(regionPermissionsWindow.minRepTimeout)
			clearTimeout(regionPermissionsWindow.minRepTimeout);

		regionPermissionsWindow.minRepTimeout = setTimeout(function(){
			this.setMinimumRepInProtectedRegion(value, this.myRegions[this.regionPermissionsWindow.regionIndex].regionId);			
		}.bind(this), 2000)
		
	}.bind(this));

	regionPermissionsWindow.addButton("Close", function () {
		regionPermissionsWindow.hide();
	}.bind(this));

	regionPermissionsWindow.reload = function(){
		for(var i = regionListBox1.length - 1; i >= 0 ; i--)
			regionListBox1.options.remove(i);
		for(var i = regionListBox2.length - 1; i >= 0 ; i--)
			regionListBox2.options.remove(i);

		clonedPlayerList = JSON.parse(JSON.stringify(this.playerList)); //static playerlist

		for(var i = 0; i < clonedPlayerList.length; i++) {
			var option = document.createElement("option");
			option.label = clonedPlayerList[i].name;
			option.textContent = clonedPlayerList[i].name;
			regionListBox1.add(option);
		};

		for(var i = 0; i < this.myRegions[this.regionPermissionsWindow.regionIndex].permissions.length; i++) {
			var option = document.createElement("option");
			option.label = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
			option.textContent = this.myRegions[this.regionPermissionsWindow.regionIndex].permissions[i].oldName;
			regionListBox2.add(option);
		};
		var rep = (this.myRegions[this.regionPermissionsWindow.regionIndex].minRepAllowed <= this.MAX_REP_TO_DISPLAY) ? this.myRegions[this.regionPermissionsWindow.regionIndex].minRepAllowed : this.MAX_REP_TO_DISPLAY;
		regionPermissionsWindow.setRangeValue("Minimum Rep Allowed", rep);
	}.bind(this);

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
	
	this.userSettings.addControl({
		title: "Loaded chunks",
		type: "range",
		value: 100,
		step: 5,
		min: 10,
		max: 2000,
		callback: function (chunks) {
			this.paint.public.settings.maxLoadedChunks = chunks;
			this.paint.background.settings.maxLoadedChunks = chunks;
		}.bind(this)
	});
	
	this.paint.public.settings.maxLoadedChunks = this.userSettings.getRangeValue("Loaded chunks");
	this.paint.background.settings.maxLoadedChunks = this.userSettings.getRangeValue("Loaded chunks");
	
	for (var k = 0; k < this.defaultVideoExportSettings.length; k++) {
		this.videoExportSettings.addControl(this.defaultVideoExportSettings[k]);
	}
	
	this.videoExportSettings.addButton("Close", function () {
		this.videoExportSettings.hide();
	}.bind(this));

	var advancedOptions = QuickSettings.create(30, 10, "Advanced options");
	advancedOptions.hide();
	this.advancedOptions = advancedOptions;

	var rotation = 0;
	var horizontal = false;
	var vertical = false;

	advancedOptions.addInfo("Tip 1:", "Press ESC to undo anything out of this menu.");
	advancedOptions.addInfo("Tip 2:", "U can also use the keys mentioned between the ( and ).");

	advancedOptions.addRange("Rotation (r)", -180, 180, 0, 1, function (value) {
		this.paint.setRotation(value);
	}.bind(this));

	advancedOptions.addBoolean("Flip horizontal (m)", false, function (value) {
		this.paint.setHorizontalMirror(value);
	}.bind(this));

	advancedOptions.addBoolean("Flip vertical (k)", false, function (value) {
		this.paint.setVerticalMirror(value);
	}.bind(this));
	
	var blurOnZoomCallback = function blurOnZoomCallback (val) {
		this.paint.public.settings.blurOnZoom = val;
		this.paint.background.settings.blurOnZoom = val;
		this.paint.local.settings.blurOnZoom = val;
		this.paint.public.relativeZoom(1);
		this.paint.background.relativeZoom(1);
		this.paint.local.relativeZoom(1);
	}.bind(this);
	
	// addControl persistently remembers last state 
	advancedOptions.addControl({
        type: "boolean",
        title: "Blur on zoom",
        value: false,
		callback: blurOnZoomCallback.bind(this)
    });
	
	blurOnZoomCallback(this.advancedOptions.getBoolean("Blur on zoom"));	
	
	var zoomLevelCallback = function (val) {
		this.paint.public.settings.zoomLevelToPixelate = val;
		this.paint.background.settings.zoomLevelToPixelate = val;
		this.paint.local.settings.zoomLevelToPixelate = val;
		this.paint.public.relativeZoom(1);
		this.paint.background.relativeZoom(1);
		this.paint.local.relativeZoom(1);
	}.bind(this);
	
	advancedOptions.addControl({
        type: "range",
        title: "The zoom-in level where it becomes pixelated",
        value: 3,
		step: 1,
		min: 1,
		max: 30,
		callback: zoomLevelCallback.bind(this)
    });
	
	zoomLevelCallback(this.advancedOptions.getRangeValue("The zoom-in level where it becomes pixelated"));

	advancedOptions.addButton("Generate grid", function () {
		this.openGenerateGridWindow();
		advancedOptions.hide();
	}.bind(this));
	
	advancedOptions.addButton("Toggle auto camera", function () {
		this.toggleFollow()
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
	
	var videoExportSettingsButton = settingsContainer.appendChild(document.createElement("div"));
	videoExportSettingsButton.appendChild(document.createTextNode("Open video export settings"));
	videoExportSettingsButton.className = "drawtogether-button";
	videoExportSettingsButton.addEventListener("click", function () {
		this.closeSettingsWindow();
		this.videoExportSettings.show();
	}.bind(this));

	var chatFilterOptions = QuickSettings.create(30, 10, "Chat filter options");
	chatFilterOptions.hide();
	this.chatFilterOptions = chatFilterOptions;

	var ChatFilterListContainer = document.createElement("div");
	ChatFilterListContainer.className = "chat-filter-list-container";

	var chatDefaultsHeader = document.createElement("H3");
	chatDefaultsHeader.appendChild(document.createTextNode("Chat Options:"));
	ChatFilterListContainer.appendChild(chatDefaultsHeader);

	var chatBeepVolumeLabel = ChatFilterListContainer.appendChild(document.createElement("label"));
	chatBeepVolumeLabel.appendChild(document.createTextNode("Chat Beep Volume: "));

	var chatBeepVolumeSlider = ChatFilterListContainer.appendChild(document.createElement("input"));
	chatBeepVolumeSlider.type = "range";
	chatBeepVolumeSlider.className = "chat-filter-visibility";
	if(localStorage.getItem("chatBeepVolume"))
		chatBeepVolumeSlider.value = localStorage.getItem("chatBeepVolume") * 100;
	else
		chatBeepVolumeSlider.value = 100;
	chatBeepVolumeSlider.addEventListener("change", function (e) {		
		localStorage.setItem("chatBeepVolume", chatBeepVolumeSlider.value * 0.01);
	}.bind(this));

	

	//var muteNewPeopleCheckbox = muteNewPeopleLabel.appendChild(document.createElement("input"));
	//muteNewPeopleCheckbox.type = "checkbox";

	var chatFilterByWordsHeader = document.createElement("H3");
	chatFilterByWordsHeader.appendChild(document.createTextNode("Filter by Words/Phrases options:"));
	ChatFilterListContainer.appendChild(chatFilterByWordsHeader);

	var chatFilterByWordsTableWrapper = ChatFilterListContainer.appendChild(document.createElement("div"));
	chatFilterByWordsTableWrapper.className = "chat-filter-wrapper";

	var chatFilterByWordsTable = chatFilterByWordsTableWrapper.appendChild(document.createElement("table"));
	chatFilterByWordsTable.className = "chat-filter-table";
	
	var chatFilterByWordsHeaderRow = chatFilterByWordsTable.appendChild(document.createElement("tr"));

	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Word/Phrase")).parentNode);
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Loose Match")).parentNode);//loosematch
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Visibility")).parentNode);
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("🔊")).parentNode);
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Global notification")).parentNode);
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Override Mute Chat")).parentNode);
	chatFilterByWordsHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Delete")).parentNode);

	var chatFilterByWordsAddRow = chatFilterByWordsTable.appendChild(document.createElement("tr"));
	var chatFilterByWordsAddRowData = chatFilterByWordsAddRow.appendChild(document.createElement("td"));
	chatFilterByWordsAddRowData.colSpan = "5";

	var chatFilterByWordsAddRowButton = chatFilterByWordsAddRowData.appendChild(document.createElement("button"));
	chatFilterByWordsAddRowButton.appendChild(document.createTextNode("V Add Word/Phrase Row V"));
	chatFilterByWordsAddRowButton.className = "chat-filter-add-word";

	var addEmptyObjectToEnd = true;
	var chatFilterByWordsArr = this.getFilterByWordsArr();

	for (var k = 0; k < chatFilterByWordsArr.length; k++) {
		var newWordRow = chatFilterByWordsTable.insertBefore(document.createElement("tr"), chatFilterByWordsAddRow);
		this.createFilterByWordRow(
			newWordRow,
			k,
			chatFilterByWordsArr[k].inputText,
			chatFilterByWordsArr[k].looseMatch,
			chatFilterByWordsArr[k].visibility,
			chatFilterByWordsArr[k].mute,
			chatFilterByWordsArr[k].globalNotification,
			chatFilterByWordsArr[k].overrideMute
			);
	}

	chatFilterByWordsAddRowButton.addEventListener("click", function (e) {
		var newWordRow = chatFilterByWordsTable.insertBefore(document.createElement("tr"), chatFilterByWordsAddRow);

		var addEmptyObjectToEnd = true;
		var chatFilterByWordsArr = this.getFilterByWordsArr(addEmptyObjectToEnd);

		var index = chatFilterByWordsArr.length - 1;

		this.createFilterByWordRow(
				newWordRow,
				index,
				chatFilterByWordsArr[index].inputText,
				chatFilterByWordsArr[index].looseMatch,
				chatFilterByWordsArr[index].visibility,
				chatFilterByWordsArr[index].mute,
				chatFilterByWordsArr[index].globalNotification,
				chatFilterByWordsArr[index].overrideMute
				);

		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));

	var chatFilterByPlayerHeader = document.createElement("H3");
	chatFilterByPlayerHeader.appendChild(document.createTextNode("Player filter options:"));
	ChatFilterListContainer.appendChild(chatFilterByPlayerHeader);

	var chatFilterByPlayerTableWrapper = ChatFilterListContainer.appendChild(document.createElement("div"));
	chatFilterByPlayerTableWrapper.className = "chat-filter-wrapper";

	var chatFilterByPlayerTable = chatFilterByPlayerTableWrapper.appendChild(document.createElement("table"));
	chatFilterByPlayerTable.className = "chat-filter-table chat-filter-player-table";
	
	var chatFilterByPlayerHeaderRow = chatFilterByPlayerTable.appendChild(document.createElement("tr"));

	chatFilterByPlayerHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Name")).parentNode);
	chatFilterByPlayerHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Visibility")).parentNode);
	chatFilterByPlayerHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("🔊")).parentNode);
	chatFilterByPlayerHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Global notification")).parentNode);
	chatFilterByPlayerHeaderRow.appendChild(document.createElement("th").appendChild(document.createTextNode("Override Mute Chat")).parentNode);

	chatFilterOptions.addElement("",ChatFilterListContainer);

	chatFilterOptions.reload = function chatFilterOptionsReload() { //naming just for stack trace
		while (chatFilterByPlayerTable.children.length > 1) {
			chatFilterByPlayerTable.removeChild(chatFilterByPlayerTable.children[1]);
		}

		clonedPlayerList = JSON.parse(JSON.stringify(this.playerList)); //static playerlist

		var chatFilterByPlayerArr = this.getFilterByPlayerArr(clonedPlayerList);

		for (var i = 0; i < clonedPlayerList.length; i++) {
			var userid = clonedPlayerList[i].userid;
			var nameInput = clonedPlayerList[i].name;
			var visibility = 100;
			var mute = false;
			var globalNotification = false;
			var overrideMute = false;
			var socketid = clonedPlayerList[i].id;

			for(var k = 0; k < chatFilterByPlayerArr.length; k++){
				if(chatFilterByPlayerArr[k].userid === clonedPlayerList[i].userid){ // found 
					nameInput += "(" + chatFilterByPlayerArr[k].name + ")";
					visibility = chatFilterByPlayerArr[k].visibility;
					mute = chatFilterByPlayerArr[k].mute;
					globalNotification = chatFilterByPlayerArr[k].globalNotification;
					overrideMute = chatFilterByPlayerArr[k].overrideMute;
					chatFilterByPlayerArr.splice(k, 1); //remove from array
				}
			}
			var row = chatFilterByPlayerTable.appendChild(document.createElement("tr"));
			
			this.createFilterByPlayerRow(
				row,
				userid,
				nameInput,
				visibility,
				mute,
				globalNotification,
				overrideMute,
				socketid
				);
		}

		for (var v = 0; v < chatFilterByPlayerArr.length; v++) {
			var userid = chatFilterByPlayerArr[v].userid;
			var nameInput = chatFilterByPlayerArr[v].name;
			var visibility = chatFilterByPlayerArr[v].visibility;
			var mute = chatFilterByPlayerArr[v].mute;
			var globalNotification = chatFilterByPlayerArr[v].globalNotification;
			var overrideMute = chatFilterByPlayerArr[v].overrideMute;

			var row = chatFilterByPlayerTable.appendChild(document.createElement("tr"));
			this.createFilterByPlayerRow(
				row,
				userid,
				nameInput,
				visibility,
				mute,
				globalNotification,
				overrideMute
				);
		}
	}.bind(this);

	chatFilterOptions.addButton("Close", function () {
		chatFilterOptions.hide();
		chatFilterOptions.reload();
	}.bind(this));

	//Button itself----------------------------------------
	var openChatFilterButton = settingsContainer.appendChild(document.createElement("div"));
	openChatFilterButton.appendChild(document.createTextNode("Open chat filter options"));
	openChatFilterButton.className = "drawtogether-button";

	openChatFilterButton.addEventListener("click", function () {
		this.closeSettingsWindow();
		chatFilterOptions.reload();
		chatFilterOptions.show();
	}.bind(this));
	
	var close = settingsContainer.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Close settings window"))
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeSettingsWindow.bind(this));
};

DrawTogether.prototype.getFilterByPlayerArr = function getFilterByPlayerArr (playerlist) {
	var chatFilterByPlayerArrStringified = localStorage.getItem("chatFilterByPlayerArr");
	var chatFilterByPlayerArr = JSON.parse(chatFilterByPlayerArrStringified);
	var changed = false;

	if(!chatFilterByPlayerArr || !chatFilterByPlayerArr.length || chatFilterByPlayerArr.length < 1 || typeof chatFilterByPlayerArr[0] !== "object"){
		chatFilterByPlayerArr = [];
		changed = true;
	}
	if(playerlist)
	for (var i = 0; i < chatFilterByPlayerArr.length; i++){
		if (!chatFilterByPlayerArr[i].userid) {
			var found = false;
			for (var k = 0; k < playerlist.length; k++) {
				if(chatFilterByPlayerArr[i].socketid == playerlist[k].id)
					found = true;
			}
			if(!found){
				chatFilterByPlayerArr.splice(i, 1);
				changed = true;
			}
		}
	}
	if(changed)
		localStorage.setItem("chatFilterByPlayerArr", JSON.stringify(chatFilterByPlayerArr));
	return chatFilterByPlayerArr;
};

DrawTogether.prototype.searchForPlayerInFilterArr = function searchForPlayerInFilterArr (arr, userid, socketid) {
	for(var i = 0; i < arr.length; i++) {
		if(socketid && arr[i].socketid == socketid)
			return i;
		if( arr[i].userid == userid )
			return i
	}
	return -1;
}

DrawTogether.prototype.getFilterByWordsArr = function getFilterByWordsArr (addEmptyObjectToEnd){
	var chatFilterByWordsArrStringified = localStorage.getItem("chatFilterByWordsArr");
	var chatFilterByWordsArr = [];

	chatFilterByWordsArr = JSON.parse(chatFilterByWordsArrStringified);
	if(!chatFilterByWordsArr || !chatFilterByWordsArr.length || chatFilterByWordsArr.length < 1 || typeof chatFilterByWordsArr[0] !== "object"){
		chatFilterByWordsArr = []; // reset array
		addEmptyObjectToEnd = true
	}

	if(addEmptyObjectToEnd){
		chatFilterByWordsArr.push({
			inputText: "",
			looseMatch: true,
			visibility: 100,
			mute: false,
			globalNotification: false,
			overrideMute: false
		});

	localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr)); // resanitize array
	}

	return chatFilterByWordsArr;
};

DrawTogether.prototype.createFilterByPlayerRow = function createFilterByPlayerRow (newPlayerRow, userid, name, visibility, mute, globalNotification, overrideMute, socketid ) {
	newPlayerRow.dataset.userid = userid;
	if(socketid)
		newPlayerRow.dataset.socketid = socketid;

	var nameRowData1 = newPlayerRow.appendChild(document.createElement("td"));
	var nameLabel = nameRowData1.appendChild(document.createElement("label"));
	var nameText = nameLabel.appendChild(document.createTextNode(name));

	var visibilityRowData2 = newPlayerRow.appendChild(document.createElement("td"));
	var visibilitySlider = visibilityRowData2.appendChild(document.createElement("input"));
	visibilitySlider.type = "range";
	visibilitySlider.className = "chat-filter-visibility";
	visibilitySlider.value = visibility || 100;
	visibilitySlider.addEventListener("change", function (e) {		
		var chatFilterByPlayerArr = this.getFilterByPlayerArr();
		var indexOfPlayer = this.searchForPlayerInFilterArr(chatFilterByPlayerArr, userid, socketid)
		if(indexOfPlayer == -1)
		{
			//create and push player object
			var playerObject = {
				userid: userid,
				name: name,
				visibility: visibility,
				mute: mute,
				globalNotification: globalNotification,
				overrideMute: overrideMute,
				socketid: socketid
			}
			playerObject.visibility = visibilitySlider.value;

			chatFilterByPlayerArr.push(playerObject);
		}
		else
			chatFilterByPlayerArr[indexOfPlayer].visibility = visibilitySlider.value;

		localStorage.setItem("chatFilterByPlayerArr", JSON.stringify(chatFilterByPlayerArr));
	}.bind(this));

	var muteRowData4 = newPlayerRow.appendChild(document.createElement("td"));
	var muteCheckbox = muteRowData4.appendChild(document.createElement("input"));
	muteCheckbox.type = "checkbox";
	muteCheckbox.className = "chat-filter-mute";
	muteCheckbox.checked = !mute;
	muteCheckbox.addEventListener("change", function (e) {		
		var chatFilterByPlayerArr = this.getFilterByPlayerArr();
		var indexOfPlayer = this.searchForPlayerInFilterArr(chatFilterByPlayerArr, userid, socketid)
		if(indexOfPlayer == -1)
		{
			//create and push player object
			var playerObject = {
				userid: userid,
				name: name,
				visibility: visibility,
				mute: mute,
				globalNotification: globalNotification,
				overrideMute: overrideMute,
				socketid: socketid
			}
			playerObject.mute = !muteCheckbox.checked;

			chatFilterByPlayerArr.push(playerObject);
		}
		else
			chatFilterByPlayerArr[indexOfPlayer].mute = !muteCheckbox.checked;

		localStorage.setItem("chatFilterByPlayerArr", JSON.stringify(chatFilterByPlayerArr));
	}.bind(this));

	var globalNotificationRowData5 = newPlayerRow.appendChild(document.createElement("td"));
	var globalNotificationCheckbox = globalNotificationRowData5.appendChild(document.createElement("input"));
	globalNotificationCheckbox.type = "checkbox";
	globalNotificationCheckbox.className = "chat-filter-globalNotification";
	globalNotificationCheckbox.checked = globalNotification;
	globalNotificationCheckbox.addEventListener("change", function (e) {		
		var chatFilterByPlayerArr = this.getFilterByPlayerArr();
		var indexOfPlayer = this.searchForPlayerInFilterArr(chatFilterByPlayerArr, userid, socketid)
		if(indexOfPlayer == -1)
		{
			//create and push player object
			var playerObject = {
				userid: userid,
				name: name,
				visibility: visibility,
				mute: mute,
				globalNotification: globalNotification,
				overrideMute: overrideMute,
				socketid: socketid
			}
			playerObject.globalNotification = globalNotificationCheckbox.checked;

			chatFilterByPlayerArr.push(playerObject);
		}
		else
			chatFilterByPlayerArr[indexOfPlayer].globalNotification = globalNotificationCheckbox.checked;

		localStorage.setItem("chatFilterByPlayerArr", JSON.stringify(chatFilterByPlayerArr));
		if (Notification.permission !== "granted")
			Notification.requestPermission();
	}.bind(this));

	var overrideMuteRowData6 = newPlayerRow.appendChild(document.createElement("td"));
	var overrideMuteChatCheckbox = overrideMuteRowData6.appendChild(document.createElement("input"));
	overrideMuteChatCheckbox.type = "checkbox";
	overrideMuteChatCheckbox.className = "chat-filter-overrideMute";
	overrideMuteChatCheckbox.checked = overrideMute;
	overrideMuteChatCheckbox.addEventListener("change", function (e) {		
		var chatFilterByPlayerArr = this.getFilterByPlayerArr();
		var indexOfPlayer = this.searchForPlayerInFilterArr(chatFilterByPlayerArr, userid, socketid)
		if(indexOfPlayer == -1)
		{
			//create and push player object
			var playerObject = {
				userid: userid,
				name: name,
				visibility: visibility,
				mute: mute,
				globalNotification: globalNotification,
				overrideMute: overrideMute,
				socketid: socketid
			}
			playerObject.overrideMute = overrideMuteChatCheckbox.checked;

			chatFilterByPlayerArr.push(playerObject);
		}
		else
			chatFilterByPlayerArr[indexOfPlayer].overrideMute = overrideMuteChatCheckbox.checked;

		localStorage.setItem("chatFilterByPlayerArr", JSON.stringify(chatFilterByPlayerArr));
	}.bind(this));
};

DrawTogether.prototype.createFilterByWordRow = function createFilterByWordRow (newWordRow, index, inputText, looseMatch, visibility, mute, globalNotification, overrideMute) {
	newWordRow.dataset.index = index;

	var newWordRowData1 = newWordRow.appendChild(document.createElement("td"));
	var newWordInputText = newWordRowData1.appendChild(document.createElement("input"));
	newWordInputText.type = "text";
	newWordInputText.className = "chat-filter-word-input";
	newWordInputText.value = inputText || "";
	newWordInputText.placeholder = "Enter at least one character";
	newWordInputText.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].inputText = newWordInputText.value;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));

	var newWordRowData2 = newWordRow.appendChild(document.createElement("td"));
	var looseMatchCheckbox = newWordRowData2.appendChild(document.createElement("input"));
	looseMatchCheckbox.type = "checkbox";
	looseMatchCheckbox.className = "chat-filter-looseMatch";
	looseMatchCheckbox.checked = looseMatch;
	looseMatchCheckbox.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].looseMatch = looseMatchCheckbox.checked;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));
	

	var newWordRowData3 = newWordRow.appendChild(document.createElement("td"));
	var newWordVisibilitySlider = newWordRowData3.appendChild(document.createElement("input"));
	newWordVisibilitySlider.type = "range";
	newWordVisibilitySlider.className = "chat-filter-visibility";
	newWordVisibilitySlider.value = visibility || 100;
	newWordVisibilitySlider.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].visibility = newWordVisibilitySlider.value;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));

	var newWordRowData4 = newWordRow.appendChild(document.createElement("td"));
	var muteCheckbox = newWordRowData4.appendChild(document.createElement("input"));
	muteCheckbox.type = "checkbox";
	muteCheckbox.className = "chat-filter-mute";
	muteCheckbox.checked = !mute;
	muteCheckbox.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].mute = !muteCheckbox.checked;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));

	var newWordRowData5 = newWordRow.appendChild(document.createElement("td"));
	var globalNotificationCheckbox = newWordRowData5.appendChild(document.createElement("input"));
	globalNotificationCheckbox.type = "checkbox";
	globalNotificationCheckbox.className = "chat-filter-globalNotification";
	globalNotificationCheckbox.checked = globalNotification;
	globalNotificationCheckbox.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].globalNotification = globalNotificationCheckbox.checked;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));

		if (Notification.permission !== "granted")
			Notification.requestPermission();
	}.bind(this));

	var newWordRowData6 = newWordRow.appendChild(document.createElement("td"));
	var overrideMuteChatCheckbox = newWordRowData6.appendChild(document.createElement("input"));
	overrideMuteChatCheckbox.type = "checkbox";
	overrideMuteChatCheckbox.className = "chat-filter-overrideMute";
	overrideMuteChatCheckbox.checked = overrideMute;
	overrideMuteChatCheckbox.addEventListener("change", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr[index].overrideMute = overrideMuteChatCheckbox.checked;
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
	}.bind(this));

	var newWordRowData7 = newWordRow.appendChild(document.createElement("td"));
	var removeRowButton = newWordRowData7.appendChild(document.createElement("button"));
	removeRowButton.appendChild(document.createTextNode("X"));
	removeRowButton.className = "chat-filter-removeRow";
	removeRowButton.addEventListener("click", function (e) {
		var chatFilterByWordsArr = this.getFilterByWordsArr();
		chatFilterByWordsArr.splice(index, 1);
		if(chatFilterByWordsArr.length < 1){
			var addEmptyObjectToEnd = true;
			chatFilterByWordsArr = this.getFilterByWordsArr(addEmptyObjectToEnd);
		}
		localStorage.setItem("chatFilterByWordsArr", JSON.stringify(chatFilterByWordsArr));
		newWordRow.parentNode.removeChild(newWordRow);//stupid as shit
	}.bind(this));
};

DrawTogether.prototype.createAccountWindow = function createAccountWindow () {
	if (this.accWindow) {
		this.accWindow.parentNode.removeChild(this.accWindow);
	}

	var accWindow = this.container.appendChild(document.createElement("div"));
	accWindow.className = "drawtogether-window drawtogether-accountwindow";
	this.accWindow = accWindow;

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
			
			var referralButton = formContainer.appendChild(document.createElement("div"));
			referralButton.appendChild(document.createTextNode("Referral"));
			referralButton.className = "drawtogether-button";
			referralButton.addEventListener("click", function () {
				this.closeAccountWindow();
				this.openReferralWindow();
			}.bind(this));

			var premiumButton = formContainer.appendChild(document.createElement("div"));
			premiumButton.appendChild(document.createTextNode("Premium"));
			premiumButton.className = "drawtogether-button";
			premiumButton.addEventListener("click", function () {
				this.closeAccountWindow();
				this.openPremiumBuyWindow();
			}.bind(this));
			
			var bountiesButton = formContainer.appendChild(document.createElement("div"));
			bountiesButton.appendChild(document.createTextNode("Bounties"));
			bountiesButton.className = "drawtogether-button";
			bountiesButton.addEventListener("click", function () {
				this.closeAccountWindow();
				this.openBountyWindow();
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
			
			this.getFavorites();
			this.getMyProtectedRegions();
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
	this.controls.byName.name.input.maxLength = 32;

	var sharediv = controlContainer.appendChild(document.createElement("div"));
	sharediv.className = "addthis_sharing_toolbox";
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
		this.getFavorites();
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
		this.getFavorites();
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

DrawTogether.prototype.uploadImage = function uploadImage (album) {
	// Remove the previous url
	while (this.imgurUrl.firstChild) {
		this.imgurUrl.removeChild(this.imgurUrl.firstChild);
	}
	if(!album) album = "main";
	this.showShareMessage("Uploading...");
	// Let the server upload the drawing to imgur and give us the url back
	this.network.socket.emit("uploadimage", this.preview.toDataURL().split(",")[1], album, function (data) {
		if (data.error) {
			this.showShareError(data.error);
			return;
		}

		this.showImgurUrl(data.url);
	}.bind(this));
};

DrawTogether.prototype.uploadBanImage = function uploadBanImage () {
	var album = "ban";
	
	this.network.socket.emit("uploadimage", this.lastBanSnapshot.split(",")[1], album, function (data) {
		if (data.error) {
			console.log("ban image error", data.error);
		}
		console.log("ban image url", data.url);
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

DrawTogether.prototype.createScuttlersOverlay = function createScuttlersOverlay () {
	var shareWindow = this.container.appendChild(document.createElement("div"));
	shareWindow.className = "drawtogether-sharewindow";
	shareWindow.style.display = "block";

	var h1 = shareWindow.appendChild(document.createElement("h1"));
	h1.appendChild(document.createTextNode("Scuttlers has been released!"));
	
	var preview = shareWindow.appendChild(document.createElement("div"));
	preview.style.margin = "3em";
	preview.innerHTML = '<iframe width="560" height="315" src="https://www.youtube.com/embed/pE737MO-8YQ" frameborder="0" allowfullscreen></iframe>';

	var close = shareWindow.appendChild(document.createElement("a"));
	close.appendChild(document.createTextNode("Bring me to steam"));
	close.className = "drawtogether-button drawtogether-close-button";
	close.href = "http://store.steampowered.com/app/689040/Scuttlers/";
	close.target = "_blank";
	
	var close = shareWindow.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("No thanks"));
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", function () {
		shareWindow.parentNode.removeChild(shareWindow);
	});
};

DrawTogether.prototype.createShareWindow = function createShareWindow () {
	var shareWindow = this.container.appendChild(document.createElement("div"));
	shareWindow.className = "drawtogether-sharewindow";
	this.shareWindow = shareWindow;

	var h1 = shareWindow.appendChild(document.createElement("h1"));
	h1.appendChild(document.createTextNode("A new way of sharing"));
	
	var preview = shareWindow.appendChild(document.createElement("img"));
	preview.className = "drawtogether-preview-canvas"
	preview.src = "images/tutorial/share.gif";

	var close = shareWindow.appendChild(document.createElement("div"));
	close.appendChild(document.createTextNode("Try it out"));
	close.className = "drawtogether-button drawtogether-close-button";
	close.addEventListener("click", this.closeShareWindow.bind(this));
};

DrawTogether.prototype.createModeSelector = function createModeSelector () {
	var selectWindow = this.container.appendChild(document.createElement("div"));
	selectWindow.className = "drawtogether-selectwindow";
	this.selectWindow = selectWindow;

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
	privateButton.innerHTML = '<img src="images/invite.png"/><br/>Sketch alone or with friends';
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
	gameButton.innerHTML = '<img src="images/game.png"/><br/>Play guess word';
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
};

DrawTogether.prototype.openDiscordWindow = function openDiscordWindow () {
	var discordWindow = this.gui.createWindow({ title: "Voice chat: Discord"});

	var container = discordWindow.appendChild(document.createElement("div"));
	container.innerHTML = '<iframe src="https://discordapp.com/widget?id=187008981837938689&theme=dark" width="350" height="500" allowtransparency="true" frameborder="0"></iframe>';	
};

DrawTogether.prototype.openGithub = function openGithub () {
	window.open("https://github.com/Squarific/anondraw");
	ga('send', 'event', 'githubcollab', 'open');
};

DrawTogether.prototype.openScuttlersWindow = function openScuttlersWindow () {
	var scuttlersWindow = this.gui.createWindow({ title: "Scuttlers trailer"});
	
	ga("send", "event", "window", "scuttlers");
	
	var content = scuttlersWindow.appendChild(document.createElement("div"));
	content.className = "content";
	
	var title = content.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Scuttlers trailer"));
	
	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("I'm developing a game called scuttlers. Feel free to check out the trailer and let me know what you think!"));
	
	var video = content.appendChild(document.createElement("div"));
	video.innerHTML = '<iframe width="560" height="315" src="https://www.youtube.com/embed/pE737MO-8YQ" frameborder="0" allowfullscreen></iframe>';
	
	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("More info: "));
	
	var a = p.appendChild(document.createElement("a"));
	a.href = "https://www.playscuttlers.com";
	a.alt = "Scuttlers official website";
	a.appendChild(document.createTextNode("https://www.playscuttlers.com"));
};

DrawTogether.prototype.openScuttlersDateWindow = function openScuttlersDateWindow () {
	var scuttlersWindow = this.gui.createWindow({ title: "Scuttlers release announcement"});
	
	ga("send", "event", "window", "scuttlersannouncement");
	
	var content = scuttlersWindow.appendChild(document.createElement("div"));
	content.className = "content";
	
	var title = content.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Scuttlers release announcment"));
	
	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("We will be releasing 15 september! Our steam store page is also live:"));
	
	var a = p.appendChild(document.createElement("a"));
	a.href = "https://store.steampowered.com/app/689040/Scuttlers/";
	a.alt = "steam store page";
	a.appendChild(document.createTextNode("Steam store page."));
	
	var video = content.appendChild(document.createElement("div"));
	video.innerHTML = '<iframe width="560" height="315" src="https://www.youtube.com/embed/24KaGZwCB8s" frameborder="0" allowfullscreen></iframe>';

	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("More info: "));
	
	var a = p.appendChild(document.createElement("a"));
	a.href = "https://www.playscuttlers.com";
	a.alt = "Scuttlers official website";
	a.appendChild(document.createTextNode("https://www.playscuttlers.com"));
};

DrawTogether.prototype.openBountyWindow = function openBountyWindow () {
	var scuttlersWindow = this.gui.createWindow({ title: "New way to support us"});
	
	ga("send", "event", "window", "bounty");
	
	var content = scuttlersWindow.appendChild(document.createElement("div"));
	content.className = "content";
	
	var title = content.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Introducing bountysource"));
	
	var title = content.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("How does it work."));
	
	var p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("You go to "));
	
	var a = p.appendChild(document.createElement("a"));
	a.href = "https://www.bountysource.com/trackers/11190661-squarific-anondraw";
	a.title = "Anondraw bountysource";
	a.target = "_blank";
	a.appendChild(document.createTextNode("bountysource"));

	p.appendChild(document.createTextNode(" and put a bounty on whatever feature you want to see. Anyone can then attempt to implement it for the bounty."));
	
	p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("To reward you in the meantime, putting a bounty also gives you rep. Just send a mail to bounty@anondraw.com with the amount you pledged. (0.5 euro = 1rep)."));
	
	p = content.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("To add a feature to the bountysource list add an 'issue' to the github here: "));
	
	var a = p.appendChild(document.createElement("a"));
	a.href = "https://github.com/Squarific/Anondraw/issues";
	a.title = "Anondraw github";
	a.target = "_blank";
	a.appendChild(document.createTextNode("github issues"));
};

DrawTogether.prototype.openReferralWindow = function openReferralWindow () {
	var referralWindow = this.gui.createWindow({ title: "Referrals" });

	var container = referralWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Referral program"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Want to earn some extra rep and goodies? Why not get your friends to join?"));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("If someone registers via your link they will be marked as your referral. Then if they get 10 rep they will become confirmed and you will get a reward."));
	
	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Rewards"));
	
	var ol = container.appendChild(document.createElement("ol"));

	var features = ["1: You get an extra rep per confirmed referral (always)", "10: you get a nice referral icon to show off", "50: you'll get an anondraw tshirt (no delivery to the moon)", "100: TBA"];
	for (var k = 0; k < features.length; k++) {
		var li = ol.appendChild(document.createElement("li"));
		li.appendChild(document.createTextNode(features[k]));
	}
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("If one of your referrals gets premium, you get it too! (Already have premium? Then you get 10 rep)"));
	
	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Link"));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Your link is: "));

	var link = p.appendChild(document.createElement("a"));
	link.appendChild(document.createTextNode("https://www.anondraw.com/?ref=" + this.account.id));
	link.href = "https://www.anondraw.com/?ref=" + this.account.id;
	link.alt = "Your referral link";
	link.title = "Your referral link";
};

DrawTogether.prototype.outlineProtectedRegion = function outlineProtectedRegion (region, ignoreTimeout) {
	//Visible protected areas.
	if(typeof this.outlineRegionTimeout !== "undefined" && !ignoreTimeout){
		clearTimeout(this.outlineRegionTimeout);
	}
	var startTime = Date.now();
	var loop = function loop(){
		if(Date.now() < startTime + 2000 ){
			var width = region.maxX - region.minX;
			var height = region.maxY - region.minY;
			var lefttop = [region.minX, region.minY]
			
			anondraw.collab.paint.previewGrid(lefttop, 1, width, height, 0);
			this.outlineRegionTimeout = setTimeout(loop.bind(this), 10);
		}
		else
		{
			anondraw.collab.paint.previewGrid([0,0],0,0,0,0);
		}
	};
	loop.apply(this);
	
};

DrawTogether.prototype.updateGeneratedGridPreview = function updateGeneratedGridPreview(generationSettings, from, to) {
	if(generationSettings == "Clear Grid Preview"){
		this.paint.previewGrid([0,0],0,0,0,0);
		return;
	}
	var squares = generationSettings.getRangeValue("Squares");
	var gutter = generationSettings.getRangeValue("Gutter");

	var maxgutter=Math.ceil((Math.abs(to[0] - from[0])-squares*2)/(squares-1));
	if(gutter>maxgutter) gutter=maxgutter;
	var guttertotal=gutter*(squares-1);
	var totalWidth = Math.floor(Math.abs(to[0] - from[0]-guttertotal)/(squares))*squares+guttertotal;

	var leftMargin = Math.floor((Math.abs(to[0] - from[0])-totalWidth)/2);

	var sqwidth = (totalWidth - gutter * (squares - 1)) / squares;
	var sqheight = Math.abs(to[1] - from[1]);
	
	var leftTop = [Math.min(from[0], to[0])+leftMargin, Math.min(from[1], to[1])];
	
	this.paint.previewGrid(
			leftTop,
			squares,
			sqwidth,
			sqheight,
			gutter
		);
};

DrawTogether.prototype.createGridInSelection = function createGridInSelection (from, to) {
	var generationSettings = QuickSettings.create(50, 50, "Grid settings");
	generationSettings.addControl({
		type: "range",
		title: "Squares",
		min: 1,
		max: 50,
		value: 5,
		step: 1,
		callback: this.updateGeneratedGridPreview.bind(this, generationSettings, from, to)
	});
	
	generationSettings.addControl({
		type: "range",
		title: "Gutter",
		min: 0,
		max: 200,
		value: 0,
		step: 1,
		callback: this.updateGeneratedGridPreview.bind(this, generationSettings, from, to)
	});
	generationSettings.addButton("Save for animation manager", function() {
		var squares = generationSettings.getRangeValue("Squares");
		var gutter = generationSettings.getRangeValue("Gutter");
		
		var maxgutter=Math.ceil((Math.abs(to[0] - from[0])-squares*2)/(squares-1));
		if(gutter>maxgutter) gutter=maxgutter;
		var guttertotal=gutter*(squares-1);
		var totalWidth = Math.floor(Math.abs(to[0] - from[0]-guttertotal)/(squares))*squares+guttertotal;

		var leftMargin = Math.floor((Math.abs(to[0] - from[0])-totalWidth)/2);

		var sqwidth = (totalWidth - gutter * (squares - 1)) / squares;
		var sqheight = Math.abs(to[1] - from[1]);
		
		var leftTop = [Math.min(from[0], to[0])+leftMargin, Math.min(from[1], to[1])];
		this.myAnimations.push({
			name: null,
			fps: 16,
			leftTop: leftTop,
			squares: squares,
			sqwidth: sqwidth,
			sqheight: sqheight,
			gutter: gutter,
			bufferFrames: {}
		});
		this.updateAnimationsCookie();
		this.updateAnimationManager();
		//
	}.bind(this));
	
	generationSettings.addButton("Generate", function () {
		var squares = generationSettings.getRangeValue("Squares");
		var gutter = generationSettings.getRangeValue("Gutter");
		

		var maxgutter=Math.ceil((Math.abs(to[0] - from[0])-squares*2)/(squares-1));
		if(gutter>maxgutter) gutter=maxgutter;
		var guttertotal=gutter*(squares-1);
		var totalWidth = Math.floor(Math.abs(to[0] - from[0]-guttertotal)/(squares))*squares+guttertotal;

		var leftMargin = Math.floor((Math.abs(to[0] - from[0])-totalWidth)/2);

		var sqwidth = (totalWidth - gutter * (squares - 1)) / squares;
		var sqheight = Math.abs(to[1] - from[1]);
		
		var leftTop = [Math.min(from[0], to[0])+leftMargin, Math.min(from[1], to[1])];
		
		if (this.reputation >= 5 || (totalWidth > 1000 || sqwidth > 200)) {
			console.log("Generating grid", squares, sqwidth, sqheight);
			this.paint.generateGrid(
				leftTop,
				squares,
				sqwidth,
				sqheight,
				gutter
			);
		} else {
			this.chat.addMessage("Grids wider than 1000 pixels or higher than 200 are limited to users with 5+ reputation.");
		}
	}.bind(this));
	
	generationSettings.addButton("Cancel", function () {
		clearTimeout(this.updateGridPreviewTimeout);
		generationSettings._panel.parentNode.removeChild(generationSettings._panel);
		this.updateGeneratedGridPreview("Clear Grid Preview");
	}.bind(this));
	
	var loop = function loop(){
		this.updateGeneratedGridPreview(generationSettings, from, to);
		this.updateGridPreviewTimeout = setTimeout(loop.bind(this), 300);
	};	
	loop.apply(this);
};

DrawTogether.prototype.openGenerateGridWindow = function openGenerateGridWindow () {
	var generationSettings = QuickSettings.create(50, 50, "Generate grid");

	generationSettings.addInfo("How to use", "The size of the lines is determined by your brush size. The color by the brush color.");
	generationSettings.addInfo("Sizes", "The width and height are per square.");
	
	generationSettings.addText("Left top x", Math.round(this.paint.public.leftTopX));
	generationSettings.addText("Left top y", Math.round(this.paint.public.leftTopY));
	
	generationSettings.addRange("Squares", 1, 30, 5, 1);
	generationSettings.addRange("Width", 1, 500, 100, 1);
	generationSettings.addRange("Height", 1, 500, 100, 1);
	
	generationSettings.addControl({
		type: "range",
		title: "Gutter",
		min: 0,
		max: 200,
		value: 0,
		step: 1
	});
	
	generationSettings.addButton("Generate", function () {
		var squares = generationSettings.getRangeValue("Squares");
		var sqwidth = generationSettings.getRangeValue("Width");
		var sqheight = generationSettings.getRangeValue("Height");
		
		if (this.reputation >= 5 || (squares <= 5 && sqwidth <= 200 && sqheight <= 200)) {
			console.log("Generating grid", squares, sqwidth, sqheight);
			this.paint.generateGrid(
				[parseInt(generationSettings.getText("Left top x")), parseInt(generationSettings.getText("Left top y"))],
				squares,
				sqwidth,
				sqheight,
				generationSettings.getRangeValue("Gutter")
			);
		} else {
			this.chat.addMessage("Grids with more than 6 squares or squares bigger than 200 pixels are limited to users with 5+ reputation.");
		}
	}.bind(this));
	
	generationSettings.addButton("close", function () {
		generationSettings._panel.parentNode.removeChild(generationSettings._panel);
	});
};

DrawTogether.prototype.openPremiumBuyWindow = function openPremiumBuyWindow () {
	var premiumBuyWindow = this.gui.createWindow({ title: "Premium" });
	premiumBuyWindow.classList.add("premiumwindow");

	var container = premiumBuyWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Support us: getting premium"));
	
	var ol = container.appendChild(document.createElement("ol"));

	var features = [
		{ icon: "star", feature: "Icon and rainbow name" },
		{ icon: "emote", feature: "Your own custom emote" },
		{ icon: "reputation", feature: "Get 20 reputations" },
		{ icon: "give", feature: "Give reputation to anyone *" },
		{ icon: "discover", feature: "Jump to a random drawing *" },
		{ icon: "region", feature: "Unlimited regions" },
		{ icon: "locations", feature: "Unlimited locations" },
		{ icon: "buttons", feature: "Unlimited buttons" },
		{ icon: "map", feature: "Access to a minimap" },
		{ icon: "ink", feature: "No ink usage" },
		{ icon: "advanced", feature: "Rotate and mirror the canvas" },
		{ icon: "pressure", feature: "Pressure support*" },
		{ icon: "redo", feature: "Redo feature *" },
		{ icon: "import", feature: "Import tool *" },
		{ icon: "copy", feature: "Copy paste *" },
		{ icon: "layers", feature: "Layers *" },
		{ icon: "brush", feature: "Custom brush *" },
		{ icon: "noads", feature: "No more random ads" }
	];
	
	for (var k = 0; k < features.length; k++) {
		var li = ol.appendChild(document.createElement("li"));
		var img = li.appendChild(document.createElement("img"));
		img.src = "images/icons/premium/" + features[k].icon + ".png";
		li.appendChild(document.createTextNode(features[k].feature));
	}
	
	container.appendChild(document.createTextNode("* Coming soon"));
	container.appendChild(document.createElement("br"));
	container.appendChild(document.createElement("br"));
	
	var span = container.appendChild(document.createElement('span'));
	span.style.fontStyle = 'italic';
	span.appendChild(document.createTextNode("For the low price of 100 euro you get to give unlimited reputation."));
	span.appendChild(document.createElement("br"));
	span.appendChild(document.createTextNode("Fair use applies, you can't break things, limit the abuse ;)"));

	var p = container.appendChild(document.createElement("p"));
	if (!this.account.uKey) {
		html = "You should first login!";
	} else {
		var html = '<span class="label">Account:</span> <strong>' + this.account.mail + '</strong><br/>';

		html += '<span class="label">Price:</span> <strong>20 euro</strong><br/>';
		html += '<span class="label">Duration:</span> <strong>Forever</strong><br/><br/>';
		html += 'Usually confirmed within 12 hours. Taking longer? Contact premium@anondraw.com <br/><br/>';
		 
		html += '<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top" style="display:inline-block; margin-right:20%;">';
	    	html +=	'<input type="hidden" name="cmd" value="_s-xclick">';
	    	html += '<input type="hidden" name="hosted_button_id" value="RU7EGGG6RH4AG">';
	    	html += '<table style="display:none;">';
		    	html += '<tr><td><input type="hidden" name="on0" value="Account/Email">Account/Email</td></tr><tr><td><input type="text" value="' + this.account.mail + '" name="os0" maxlength="200"></td></tr>';
	    	html += '</table>';
	    	html += '<input type="image" style="margin-top:0.5em;" src="https://www.paypalobjects.com/en_US/BE/i/btn/btn_buynowCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">';
	    	html += '<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">';
	    html += '</form>';
	    html += '<a class="coinbase-button" data-code="8be6985bf22cfd01ca0877cb6fb97249" data-button-style="custom_small" href="https://www.coinbase.com/checkouts/8be6985bf22cfd01ca0877cb6fb97249">Pay With Bitcoin</a>';

	    html += '<br/><br/><br/>';
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
	var welcomeWindow = this.gui.createWindow({ title: "Welcome!", close: false });
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
	p.appendChild(document.createTextNode("License: You give us the non-exclusive, transferable right to display and modify all the content you create using this website. You also give everyone the Creative Commons share alike license for non commercial use."));

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
		.setOptions({ 'tooltipPosition': 'auto', 'showProgress': true, 'hideNext': true, 'exitOnOverlayClick': false, 'exitOnEsc': false})
		.onchange(function () {
			ga("send", "event", "tutorial", "next");
		})
		.onexit(function () {
			ga("send", "event", "tutorial", "exit");
			this.openWelcomeWindow();
		}.bind(this))
		.oncomplete(function () {
			ga("send", "event", "tutorial", "complete");
			this.userSettings.setBoolean("Show welcome", false, true);
		}.bind(this))
		.start();
	}.bind(this));
};

DrawTogether.prototype.openFeedbackWindow = function openFeedbackWindow () {
	var feedbackWindow = this.gui.createWindow({title: "Feedback"});
	feedbackWindow.classList.add("feedback-window");

	var container = feedbackWindow.appendChild(document.createElement("div"))
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
	var featureWindow = this.gui.createWindow({ title: "Some new shiny features!"});

	featureWindow.classList.add("feature-window");

	var container = featureWindow.appendChild(document.createElement("div"))
	container.className = "content";

	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Interactivity and special snowflakes"));
	
	/*var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Ps. don't forget the contest that goes on every month!"));*/

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("New things:"));

	var ol = container.appendChild(document.createElement("ol"));

	var features = [
		"Clickable regions: time to make some buttons",
		"Negative and decimal rep are now supported",
		"Pressing the back button takes you back",
		"We now use https, super secure!!!",
		"Monthly contest (srsly participate, its worth it)",
		"New users now get a nice window telling them they can't draw in the spawn with a button to go to a random spot."
	];

	for (var k = 0; k < features.length; k++) {
		var li = ol.appendChild(document.createElement("li"));
		li.appendChild(document.createTextNode(features[k]));
	}

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Regards,"));
	p.appendChild(document.createElement("br"));
	p.appendChild(document.createTextNode("Anondraw Team"));

	// var p = container.appendChild(document.createElement("p"));
	// p.appendChild(document.createTextNode("Ps. want more features?"));

	// var p = container.appendChild(document.createElement("p"));
	// p.appendChild(document.createTextNode("Getting premium helps us pay for development time and the server hosting."));

	var premiumButton = container.appendChild(document.createElement("div"));
	premiumButton.appendChild(document.createTextNode("Want to see more updates? Get premium!"));
	premiumButton.className = "drawtogether-button";
	premiumButton.addEventListener("click", function () {
		if (featureWindow.parentNode)
			featureWindow.parentNode.removeChild(featureWindow);

		this.openPremiumBuyWindow();
	}.bind(this));
};

DrawTogether.prototype.openModeratorWelcomeWindow = function openModeratorWelcomeWindow () {
	localStorage.setItem('moderatorwelcomewindowlastopen', Date.now());
	var moderatorWindow = this.gui.createWindow({ title: "Rules and guidelines"});

	moderatorWindow.classList.add("moderator-window");

	var container = moderatorWindow.appendChild(document.createElement("div"))
	container.className = "content";
	
	var title = container.appendChild(document.createElement("h2"));
	title.appendChild(document.createTextNode("Rules and guidelines"));
	
	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Questions"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("If you have a question, feel free to mail info@anondraw.com or ask squarifc on discord."));

	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("License"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("You give us the non-exclusive, transferable right to display and modify all the content you create using this website. You also give everyone the Creative Commons share alike license for non commercial use. This is needed so everyone is free to collaborate without having to worry about copyright."));
	
	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Griefing"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Griefing is not allowed. Do not (try to) destroy drawings that other people made. Do not censor drawings. Do not impose your morals on other peoples drawing. Ask before helping. If no one is around and there are no cloud rules, you may assume that you can improve a drawing. Judgement will be made on a case by case basis."));	
	
	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("What is allowed?"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("There are no content restrictions other than those imposed by the law. Do not share or create anything that would be illegal inside Belgium."));	

	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Clouds"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("All users are allowed to claim space as their own cloud. The way to do this is by drawing a background in one color."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("When encountering a background that is colored, i.e. not transparent, you have to assume its a cloud with rules."));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Every cloudowner is allowed to enforce their rules. To do so, they FIRST have to clearly indicate what the rules are somewhere on the cloud. Rules can only be enforced if they were there before the drawing. Altough users ought to assume a cloud is governed by rules, marking it in multiple spaces on the cloud is advised in order for there to be less incidents."));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("To delete a drawing that is breaking the rules; the cloudowner has to leave a message next to the drawing with 'will be removed on DATE' where the given date is at least a week from now."));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("The only exception is when both the owner and the drawer are online, in that case, they should talk with each other. This policy is there to give the drawer time to move over or screenshot their work."));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("After the period has elapsed, the owner can remove the offending drawing. When in doubt, send an email to info@anondraw.com or ask squarific on discord. When a dispute arises, it is advised to first ask an admin. Not doing so might be considered a bad faith action later, resulting in a decision against you."));
	
	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Moderators"));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Users, but especially moderators, should assume good faith. They ought to remain calm and have thick skin. Do not use given powers lightly. Give the benefit of the doubt and give yourself a higher standard than what you demand of others."));

	var title = container.appendChild(document.createElement("h3"));
	title.appendChild(document.createTextNode("Ban times"));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("When in doubt, start with a short time period of less than a week and contact info@anondraw.com or squarific on discord."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("Try to keep proof. Chat messages are logged, and so is your screen at the time you ban (a before and after is saved). If more proof is needed, send it to banproof@anondraw.com."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("If someone is being annoying, you ought to first use the mute function. This should normally suffice. The only exceptions are when users go around it."));
	
	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("First talk, in a friendly manner, with the person you want to ban and ask them to undo. A kick of less than a minute is allowed if you fear they won't or it will be too late. Be careful of collatoral damage though."));

	var p = container.appendChild(document.createElement("p"));
	p.appendChild(document.createTextNode("If someone blatantly griefs and does not listen, you may ban for longer time periods. Be sure to include a good description in the reason field."));

};


DrawTogether.prototype.createFAQDom = function createFAQDom () {
	var faq = document.createElement("div");
	faq.className = "drawtogether-faq";

	var adContainer = faq.appendChild(document.createElement("div"));
	adContainer.className = "adcontainer drawtogether-question";

	var questions = [{
		question: "What is anondraw?",
		answer: "It's a website where you can draw or doodle in group with friends or strangers. Join one of the rooms and start drawing and collaborating with the group. The interactive drawing works on the iPad and other android tablets. You can also doodle on phones."
	}, {
		question: "How do I chat?",
		answer: "There is a chat to the right or if you are on mobile you can click on the chat button."
	}, {
		question: "Can I make animations?",
		answer: 'Yes you can, for more info on how making these animations work, you can watch <a href="https://www.youtube.com/watch?v=wZ47oOPqNAQ">this video</a>'
	}, {
		question: "How big is the canvas?",
		answer: "The interactive canvas has an infinite size. You could move as far away from the center as you'd like."
	}, {
		question: "I want to draw privately with some people, is that possible?",
		answer: "Yes, in the home screen click on draw with friends and then share the invite url printed in the chat. If you are already in a room, simply click on the room button and then click create private room after giving it a name."
	},  {
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
		question: "Are 3d party programs allowed?",
		answer: 'They are as long as they are reasonable. So be cool about it. An example of drawing bots:' +
		        ' <a href="http://anonbots.bitballoon.com/" alt="Anondraw bot">http://anonbots.bitballoon.com</a>'
	}, {
		question: "What benefits does reputation give you?",
		answer: "At " + this.ZOOMED_OUT_MIN_REP + " reputation, you are allowed to draw while zoomed out. \n" +
		        "At " + this.BIG_BRUSH_MIN_REP + " reputation, you are allowed to use brush sizes bigger than 10. \n" +
		        "At 7 reputation, you can give upvotes to other people who have less reputation than you. \n" +
		        "At 15 reputation, you can join the member only rooms and share an ip with other users without affecting your ink. \n" +
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
	}, {
		question: "So this is basicly a ms paint multiplayer app?",
		answer: "You could call it that yea, it's a draw pad where you can draw something online."
	}, {
		question: "How long will my sketches be saved?",
		answer: "Your sketches should remain forever. All drawings are saved on the pads every 6 hours, after this period they should be permanent."
	}, {
		question: "Can I play this like draw something but online?",
		answer: "Yes, there is a gamemode where you get words and other people have to guess what you just drew."
	}, {
		question: "I'd like to donate, is that possible?",
		answer: "Yea it is, the best way would be to buy premium, that way you get something in return. If you feel like just throwing money in but don't want premium for some reaosn, you can also always use <a href=\"http://www.paypal.me/anondraw\">http://www.paypal.me/anondraw</a>"
	}];

	for (var qKey = 0; qKey < questions.length; qKey++) {
		var question = faq.appendChild(document.createElement("div"));
		question.className = "drawtogether-question";

		var qhead = question.appendChild(document.createElement("h2"));
		qhead.className = "drawtogether-question-question";
		qhead.innerHTML = questions[qKey].question;

		var qText = question.appendChild(document.createElement("div"));
		qText.className = "drawtogether-question-answer";
		
		var answerLines = questions[qKey].answer.split("\n");
		for (var k = 0; k < answerLines.length; k++) {
			var answerLine = qText.appendChild(document.createElement("div"));
			answerLine.innerHTML = answerLines[k];
		}
	}

	return faq;
};

DrawTogether.prototype.createControlArray = function createControlArray () {
	var buttonList = [{
		name: "name",
		type: "text",
		text: "Username",
		value: localStorage.getItem("drawtogether-name") || "",
		title: "Change your name",
		action: this.changeNameDelayed.bind(this)/*,
		data: {
			intro: "This is your current guest name. Change this to something you like!"
		}*/
	},{
		name: "home-button",
		type: "button",
		value: "",
		text: "Modes",
		title: "Go to the mode selector",
		action: this.openModeSelector.bind(this)
	}, {
		name: "room-button",
		type: "button",
		text: "Rooms",
		action: this.openRoomWindow.bind(this)
	}, {
		name: "settings",
		type: "button",
		text: "Settings",
		action: this.openSettingsWindow.bind(this)
	}];

	if (location.toString().indexOf("kongregate") == -1) {
		buttonList.push({
			name: "account",
			type: "button",
			text: "Account",
			action: this.openAccountWindow.bind(this)
		});
	}
	
	buttonList.push({
		name: "premium",
		type: "button",
		text: "Premium",
		action: this.openPremiumBuyWindow.bind(this)
	});

	buttonList.push({
		name: "discord",
		type: "button",
		text: "Discord chat",
		action: this.openDiscordWindow.bind(this)
	});
	
	buttonList.push({
		name: "github",
		type: "button",
		text: "Github",
		action: this.openGithub.bind(this)
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

