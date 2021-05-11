const router = require('express').Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
var path = require('path');
const jwt = require('jsonwebtoken');

const privateKeyPath = path.join(__dirname, '..', '..', 'jwtsignkey.key');
const privateKey = fs.readFileSync(privateKeyPath);

const INSERT_QUERY_PLUGIN = "INSERT INTO `plugins` (uuid, useruuid, name, description) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)";
const INSERT_QUERY_VERSION = "INSERT INTO `versions` (pluginuuid, major, minor, patch, releasenotes, source) VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?)";
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

module.exports = (database) => {
    router.post('/', [
        body('name').isLength({ min: 3, max: 255 }),
        body('description'),
        body('bearer'),
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const pluginuuid = uuidv4();
        let useruuid
        try {
            useruuid = jwt.verify(req.body.bearer, privateKey)
        } catch (error) {
            return res.status(401).json(JWT_ERROR);
        }

        database.query(INSERT_QUERY_PLUGIN, [pluginuuid, useruuid.uuid, req.body.name, req.body.description], (err, result) => {
            if (err) {
                console.log("New plugin database error", err, pluginuuid, useruuid, req.body.name, req.body.description);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            res.status(200).json({ uuid: pluginuuid });
        });
    });

    return router;
};
