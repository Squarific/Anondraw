let _ = require("lodash");
let fs = require("fs");
let path = require("path");
let compressor = require("node-minify");
let mustache = require("mustache")
let exec = require("child_process").execSync;

var imagefolder = './dist/images/emotes';

let emojiList = [];

var emojifiles = fs.readdirSync(imagefolder);
	
emojifiles.forEach(function(filename) {
	var filePath = path.join(imagefolder, filename);
	var stats = fs.statSync(filePath);
	if(stats.isFile()){
		emojiList.push({"name": filename.slice(0, -4), "path": 'images/emotes/' + filename});
		console.log('Name:', filename.slice(0, -4), 'directory:', 'images/emotes/' + filename);
	}
});
if (emojiList.length > 0)
	emojiList[emojiList.length -1].last = 1;

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
if (process.argv[2] == "repeat") {
	fs.watch("src", { recursive: true }, function () {
		// Don't build too often, changes often happen multiple times
		// with a lot of text editors even with a single save
		if (Date.now() - lastBuild > 5000) build();
	});
}

build();

function build() {
	lastBuild = Date.now();
	compressor.minify({
		compressor: "gcc",
		input: "src/scripts/**/*.js",
		output: "dist/anondraw.min.js",
		options: [ "--language_in=ES5" ],
		callback: function(err, min) {
			if (err) {
				console.log("[ERROR] Rebuilding scripts failed", err);
				return;
			}
			console.log("Scripts rebuilt.");
		}
	});

	compressor.minify({
		compressor: "yui-css",
		input: "src/css/*.css",
		output: "dist/anondraw.min.css",
		callback: function(err, min) {
			if (err) {
				console.log("[ERROR] Rebuilding styles failed", err);
				return;
			}
			console.log("Styles rebuilt.");
		}
	});

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
	});
}
