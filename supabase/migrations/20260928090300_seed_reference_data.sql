-- ============================================================
-- ISCEST — seed reference data
--
-- Sample journals, the 2027 conference, and its tracks. Written to be
-- re-runnable: every statement is guarded so applying this twice is a
-- no-op.
--
-- The admin *account* is NOT seeded here — it needs an auth.users row,
-- which SQL can't create. `npm run seed` does that via the Auth admin
-- API. See seed.js.
-- ============================================================

insert into public.journals (code, title, issn, frequency, description) values
    ('JCS', 'Journal of Computational Systems',   '2411-0091', 'continuous',
     'Distributed systems, algorithms, and computational theory.'),
    ('JAT', 'Journal of Applied Technology',      '2411-0108', 'quarterly',
     'Robotics, applied machine learning, and hardware-software systems.'),
    ('JSE', 'Journal of Sustainable Engineering', '2411-0115', 'biannual',
     'Energy-efficient computing and green infrastructure research.')
on conflict (code) do nothing;

insert into public.conferences
    (title, start_date, end_date, location, submission_deadline, description)
select
    'ISCEST 2027 Annual Conference',
    date '2027-06-14',
    date '2027-06-17',
    'Lisbon, Portugal',
    date '2027-01-30',
    'Four days of keynotes, technical sessions, and poster presentations.'
where not exists (
    select 1 from public.conferences where title = 'ISCEST 2027 Annual Conference'
);

insert into public.conference_tracks (conference_id, name)
select c.id, t.name
from public.conferences c
cross join (values
    ('AI & intelligent systems'),
    ('Embedded & hardware engineering'),
    ('Sustainable computing')
) as t (name)
where c.title = 'ISCEST 2027 Annual Conference'
  and not exists (
      select 1 from public.conference_tracks ct where ct.conference_id = c.id
  );
