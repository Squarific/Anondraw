let fs = require("fs")
let path = require("path")

function readConfig() {
    let dir = __dirname, last;
    let env = process.env.NODE_ENV;
    let base = "./configs/config.json";

    if (env) {
        base = env.trim().toLowerCase() + "." + base;
    }

    while (dir !== last) {
        let file = path.join(dir, base);
        let read = false;

        try {
            let stat = fs.statSync(file);
            if (stat.isFile()) {
                read = true;
            }
        } catch (_) { }

        if (read) {
            try {
                return readJson(file);
            } catch (e) {
                throw base + ": " + e;
            }
        }

        last = dir;
        dir = path.dirname(dir);
    }

    throw "No configuration file `" + base + "` found.";
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, { encoding: "utf8" }));
}

module.exports = readConfig();
