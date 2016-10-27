var drawingTypes = ["line", "brush", "block"];
var tinycolor = require("tinycolor2");
var FIX_CANVAS_PIXEL_SIZE = 0.5;

function decodeDrawing (drawing) {
    drawing.color = tinycolor(drawing.color);
    return drawing;
}

var Canvas = require("canvas");

function TiledCanvas (canvas, settings) {
    this.canvas = canvas;

    this.leftTopX = 0;
    this.leftTopY = 0;
    this.zoom = 1; // 2 = two times zoomed in

    this.affecting = [[0, 0], [0, 0]];
    this.chunks = {};
    // this.chunks[chunkX][chunkY] is a context or 'empty'

    this.settings = this.normalizeDefaults(settings, this.defaultSettings);
    this.contextQueue = [];
    this.context = this.createContext();
}

TiledCanvas.prototype.defaultSettings = {
    chunkSize: 256
};

TiledCanvas.prototype.drawDrawings = function drawDrawings (drawings, callback) {
    var todo = drawings.length;

    function lowerAndCheck () {
        todo--;
        if (todo == 0) callback();
    }

    for (var k = 0; k < drawings.length; k++) {
        this.drawDrawing(decodeDrawing(drawings[k]), lowerAndCheck);
    }

    if (todo == 0) callback();
};

TiledCanvas.prototype.drawDrawing = function drawDrawing (decodedDrawing, callback) {
    if (!decodedDrawing) {
        callback();
        return;
    }
    
    this.drawFunctions[decodedDrawing.type](this.context, decodedDrawing, this, callback);
};

TiledCanvas.prototype.drawFunctions = {
    brush: function (context, drawing, tiledCanvas, callback) {
        if (typeof drawing.x !== "number" ||
            typeof drawing.y !== "number" ||
            typeof drawing.size !== "number") {
            callback();
            return;
        }

        context.beginPath();
        context.arc(drawing.x, drawing.y, drawing.size, 0, 2 * Math.PI, true);
        context.fillStyle = drawing.color;
        context.fill();

        if (tiledCanvas) {
            tiledCanvas.drawingRegion(drawing.x, drawing.y, drawing.x, drawing.y, drawing.size);
            tiledCanvas.executeNoRedraw(callback);
        }
    },
    block: function (context, drawing, tiledCanvas, callback) {
        if (typeof drawing.x !== "number" ||
            typeof drawing.y !== "number" ||
            typeof drawing.size !== "number") {
            callback();
            return;
        }

        context.fillStyle = drawing.color;
        context.fillRect(drawing.x, drawing.y, drawing.size, drawing.size);

        if (tiledCanvas) {
            tiledCanvas.drawingRegion(drawing.x, drawing.y, drawing.x, drawing.y, drawing.size);
            tiledCanvas.executeNoRedraw(callback);
        }
    },
    line: function (context, drawing, tiledCanvas, callback) {        
        if (typeof drawing.x !== "number" ||
            typeof drawing.y !== "number" ||
            typeof drawing.x1 !== "number" ||
            typeof drawing.y1 !== "number" ||
            typeof drawing.size !== "number") {
            callback();
            return;
        }

        context.beginPath();

        context.moveTo(drawing.x, drawing.y + FIX_CANVAS_PIXEL_SIZE);
        context.lineTo(drawing.x1, drawing.y1 + FIX_CANVAS_PIXEL_SIZE);
        
        context.strokeStyle = drawing.color.toRgbString();
        context.lineWidth = drawing.size;

        context.lineCap = "round";

        context.stroke();
        
        if (tiledCanvas) {
            tiledCanvas.drawingRegion(drawing.x, drawing.y, drawing.x1, drawing.y1, drawing.size);
            tiledCanvas.executeNoRedraw(callback);
        }
    },
    path: function (ctx, path, tiledCanvas, callback) {
        if (typeof path.size !== "number") {
            callback();
            return;
        }

        if (!path.points || path.points.length < 2) {
            callback();
            return;
        }
        
        var minX = path.points[0][0],
            minY = path.points[0][1],
            maxX = path.points[0][0],
            maxY = path.points[0][1]; 

        // Start on the first point
        ctx.beginPath();
        if (typeof path.points[0][0] !== "number" || typeof path.points[0][1] !== "number") {
            callback();
            return;
        }

        ctx.moveTo(path.points[0][0], path.points[0][1] + FIX_CANVAS_PIXEL_SIZE);

        // Connect a line between all points
        for (var pointId = 1; pointId < path.points.length; pointId++) {
            if (typeof path.points[pointId][0] !== "number" ||
                typeof path.points[pointId][1] !== "number")
                continue;

            ctx.lineTo(path.points[pointId][0], path.points[pointId][1] + FIX_CANVAS_PIXEL_SIZE);

            minX = Math.min(path.points[pointId][0], minX);
            minY = Math.min(path.points[pointId][1], minY);
            maxX = Math.max(path.points[pointId][0], maxX);
            maxY = Math.max(path.points[pointId][1], maxY);
        }

        ctx.strokeStyle = path.color.toRgbString();
        ctx.lineWidth = path.size;

        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.stroke();
        tiledCanvas.drawingRegion(minX, minY, maxX, maxY, path.size);
        tiledCanvas.executeNoRedraw(callback);
    },
    text: function (ctx, drawing, tiledCanvas, callback) {
        if (typeof drawing.size !== "number" ||
            typeof drawing.x !== "number" ||
            typeof drawing.y !== "number") {
            callback();
            return;
        }
        ctx.font = drawing.size + "px Verdana, Geneva, sans-serif";
        ctx.fillStyle = drawing.color.toRgbString();

        ctx.fillText(drawing.text, drawing.x, drawing.y);        
        
        var canvas = new Canvas();
        var hiddenContext = canvas.getContext('2d');
        hiddenContext.font = drawing.size + "pt Verdana, Geneva, sans-serif";
        var textWidth = hiddenContext.measureText(drawing.text).width;

        tiledCanvas.drawingRegion(drawing.x, drawing.y - drawing.size, drawing.x + textWidth, drawing.y, drawing.size);
        tiledCanvas.executeNoRedraw(callback);
    }
};

