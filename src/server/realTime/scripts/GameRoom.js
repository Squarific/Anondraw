var words = require("./words.js");

var TIME_PER_WORD = 120 * 1000; // How long can we draw
var TIME_TO_PICK = 15 * 1000; // How long we can pick
var WORD_PICK_COUNT = 5; // Amount of words we can pick from

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function GameRoom (name, io) {
	this.currentPlayer;
	this.gameTimeout;
	this.currentWord;

	this.io = io;
	this.name = name;
	this.players = [];
	this.boundword = this.assignWord.bind(this);
}

GameRoom.prototype.join = function join (socket) {
	this.players.push(socket);
	socket.gamescore = 0;
	socket.on("word", this.boundword);

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

	socket.removeListener("word", this.boundword);
};

GameRoom.prototype.chatmessage = function chatmessage (socket, message) {
	if (socket == this.currentPlayer) return;

	if (!message || typeof message.toLowerCase !== "function") return;
	if (!this.currentWord || typeof this.currentWord.toLowerCase !== "function") return;

	if (message.toLowerCase().indexOf(this.currentWord.toLowerCase()) !== -1) {
		// Word has been guessed, get a new word and assign next player
		this.io.to(socket.room).emit("chatmessage", {
			user: "GAME",
			message: "The word " + this.currentWord + " has been guessed by " + socket.name
		});

		socket.gamescore += 5;
		this.currentPlayer.gamescore += 2;

		this.nextGame(true);
		return true;
	}
};

GameRoom.prototype.nextGame = function nextGame (guessed) {
	clearTimeout(this.gameTimeout);

	// If noone is in the room, stop playing
	if (this.players.length == 0) {
		delete this.currentPlayer;
		return;
	}

	if (!this.currentWord && this.currentPlayer) {
		this.io.to(this.name).emit("chatmessage", {
			user: "GAME",
			message: this.currentPlayer.name + " did not pick a word."
		});	
	}

	// Was the previous game succesful?
	if (!guessed && this.currentPlayer && this.currentWord) {
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
				message: this.currentPlayer.name + " didn't draw again. He got kicked!"
			});

			this.currentPlayer.disconnect();
		} else {
			this.io.to(this.name).emit("chatmessage", {
				user: "GAME",
				message: this.currentPlayer.name + " didn't draw. Next time he will be kicked!"
			});
			this.currentPlayer.hasNotDrawn = true;
		}
	} else {
		if (this.currentPlayer) delete this.currentPlayer.hasNotDrawn;
	}

	if (this.currentPlayer) this.currentPlayer.emit("endturn");

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
	// CURRENTLY REMOVED
	this.currentPlayerDrew = true;

	var sendWords = [];
	for (var k = 0; k < WORD_PICK_COUNT; k++)
		sendWords.push(words[Math.floor(Math.random() * words.length)]);

	delete this.currentWord;
	this.currentPlayer.emit("words", sendWords);
	this.sendWords = sendWords;
	this.waitForWordsTimeout = setTimeout(this.forceWord.bind(this), TIME_TO_PICK);
	this.dispatchEvent({
		type: "newgame"
	});
};

GameRoom.prototype.assignWord = function assignWord (word) {
	clearTimeout(this.waitForWordsTimeout);

	if (this.sendWords.indexOf(word) === -1) {
		console.log("[CHEATER] ", this.currentPlayer.ip, this.sendWords, word);
		this.nextGame();
		this.io.to(this.currentPlayer.room).emit("chatmessage", {user: "GAME", message: this.currentPlayer.name + " cheated!"});
		return;
	}

	// Assign new word
	this.currentWord = word;

	// Arrange the time stuff
	this.gameTimeout = setTimeout(this.nextGame.bind(this), TIME_PER_WORD);
	this.endTime = Date.now() + TIME_PER_WORD;

	console.log("[GAME][" + this.name + "] Current player (" + this.currentPlayer.name + ") current word '" + this.currentWord + "' playercount " + this.players.length);

	// Send the current state
	this.io.to(this.currentPlayer.room).emit("gamestatus", this.getStatus());
	this.currentPlayer.emit("gameword", this.currentWord);
};

GameRoom.prototype.forceWord = function forceWord () {
	if (!this.currentWord) {
		this.nextGame()
	}
};

GameRoom.prototype.addedDrawing = function addedDrawing (socket) {
	if (socket == this.currentPlayer) {
		this.currentPlayerDrew = true;
	}
};

GameRoom.prototype.getStatus = function getStatus () {
	return {
		currentPlayer: this.currentPlayer.id,
		letters: this.currentWord ? this.currentWord.length : 0,
		timeLeft: this.endTime - Date.now()
	};
};

/**
 * Event dispatcher
 * License mit
 * https://github.com/mrdoob/eventdispatcher.js
 * @author mrdoob / http://mrdoob.com/
 */

var EventDispatcher = function () {}

EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.addEventListener = EventDispatcher.prototype.addEventListener;
		object.hasEventListener = EventDispatcher.prototype.hasEventListener;
		object.removeEventListener = EventDispatcher.prototype.removeEventListener;
		object.dispatchEvent = EventDispatcher.prototype.dispatchEvent;

	},

	addEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) this._listeners = {};

		var listeners = this._listeners;

		if ( listeners[ type ] === undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	},

	hasEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return false;

		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {

			return true;

		}

		return false;

	},

	removeEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {

			var index = listenerArray.indexOf( listener );

			if ( index !== - 1 ) {

				listenerArray.splice( index, 1 );

			}

		}

	},

	dispatchEvent: function ( event ) {
			
		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [];
			var length = listenerArray.length;

			for ( var i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( var i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}

};

EventDispatcher.prototype.apply(GameRoom.prototype);

module.exports = GameRoom;