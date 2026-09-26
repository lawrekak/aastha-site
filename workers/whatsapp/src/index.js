// WhatsApp confirmations and reminders for Cal.com bookings — Cloudflare Worker.
// POST /webhooks/cal  <- Cal.com webhook (BOOKING_CREATED, BOOKING_RESCHEDULED), signed with CAL_WEBHOOK_SECRET
// Cron every hour     -> reminder for bookings starting 23–24 hours from now
// Secrets: CAL_WEBHOOK_SECRET, CAL_API_KEY, WA_TOKEN
// Vars:    WA_PHONE_ID, TEMPLATE_CONFIRM, TEMPLATE_REMIND, TEMPLATE_LANG
const TZ = "Asia/Kolkata";
const when = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

export function normalisePhone(raw) {
  const d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  return null;
}

function phoneOf(b) {
  const a = (b.attendees || [])[0] || {};
  const r = b.responses || b.bookingFieldsResponses || {};
  const v = (x) => (x && typeof x === "object" ? x.value : x);
  return normalisePhone(a.phoneNumber || v(r.attendeePhoneNumber) || v(r.phone) || v(r.phoneNumber) || b.smsReminderNumber);
}
const nameOf = (b) => (((b.attendees || [])[0] || {}).name || (b.responses && (b.responses.name?.value || b.responses.name)) || "there").toString().split(" ")[0];
function modeOf(b) {
  const m = (b.metadata && b.metadata.mode) || b.location || "";
  if (/video|meet|zoom|daily/i.test(m)) return "Video call";
  if (/phone/i.test(m)) return "Phone call";
  return "At the office, Vaishali Colony, Haldwani";
}

export async function verify(secret, raw, sig) {
  if (!secret || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function sendTemplate(env, to, template, params) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: env.TEMPLATE_LANG || "en" }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text) })) }] } })
  });
  if (!r.ok) throw new Error(`WhatsApp API ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function remind(env, now = new Date()) {
  const from = new Date(now.getTime() + 23 * 3600e3), to = new Date(now.getTime() + 24 * 3600e3);
  const r = await fetch(`https://api.cal.com/v2/bookings?status=upcoming&afterStart=${from.toISOString()}&beforeEnd=${new Date(to.getTime() + 3600e3).toISOString()}&take=100`, {
    headers: { Authorization: `Bearer ${env.CAL_API_KEY}`, "cal-api-version": "2024-08-13" }
  });
  if (!r.ok) throw new Error(`Cal.com ${r.status}`);
  const list = (await r.json()).data || [];
  let sent = 0;
  for (const b of list) {
    const start = new Date(b.start || b.startTime);
    if (!(start >= from && start < to)) continue;          // exactly one hourly run sends each reminder
    const phone = phoneOf(b); if (!phone) continue;
    await sendTemplate(env, phone, env.TEMPLATE_REMIND, [when(start), modeOf(b)]); sent++;
  }
  return sent;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/webhooks/cal") return new Response("Not found", { status: 404 });
    const raw = await request.text();
    if (!(await verify(env.CAL_WEBHOOK_SECRET, raw, request.headers.get("x-cal-signature-256")))) return new Response("Bad signature", { status: 401 });
    const evt = JSON.parse(raw);
    if (!["BOOKING_CREATED", "BOOKING_RESCHEDULED"].includes(evt.triggerEvent)) return new Response("Ignored", { status: 200 });
    const b = evt.payload || {};
    const phone = phoneOf(b);
    if (!phone) return new Response("No phone number on booking", { status: 200 });
    try {
      await sendTemplate(env, phone, env.TEMPLATE_CONFIRM, [nameOf(b), when(b.startTime || b.start), modeOf(b)]);
      return new Response("Sent", { status: 200 });
    } catch (e) {
      console.log("confirm failed", e.message);
      return new Response("Send failed", { status: 502 });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(remind(env).then((n) => console.log(`reminders sent: ${n}`)).catch((e) => console.log("reminders failed", e.message)));
  }
};
