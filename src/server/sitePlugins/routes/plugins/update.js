const router = require('express').Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const fs = require('fs');
var path = require('path');
const jwt = require('jsonwebtoken');

const privateKeyPath = path.join(__dirname, '..', '..', 'jwtsignkey.key');
const privateKey = fs.readFileSync(privateKeyPath);

const UPDATE_QUERY = "UPDATE `plugins` SET name = ?, description = ? WHERE uuid = UUID_TO_BIN(?) AND useruuid = UUID_TO_BIN(?)";
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
    router.put('/:uuid', [
        param('uuid').isLength({ min: 36, max: 36 }),
        body('uuid').isLength({ min: 36, max: 36 }),
        body('useruuid').isLength({ min: 36, max: 36 }),
        body('name').isLength({ min: 3, max: 255 }),
        body('bearer'),
        body('description')
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

        database.query(UPDATE_QUERY, [req.body.name, req.body.description, req.body.uuid, useruuid.uuid], (err, result) => {
            if (err) {
                console.log("Update plugin database error", err, req.body.name, req.body.description, req.body.uuid, useruuid.uuid);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            return res.status(200).json({
                msg: "success",
            });
        });
    });

    return router;
};
