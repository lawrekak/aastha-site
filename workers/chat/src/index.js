// Booking assistant for aastha's website — Cloudflare Worker.
// POST /api/chat  { messages: [{role:"user"|"assistant", content}], lang?: "en"|"hi" }
//   -> { reply, booked?: { ref, label } }
// Secrets (wrangler secret put): ANTHROPIC_API_KEY, CAL_API_KEY
// Vars (wrangler.toml): CAL_EVENT_TYPE_ID, ALLOWED_ORIGIN, MODEL
const TZ = "Asia/Kolkata";
const MAX_TURNS = 20, MAX_CHARS = 1000, MAX_ROUNDS = 5;

const SYSTEM = `You are the booking assistant on the website of Aastha Vishwakarma, Advocate.
Facts: she appears before the High Court of Uttarakhand at Nainital, the Delhi High Court, the District Courts of Delhi and Nainital, the NCLAT, the Central Administrative Tribunal and the Supreme Court. Practice areas: education and service law; district court civil and criminal litigation (cheque bounce under Section 138 NI Act, recovery suits, civil and commercial disputes, criminal complaints and defence, bail and anticipatory bail, appeals and revisions, execution, property and contract disputes, mediation); writ petitions against public authorities; criminal appeals and white-collar defence; property and land; insolvency (IBC); tribunal matters.
Office: Vishwakarma, Kumar & Jain Law Offices, B-8, Vaishali Colony, Bhotia Parao, Haldwani, Uttarakhand 263139. Phone +91 88020 29468. Office hours 9 AM–5 PM IST. The first meeting is up to 30 minutes, at the office, by video or by phone, and carries no fee. Other fees depend on the work and are confirmed in writing before engagement; never quote amounts.
Your job: help the visitor book the first meeting, and answer basic questions about the office.
Rules:
- Never give legal advice or predict outcomes; say the advocate will discuss it in the meeting.
- Bar Council of India Rule 36: never call her the best, a specialist or an expert, never mention wins, success rates or past cases she has handled, never compare her with other advocates. If asked about her past cases or results, say the Bar Council's rules do not allow advocates to publicise them.
- Do not ask for confidential facts. A one-line description of the matter is enough.
- Reply in the visitor's language (Hindi in Devanagari if they write Hindi or Hinglish). Keep replies to 1–4 short sentences of plain text, no markdown.
- To offer times, call list_open_slots and offer at most 4, using their labels exactly.
- Before booking you need: the chosen slot's start value, full name, email address, 10-digit mobile number, a one-line matter type, and the mode (office, video or phone). Ask for what is missing.
- Read the details back and get a clear yes before calling book_consultation. After booking, give the reference and say a confirmation email is on its way.
- If the visitor has no email address, or the matter is urgent (bail, a threatened demolition), ask them to call +91 88020 29468 during office hours.
- Today is {{TODAY}} (IST).`;

const TOOLS = [
  { name: "list_open_slots", description: "Open 30-minute consultation times from the advocate's calendar. Returns up to 12 slots as {start, label}. Optional date (YYYY-MM-DD) limits to that day; otherwise the next 10 days.",
    input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD, optional" } } } },
  { name: "book_consultation", description: "Books the first meeting after the visitor confirmed. Returns {ref, label} or an error message.",
    input_schema: { type: "object", properties: { start: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, matter: { type: "string" }, mode: { type: "string", enum: ["office", "video", "phone"] } }, required: ["start", "name", "email", "phone", "matter", "mode"] } }
];

const label = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const ymd = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

async function cal(env, path, init = {}, version = "2024-08-13") {
  const r = await fetch("https://api.cal.com/v2" + path, { ...init, headers: { Authorization: `Bearer ${env.CAL_API_KEY}`, "cal-api-version": version, "Content-Type": "application/json", ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status === "error") throw new Error(j?.error?.message || `Calendar service returned ${r.status}`);
  return j.data;
}

export async function runTool(env, name, input) {
  if (name === "list_open_slots") {
    const now = new Date();
    const start = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : ymd(now);
    const end = input.date ? input.date : ymd(new Date(now.getTime() + 10 * 864e5));
    const data = await cal(env, `/slots?eventTypeId=${env.CAL_EVENT_TYPE_ID}&start=${start}&end=${end}&timeZone=${TZ}`, {}, "2024-09-04");
    const slots = Object.values(data || {}).flat().map((s) => s.start || s.time).filter(Boolean).filter((s) => new Date(s) > now).slice(0, 12);
    return slots.length ? slots.map((s) => ({ start: s, label: label(s) })) : "No open times in that range. Suggest another day or calling the office.";
  }
  if (name === "book_consultation") {
    const digits = String(input.phone || "").replace(/\D/g, "").replace(/^0+/, "");
    const phone = digits.length === 10 ? "+91" + digits : digits.length === 12 && digits.startsWith("91") ? "+" + digits : null;
    if (!phone) throw new Error("The mobile number must have 10 digits.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input.email || ""))) throw new Error("The email address is not valid.");
    const modes = { office: "At the office, Haldwani", video: "Video call", phone: "Phone call" };
    const data = await cal(env, "/bookings", { method: "POST", body: JSON.stringify({
      start: new Date(input.start).toISOString(), eventTypeId: Number(env.CAL_EVENT_TYPE_ID),
      attendee: { name: String(input.name).slice(0, 100), email: String(input.email).slice(0, 200), timeZone: TZ, phoneNumber: phone, language: "en" },
      bookingFieldsResponses: { notes: `${String(input.matter).slice(0, 200)} — ${modes[input.mode] || input.mode} (booked via website assistant)` },
      metadata: { source: "website-assistant", mode: String(input.mode) }
    }) });
    return { ref: data.uid || data.id, label: label(data.start || input.start) };
  }
  throw new Error("Unknown tool");
}

async function claude(env, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.MODEL || "claude-haiku-4-5-20251001", max_tokens: 600, system: SYSTEM.replace("{{TODAY}}", new Date().toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })), tools: TOOLS, messages })
  });
  if (!r.ok) throw new Error(`Model returned ${r.status}`);
  return r.json();
}

export async function chat(env, incoming) {
  let messages = (Array.isArray(incoming) ? incoming : []).slice(-MAX_TURNS)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new Error("The last message must come from the visitor.");
  let booked = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await claude(env, messages);
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop_reason !== "tool_use") return { reply: text || "Please call the office on +91 88020 29468.", booked };
    messages = [...messages, { role: "assistant", content: res.content }];
    const results = [];
    for (const b of res.content.filter((x) => x.type === "tool_use")) {
      try { const out = await runTool(env, b.name, b.input || {}); if (b.name === "book_consultation") booked = out; results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) }); }
      catch (e) { results.push({ type: "tool_result", tool_use_id: b.id, content: "Error: " + e.message, is_error: true }); }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "Sorry, that took too long. Please use the consultation page or call +91 88020 29468.", booked };
}

const cors = (env) => ({ "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    const origin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });
    try {
      const body = await request.json();
      const out = await chat(env, body.messages);
      return Response.json(out, { headers: cors(env) });
    } catch (e) {
      return Response.json({ error: "unavailable" }, { status: 502, headers: cors(env) });
    }
  }
};
