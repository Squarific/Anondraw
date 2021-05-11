const router = require('express').Router({ mergeParams: true });
const { param, validationResult } = require('express-validator');

const SELECT_QUERY = "SELECT CONCAT(major,'.',minor,'.',patch) AS version, releasenotes, creation, updatedatetime from  `versions` WHERE pluginuuid = UUID_TO_BIN(?) AND verified = true;";
const GENERIC_DB_ERROR = {
    errors: [{
        msg: "Internal database error"
    }]
};

module.exports = (database) => {
    router.get('/:pluginUuid', [
        param('pluginUuid').isLength({ min: 36, max: 36 })
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        database.query(SELECT_QUERY, [req.params.pluginUuid], (err, result) => {
            if (err) {
                console.log("Retrieve plugin database error", err);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            return res.status(200).json({
                pluginUuid: req.params.pluginUuid,
                versions: result
            });
        });
    });

    return router;
};
