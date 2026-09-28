-- ============================================================
-- ISCEST — initial schema
--
-- Replaces the old hand-written backend/sql/schema.sql and the
-- Prisma schema it mirrored. The CHECK allowlists below are the
-- source of truth for membership tiers, so they must stay in step
-- with the <select id="tier"> options in public/registration.html.
--
-- gen_random_uuid() is built into Postgres 13+, so no pgcrypto
-- extension is needed (Supabase runs 15+).
-- ============================================================

-- ------------------------------------------------------------
-- profiles — one row per member, keyed to auth.users
-- Backs: Registration Form, Login/Account, and the admin Members table.
--
-- Credentials live in auth.users, not here. This table holds only the
-- academic profile the Registration Form collects.
-- `email` is intentionally nullable: it is denormalised from auth.users
-- for the admin members table, and a NULL there should degrade to a
-- blank cell rather than make a signup fail outright.
-- ------------------------------------------------------------
create table public.profiles (
    id                uuid primary key references auth.users (id) on delete cascade,
    email             text,
    title             text,          -- Mr, Miss, Mrs, Engr, Barr, Dr, Associate Professor, Professor
    name              text not null, -- Surname first, e.g. "Adeyemi Folake"
    sex               text,
    affiliation       text,          -- Institution / University
    department        text,
    city              text,
    state             text,
    country           text,
    telephone         text,
    specialization    text,          -- Area of specialization
    tier              text not null default 'Student — ₦5,000'
                          check (tier in (
                              'Student — ₦5,000',
                              'International Student — $30',
                              'Full Membership — ₦10,000',
                              'International Membership — $60'
                          )),
    role              text not null default 'member'
                          check (role in ('member', 'admin')),
    membership_status text not null default 'pending'
                          check (membership_status in ('pending', 'active', 'expired')),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_role_idx on public.profiles (role);

-- ------------------------------------------------------------
-- journals
-- Backs: Journals page and the admin dashboard.
-- ------------------------------------------------------------
create table public.journals (
    id          uuid primary key default gen_random_uuid(),
    code        varchar(20) not null unique,  -- e.g. "JCS"
    title       varchar(255) not null,
    issn        varchar(20),
    description text,
    frequency   varchar(20) not null default 'quarterly'
                    check (frequency in ('continuous', 'quarterly', 'biannual', 'annual')),
    open_access boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- conferences
-- Backs: Conference page and the admin dashboard.
-- ------------------------------------------------------------
create table public.conferences (
    id                  uuid primary key default gen_random_uuid(),
    title               varchar(255) not null,
    start_date          date not null,
    end_date            date not null,
    location            varchar(255) not null,
    description         text,
    registration_open   boolean not null default true,
    submission_deadline date,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    check (end_date >= start_date)
);

create index conferences_start_date_idx on public.conferences (start_date);

-- ------------------------------------------------------------
-- conference_tracks
-- Prisma/MongoDB stored `tracks` as an array on the conference; in
-- Postgres one conference has many tracks.
-- ------------------------------------------------------------
create table public.conference_tracks (
    id            uuid primary key default gen_random_uuid(),
    conference_id uuid not null references public.conferences (id) on delete cascade,
    name          varchar(255) not null
);

create index conference_tracks_conference_id_idx on public.conference_tracks (conference_id);

-- ------------------------------------------------------------
-- Keep updated_at current on every row update
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger trg_journals_updated_at before update on public.journals
    for each row execute function public.set_updated_at();

create trigger trg_conferences_updated_at before update on public.conferences
    for each row execute function public.set_updated_at();