TiledCanvas.prototype.cloneObject = function (obj) {
	var clone = {};
	for (var k in obj) {
		if (typeof obj[k] === "object" && !(obj[k] instanceof Array)) {
			clone[k] = this.cloneObject(obj[k]);
		} else {
			clone[k] = obj[k]
		}
	}
	return clone;
};

TiledCanvas.prototype.normalizeDefaults = function normalizeDefaults (target, defaults) {
	target = target || {};
	var normalized = this.cloneObject(target);
	for (var k in defaults) {
		if (typeof defaults[k] === "object" && !(defaults[k] instanceof Array)) {
			normalized[k] = this.normalizeDefaults(target[k] || {}, defaults[k]);
		} else {
			normalized[k] = target[k] || defaults[k];
		}
	}
	return normalized;
};


TiledCanvas.prototype.redraw = function redraw (noclear) {
    if (!noclear) this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    var startChunkX = Math.floor(this.leftTopX / this.settings.chunkSize),
        endChunkX   = Math.ceil((this.leftTopX + this.canvas.width / this.zoom) / this.settings.chunkSize),
        startChunkY = Math.floor(this.leftTopY / this.settings.chunkSize),
        endChunkY   = Math.ceil((this.leftTopY + this.canvas.height / this.zoom) / this.settings.chunkSize);
    
    for (var chunkX = startChunkX; chunkX < endChunkX; chunkX++) {
        for (var chunkY = startChunkY; chunkY < endChunkY; chunkY++) {
            this.drawChunk(chunkX, chunkY);
        }
    }
};

TiledCanvas.prototype.drawChunk = function drawChunk (chunkX, chunkY) {
    if (this.chunks[chunkX] && this.chunks[chunkX][chunkY] && this.chunks[chunkX][chunkY] !== "empty") {
        this.ctx.drawImage(this.chunks[chunkX][chunkY].canvas, ((chunkX * this.settings.chunkSize) - this.leftTopX) * this.zoom, ((chunkY * this.settings.chunkSize) - this.leftTopY) * this.zoom, this.settings.chunkSize * this.zoom, this.settings.chunkSize * this.zoom);
    } else if(typeof this.requestUserChunk == "function" && (!this.chunks[chunkX] || this.chunks[chunkX][chunkY] !== "empty")) {
        this.requestChunk(chunkX, chunkY);
    }
};

TiledCanvas.prototype.goto = function goto (x, y) {
    this.leftTopX = x;
    this.leftTopY = y;
    this.redraw();
};

TiledCanvas.prototype.relativeZoom = function relativeZoom (zoom) {
    this.zoom *= zoom;
    this.redraw();
};

TiledCanvas.prototype.absoluteZoom = function absoluteZoom (zoom) {
    this.zoom = zoom;
    this.redraw();
};

