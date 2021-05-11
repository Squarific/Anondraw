const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const minify = require("@node-minify/core");
const uglifyES = require("@node-minify/uglify-es");
const cleanCSS = require("@node-minify/clean-css");
const mustache = require("mustache");
// const exec = require("child_process").execSync;
// const chokidar = require('chokidar');

var imagefolder = './dist/images/emotes';

let emojiList = [];

var emojifiles = fs.readdirSync(imagefolder);

emojifiles.forEach(function (filename) {
	var filePath = path.join(imagefolder, filename);
	var stats = fs.statSync(filePath);
	if (stats.isFile()) {
		emojiList.push({ "name": filename.slice(0, -4), "path": 'images/emotes/' + filename });
		//console.log('Name:', filename.slice(0, -4), 'directory:', 'images/emotes/' + filename);
	}
});
if (emojiList.length > 0)
	emojiList[emojiList.length - 1].last = 1;

console.log("Read emojis");

let config = _.merge(
	require("./info.json"),
	require("./config.js"),
	{
		version: "2825593"
	},
	{
		"emojiList": emojiList,
		"emojiName": function () {
			return this.name;
		},
		"emojiPath": function () {
			return this.path;
		}
	}
);

var lastBuild = Date.now();
var building = 0;
if (process.argv[2] == "repeat") {
	setInterval(function () {
		if (Date.now() - lastBuild > 2000) {
			build();
		}
	}, 10000);

}

build();

function build() {
	lastBuild = Date.now();
	if (building !== 0) return console.log("ALREADY BUILDING", building);

	console.log("=== Starting a build ===");
	building = 3;

	minify({
		compressor: uglifyES,
		input: "src/scripts/**/*.js",
		output: "dist/anondraw.min.js",
		options: {
			warnings: true, // pass true to display compressor warnings.
			mangle: true, // pass false to skip mangling names.
			compress: true // pass false to skip compressing entirely. Pass an object to specify custom compressor options.
		},
		callback: function (err, min) {
			if (err) {
				console.log("[ERROR] Rebuilding scripts failed", err);
				return;
			}
			console.log("Scripts rebuilt.");
			building--;
		}
	});

	console.log("Submitted script rebuilding job");

	minify({
		compressor: cleanCSS,
		input: "src/css/*.css",
		output: "dist/anondraw.min.css",
		callback: function (err, min) {
			if (err) {
				console.log("[ERROR] Rebuilding styles failed", err);
				return;
			}
			console.log("Styles rebuilt.");
			building--;
		}
	});

	console.log("Submitted style rebuilding job");

	fs.readdir("src", function (err, files) {
		if (err) {
			console.log("[ERROR] Reading directory", err)
			return
		}

		for (let i = 0; i < files.length; i++) {
			let file = path.join("src", files[i]);
			if (fs.statSync(file).isFile()) {
				let content = fs.readFileSync(file, { encoding: "utf8" });
				fs.writeFileSync(
					path.join("dist", files[i]),
					mustache.render(content, config));
			}
		}

		console.log("Templates rebuilt.");
		building--;
	});

	console.log("Submitted templates rebuilding job");
}
