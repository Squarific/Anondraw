function Protocol (io, drawtogether) {
	this.io = io;
	this.drawtogether = drawtogether;
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
		socket.username = "Anonymouse";
		socket.emit("initname", socket.username);

		socket.on("chatmessage", function (message) {
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
			socket.username = name;
		})

		socket.on("drawing", function (drawing, callback) {
			protocol.drawTogether.addDrawing(socket.room, drawing, function (err) {
				if (!err)
					protocol.sendDrawing(socket.room, drawing);

				callback();
			});
		})

		socket.on("changeroom", function (room) {
			socket.leave(socket.room);
			socket.join(room);
			socket.room = room;

			socket.emit("chatmessage", {
				user: "SERVER",
				message: "Changed room to " + room + " loading drawings..."
			});

			protocol.drawtogether.getDrawings(room, function (drawings) {
				socket.emit("drawings", drawings)
			})
		});
	});
};

module.exports = Protocol;