TiledCanvas.prototype.execute = function execute (callback) {
    this.executeNoRedraw(callback);
    this.redraw();
};

TiledCanvas.prototype.executeNoRedraw = function executeNoRedraw (callback) {
    var todo = 0;
    callback = callback || function () {};

    function lowerAndCheck () {
        todo--;
        if (todo == 0) callback();
    }

    // These are split into 2 main loops to ensure callback only gets called once
    for (var chunkX = this.affecting[0][0]; chunkX < this.affecting[1][0]; chunkX++) {
        for (var chunkY = this.affecting[0][1]; chunkY < this.affecting[1][1]; chunkY++) {
            todo++;
        }
    }

    for (var chunkX = this.affecting[0][0]; chunkX < this.affecting[1][0]; chunkX++) {
        for (var chunkY = this.affecting[0][1]; chunkY < this.affecting[1][1]; chunkY++) {
            this.executeChunk(chunkX, chunkY, this.contextQueue, lowerAndCheck);
        }
    }

    this.contextQueue = [];
    if (todo == 0) callback();
};

TiledCanvas.prototype.clearAll = function clearAll () {
    this.contextQueue = [];
    for (var chunkX in this.chunks) {
        this.clearChunkRow(chunkX);
    }
};

TiledCanvas.prototype.clearChunkRow = function clearChunkRow (chunkX) {
    for (var chunkY in this.chunks[chunkX]) {
        this.clearChunk(chunkX, chunkY);
    }
};

TiledCanvas.prototype.clearChunk = function clearChunk (chunkX, chunkY) {
    if (this.chunks[chunkX][chunkY] == "empty") return;
	this.chunks[chunkX][chunkY].clearRect(chunkX * this.settings.chunkSize, chunkY * this.settings.chunkSize, this.chunks[chunkX][chunkY].canvas.width, this.chunks[chunkX][chunkY].canvas.height);
};

TiledCanvas.prototype.requestChunk = function requestChunk (chunkX, chunkY, callback) {
    // Request a chunk and redraw once we got it
    if (typeof this.requestUserChunk !== "function") return;
    this.requestChunkCallbackList = this.requestChunkCallbackList || {};

    if (this.requestChunkCallbackList[chunkX] && this.requestChunkCallbackList[chunkX][chunkY]) {
        if (!callback) return;
        // This chunk has already been requested, add to the callback list
        this.requestChunkCallbackList[chunkX][chunkY].push(callback);
    } else {
        this.requestChunkCallbackList[chunkX] = this.requestChunkCallbackList[chunkX] || {};

        var queue = [];
        if (callback) queue.push(callback);
        this.requestChunkCallbackList[chunkX][chunkY] = queue;

        this.requestUserChunk(chunkX, chunkY, function (image) {
            // For responsiveness make sure the callback doesnt happen in the same event frame
            setTimeout(this.setUserChunk.bind(this, chunkX, chunkY, image));
        }.bind(this));
    }
};

TiledCanvas.prototype.setUserChunk = function setUserChunk (chunkX, chunkY, image) {
    // Don't set the user chunk twice
    if (this.chunks[chunkX] && this.chunks[chunkX][chunkY]) return;

    // If the image is falsy and there is no queue then this chunk is transparent
    // for performance reasons empty chunks should not allocate memory
    if (!image && (!this.requestChunkCallbackList[chunkX] || this.requestChunkCallbackList[chunkX][chunkY].lenth == 0)) {
        this.chunks[chunkX] = this.chunks[chunkX] || {};
        this.chunks[chunkX][chunkY] = "empty";
        return;
    }

    // Draw the chunk
    this.chunks[chunkX] = this.chunks[chunkX] || {};
    this.chunks[chunkX][chunkY] =  this.newCtx(this.settings.chunkSize, this.settings.chunkSize, -chunkX * this.settings.chunkSize, -chunkY * this.settings.chunkSize);

    if (image) {
        try {
            this.chunks[chunkX][chunkY].drawImage(image, chunkX * this.settings.chunkSize, chunkY * this.settings.chunkSize);
        } catch (e) {
            console.log(chunkX, chunkY, "Failed to draw.");
        }
    }

    // Run all callbacks
    var callbackList = this.requestChunkCallbackList[chunkX][chunkY];
    for (var k = 0; k < callbackList.length; k++) {
        callbackList[k]();
    }

    delete this.requestChunkCallbackList[chunkX][chunkY];
};

TiledCanvas.prototype.copyArray = function copyArray (arr) {
    var temp = [];
    for (var k = 0; k < arr.length; k++) {
        temp[k] = arr[k];
    }
    return temp;
};

