const router = require('express').Router({ mergeParams: true });
const { param, validationResult } = require('express-validator');

const SELECT_QUERY_PLUGIN = "SELECT BIN_TO_UUID(uuid) as uuid, BIN_TO_UUID(useruuid) as useruuid, name, description, creation, updatedatetime from  `plugins` WHERE uuid = UUID_TO_BIN(?) AND verified = true; ";
const SELECT_QUERY_VERSIONS = "SELECT CONCAT(major,'.',minor,'.',patch) AS version, creation, updatedatetime from  `versions` WHERE pluginuuid = UUID_TO_BIN(?) ORDER BY major DESC, minor DESC, patch DESC ;";
const SELECT_QUERY = SELECT_QUERY_PLUGIN + SELECT_QUERY_VERSIONS
const GENERIC_DB_ERROR = {
    errors: [{
        msg: "Internal database error"
    }]
};

module.exports = (database) => {
    router.get('/:uuid', [
        param('uuid').isLength({ min: 36, max: 36 })
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        database.query(SELECT_QUERY, [req.params.uuid, req.params.uuid], (err, result) => {
            if (err) {
                console.log("Retrieve plugin database error", err, req.params.uuid);
                return res.status(504).json(GENERIC_DB_ERROR);
            }


            return res.status(200).json({
                plugin: result[0],
                versions: result[1]
            });
        });



    });

    return router;
};
