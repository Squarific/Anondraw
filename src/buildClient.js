var compressor = require('node-minify');
var fs = require("fs");

console.log("Listening to changes to client/scripts and client/css, will rebuild on file change.");
console.log("Also rebuilding JS and CSS now.");

rebuildJs();
rebuildCss();

var rebuildJSTimeout,
	rebuildCssTimeout;

fs.watch("client/scripts", function (event) {
	// Wait 100ms after the last change and reset if timer not reached
	// Most editors will do multiple edits for saving one file, this also
	// prevents ghost tmp files
	clearTimeout(rebuildJSTimeout);
	rebuildJSTimeout = setTimeout(rebuildJs, 100);
});
fs.watch("client/css", function (event) {
	// Wait 100ms after the last change and reset if timer not reached
	// Most editors will do multiple edits for saving one file, this also
	// prevents ghost tmp files
	clearTimeout(rebuildCssTimeout);
	rebuildCssTimeout = setTimeout(rebuildCss, 100);
});

var rebuildingJs = false;
function rebuildJs () {
	// If we are already rebuilding, let it finish first
	// then rebuild again
	if (rebuildingJs) {
		setTimeout(rebuildJs, 800);
		return;
	}

	console.log("[JS CHANGED] Rebuilding js files");

	rebuildingJs = true;
	new compressor.minify({
	    type: 'gcc',
	    fileIn: "client/scripts/*.js",
	    fileOut: 'client/DrawTogether.min.js',
	    options: ["--language_in=ES5"],
	    callback: function(err, min) {
	   		rebuildingJs = false;
	    	if (err) {
	    		console.log("[ERROR] Rebuilding JS failed", err);
	    		return;
	    	}
			console.log("JS FILE REBUILD");
	    }
	});
}

var rebuildingCss = false;
function rebuildCss () {
	// If we are already rebuilding, let it finish first
	// then rebuild again
	if (rebuildingCss) {
		setTimeout(rebuildCss, 800);
		return;
	}

	console.log("[CSS CHANGED] Rebuilding css files");

	rebuildingCss = true;
	new compressor.minify({
	    type: 'yui-css',
	    fileIn: "client/css/*.css",
	    fileOut: 'client/DrawTogether.min.css',
	    callback: function(err, min) {
	   		rebuildingCss = false;
	    	if (err) {
	    		console.log("[ERROR] Rebuilding CSS failed", err);
	    		return;
	    	}
			console.log("CSS FILE REBUILD");
	    }
	});
}
