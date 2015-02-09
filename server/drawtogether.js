function DrawTogether (database) {
	this.database = database;
}

DrawTogether.prototype.rgbToHex = function rgbToHex (r, g, b) {
	var hex = ((r << 16) | (g << 8) | b).toString(16);
	return "#" + ("000000" + hex).slice(-6);
};

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

	if (drawing[3] > 100) {
		callback("Don't try to cheat the system please!");
		return;
	}

	if (typeof drawing[5] == "number" && typeof drawing[6] && this.sqDistance([drawing[1], drawing[2]], [drawing[5], drawing[6]]) > 9000000) {
		callback("That's a bit long don't you think?");
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

DrawTogether.prototype.sqDistance = function sqDistance (point1, point2) {
	var xDist = point1[0] - point2[0];
	var yDist = point1[1] - point2[1];
	return xDist * xDist + yDist * yDist;
};

DrawTogether.prototype.getDrawings = function getDrawings (room, callback) {
	// Return a list of network transmittable drawings

	var self = this;
	this.database.query("SELECT * FROM (SELECT id, type, x, y, x1, y1, size, r, g, b, room FROM drawings WHERE room = ? ORDER BY id DESC LIMIT 20000) AS T ORDER BY id ASC", room, function (err, rows) {
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

	var newDrawing = [drawing.type, drawing.x, drawing.y, drawing.size, this.rgbToHex(drawing.r, drawing.g, drawing.b)];

	if (drawing.x1) newDrawing.push(drawing.x1);
	if (drawing.y1) newDrawing.push(drawing.y1);

	return newDrawing; 
};

module.exports = DrawTogether;