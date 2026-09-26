// Offline tests for both Workers with simulated Claude, Cal.com and WhatsApp APIs.
// Usage: node workers/test.mjs
import assert from "node:assert/strict";
import chatWorker, { chat } from "./chat/src/index.js";
import waWorker, { verify, normalisePhone, remind } from "./whatsapp/src/index.js";

const calls = [];
let script = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push({ url, init });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://api.anthropic.com")) return json(script.shift());
  if (url.includes("api.cal.com/v2/slots")) return json({ status: "success", data: { "2030-01-07": [{ start: "2030-01-07T10:00:00.000+05:30" }, { start: "2030-01-07T10:30:00.000+05:30" }] } });
  if (url.includes("api.cal.com/v2/bookings") && init.method === "POST") return json({ status: "success", data: { uid: "bk_123", start: JSON.parse(init.body).start } });
  if (url.includes("api.cal.com/v2/bookings")) {
    const now = Date.now();
    return json({ status: "success", data: [
      { start: new Date(now + 23.5 * 3600e3).toISOString(), attendees: [{ name: "Ravi Joshi", phoneNumber: "+91 98765 43210" }], location: "Video call" },
      { start: new Date(now + 26 * 3600e3).toISOString(), attendees: [{ name: "Later", phoneNumber: "9876500000" }] }
    ] });
  }
  if (url.startsWith("https://graph.facebook.com")) return json({ messages: [{ id: "wamid.1" }] });
  return json({}, 404);
};
const env = { ANTHROPIC_API_KEY: "k", CAL_API_KEY: "c", CAL_EVENT_TYPE_ID: "42", ALLOWED_ORIGIN: "https://example.in", CAL_WEBHOOK_SECRET: "s3cret", WA_TOKEN: "t", WA_PHONE_ID: "99", TEMPLATE_CONFIRM: "booking_confirmation", TEMPLATE_REMIND: "appointment_reminder" };

// 1. Chat: model lists slots, then books, then answers
script = [
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "list_open_slots", input: {} }] },
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "book_consultation", input: { start: "2030-01-07T10:00:00.000+05:30", name: "Ravi Joshi", email: "ravi@example.com", phone: "98765 43210", matter: "Service matter", mode: "office" } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "Booked. Your reference is bk_123." }] }
];
const out = await chat(env, [{ role: "assistant", content: "hi" }, { role: "user", content: "Book Monday 10 AM" }]);
assert.equal(out.reply, "Booked. Your reference is bk_123.");
assert.equal(out.booked.ref, "bk_123");
const booking = JSON.parse(calls.find((c) => c.url.endsWith("/v2/bookings") && c.init.method === "POST").init.body);
assert.equal(booking.eventTypeId, 42);
assert.equal(booking.attendee.phoneNumber, "+919876543210");
assert.equal(booking.start, "2030-01-07T04:30:00.000Z");
const firstModelCall = JSON.parse(calls.find((c) => c.url.includes("anthropic")).init.body);
assert.equal(firstModelCall.messages[0].role, "user", "leading assistant turn is dropped");
assert.ok(firstModelCall.system.includes("Rule 36"));
console.log("ok  chat: lists slots, books with normalised phone and UTC time");

// 2. Chat: bad phone is returned to the model as an error, not booked
calls.length = 0;
script = [
  { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t3", name: "book_consultation", input: { start: "2030-01-07T10:00:00+05:30", name: "A", email: "a@b.co", phone: "123", matter: "x", mode: "video" } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "Please share a 10-digit mobile number." }] }
];
const bad = await chat(env, [{ role: "user", content: "book" }]);
assert.equal(bad.booked, null);
const second = JSON.parse(calls.filter((c) => c.url.includes("anthropic"))[1].init.body);
assert.match(JSON.stringify(second.messages.at(-1)), /10 digits/);
console.log("ok  chat: invalid phone rejected before booking");

// 3. Chat Worker: origin check and CORS
const forbidden = await chatWorker.fetch(new Request("https://example.in/api/chat", { method: "POST", headers: { Origin: "https://evil.test" }, body: "{}" }), env);
assert.equal(forbidden.status, 403);
const pre = await chatWorker.fetch(new Request("https://example.in/api/chat", { method: "OPTIONS" }), env);
assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "https://example.in");
console.log("ok  chat worker: blocks other sites, answers preflight");

// 4. WhatsApp: signature, confirmation, reminders
assert.equal(normalisePhone("098765 43210"), "919876543210");
assert.equal(normalisePhone("12"), null);
const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED", payload: { startTime: "2030-01-07T04:30:00Z", attendees: [{ name: "Ravi Joshi", phoneNumber: "+919876543210" }], location: "Office" } });
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s3cret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((x) => x.toString(16).padStart(2, "0")).join("");
assert.equal(await verify("s3cret", body, sig), true);
assert.equal(await verify("s3cret", body, sig.replace(/.$/, "0")), sig.endsWith("0") ? true : false);
const rejected = await waWorker.fetch(new Request("https://example.in/webhooks/cal", { method: "POST", body, headers: { "x-cal-signature-256": "00" } }), env);
assert.equal(rejected.status, 401);
calls.length = 0;
const okRes = await waWorker.fetch(new Request("https://example.in/webhooks/cal", { method: "POST", body, headers: { "x-cal-signature-256": sig } }), env);
assert.equal(okRes.status, 200);
const wa = JSON.parse(calls.find((c) => c.url.includes("graph.facebook.com")).init.body);
assert.equal(wa.to, "919876543210");
assert.equal(wa.template.name, "booking_confirmation");
assert.equal(wa.template.components[0].parameters[0].text, "Ravi");
assert.match(wa.template.components[0].parameters[1].text, /Monday, 7 January/);
console.log("ok  whatsapp: rejects unsigned webhooks, sends confirmation in IST");
calls.length = 0;
const n = await remind(env);
assert.equal(n, 1, "only the booking 23–24 h away gets a reminder");
const rem = JSON.parse(calls.find((c) => c.url.includes("graph.facebook.com")).init.body);
assert.equal(rem.template.name, "appointment_reminder");
assert.equal(rem.template.components[0].parameters[1].text, "Video call");
console.log("ok  whatsapp: hourly reminder sends once, to the right booking");
console.log("\nAll worker tests passed.");
