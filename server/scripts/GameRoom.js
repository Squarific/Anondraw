var words = require("./words.js");
var TIME_PER_WORD = 60 * 1000;

function GameRoom (name, io) {
	this.currentPlayer;
	this.gameTimeout;
	this.currentWord;

	this.io = io;
	this.name = name;
	this.players = [];
}

GameRoom.prototype.join = function join (socket) {
	this.players.push(socket);
	socket.gamescore = 0;

	if (!this.currentPlayer) {
		this.nextGame();
	} else {
		this.io.to(this.name).emit("gamestatus", this.getStatus());
	}	
};

GameRoom.prototype.leave = function (socket) {
	while (this.players.indexOf(socket) !== -1) {
		this.players.splice(this.players.indexOf(socket), 1);
	}
	
	if (this.currentPlayer == socket) {
		this.nextGame();
	}
};

GameRoom.prototype.chatmessage = function chatmessage (socket, message) {
	if (socket == this.currentPlayer) return;

	if (message.toLowerCase().indexOf(this.currentWord.toLowerCase()) !== -1) {
		// Word has been guessed, get a new word and assign next player
		this.io.to(socket.room).emit("chatmessage", {
			user: "GAME",
			message: "The word " + this.currentWord + " has been guessed by " + socket.username
		});

		socket.gamescore++;
		this.currentPlayer.gamescore++;

		this.nextGame(true);
	}
};

GameRoom.prototype.nextGame = function nextGame (guessed) {
	clearTimeout(this.gameTimeout);

	// If noone is in the room, stop playing
	if (this.players.length == 0) {
		delete this.currentPlayer;
		return;
	}

	// Was the previous game succesful?
	if (!guessed && this.currentPlayer) {
		this.io.to(this.name).emit("chatmessage", {
			user: "GAME",
			message: "The word " + this.currentWord + " has not been guessed!"
		});

		
	}

	if (!guessed && this.currentPlayer && !this.currentPlayerDrew) {
		if (this.currentPlayer.hasNotDrawn) {
			this.currentPlayer.emit("chatmessage", {
				user: "GAME",
				message: "You didn't draw. You have been kicked!"
			});

			this.io.to(this.name).emit("chatmessage", {
				user: "GAME",
				message: this.currentPlayer.username + " didn't draw again. He got kicked!"
			});

			this.currentPlayer.disconnect();
		} else {
			this.io.to(this.name).emit("chatmessage", {
				user: "GAME",
				message: this.currentPlayer.username + " didn't draw. Next time he will be kicked!"
			});
			this.currentPlayer.hasNotDrawn = true;
		}
	} else {
		if (this.currentPlayer) delete this.currentPlayer.hasNotDrawn;
	}

	// Assign new drawer
	var newAssigned = false;
	for (var k = 0; k < this.players.length; k++) {
		if (this.players[k] == this.currentPlayer) {
			this.currentPlayer = this.players[(k + 1) % this.players.length];
			newAssigned = true;
			break;
		}
	}

	// There was no current player before
	if (!newAssigned) {
		if (this.players.length == 0) return;
		this.currentPlayer = this.players[0];
	}

	// The new play has not drawn yet
	this.currentPlayerDrew = false;

	// Assign new word
	this.currentWord = words[Math.floor(Math.random() * words.length)];

	// Arrange the time stuff
	this.gameTimeout = setTimeout(this.nextGame.bind(this), TIME_PER_WORD);
	this.endTime = Date.now() + TIME_PER_WORD;

	console.log("[GAME][" + this.name + "] Current player (" + this.currentPlayer.username + ") current word '" + this.currentWord + "' playercount " + this.players.length);

	// Send the current state
	this.io.to(this.currentPlayer.room).emit("gamestatus", this.getStatus());
	this.currentPlayer.emit("gameword", this.currentWord);
};

GameRoom.prototype.addedDrawing = function addedDrawing (socket) {
	if (socket == this.currentPlayer) {
		this.currentPlayerDrew = true;
	}
};

GameRoom.prototype.getStatus = function getStatus () {
	var players = [];
	for (var k = 0; k < this.players.length; k++) {
		players.push({
			id: this.players[k].id,
			score: this.players[k].gamescore
		});
	}

	return {
		currentPlayer: this.currentPlayer.id,
		players: players,
		timeLeft: this.endTime - Date.now()
	};
};

module.exports = GameRoom;