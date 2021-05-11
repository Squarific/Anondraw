const router = require('express').Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const fs = require('fs');
var path = require('path');
const jwt = require('jsonwebtoken');

const privateKeyPath = path.join(__dirname, '..', '..', 'jwtsignkey.key');
const privateKey = fs.readFileSync(privateKeyPath);

const SELECT_PLUGINUUID = `SELECT BIN_TO_UUID(useruuid) as useruuid FROM plugins WHERE uuid = UUID_TO_BIN(?); `;

const SELECT_QUERY_LATEST_VERSION = `
    SELECT major, minor, patch FROM versions
    WHERE pluginuuid = UUID_TO_BIN(?)
    ORDER BY major DESC, minor DESC, patch DESC 
    LIMIT 1
    ; `;
const INSERT_QUERY = "INSERT INTO `versions` (pluginuuid, major, minor, patch, releasenotes, source) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?)";

const GENERIC_DB_ERROR = {
    errors: [{
        msg: "Internal database error"
    }]
};

const JWT_ERROR = {
    errors: [{
        msg: "Jwt decode failed"
    }]
};

const PLUGIN_NOT_FOUND_ERROR = {
    errors: [{
        msg: "Plugin not found or not plugin owner"
    }]
};

module.exports = (database) => {
    router.post('/:pluginuuid', [
        param('pluginuuid').isLength({ min: 36, max: 36 }),
        body('releasenotes'),
        body('source'),
        body('bearer'),
        body('changetype')
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let useruuid
        try {
            useruuid = jwt.verify(req.body.bearer, privateKey)
        } catch (error) {
            return res.status(401).json(JWT_ERROR);
        }

        database.query(SELECT_PLUGINUUID + SELECT_QUERY_LATEST_VERSION, [req.params.pluginuuid, req.params.pluginuuid], (err, result) => {
            if (err) {
                console.log("Find pluginversion database error", err, req.params.pluginuuid);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            if (!result || !result[0] || !result[0][0] || result[0][0].useruuid != useruuid.uuid) {
                return res.status(400).json(PLUGIN_NOT_FOUND_ERROR);
            }
            
            const dbVersion = result[1] && result[1][0];
            const VERSION_ZERO = { major: 0, minor: 0, patch: 0 };
            newVersion = calculateNextVersion(dbVersion || VERSION_ZERO, req.body.changetype);

            addNewVerwion(newVersion)
        })

        function addNewVerwion(newVersion) {
            database.query(INSERT_QUERY, [req.params.pluginuuid, newVersion.major, newVersion.minor, newVersion.patch, req.body.releasenotes, req.body.source], (err, result) => {
                if (err) {
                    console.log("New plugin database error", err, req.params.pluginuuid);
                    return res.status(504).json(GENERIC_DB_ERROR);
                }
                return res.status(200).json({
                    newversion: `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`
                });
            });
        }

        function calculateNextVersion(versionData, changetype) {
            // TODO trow error if versions < 255
            let { major, minor, patch } = { ...versionData }
            switch (changetype) {
                case "major":
                    major++
                    minor = 0
                    patch = 0
                    break;
                case "minor":
                    minor++
                    patch = 0
                    break;
                case "patch":
                    patch++
                    break;
            }
            return { major, minor, patch };

        }
    });

    return router;
};
