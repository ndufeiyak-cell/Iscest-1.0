-- ============================================================
-- ISCEST — Row Level Security
--
-- Access model:
--   * All data reads AND writes go through the Express API, which uses
--     the service-role key and therefore bypasses RLS.
--   * The browser only ever holds the anon key, and only uses it for
--     Supabase Auth. It never queries these tables directly.
--
-- So RLS here is defence-in-depth, not the primary control. It is
-- written READ-ONLY on purpose: there are deliberately no INSERT,
-- UPDATE or DELETE policies anywhere. With RLS enabled, "no policy"
-- means "denied", so a leaked anon key can read public content and
-- nothing else, and cannot write anything at all.
--
-- If a future table is added, give it the same treatment: enable RLS,
-- add only the SELECT policies it needs, revoke its write grants.
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.journals          enable row level security;
alter table public.conferences       enable row level security;
alter table public.conference_tracks enable row level security;

-- ------------------------------------------------------------
-- profiles — a member may read their own row; an admin may read all.
-- Writes happen only via the service role.
-- ------------------------------------------------------------
create policy profiles_select_own on public.profiles
    for select to authenticated
    using (auth.uid() = id);

create policy profiles_select_admin on public.profiles
    for select to authenticated
    using (public.is_admin());

-- ------------------------------------------------------------
-- Public content — readable by anyone, signed in or not.
-- ------------------------------------------------------------
create policy journals_public_read on public.journals
    for select to anon, authenticated
    using (true);

create policy conferences_public_read on public.conferences
    for select to anon, authenticated
    using (true);

create policy conference_tracks_public_read on public.conference_tracks
    for select to anon, authenticated
    using (true);

-- ------------------------------------------------------------
-- Table grants.
--
-- Supabase's default privileges hand anon/authenticated ALL on new
-- tables in `public`. RLS already blocks the writes, but revoking the
-- grants too means a future mistake (RLS disabled on one table) still
-- isn't enough to expose writes.
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.journals          to anon, authenticated;
grant select on public.conferences       to anon, authenticated;
grant select on public.conference_tracks to anon, authenticated;
grant select on public.profiles          to authenticated;

revoke insert, update, delete, truncate, references, trigger
    on public.profiles, public.journals, public.conferences, public.conference_tracks
    from anon, authenticated;
