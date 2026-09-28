-- ============================================================
-- ISCEST — auth.users <-> public.profiles bridge
--
-- Supabase Auth owns the credentials. This migration keeps a matching
-- public.profiles row in step with auth.users, and provides the
-- is_admin() helper the RLS policies need.
-- ============================================================

-- ------------------------------------------------------------
-- Signup: create the profile row from the metadata the Registration
-- Form sent to supabase.auth.signUp({ options: { data: {...} } }).
--
-- SECURITY: every metadata key is allowlisted by name, and `role` is
-- HARDCODED to 'member'. raw_user_meta_data is attacker-controlled —
-- copying a `role` out of it would let anyone sign up as an admin.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    v_tier text;
begin
    -- A tampered tier would otherwise violate the CHECK constraint and
    -- abort the whole signup. Fall back to the default instead.
    v_tier := coalesce(nullif(trim(meta ->> 'tier'), ''), 'Student — ₦5,000');
    if v_tier not in (
        'Student — ₦5,000',
        'International Student — $30',
        'Full Membership — ₦10,000',
        'International Membership — $60'
    ) then
        v_tier := 'Student — ₦5,000';
    end if;

    insert into public.profiles (
        id, email, title, name, sex, affiliation, department,
        city, state, country, telephone, specialization, tier, role
    )
    values (
        new.id,
        new.email,
        -- nullif(trim(x), '') turns an empty form field into NULL rather
        -- than an empty string, so "not supplied" is one value not two.
        nullif(trim(meta ->> 'title'), ''),
        coalesce(
            nullif(trim(meta ->> 'name'), ''),
            split_part(coalesce(new.email, ''), '@', 1),
            'Member'
        ),  -- name is NOT NULL — never let this resolve to NULL
        nullif(trim(meta ->> 'sex'), ''),
        nullif(trim(meta ->> 'affiliation'), ''),
        nullif(trim(meta ->> 'department'), ''),
        nullif(trim(meta ->> 'city'), ''),
        nullif(trim(meta ->> 'state'), ''),
        nullif(trim(meta ->> 'country'), ''),
        nullif(trim(meta ->> 'telephone'), ''),
        nullif(trim(meta ->> 'specialization'), ''),
        v_tier,
        'member'  -- never from metadata
    );

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Keep profiles.email in step when an address changes in auth.users,
-- so the admin members table doesn't drift.
-- ------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.profiles
       set email = new.email
     where id = new.id;
    return new;
end;
$$;

create trigger on_auth_user_email_updated
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.handle_user_email_change();

-- ------------------------------------------------------------
-- is_admin() — lets a profiles RLS policy test for an admin without
-- recursing into profiles' own RLS (the usual infinite-recursion trap).
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
          from public.profiles
         where id = auth.uid()
           and role = 'admin'
    );
$$;

-- SECURITY DEFINER functions are not meant to be called directly by
-- clients, so strip the default EXECUTE grant. Triggers still fire.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_user_email_change() from public;
revoke all on function public.is_admin() from public;

-- is_admin() is the one exception: the RLS policies evaluate it as the
-- calling role, so authenticated needs EXECUTE.
grant execute on function public.is_admin() to authenticated;
