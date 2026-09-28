const supabaseAdmin = require("../lib/supabaseAdmin");
const { CONFERENCE_COLUMNS, conferencePayload } = require("../lib/mappers");

// The related table comes back as [{ name }]; the frontend wants a plain
// string array. This keeps the response shape byte-identical to what the
// Prisma version produced, so js/admin.js and conference.html read it the
// same way they always did.
function withTrackNames(conference) {
  const { tracks, ...rest } = conference;
  return { ...rest, tracks: (tracks || []).map((t) => t.name) };
}

function normalizeTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.map((t) => String(t).trim()).filter(Boolean);
}

function loadConference(id) {
  return supabaseAdmin
    .from("conferences")
    .select(CONFERENCE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
}

// GET /api/conferences?upcoming=true
async function getConferences(req, res) {
  let query = supabaseAdmin
    .from("conferences")
    .select(CONFERENCE_COLUMNS)
    .order("start_date", { ascending: true });

  if (req.query.upcoming === "true") {
    // start_date is a DATE column, so compare against a plain date string
    // rather than a timestamp.
    query = query.gte("start_date", new Date().toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ message: "Couldn't load conferences" });
  res.json(data.map(withTrackNames));
}

async function getConference(req, res) {
  const { data, error } = await loadConference(req.params.id);
  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Conference not found" });
  res.json(withTrackNames(data));
}

async function createConference(req, res) {
  const { tracks = [], ...body } = req.body;

  const { data: created, error } = await supabaseAdmin
    .from("conferences")
    .insert(conferencePayload(body))
    .select("id")
    .single();

  if (error) return res.status(400).json({ message: error.message });

  const names = normalizeTracks(tracks);

  // Not atomic. Prisma's nested write made conference + tracks one
  // statement; these are two calls. If the insert below fails you get a
  // conference with no tracks, which re-saving fixes. A plpgsql
  // save_conference() function called via supabase.rpc() would restore
  // atomicity if that ever becomes a real problem.
  if (names.length) {
    const { error: trackError } = await supabaseAdmin
      .from("conference_tracks")
      .insert(names.map((name) => ({ conference_id: created.id, name })));

    if (trackError) {
      return res
        .status(500)
        .json({ message: "Conference saved, but its tracks could not be. Re-save to retry." });
    }
  }

  const { data, error: loadError } = await loadConference(created.id);
  if (loadError || !data) {
    return res.status(500).json({ message: "Conference saved but could not be reloaded" });
  }
  res.status(201).json(withTrackNames(data));
}

async function updateConference(req, res) {
  const { id } = req.params;
  const { tracks, ...body } = req.body;

  // An update matching no rows is a silent no-op in PostgREST, so check
  // existence up front rather than trying to infer it from the result.
  const { data: existing, error: findError } = await supabaseAdmin
    .from("conferences")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findError) return res.status(400).json({ message: findError.message });
  if (!existing) return res.status(404).json({ message: "Conference not found" });

  const payload = conferencePayload(body);
  if (Object.keys(payload).length) {
    const { error } = await supabaseAdmin.from("conferences").update(payload).eq("id", id);
    if (error) return res.status(400).json({ message: error.message });
  }

  // Only touch tracks when the caller actually sent them, so a partial
  // update of the conference fields alone leaves its tracks intact.
  if (tracks !== undefined) {
    const names = normalizeTracks(tracks);

    const { error: deleteError } = await supabaseAdmin
      .from("conference_tracks")
      .delete()
      .eq("conference_id", id);
    if (deleteError) return res.status(500).json({ message: deleteError.message });

    if (names.length) {
      const { error: insertError } = await supabaseAdmin
        .from("conference_tracks")
        .insert(names.map((name) => ({ conference_id: id, name })));
      if (insertError) return res.status(500).json({ message: insertError.message });
    }
  }

  const { data, error } = await loadConference(id);
  if (error || !data) return res.status(404).json({ message: "Conference not found" });
  res.json(withTrackNames(data));
}

async function deleteConference(req, res) {
  // conference_tracks rows cascade with the conference (see the FK in
  // supabase/migrations/20260928090000_init_schema.sql).
  const { data, error } = await supabaseAdmin
    .from("conferences")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) return res.status(400).json({ message: error.message });
  if (!data || data.length === 0) {
    return res.status(404).json({ message: "Conference not found" });
  }
  res.json({ message: "Conference deleted" });
}

module.exports = {
  getConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
};
