CREATE TABLE users (
	id INT UNSIGNED AUTO_INCREMENT,
	email VARCHAR(255) UNIQUE,
	pass VARCHAR(64),
	PRIMARY KEY(id),
	INDEX (email, pass)
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
    banned_by INT UNSIGNED,
    startdate DATETIME,
    enddate DATETIME,
    reason TEXT,
    INDEX (ip, enddate)
);

CREATE TABLE IF NOT EXISTS accountbans (
    userid INT UNSIGNED,
    banned_by INT UNSIGNED,
    startdate DATETIME,
    enddate DATETIME,
    reason TEXT,
    INDEX (userid, enddate)
);