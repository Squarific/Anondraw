const router = require('express').Router({ mergeParams: true });
const { param, validationResult } = require('express-validator');


const SELECT_QUERY = "SELECT BIN_TO_UUID(pluginuuid) as pluginuuid, CONCAT(major,'.',minor,'.',patch) AS version, releasenotes, source, creation, updatedatetime from  `versions` WHERE pluginuuid = UUID_TO_BIN(?) AND major = ? AND minor = ? AND patch = ? AND verified = true;";
const GENERIC_DB_ERROR = {
    errors: [{
        msg: "Internal database error"
    }]
};

module.exports = (database) => {
    router.get('/:pluginuuid/:version', [
        param('pluginuuid').isLength({ min: 36, max: 36 }),
        param('version')
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        let versionArray = req.params.version.split('.').map(x => parseInt(x, 10));
        let [major, minor, patch] = [...versionArray]

        database.query(SELECT_QUERY, [req.params.pluginuuid, major, minor, patch], (err, result) => {
            if (err) {
                console.log("Retrieve plugin database error", err, req.params.pluginuuid);
                return res.status(504).json(GENERIC_DB_ERROR);
            }

            return res.status(200).json({
                version: result[0]
            });
        });



    });

    return router;
};
