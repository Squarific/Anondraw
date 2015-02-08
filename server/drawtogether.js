function DrawTogether (database) {
	this.database = database;
}

DrawTogether.prototype.addChatMessage = function addChatMessage (room, data) {
	this.database.query("INSERT INTO msg SET ?", {
		room: room,
		user: data.user,
		message: data.message,
		now: new Date()
	}, function (err) {
		if (err)
			console.error(err);
	});
};

DrawTogether.prototype.addDrawing = function addDrawing (room, drawing, callback) {
	// Put the given drawing in the database for the given room, returns err if error

	if (!drawing || !drawing[4] || typeof drawing[4].substr !== "function") {
		console.log("INVALID DRAWING", drawing)
		callback("Drawing should be an array with a string on the fourth index.");
		return;
	}

	this.database.query("INSERT INTO drawings SET ?", {
		room: room,
		type: drawing[0],
		x: drawing[1],
		y: drawing[2],
		size: drawing[3],
		r: parseInt(drawing[4].substr(1, 2), 16),
		g: parseInt(drawing[4].substr(3, 2), 16),
		b: parseInt(drawing[4].substr(5, 2), 16),
		x1: drawing[5],
		y1: drawing[6],
		now: new Date()
	}, function (err) {
		if (err) {
			callback("Something went wrong trying to write your drawing into the database, it has been removed!");
			return;
		}
		callback();
	});
};

DrawTogether.prototype.getDrawings = function getDrawings (room, callback) {
	// Return a list of network transmittable drawings

	var self = this;
	this.database.query("SELECT * FROM (SELECT id, type, x, y, x1, y1, size, r, g, b, room FROM drawings WHERE room = ? ORDER BY id DESC LIMIT 10000) AS T ORDER BY id ASC", room, function (err, rows) {
		if (err) {
			console.log(err);
			callback("Something went wrong while trying to retrieve the drawings from the database!");
			return;
		}
		self.encodeDrawings(rows, function (drawings) {
			callback(undefined, drawings);
		});
	});
	// callback(undefined, [])
};

DrawTogether.prototype.encodeDrawings = function encodeDrawings (drawings, callback) {
	// Turn the drawing objects from the database into arrays
	// so they take less space when send to the client

	var new_drawings = [];

	for (var key = 0; key < drawings.length; key++) {
		new_drawings[key] = this.encodeDrawing(drawings[key]);
	}

	callback(new_drawings);
};

DrawTogether.prototype.encodeDrawing = function encodeDrawing (drawing) {
	// Turn a single drawing into an array so it takes less
	// space when transmitting over the network

	var newDrawing = [drawing.type, drawing.x, drawing.y, drawing.size, drawing.r.toString(16) + drawing.g.toString(16) + drawing.b.toString(16)];

	if (drawing.x1) newDrawing.push(drawing.x1);
	if (drawing.y1) newDrawing.push(drawing.y1);

	return newDrawing; 
};

module.exports = DrawTogether;