CREATE DATABASE IF NOT EXISTS `siteplugins`;
USE `siteplugins`;

DELIMITER //

CREATE FUNCTION UUID_TO_BIN(_uuid BINARY(36))
    RETURNS BINARY(16)
    LANGUAGE SQL  DETERMINISTIC  CONTAINS SQL  SQL SECURITY INVOKER
RETURN
    UNHEX(CONCAT(
        SUBSTR(_uuid, 15, 4),
        SUBSTR(_uuid, 10, 4),
        SUBSTR(_uuid,  1, 8),
        SUBSTR(_uuid, 20, 4),
        SUBSTR(_uuid, 25) ));
//
CREATE FUNCTION BIN_TO_UUID(_bin BINARY(16))
    RETURNS BINARY(36)
    LANGUAGE SQL  DETERMINISTIC  CONTAINS SQL  SQL SECURITY INVOKER
RETURN
    LCASE(CONCAT_WS('-',
        HEX(SUBSTR(_bin,  5, 4)),
        HEX(SUBSTR(_bin,  3, 2)),
        HEX(SUBSTR(_bin,  1, 2)),
        HEX(SUBSTR(_bin,  9, 2)),
        HEX(SUBSTR(_bin, 11))
             ));

//
DELIMITER ;


CREATE TABLE IF NOT EXISTS `plugins` (
    uuid binary(16) NOT NULL,
    useruuid binary(16) NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    verified BOOLEAN DEFAULT FALSE NOT NULL,

    creation datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedatetime datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    PRIMARY KEY(uuid),
    INDEX(name),
    INDEX(useruuid),
    INDEX(verified),
    INDEX(creation),
    INDEX(updatedatetime)
);

CREATE TABLE IF NOT EXISTS `versions` (
    pluginuuid binary(16) NOT NULL,

    major TINYINT UNSIGNED NOT NULL,
    minor TINYINT UNSIGNED NOT NULL,
    patch TINYINT UNSIGNED NOT NULL,

    releasenotes TEXT NOT NULL,
    source TEXT NOT NULL,

    verified BOOLEAN DEFAULT FALSE NOT NULL,

    creation datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedatetime datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(pluginuuid, major, minor, patch),
    INDEX(pluginuuid),
    INDEX(updatedatetime),
    INDEX(major, minor, patch),
    INDEX(verified),
    INDEX(creation)
);
