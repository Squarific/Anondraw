var CACHE_LENGTH = 4000; //How many drawingparts are held before being send to permanent
var PARTS_PER_DRAWING = 10;
var CACHE_IGNORE = 200; // How many drawings we ignore in the cache count
var WAIT_BEFORE_SYNC_RETRY = 20000;

function DrawTogether (background) {
	this.drawings = {};
	this.paths = {};
	this.background = background;
}

DrawTogether.prototype.forceSend = function forceSend (callback){
	var message = "Rooms ";
	for( var room in this.drawings ) {
		if(!this.drawings[room].sending){
			this.drawings[room].ignoreCache = true;
			message += room + " ";
		}

	}
	callback(message + "are set for sync.")
};

DrawTogether.prototype.addDrawing = function addDrawing (room, drawing, callback) {
	// Put the given drawing in the database for the given room
	this.drawings[room] = this.drawings[room] || [];
	this.drawings[room].currentParts = this.drawings[room].currentParts || 0;
	this.drawings[room].push(drawing);

	// If it is a path, add how many points there are, otherwise add the value for drawings
	this.drawings[room].currentParts += drawing.points ? drawing.points.length : PARTS_PER_DRAWING;
	
	// If we have enough drawings and they are long enough
	// and if we are not yet sending anything and this is not a gameroom
	// then we will sync the drawings with the background server
	if ( ( this.drawings[room].currentParts > CACHE_LENGTH || this.drawings[room].ignoreCache ) &&
	    ( this.drawings[room].length > CACHE_IGNORE || this.drawings[room].ignoreCache ) &&
		( new Date() - (this.drawings[room].last_send_to_img_server || 0) > WAIT_BEFORE_SYNC_RETRY ) &&
	    !this.drawings[room].sending &&
	    !room.indexOf("game_") == 0 &&
	    !room.indexOf("private_game_") == 0) {

		// Make sure we wait till the server responded
		this.drawings[room].sending = true;

		var cacheIgnore = (this.drawings[room].ignoreCache) ? 0 : CACHE_IGNORE; // ignore cache on forcesync
		
		this.drawings[room].sendLength = this.drawings[room].length - cacheIgnore; 

		if (typeof this.onFinalize == "function") this.onFinalize(room, cacheIgnore);
		else console.log("No finalize handler");

		this.background.sendDrawings(room, this.drawings[room].slice(0, this.drawings[room].sendLength), function (err) {
			this.drawings[room].last_send_to_img_server = new Date();
			if (err) {
				this.drawings[room].sending = false;
				this.drawings[room].ignoreCache = true;
				console.log("[SENDDRAWING][ERROR] ", err);
				return;
			}
			
			this.drawings[room].splice(0, this.drawings[room].sendLength);

			// Reset the amount of parts, we recount instead of
			// subtracting what we send to ensure it never goes out of sync
			this.drawings[room].currentParts = this.countParts(this.drawings[room], cacheIgnore);
			
			if(this.drawings[room].ignoreCache)
				console.log("Room " + room + " force synced.");
			else
				console.log("Room " + room + " synced.");
			this.drawings[room].sending = false;
			this.drawings[room].ignoreCache = false;
			
		}.bind(this));
	}

	callback(true);
};

DrawTogether.prototype.clearAll = function clearAll () {
	this.drawings = {};
	this.paths = {};
};

DrawTogether.prototype.clear = function clear (room) {
	if (!room) {
		console.log("Clear called with no room");
		return false;
	} else {
		delete this.drawings[room];
		delete this.paths[room];
	}
};

DrawTogether.prototype.undoDrawings = function undoDrawings (room, socketid, all) {
	this.removePath(room, socketid);

	if (!this.drawings || !this.drawings[room]) return;

	var stop = 0;
	if (this.drawings[room].sending) {
		stop = this.drawings[room].sendLength;
	}

	for (k = this.drawings[room].length - 1; k >= stop; k--) {
		if (this.drawings[room][k].id == socketid || this.drawings[room][k].socketid == socketid) {
			this.drawings[room].splice(k, 1);

			if (!all) return;
		}
	}
};

DrawTogether.prototype.countParts = function countParts (drawingList, cacheIgnore) {
	var size = 0;

	for (var k = 0; k < drawingList.length - cacheIgnore; k++)
		size += drawingList[k].points ? drawingList[k].points.length : 1;

	return size;
};

DrawTogether.prototype.addPath = function addPath (room, id, props) {
	this.paths[room] = this.paths[room] || {};
	this.finalizePath(room, id);
	this.paths[room][id] = props;
};

DrawTogether.prototype.addPathPoint = function addPathPoint (room, id, point) {
	if (!this.paths[room] || !this.paths[room][id]) return false;
	this.paths[room][id].points = this.paths[room][id].points || [];
	this.paths[room][id].points.push(point);
	return true;
};

DrawTogether.prototype.finalizePath = function finalizePath (room, id, callback) {
	callback = callback || function () {};

	if (!this.paths[room] || !this.paths[room][id]) {
		callback(false);
		return false;
	}

	this.addDrawing(room, this.paths[room][id], callback);
	this.removePath(room, id);
};

DrawTogether.prototype.removePath = function removePath (room, id) {
	this.paths[room] && delete this.paths[room][id];
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

DrawTogether.prototype.getPaths = function getPaths (room, callback) {
	callback(null, this.paths[room] || {});
};

DrawTogether.prototype.inkUsageFromDrawing = function inkUsageFromDrawing (drawing) {
	// If its a brush the ink usage is (size * size)
	// If it is a line the ink usage is (size * length)
	var length = drawing.size;

	if (typeof drawing.x1 == "number")
		length = this.utils.distance(drawing.x, drawing.y, drawing.x1, drawing.y1);

	return Math.ceil(drawing.size * length / 25);
};

// Returns the inkusage for a pathpoint
// (point1, point2, size) or (point1, undefined, size)
DrawTogether.prototype.inkUsageFromPath = function inkUsageFromPath (point1, point2, size) {
	var length = size + (point2 ? this.utils.distance(point1[0], point1[1], point2[0], point2[1]) : 0);
	return Math.ceil(size * length / 25);
};

DrawTogether.prototype.utils = {
	distance: function (x1, y1, x2, y2) {
		// Returns the distance between (x1, y1) and (x2, y2)
		var xDis = x1 - x2,
		    yDis = y1 - y2;
		return Math.sqrt(xDis * xDis + yDis * yDis);
	}
};

module.exports = DrawTogether;