const router = require('express').Router({ mergeParams: true });
const { validationResult } = require('express-validator');

const SELECT_QUERY = "SELECT BIN_TO_UUID(uuid) as uuid, BIN_TO_UUID(useruuid) as useruuid, name, description, creation, updatedatetime from  `plugins` WHERE verified = true";
const GENERIC_DB_ERROR = {
    errors: [{
        msg: "Internal database error"
    }]
};

module.exports = (database) => {
    router.get('/', [
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        database.query(SELECT_QUERY, (err, result) => {
            if (err) {
                console.log("Retrieve plugin database error", err);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            return res.status(200).json({
                plugins: result
            });
        });
    });

    return router;
};
