var http = require("http");
var drawcode = require("./draw_password.js");

var Canvas = require("canvas");
var TiledCanvas = require("./scripts/TiledCanvas.js");
var fs = require("fs");

var mkdirp = require('mkdirp');

var room_regex = /^[a-z0-9_]+$/i;
var currentlyDrawing = {};

fs.readFile("./images/background.png", function (err, transparentBytes) {
	if (err) throw "Transparent image unavailable! Err: " + err;

	transparent = new Canvas.Image();
	transparent.src = transparentBytes;

	function newTiledCanvas (room) {
		var tiledCanvas = new TiledCanvas();

		tiledCanvas.requestUserChunk = function (x, y, callback) {
			fs.readFile("./images/" + room + "/" + x + "-" + y + ".png", function (err, imgBytes) {
				if (err) {
					if (err.code !== "ENOENT") {
						throw "Image load error: " + err;
					}

					callback(transparent);
					return;
				}

				var img = new Canvas.Image();
				img.src = imgBytes;
				callback(img);
			});
		};

		return tiledCanvas;
	}

	var server = http.createServer(function (req, res) {
		var url = require("url");
		var parsedUrl = url.parse(req.url, true);

		if (parsedUrl.pathname == "/chunk") {
			var x = parseInt(parsedUrl.query.x);
			var y = parseInt(parsedUrl.query.y);
			var room = parsedUrl.query.room;

			res.writeHead(200, {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "image/png"
			});

			if (!room_regex.test(room)) {
				res.end(transparentBytes);
				return;
			}

			fs.readFile("./images/" + room + "/" + x + ":" + y + ".png", function (err, data) {
				if (err) {
					res.end(transparentBytes);
					return;
				}

				// TODO: CACHE
				res.end(data, "binary");
			});
			return;
		}

		if (parsedUrl.pathname == "/drawings") {
			res.writeHead(200, {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "application/json"
			});

			if (drawcode !== parsedUrl.query.drawcode) {
				res.end('{"error": "Wrong drawcode"}');
				return;
			}

			if (req.method !== 'POST') {
				res.end('{"error": "This command is only supported using POST"}');
				return;
			}

			var room = parsedUrl.query.room;

			if (currentlyDrawing[room]) {
				res.end('{"error": "This room is busy"}');
				return;
			}
			currentlyDrawing[room] = true;

			if (!room_regex.test(room)) {
				res.end(transparentBytes);
				return;
			}

			var body = '';
			req.on('data', function (data) {
				body += data;

				// If the body length is bigger than 10MB
				// stop the connection
				if (body.length > 1e7) {
					req.connection.destroy();
					console.log("[DRAWING] Request too big!");
				}
			});

			req.on('end', function () {
				try {
					var data = JSON.parse(body);
				} catch (e) {
					console.log("Error parsing the drawings, is it valid json?", e);
					res.end('{"error": "Invalid json!"}');
					return;
				}
				
				mkdirp('./images/' + room, function (err) {
					if (err) {
						res.end('{"error": "Faulty directory"}');
						console.log("Error creating image folder for room", room, err);
						return;
					}

					var tiledCanvas = newTiledCanvas(room);

					tiledCanvas.drawDrawings(data, function () {
						tiledCanvas.save(function (err, bytes, x, y, callback) {
							if (err) {
								console.log("Error saving chunk ", x, y, " of room ", room);
								callback();
								return;
							}

							fs.writeFile("./images/" + room + "/" + x + ":" + y + ".png", bytes, function (err) {
								if (err) {
									console.log("[DRAW][ERROR] Save image error", err);
									callback();
									return;
								}

								callback();
							});
						}, function () {
							res.end('{"success": "done"}');
							currentlyDrawing[room] = false;
						});
					});
				});
			});
			return;
		}

		res.end('{"error": "Unknown command"}');
	}.bind(this)).listen(5552);
});
