const supabaseAdmin = require("../lib/supabaseAdmin");
const { JOURNAL_COLUMNS, journalPayload } = require("../lib/mappers");

// Unlike Prisma, supabase-js returns { data, error } instead of throwing, so
// every handler checks `error` explicitly. An update or delete that matches
// no rows is a silent no-op rather than an error, so those use .select() to
// tell "nothing matched" apart from "done".

async function getJournals(req, res) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .select(JOURNAL_COLUMNS)
    .order("code", { ascending: true });

  if (error) return res.status(500).json({ message: "Couldn't load journals" });
  res.json(data);
}

async function getJournal(req, res) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .select(JOURNAL_COLUMNS)
    .eq("id", req.params.id)
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Journal not found" });
  res.json(data);
}

async function createJournal(req, res) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .insert(journalPayload(req.body))
    .select(JOURNAL_COLUMNS)
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json(data);
}

async function updateJournal(req, res) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .update(journalPayload(req.body))
    .eq("id", req.params.id)
    .select(JOURNAL_COLUMNS)
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Journal not found" });
  res.json(data);
}

async function deleteJournal(req, res) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) return res.status(400).json({ message: error.message });
  if (!data || data.length === 0) return res.status(404).json({ message: "Journal not found" });
  res.json({ message: "Journal deleted" });
}

module.exports = { getJournals, getJournal, createJournal, updateJournal, deleteJournal };
