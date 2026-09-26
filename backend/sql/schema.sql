-- ============================================================
-- ISCEST — relational schema (PostgreSQL)
-- Mirrors backend/prisma/schema.prisma
--
-- NOTE: the app itself now uses Prisma to manage this schema —
-- run `npx prisma migrate dev` in /backend to create the real
-- tables and migration history. This file is a plain-SQL reference
-- kept for anyone who wants to read or hand-run the schema without
-- installing Prisma.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- Users / member accounts
-- Backs: Registration Form (registration.html) and Login (login.html)
-- ------------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(30),                       -- Mr, Miss, Mrs, Engr, Barr, Dr, Associate Professor, Professor
    name                VARCHAR(200) NOT NULL,              -- Surname first
    sex                 VARCHAR(10),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,              -- bcrypt hash, never plain text
    affiliation         VARCHAR(255),                       -- Institution / University
    department          VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(100),
    country             VARCHAR(100),
    telephone           VARCHAR(30),
    specialization      VARCHAR(255),                       -- Area of specialization
    tier                VARCHAR(50) NOT NULL DEFAULT 'Student — ₦5,000'
                            CHECK (tier IN ('Student — ₦5,000', 'International Student — $30', 'Full Membership — ₦10,000', 'International Membership — $60')),
    role                VARCHAR(20) NOT NULL DEFAULT 'member'
                            CHECK (role IN ('member', 'admin')),
    membership_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (membership_status IN ('pending', 'active', 'expired')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- ------------------------------------------------------------
-- Journals
-- Backs: Journals page (journals.html) and the admin dashboard
-- ------------------------------------------------------------
CREATE TABLE journals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(20) NOT NULL UNIQUE,       -- e.g. "JCS"
    title               VARCHAR(255) NOT NULL,
    issn                VARCHAR(20),
    description         TEXT,
    frequency           VARCHAR(20) NOT NULL DEFAULT 'quarterly'
                            CHECK (frequency IN ('continuous', 'quarterly', 'biannual', 'annual')),
    open_access         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Conferences
-- Backs: Conference page (conference.html) and the admin dashboard
-- ------------------------------------------------------------
CREATE TABLE conferences (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                 VARCHAR(255) NOT NULL,
    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    location              VARCHAR(255) NOT NULL,
    description           TEXT,
    registration_open     BOOLEAN NOT NULL DEFAULT TRUE,
    submission_deadline   DATE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_conferences_start_date ON conferences (start_date);

-- ------------------------------------------------------------
-- Conference tracks
-- MongoDB stored `tracks` as an array on the Conference document;
-- normalized here into its own table (one conference has many tracks).
-- ------------------------------------------------------------
CREATE TABLE conference_tracks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id       UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL
);

CREATE INDEX idx_conference_tracks_conference_id ON conference_tracks (conference_id);

-- ------------------------------------------------------------
-- Keep updated_at current on every row update
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_journals_updated_at BEFORE UPDATE ON journals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conferences_updated_at BEFORE UPDATE ON conferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Seed data — mirrors backend/seed.js
-- ------------------------------------------------------------
INSERT INTO journals (code, title, issn, frequency, description) VALUES
    ('JCS', 'Journal of Computational Systems', '2411-0091', 'continuous', 'Distributed systems, algorithms, and computational theory.'),
    ('JAT', 'Journal of Applied Technology', '2411-0108', 'quarterly', 'Robotics, applied machine learning, and hardware-software systems.'),
    ('JSE', 'Journal of Sustainable Engineering', '2411-0115', 'biannual', 'Energy-efficient computing and green infrastructure research.');

INSERT INTO conferences (title, start_date, end_date, location, submission_deadline, description) VALUES
    ('ISCEST 2027 Annual Conference', '2027-06-14', '2027-06-17', 'Lisbon, Portugal', '2027-01-30',
     'Four days of keynotes, technical sessions, and poster presentations.');

INSERT INTO conference_tracks (conference_id, name)
SELECT id, track
FROM conferences, unnest(ARRAY['AI & intelligent systems', 'Embedded & hardware engineering', 'Sustainable computing']) AS track
WHERE title = 'ISCEST 2027 Annual Conference';

-- Seeded admin account. Generate a real bcrypt hash before running this seed —
-- e.g. in the backend folder: node -e "console.log(require('bcryptjs').hashSync('changeme123', 10))"
-- then paste the result below in place of the placeholder.
INSERT INTO users (name, email, password_hash, role, membership_status, tier) VALUES
    ('ISCEST Admin', 'admin@iscest.com', '<paste-bcrypt-hash-here>',
     'admin', 'active', 'Full Membership — ₦10,000');