TiledCanvas.prototype.executeChunk = function executeChunk (chunkX, chunkY, queue, callback) {
    callback = callback || function () {};
    queue = queue || this.contextQueue;

    // Executes the current queue on a chunk
    // If queue is set execute that queue instead
    this.chunks[chunkX] = this.chunks[chunkX] || {};
 
    if (!this.chunks[chunkX][chunkY] || this.chunks[chunkX][chunkY] == "empty") {
        // This chunk has never been painted to before
        // We first have to ask what this chunk looks like
        // Remember the Queue untill we got the chunk
        // if we already remembered a queue then add this queue to it
        // Only do this when we actually want to use userdefined chunks
        if (typeof this.requestUserChunk == "function" && this.chunks[chunkX][chunkY] !== "empty") {
            this.requestChunk(chunkX, chunkY, function (queue) {
                this.executeChunk(chunkX, chunkY, queue, callback);
            }.bind(this, this.copyArray(queue)));
            return;
        } else {
            this.chunks[chunkX][chunkY] =  this.newCtx(this.settings.chunkSize, this.settings.chunkSize, -chunkX * this.settings.chunkSize, -chunkY * this.settings.chunkSize);
        }
    }

    var ctx = this.chunks[chunkX][chunkY];

    for (var queuekey = 0; queuekey < queue.length; queuekey++) {
        if (typeof ctx[queue[queuekey][0]] === 'function') {
            this.executeQueueOnChunk(ctx, queue[queuekey]);
        } else {
            ctx[queue[queuekey][0]] = queue[queuekey][1];
        }
    }

    callback();
};

TiledCanvas.prototype.executeQueueOnChunk = function executeQueueOnChunk (ctx, args) {
    ctx[args[0]].apply(ctx, Array.prototype.slice.call(args, 1));
};

TiledCanvas.prototype.drawingRegion = function (startX, startY, endX, endY, border) {
    border = border || 0;
    this.affecting[0][0] = Math.floor((Math.min(startX, endX) - border) / this.settings.chunkSize);
    this.affecting[0][1] = Math.floor((Math.min(startY, endY) - border) / this.settings.chunkSize);
    this.affecting[1][0] = Math.ceil((Math.max(endX, startX) + border) / this.settings.chunkSize);
    this.affecting[1][1] = Math.ceil((Math.max(endY, startY) + border) / this.settings.chunkSize);
};

TiledCanvas.prototype.newCtx = function newCtx (width, height, translateX, translateY) {
    var canvas = new Canvas(width, height);
    var ctx = canvas.getContext('2d');
    ctx.translate(translateX, translateY);
    return ctx;
};

TiledCanvas.prototype.createContext = function createContext () {
    var context = {};
    var canvas = new Canvas();
    var ctx = canvas.getContext('2d');
    for (var key in ctx) {
        if (typeof ctx[key] === 'function') {
            context[key] = function (func) {
                this.contextQueue.push(arguments);
            }.bind(this, key);
        } else if (typeof ctx[key] !== 'object') {
            context.__defineGetter__(key, function (key) {
                var ctx = this.newCtx();
                for (var queuekey = 0; queuekey < this.contextQueue.length; queuekey++) {
                    if (typeof ctx[args[0]] === 'function') {
                        ctx[args[0]].apply(ctx, args.slice(1));
                    } else {
                        ctx[args[0]] = args[1];
                    }
                }
                return ctx[key];
            }.bind(this, key));

            context.__defineSetter__(key, function (key, value) {
                this.contextQueue.push(arguments);
            }.bind(this, key));
        }
    }
    return context;
};

// This function can be used to save the chunks
// 
// saveFunction will be called for every chunk with (canvas, x, y, callback)
// you have to call the callback after the chunk is saved
// 
// callback will be called after all chunks have been saved
TiledCanvas.prototype.save = function save (saveFunction, callback) {
    var todo = 0;

    function lowerAndCheck () {
        todo--;
        if (todo == 0) callback();
    }

    // Two seperate loops to ensure callback gets called only once
    for (var x in this.chunks) {
        for (var y in this.chunks[x]) {
            todo++;
        }
    }
    
    for (var x in this.chunks) {
        for (var y in this.chunks[x]) {
            this.chunks[x][y].canvas.toBuffer(function (x, y, err, data) {
                saveFunction(err, data, x, y, lowerAndCheck);
            }.bind(this, x, y));
        }
    }

    if (todo == 0) callback();
};

module.exports = TiledCanvas;