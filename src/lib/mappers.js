// The API speaks camelCase — public/js/admin.js, journals.html and
// conference.html all depend on those exact field names — while the
// Postgres columns are snake_case. Reads use PostgREST column aliases and
// writes go through the payload builders below, so the whole mapping lives
// in this one file.

// Drops keys whose value is `undefined`, so a PATCH-style update only
// touches the fields the caller actually sent. (`null` is kept: it means
// "clear this field".)
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

const PROFILE_COLUMNS = [
  "id", "email", "title", "name", "sex", "affiliation", "department",
  "city", "state", "country", "telephone", "specialization", "tier", "role",
  "membershipStatus:membership_status",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(",");

// Mirrors the check constraint on profiles.membership_status. Held here so
// the API rejects a bad value with a readable 400 rather than letting it
// reach Postgres, where a constraint violation surfaces as an opaque error.
// "active" is what an admin sets once a member's payment has been confirmed.
const MEMBERSHIP_STATUSES = ["pending", "active", "expired"];

const JOURNAL_COLUMNS = [
  "id", "code", "title", "issn", "description", "frequency",
  "openAccess:open_access",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(",");

// `tracks` comes back as [{ name }] from the related table; the controllers
// flatten it to a plain string array with withTrackNames().
const CONFERENCE_COLUMNS = [
  "id", "title", "location", "description",
  "startDate:start_date",
  "endDate:end_date",
  "registrationOpen:registration_open",
  "submissionDeadline:submission_deadline",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "tracks:conference_tracks(name)",
].join(",");

function journalPayload(body) {
  return compact({
    code: body.code,
    title: body.title,
    issn: body.issn,
    description: body.description,
    frequency: body.frequency,
    open_access: body.openAccess,
  });
}

// PostgREST accepts ISO strings ("2027-06-14") for date columns, so the
// API keeps taking plain dates from the form and this maps them across.
function conferencePayload(body) {
  return compact({
    title: body.title,
    location: body.location,
    description: body.description,
    start_date: body.startDate,
    end_date: body.endDate,
    registration_open: body.registrationOpen,
    submission_deadline: body.submissionDeadline,
  });
}

module.exports = {
  MEMBERSHIP_STATUSES,
  PROFILE_COLUMNS,
  JOURNAL_COLUMNS,
  CONFERENCE_COLUMNS,
  journalPayload,
  conferencePayload,
};
