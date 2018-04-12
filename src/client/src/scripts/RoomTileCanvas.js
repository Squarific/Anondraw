/*
	Events:
		'click': {
			position: [Number, Number] //[x, y] in real world coords
		}
	
	Call this.requestData(server, room); to start or this.useTiles();
*/

function RoomTileCanvas (favList, settings) {
	this.container = document.createElement("div");
	
	this.container.classList.add("roomTileCanvas");
	this.errorDiv = this.container.appendChild(document.createElement("div"));
	this.errorDiv.classList.add("status no-error");
	this.errorDiv.appendChild(document.createTextNode("Loading..."));
	
	this.settings = this.utils.merge(this.utils.copy(settings), this.defaultSettings);
	
	var canvas = this.container.appendChild(document.createElement("canvas"));
	this.tiledCanvas = new TiledCanvas(canvas);
	this.tiledCanvas.requestUserChunk = this.requestChunk.bind(this);
	
	this.callbacks = [];
	
	this.favList = favList;
	
	// Easier debugging
	canvas.tiledCanvas = this.tiledCanvas;
	canvas.roomTileCanvas = this;
	
	window.addEventListener("resize", this.resize.bind(this));
	this.resize();
	
	document.addEventListener("mousedown", this.startDrag.bind(this));
	document.addEventListener("mousemove", this.drag.bind(this));
	document.addEventListener("mouseup", this.stopDrag.bind(this));
	document.addEventListener("touchstart", this.startDrag.bind(this));
	document.addEventListener("touchmove", this.drag.bind(this));
	document.addEventListener("touchend", this.stopDrag.bind(this));
	document.addEventListener("wheel", this.wheel.bind(this));
}

RoomTileCanvas.prototype.drawFavList = function drawFavList () {
	for (var k = 0; k < this.favList.length; k++) {
		var radius = 2;
		var relativeX = this.favList[k].x / this.settings.originalSize * this.settings.tileSize;
		var relativeY = this.favList[k].y / this.settings.originalSize * this.settings.tileSize;
		
		var ctx = document.createElement("canvas").getContext("2d");
		ctx.font = "22px Arial";
		var width = ctx.measureText(this.favList[k].name).width;

		this.tiledCanvas.context.fillStyle = "#323e4a";

		this.tiledCanvas.context.font = "22px Arial";
		this.tiledCanvas.context.fillText(this.favList[k].name, relativeX - width / 2, relativeY - 3);

		this.tiledCanvas.context.beginPath();
		this.tiledCanvas.context.arc(relativeX, relativeY, radius, 0, 2 * Math.PI);
		this.tiledCanvas.context.fill();

		this.tiledCanvas.drawingRegion(relativeX - width / 2, relativeY - 25, relativeX + width / 2, relativeY + radius, 5);
		this.tiledCanvas.executeNoRedraw();
	}
	
	this.tiledCanvas.redraw();
};

RoomTileCanvas.prototype.wheel = function wheel (event) {
	if (event.target === this.tiledCanvas.canvas) {
		// I'm assuming deltaY is 100 or -100
		var coords = this.getCoords(event, this.tiledCanvas.canvas);
		this.tiledCanvas.relativeZoom(1 - (event.deltaY / 1000), coords[0], coords[1]);
		if (this.tiledCanvas.zoom < 0.1) this.tiledCanvas.absoluteZoom(0.1, coords[0], coords[1]);
	}
};

RoomTileCanvas.prototype.startDrag = function startDrage (event) {
	if (event.target !== this.tiledCanvas.canvas) return;
	event.preventDefault();
	var coords = this.getCoords(event, this.tiledCanvas.canvas);
	
	this.startCoords = coords;
	this.moved = false;
};

RoomTileCanvas.prototype.drag = function drag (event) {
	if (!this.startCoords) return;
	event.preventDefault();
	var coords = this.getCoords(event, this.tiledCanvas.canvas);
	
	if (this.startCoords[0] - coords[0] !== 0 ||
	    this.startCoords[1] - coords[1] !== 0) {
	
		this.tiledCanvas.goto(
			this.tiledCanvas.leftTopX + ((this.startCoords[0] - coords[0]) / this.tiledCanvas.zoom),
			this.tiledCanvas.leftTopY + ((this.startCoords[1] - coords[1]) / this.tiledCanvas.zoom)
		);
		
		this.startCoords = coords;
		this.moved = true;
	}
};

RoomTileCanvas.prototype.stopDrag = function stopDrag (event) {	
	if (!this.moved && this.startCoords) {
		var coords = this.getCoords(event, this.tiledCanvas.canvas);
		this.dispatchEvent({
			type: "click",
			position: [
				(this.tiledCanvas.leftTopX + (coords[0] / this.tiledCanvas.zoom)) / this.settings.tileSize * this.settings.originalSize,
				(this.tiledCanvas.leftTopY + (coords[1] / this.tiledCanvas.zoom)) / this.settings.tileSize * this.settings.originalSize
			]
		});
	}
	delete this.startCoords;
	this.moved = false;
};

RoomTileCanvas.prototype.getCoords = function getCoords (event, forceTarget) {
	// If there is no clientX/Y (meaning no mouse event) and there are no changed touches
	// meaning no touch event, then we can't get the coords relative to the target element
	// for this event
	if ((typeof event.clientX !== "number" && (!event.changedTouches || !event.changedTouches[0])) ||
		(typeof event.clientY !== "number" && (!event.changedTouches || !event.changedTouches[0])))
		return [0, 0];

	// Return the coordinates relative to the target element
	var clientX = (typeof event.clientX === 'number') ? event.clientX : event.changedTouches[0].clientX,
	    clientY = (typeof event.clientY === 'number') ? event.clientY : event.changedTouches[0].clientY,
	    target = forceTarget || event.target || document.elementFromPoint(clientX, clientY);

	var relativeX = clientX - target.getBoundingClientRect().left,
	    relativeY = clientY - target.getBoundingClientRect().top;

	return [relativeX, relativeY];
};


