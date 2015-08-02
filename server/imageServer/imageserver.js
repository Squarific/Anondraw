var http = require("http");
var drawcode = require("./draw_password.js");

var Canvas = require("canvas");
var fs = require("fs");

var room_regex = /^[a-z0-9_]+$/i;
var currentlyDrawing = {};

function drawOnCanvas (ctx, drawing) {
	
}

fs.readFile("./images/transparent.png", function (err, transparent) {
	if (err) throw "Transparent image unavailable! Err: " + err;

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
				res.end(transparent);
				return;
			}

			fs.readFile("./images/" + room + "/" + x + "-" + y + ".png", function (err, data) {
				if (err) {
					res.end(transparent);
					return;
				}

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

			var x = parseInt(parsedUrl.query.x);
			var y = parseInt(parsedUrl.query.y);
			var room = parsedUrl.query.room;

			if (currentlyDrawing[room]) {
				res.end('{"error": "This room is busy"}');
				return;
			}
			currentlyDrawing[room] = true;

			if (!room_regex.test(room)) {
				res.end(transparent);
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
					console.log("Error parsing the drawings, is it valid json?", e, body);
					res.end('{"error": "Invalid json!"}');
					return;
				}
				
				var tiledCanvas = new TiledCanvas(function (x, y, callback) {
					fs.readFile("./images/" + room + "/" + x + "-" + y + ".png", function (err, img) {
						if (err) {
							if (err.code !== "ENOENT") {
								throw "Image load error: " + err;
							}
							img = transparent;
						}

						callback(img);
					});
				});

				tiledCanvas.drawDrawings(data);
				tiledCanvas.save(function (canvas, x, y, callback) {
					fs.writeFile("./images/" + room + "/" + x + "-" + y + ".png", data, function (err) {
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
				return;
			});
			return;
		}

		res.end('{"error": "Unknown command"}');
	}.bind(this)).listen(5552);
});
