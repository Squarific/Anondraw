-- Reputation by per user
select u.id, count(*) as reputation, u.last_username
from users as u
    inner join reputations as r
        on r.to_id = u.id
group by u.id
order by reputation desc ;

-- Reputation per user only users who are referred
select u.id, count(*) as reputation, u.last_username, referral
from users as u
    inner join reputations as r
        on r.to_id = u.id
where referral != 0
group by u.id
order by reputation desc ;

-- Accountbans with last_username, startdate, enddate, reputation, banned_by, banner.last_username and reason
SELECT
    users.last_username,
    startdate, enddate,
    COUNT(to_id) as rep,
    banned_by, banner.last_username,
    reason
FROM accountbans
    JOIN users ON accountbans.userid = users.id 
    JOIN reputations ON accountbans.userid = reputations.to_id 
    JOIN users AS banner ON banned_by = banner.id
GROUP BY to_id, startdate
ORDER BY startdate;

-- Most unique rep given:
SELECT COUNT(*), last_username
FROM (
    SELECT *
    FROM reputations
    GROUP BY from_id, to_id
) AS innertable
    JOIN users ON users.id = innertable.from_id
GROUP BY from_id
ORDER BY COUNT(*) DESC
LIMIT 20;

-- Most rep gotten:
SELECT COUNT(*), last_username
FROM reputations
    JOIN users ON users.id = reputations.to_id
GROUP BY to_id
ORDER BY COUNT(*) DESC
LIMIT 100;

-- Most unique rep gotten:
SELECT COUNT(*), last_username
FROM (SELECT * FROM reputations GROUP BY from_id, to_id) AS innertable
    JOIN users ON users.id = innertable.to_id
GROUP BY to_id ORDER BY COUNT(*) DESC
LIMIT 20;

-- Rep per count
SELECT repcount, COUNT(*)
FROM (
    SELECT COUNT(*) as repcount
    FROM reputations JOIN users ON users.id = reputations.to_id
    GROUP BY to_id ORDER BY COUNT(*) DESC
) as groupedrep
GROUP BY repcount;
 
-- Registered users per day
SELECT DATE(register_datetime), COUNT(*) FROM users GROUP BY DATE(register_datetime) ORDER BY DATE(register_datetime);

