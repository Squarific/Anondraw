var words = require("./words.js");
var TIME_PER_WORD = 20 * 1000;

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
		socket.emit("gamestatus", this.getStatus());
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

GameRoom.prototype.chatmessage = function chatMessage (socket, message) {
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
	delete this.gameTimeout;

	// If noone is in the room, stop playing
	if (this.players.length == 0) {
		delete this.currentPlayer;
		return;
	}

	// Assign new drawer
	for (var k = 0; k < this.players.length; k++) {
		if (this.players[k] == this.currentPlayer) {
			this.currentPlayer = this.players[(k + 1) % this.players.length];
			break;
		}
	}

	// There was no current player before
	if (!this.currentPlayer) {
		this.currentPlayer = this.players[0];
	}

	// Was the previous game succesful?
	if (!guessed) {
		this.io.to(this.currentPlayer.room).emit("chatmessage", {
			user: "GAME",
			message: "The word " + this.currentWord + " has not been guessed!"
		});
	}

	// Assign new word
	this.currentWord = words[Math.floor(Math.random() * words.length)];

	// Arrange the time stuff
	this.gameTimeout = setTimeout(this.nextGame.bind(this), TIME_PER_WORD);
	this.endTime = Date.now() + TIME_PER_WORD;

	console.log("[GAME][" + this.name + "] Current player (" + this.currentPlayer.username + ") current word '" + this.currentWord + "' playercount " + this.players.length);

	// Send the current state
	this.io.to(this.currentPlayer.room).emit("gamestatus", this.getStatus());
	this.currentPlayer.emit("generalmessage", "It is your turn! Please draw: '" + this.currentWord + "'");
	this.currentPlayer.emit("chatmessage", {
		user: "GAME",
		message: "It is your turn! Please draw: '" + this.currentWord + "'"
	});
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
		timeLeft: Date.now() - this.endTime
	};
};

module.exports = GameRoom;