CREATE TABLE IF NOT EXISTS drawings (
    id INT UNSIGNED AUTO_INCREMENT,
    type TINYINT UNSIGNED,
    x SMALLINT,
    y SMALLINT,
    x1 SMALLINT,
    y1 SMALLINT,
    size TINYINT UNSIGNED,
    r TINYINT UNSIGNED,
    g TINYINT UNSIGNED,
    b TINYINT UNSIGNED,
    room VARCHAR(24),
    now DATETIME,
    PRIMARY KEY (id),
    INDEX (room)
);

CREATE TABLE IF NOT EXISTS msg (
    id INT UNSIGNED AUTO_INCREMENT,
    room VARCHAR(24),
    user VARCHAR(36),
    message TEXT,
    now DATETIME,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT,
    email VARCHAR(255),
    password VARCHAR(64),
    perms INT UNSIGNED DEFAULT 0,
    PRIMARY KEY (id),
    INDEX (email, password)
);

CREATE TABLE IF NOT EXISTS reputations (
    id INT UNSIGNED AUTO_INCREMENT,
    from_id INT UNSIGNED,
    to_id INT UNSIGNED,
    PRIMARY KEY (id),
    INDEX(to_id, from_id)
);

CREATE TABLE IF NOT EXISTS ipbans (
    ip VARCHAR(48),
    startdate DATETIME,
    enddate DATETIME,
    PRIMARY KEY (ip),
    INDEX (ip, enddate)
);

CREATE TABLE IF NOT EXISTS accountbans (
    userid INT UNSIGNED,
    startdate DATETIME,
    enddate DATETIME,
    PRIMARY KEY (userid),
    INDEX (userid, enddate)
);

CREATE TABLE IF NOT EXISTS ink (
    ip VARCHAR(16),
    ink SMALLINT,
    PRIMARY KEY (ip),
    INDEX (ip)
);
