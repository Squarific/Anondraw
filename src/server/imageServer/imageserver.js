require("../../common/nice_console_log.js");
var config = require("../../common/config.js");

var https = require("https");
var drawcode = config.service.image.password.draw;

var Canvas = require("canvas");
var TiledCanvas = require("./scripts/TiledCanvas.js");
var fs = require('graceful-fs');

var options = {
	key: fs.readFileSync(config.permfolder + '/privkey.pem'),
	cert: fs.readFileSync(config.permfolder + '/cert.pem'),
	ca: fs.readFileSync(config.permfolder + '/chain.pem')
};

var mkdirp = require('mkdirp');

var room_regex = /^[a-z0-9_]+$/i;
var currentlyDrawing = {};

fs.readFile("./images/background.png", function (err, transparentBytes) {
	if (err) throw "Transparent image unavailable! Err: " + err;

	transparent = new Canvas.Image();
	transparent.src = transparentBytes;

	function newTiledCanvas(room) {
		var tiledCanvas = new TiledCanvas();

		tiledCanvas.requestUserChunk = function (x, y, callback) {
			fs.readFile("./images/" + room + "/" + x + "_" + y + ".png", function (err, imgBytes) {
				if (err) {
					if (err.code !== "ENOENT") {
						throw "Image load error: " + err;
					}

					callback(transparent);
					return;
				}

				if (imgBytes.length == 0) {
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

	var server = https.createServer(options, function (req, res) {
		var url = require("url");
		var parsedUrl = url.parse(req.url, true);

		if (parsedUrl.pathname == "/chunk") {
			var x = parseInt(parsedUrl.query.x);
			var y = parseInt(parsedUrl.query.y);
			var room = parsedUrl.query.room;

			if (!room_regex.test(room)) {
				res.writeHead(200, {
					"Access-Control-Allow-Origin": "*",
					"Content-Type": "image/png"
				});
				res.end(transparentBytes);
				return;
			}

			fs.readFile("./images/" + room + "/" + x + "_" + y + ".png", function (err, data) {
				if (err && err.code === "ENOENT") {
					res.writeHead(200, {
						"Access-Control-Allow-Origin": "*",
						"Content-Type": "image/png"
					});
					res.end(transparentBytes);
					return;
				}

				if (err) {
					console.log("Chunk error:", err, x, y);
					res.writeHead(502);
					res.end();
					return;
				}

				res.writeHead(200, {
					"Access-Control-Allow-Origin": "*",
					"Content-Type": "image/png"
				});

				if (data.length === 0) {
					// Shouldn't happen but if it does, just send transparent
					res.end(transparentBytes);
					return;
				}

				// TODO: CACHE
				res.end(data, "binary");
			});
			return;
		}

		if (parsedUrl.pathname == "/tiles") {
			var room = parsedUrl.query.room;

			res.writeHead(200, {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "application/json"
			});

			if (!room_regex.test(room)) {
				res.end(JSON.stringify({ err: "The room should only contain lowercase alphanumeric characters and _" }));
				return;
			}

			fs.readdir("./images/" + room, function (err, items) {
				if (err && err.code == "ENOENT") {
					res.end(JSON.stringify({
						err: null,
						tiles: []
					}));
					return;
				}

				if (err) {
					console.log("Readdir failed on room", room, err);
					res.end(JSON.stringify({ err: "Could not load tiles." }));
					return;
				}

				var tiles = [];
				for (var k = 0; k < items.length; k++) {
					tiles.push(items[k].replace(".png", ""));
				}

				res.end(JSON.stringify({
					err: null,
					tiles: tiles
				}));
			});

			return;
		}

		if (parsedUrl.pathname == "/drawings") {
			res.writeHead(200, {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "application/json"
			});

			if (drawcode !== parsedUrl.query.drawcode) {
				console.log("Wrong drawcode", drawcode, parsedUrl.query.drawcode);
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
					currentlyDrawing[room] = false;
					return;
				}

				mkdirp('./images/' + room, function (err) {
					if (err) {
						res.end('{"error": "Faulty directory"}');
						console.log("Error creating image folder for room", room, err);
						currentlyDrawing[room] = false;
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

							fs.writeFile("./images/" + room + "/" + x + "_" + y + ".png", bytes, function (err) {
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

							// In case there is a memory leak, this might help
							tiledCanvas.chunks = {};
						});
					});
				});
			});
			return;
		}

		res.end('{"error": "Unknown command"}');
	}.bind(this)).listen(config.service.image.port);
});
