function Protocol (io, drawtogether) {
	this.io = io;
	this.drawTogether = drawtogether;
	this.bindIO();
}

Protocol.prototype.sendChatMessage = function sendChatMessage (room, data) {
	console.log("[CHAT] [" + room + "]" + data.user + ": " + data.message);
	this.io.to(room).emit("chatmessage", data);
};

Protocol.prototype.sendDrawing = function sendDrawing (room, drawing) {
	this.io.to(room).emit("drawing", drawing);
};

Protocol.prototype.bindIO = function bindIO () {
	var protocol = this;

	this.io.on("connection", function (socket) {
		// Give the user a name and send it to the client, then bind
		// all events so we can answer the client when it asks something

		socket.username = "Anonymouse";
		socket.emit("initname", socket.username);

		socket.on("chatmessage", function (message) {
			// User is trying to send a message, if he is in a room
			// send the message to all other users, otherwise show an error

			if (!socket.room) {
				socket.emit("chatmessage", "You can't chat unless you are in a room!");
				return;
			}

			protocol.sendChatMessage(socket.room ,{
				user: socket.username,
				message: message
			});
		});

		socket.on("changename", function (name) {
			// Change the username

			socket.username = name;
		})

		socket.on("drawing", function (drawing, callback) {
			// The client drew something and wants to add it to the room
			// If a valid drawing put it in the database and send it to
			// the reast of the people in the room

			if (typeof callback !== "function")
				callback = function () {};

			protocol.drawTogether.addDrawing(socket.room, drawing, function (err) {
				if (!err) {
					protocol.sendDrawing(socket.room, drawing);
				} else {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					})
				}

				callback();
			});
		})

		socket.on("changeroom", function (room) {
			// User wants to change hes room, subscribe the socket to the
			// given room, tell the user he is subscribed and send the drawing.

			socket.leave(socket.room);
			socket.join(room);
			socket.room = room;

			socket.emit("chatmessage", {
				user: "SERVER",
				message: "Changed room to " + room + ", loading drawings..."
			});

			protocol.drawTogether.getDrawings(room, function (err, drawings) {
				if (err) {
					socket.emit("chatmessage", {
						user: "SERVER",
						message: err
					});
					drawings = [];
				}
				socket.emit("drawings", {
					room: socket.room,
					drawings: drawings
				})
			})
		});
	});
};

module.exports = Protocol;