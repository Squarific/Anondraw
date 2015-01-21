var fs = require("fs");

console.log("Listening to changes to client/scripts and client/css, will rebuild on file change.");
console.log("Also rebuilding JS and CSS now.");

rebuildJs();
rebuildCss();

var rebuildJSTimeout,
	rebuildCssTimeout;

fs.watch("client/scripts", function (event) {
	// Wait 100ms after the last change and reset if timer not reached
	// Mose editors will do multiple edits for saving one file, this also
	// prevents ghost tmp files
	clearTimeout(rebuildJSTimeout);
	rebuildJSTimeout = setTimeout(rebuildJs, 100);
});
fs.watch("client/css", function (event) {
	// Wait 100ms after the last change and reset if timer not reached
	// Mose editors will do multiple edits for saving one file, this also
	// prevents ghost tmp files
	clearTimeout(rebuildCssTimeout);
	rebuildCssTimeout = setTimeout(rebuildCss, 100);
});

function rebuildJs () {
	fs.readdir("client/scripts", function (err, files) {
		if (err) throw err;

		var minimizedFile = "";
		for (var fKey = 0; fKey < files.length; fKey++) {
			minimizedFile += fs.readFileSync("client/scripts/" + files[fKey], {encoding: "utf-8"}) + "\n";
		}

		fs.writeFile("client/DrawTogether.min.js", minimizedFile, function (err) {
			if (err) throw err;
			console.log("JS FILE REBUILD");
		});
	});
}

function rebuildCss () {
	fs.readdir("client/css", function (err, files) {
		if (err) throw err;

		var minimizedFile = "";
		for (var fKey = 0; fKey < files.length; fKey++) {
			minimizedFile += fs.readFileSync("client/css/" + files[fKey], {encoding: "utf-8"}) + "\n";
		}

		fs.writeFile("client/DrawTogether.min.css", minimizedFile, function (err) {
			if (err) throw err;
			console.log("CSS FILE REBIULD");
		});
	});
}