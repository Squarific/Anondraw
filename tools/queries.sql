-- Reputation by per user
select u.id, count(*) as reputation, u.last_username
from users as u
    inner join reputations as r
        on r.to_id = u.id
group by u.id
order by reputation desc ;
