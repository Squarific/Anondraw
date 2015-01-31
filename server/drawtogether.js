function DrawTogether (database) {
	this.database = database;
}

DrawTogether.prototype.addDrawing = function addDrawing (room, drawing, callback) {
	// Put the given drawing in the database for the given room, returns err if error
	this.database.query("INSERT INTO drawings SET ?", {
		if (!drawing || typeof drawing[4].substr !== "function")
			return;

		room: room,
		type: drawing[0],
		x: drawing[1],
		y: drawing[2],
		size: drawing[3],
		r: parseInt(drawing[4].substr(1, 2), 16),
		g: parseInt(drawing[4].substr(3, 2), 16),
		b: parseInt(drawing[4].substr(5, 2), 16),
		x1: drawing[5],
		y1: drawing[6]
	}, function (err) {
		callback(err);
	});
};

DrawTogether.prototype.getDrawings = function getDrawings (room, callback) {
	// Return a list of network transmittable drawings
	var self = this;
	this.database.query("SELECT * FROM drawings WHERE room = ?", room, function (err, rows) {
		setTimeout(function () {
			self.encodeDrawings(rows, callback);
		}, 0);
	});
};

DrawTogether.prototype.encodeDrawings = function encodeDrawings (drawings, callback) {
	var new_drawings = [];

	for (var key = 0; key < drawings.length; key++) {
		new_drawings[key] = this.encodeDrawing(drawings[key]);
	}

	callback(new_drawings);
};

DrawTogether.prototype.encodeDrawing = function encodeDrawing (drawing) {
	var newDrawing = [drawing.type, drawing.x, drawing.y, drawing.size, drawing.r.toString(16) + drawing.g.toString(16) + drawing.b.toString(16)];

	if (drawing.x1) newDrawing.push(drawing.x1);
	if (drawing.y1) newDrawing.push(drawing.y1);

	return newDrawing; 
};

module.exports = DrawTogether;