-- Reputation by per user
select u.id, count(*) as reputation, u.last_username
from users as u
    inner join reputations as r
        on r.to_id = u.id
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
