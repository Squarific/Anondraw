CREATE TABLE IF NOT EXISTS users (
	id INT UNSIGNED AUTO_INCREMENT,
	email VARCHAR(255) UNIQUE,
	pass VARCHAR(64),
	referral INT UNSIGNED,
	PRIMARY KEY(id),
	INDEX (email, pass)
);

ALTER TABLE users ADD COLUMN last_username VARCHAR(32);
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN last_online DATETIME;
ALTER TABLE users ADD COLUMN register_datetime DATETIME;
ALTER TABLE users ADD COLUMN headerImage VARCHAR(128);
ALTER TABLE users ADD COLUMN profileImage VARCHAR(128);

CREATE TABLE teams (
	id INT UNSIGNED AUTO_INCREMENT,
	submittime DATETIME,
	image VARCHAR(128),
	owner INT UNSIGNED,
	PRIMARY KEY(id),
	INDEX(image),
	INDEX(submittime, image)
);

CREATE TABLE members (
	teamid INT UNSIGNED,
	name VARCHAR(32),
	social VARCHAR(128)
);

CREATE TABLE votes (
	userid INT UNSIGNED,
	votetime DATETIME,
	weight INT,
	image VARCHAR(128),
	INDEX(userid, image),
	INDEX(image),
	UNIQUE KEY onevote (userid, image)
);

CREATE TABLE IF NOT EXISTS forgotkeys (
	email VARCHAR(255),
	ip VARCHAR(48),
	code VARCHAR(16) UNIQUE,
	created DATETIME,
	active BIT,
	INDEX(code, created, active)
);

CREATE TABLE IF NOT EXISTS friendlist (
    from_id INT,
    to_id INT,
    friendtime DATETIME
);

CREATE TABLE IF NOT EXISTS premium (
    userid INT UNSIGNED,
    startdate DATETIME,
    level INT
);

CREATE TABLE IF NOT EXISTS permissions (
    roomid INT UNSIGNED,
    userid INT UNSIGNED,
    level INT UNSIGNED,
    INDEX(roomid, userid)
);

CREATE TABLE IF NOT EXISTS reputations (
    id INT UNSIGNED AUTO_INCREMENT,
    from_id INT UNSIGNED,
    to_id INT UNSIGNED,
    PRIMARY KEY (id),
    INDEX(to_id, from_id)
    INDEX(from_id, to_id)
);

CREATE TABLE imageposts (
	userid INT UNSIGNED,
	image VARCHAR(128),
	story TEXT,
	created DATETIME,
	INDEX (image),
	INDEX (userid, created),
	INDEX (created)
);

--For the possible source values, see PlayerDatabase.js
ALTER TABLE reputations ADD COLUMN source INT UNSIGNED DEFAULT 0;

CREATE TABLE IF NOT EXISTS ipbans (
    ip VARCHAR(48),
    banned_by INT UNSIGNED,
    startdate DATETIME,
    enddate DATETIME,
    reason TEXT,
    INDEX (ip, enddate)
);

--alter table regions add id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST; 
--ALTER TABLE regions ADD minRepAllowed int UNSIGNED

--Need above for the production server when permissions are done^^

CREATE TABLE IF NOT EXISTS regions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id),
    owner INT UNSIGNED,
    minRepAllowed INT UNSIGNED,
	name VARCHAR(255),
    minX BIGINT,
    minY BIGINT,
    maxX BIGINT,
    maxY BIGINT,
    room VARCHAR(255),
    INDEX (room),
    INDEX (owner, maxX, minX, maxY, minY, room)
);
ALTER TABLE regions ADD COLUMN name VARCHAR(255);

CREATE TABLE IF NOT EXISTS regions_permissions (
    regionId INT UNSIGNED,
    userId INT UNSIGNED,
    INDEX (regionId)    
);

CREATE TABLE IF NOT EXISTS favorites (
    owner INT UNSIGNED,
    x BIGINT,
    y BIGINT,
    room VARCHAR(255),
    name VARCHAR(255),
    INDEX (room, owner, x, y)
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

CREATE TABLE IF NOT EXISTS messages (
	id BIGINT AUTO_INCREMENT,
	fromId INT,
	toId INT,
	message TEXT,
	send DATETIME,
	isRead BIT,
	INDEX(id),
	INDEX(fromId),
	INDEX(toId),
	INDEX(send)
);
