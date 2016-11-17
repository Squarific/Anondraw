-- Reputation by per user
select u.id, count(*) as reputation, u.last_username
from users as u
    inner join reputations as r
        on r.to_id = u.id
group by u.id
order by reputation desc ;

-- Accountbans with last_username, startdate, enddate and reputation

SELECT last_username, startdate, enddate, COUNT(to_id)
FROM accountbans
    JOIN users ON accountbans.userid = users.id
    JOIN reputations ON accountbans.userid = reputations.to_id
GROUP BY to_id
ORDER BY startdate;
