CREATE TABLE IF NOT EXISTS users (
	id INT UNSIGNED AUTO_INCREMENT,
	email VARCHAR(255) UNIQUE,
	pass VARCHAR(64),
	PRIMARY KEY(id),
	INDEX (email, pass)
);

ALTER TABLE users ADD COLUMN last_username VARCHAR(32);
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN last_online DATETIME;

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

ALTER TABLE ipbans ADD INDEX banned_by (banned_by);

CREATE TABLE IF NOT EXISTS accountbans (
    userid INT UNSIGNED,
    banned_by INT UNSIGNED,
    startdate DATETIME,
    enddate DATETIME,
    reason TEXT,
    INDEX (userid, enddate)
);