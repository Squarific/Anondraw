function TiledCanvas (loadChunk, chunkSize) {
	this.chunkSize = 256 || chunkSize;
	this.loadChunk = loadChunk;
}

TiledCanvas.prototype.drawChunk = function drawChunk (drawing, x, y, callback) {
	this.chunk[x] = this.chunk[x] || {};
	
};

// Put all the drawings on the canvas
TiledCanvas.prototype.drawDrawings = function drawDrawings (drawings) {
	// 	var canvas = new Canvas(256, 256);
	// 	var ctx = canvas.getContext("2d");
		
	// 	var background = new Image();
	// 	background.src = img;
	// 	ctx.drawImage(background, 0, 0);

	// 	for (var k = 0; k < data.length; k++) {
	// 		drawOnCanvas(ctx, data[k]);
	// 	}

	// 	canvas.toBuffer(function (err, data) {
	// 		if (err) {
	// 			res.end('{"error": "Couldn\'t draw"}');
	// 			console.log("[DRAW][ERROR] Failed to buffer", err);
	// 			return;
	// 		}

			
	// 	});					
	// });
};

// This function can be used to save the chunks
// 
// saveFunction will be called for every chunk with (canvas, x, y, callback)
// you have to call the callback after the chunk is saved
// 
// callback will be called after all chunks have been saved
TiledCanvas.prototype.save = function save (saveFunction, callback) {
	var todo = 0;

	for (var x in this.chunks) {
		for (var y in this.chunks[x]) {
			todo++;

			this.chunks[x][y].toBuffer(function (x, y, err, data) {
				if (err) {
					console.log("toBuffer error", err);
					return;
				}

				saveFunction(data, x, y, function () {
					todo--;
					if (todo == 0) callback();
				});
			}.bind(this, x, y));
		}
	}

	if (todo == 0) callback();
};

module.exports = TiledCanvas;