RoomTileCanvas.prototype.utils = {
	copy: function (object) {
		// Returns a deep copy of the object
		var copied_object = {};
		for (var key in object) {
			if (typeof object[key] == "object") {
				copied_object[key] = this.copy(object[key]);
			} else {
				copied_object[key] = object[key];
			}
		}
		return copied_object;
	},
	merge: function (targetobject, object) {
		// All undefined keys from targetobject will be filled
		// by those of object (goes deep)
		if (typeof targetobject != "object") {
			targetobject = {};
		}

		for (var key in object) {
			if (typeof object[key] == "object") {
				targetobject[key] = this.merge(targetobject[key], object[key]);
			} else if (typeof targetobject[key] == "undefined") {
				targetobject[key] = object[key];
			}
		}

		return targetobject;
	}
};

RoomTileCanvas.prototype.defaultSettings = {
	tileSize: 16,         // How big tiles should be drawn
	originalSize: 1024,   // The original size of a tile
	tileColor: "#f3f3f3"  // Color of the tiles
};

RoomTileCanvas.prototype.resize = function resize () {
	this.tiledCanvas.canvas.width = this.tiledCanvas.canvas.offsetWidth;
	this.tiledCanvas.canvas.height = this.tiledCanvas.canvas.offsetHeight;
	this.tiledCanvas.redraw();
};

RoomTileCanvas.prototype.drawTiles = function drawTiles (tiles) {
	for (var k = 0; k < tiles.length; k++) {
		var coords = tiles[k].split("_");
		this.drawTile(parseInt(coords[0]), parseInt(coords[1]));
	}
	
	this.tiledCanvas.redraw();
};

RoomTileCanvas.prototype.start = function start () {
	for (var k = 0; k < this.callbacks.length; k++) {
		this.callbacks[k]();
	}
};

RoomTileCanvas.prototype.requestChunk = function requestChunk (x, y, callback) {
	if (!this.tiles) {
		this.callbacks.push(this.requestChunk.bind(this, x, y, callback));
		return;
	}
	
	var canvas = document.createElement("canvas");
	canvas.width = this.tiledCanvas.settings.chunkSize;
	canvas.height = this.tiledCanvas.settings.chunkSize;
	
	var ctx = canvas.getContext("2d");
	
	
	var minX = Math.floor(x * this.tiledCanvas.settings.chunkSize / this.settings.tileSize);
	var minY = Math.floor(y * this.tiledCanvas.settings.chunkSize / this.settings.tileSize);
	var maxX = Math.ceil((x + 1) * this.tiledCanvas.settings.chunkSize / this.settings.tileSize);
	var maxY = Math.ceil((y + 1) * this.tiledCanvas.settings.chunkSize / this.settings.tileSize);
	
	for (var x = minX; x < maxX; x++) {
		for (var y = minY; y < maxY; y++) {
			if (this.tiles[x] && this.tiles[x][y]) {
				ctx.rect(
					(x - minX) * this.settings.tileSize,
					(y - minY) * this.settings.tileSize,
					this.settings.tileSize,
					this.settings.tileSize
				);
			}
		}
	}
	
	ctx.fillStyle = this.settings.tileColor;
	ctx.fill();
	
	ctx.lineWidth = 1;
	ctx.strokeStyle = "black";
	ctx.stroke();
	
	callback(canvas);
};

RoomTileCanvas.prototype.decodeTiles = function decodeTiles (tiles) {
	var object = {};

	for (var k = 0; k < tiles.length; k++) {
		var coords = tiles[k].split("_");
		coords[0] = parseInt(coords[0]);
		coords[1] = parseInt(coords[1]);
		object[coords[0]] = object[coords[0]] || {};
		object[coords[0]][coords[1]] = true;
	}

	return object;
};

RoomTileCanvas.prototype.displayError = function displayError (err) {
	while (this.errorDiv.firstChild)
		this.errorDiv.removeChild(this.errorDiv.firstChild);
	
	this.errorDiv.appendChild(document.createTextNode(err));
};

RoomTileCanvas.prototype.requestData = function requestData (server, room) {
	delete this.tiles;
	this.tiledCanvas.clearAll();
	
	var req = new XMLHttpRequest();
	
	req.addEventListener("readystatechange", function (event) {
		if (req.status == 200 && req.readyState == 4) {
			var data = JSON.parse(req.responseText);

			if (data.error) {
				this.displayError("Could not load tile map: " + data.error);
				return;
			}

			this.displayError("Drag to move, click to teleport, scrollwheel to zoom.");
			this.tiles = this.decodeTiles(data.tiles);
			this.drawFavList();
			this.start();
		} else if (req.readyState == 4) {
			this.displayError("Could not load tile map. Are you connected to the internet? Status code: " + req.status);
		}
	}.bind(this));

	var url = server + "/tiles?room=" + encodeURIComponent(room);

	req.open("GET", url);
	req.send();
};

RoomTileCanvas.prototype.useTiles = function useTiles (tiles) {
	this.displayError("Drag to move, click to teleport, scrollwheel to zoom.");
	this.tiles = tiles;
	this.drawFavList();
	this.start();
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

EventDispatcher.prototype.apply(RoomTileCanvas.prototype);