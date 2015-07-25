var CACHE_LENGTH = 30000; //How many drawings are saved

function DrawTogether () {
	this.drawings = {};
}

DrawTogether.prototype.rgbToHex = function rgbToHex (r, g, b) {
	var hex = ((r << 16) | (g << 8) | b).toString(16);
	return "#" + ("000000" + hex).slice(-6);
};

// DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
// 	// If its a brush the ink usage is ceil(size * size / 100)
// 	// If it is a line the ink usage is ceil(size * length * 2 / 100)
// 	var length = drawing[3];

// 	if (typeof drawing[5] == "number")
// 		length = this.utils.distance(drawing[1], drawing[2], drawing[5], drawing[6]) * 2;

// 	return Math.ceil(drawing[3] * length / 100);
// };

DrawTogether.prototype.addDrawing = function addDrawing (room, drawing, callback) {
	// Put the given drawing in the database for the given room, returns err if error
	this.drawings[room] = this.drawings[room] || [];
	this.drawings[room].push(drawing);
	this.drawings[room].splice(0, this.drawings[room] - CACHE_LENGTH);
	callback();
};

DrawTogether.prototype.sqDistance = function sqDistance (point1, point2) {
	var xDist = point1[0] - point2[0];
	var yDist = point1[1] - point2[1];
	return xDist * xDist + yDist * yDist;
};

DrawTogether.prototype.getDrawings = function getDrawings (room, callback) {
	// Return a list of network transmittable drawings
	callback(null, this.drawings[room] || []);
};

DrawTogether.prototype.utils = {
	distance: function (x1, y1, x2, y2) {
		// Returns the distance between (x1, y1) and (x2, y2)
		var xDis = x1 - x2,
		    yDis = y1 - y1;
		return Math.sqrt(xDis * xDis + yDis * yDis);
	}
};

module.exports = DrawTogether;