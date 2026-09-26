(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* Mobile menu */
  var sheet = $("#sheet"), menuBtn = $("#menu-btn");
  function closeMenu() { if (!sheet) return; sheet.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  if (menuBtn) menuBtn.addEventListener("click", function () {
    var open = sheet.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) { var a = sheet.querySelector("a"); if (a) a.focus(); }
  });
  document.addEventListener("click", function (e) { if (sheet && sheet.classList.contains("open") && !e.target.closest("#sheet,#menu-btn")) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet && sheet.classList.contains("open")) { closeMenu(); menuBtn.focus(); } });

  /* Bar Council disclaimer: shown once per visit, focus kept inside until accepted.
     Every visitor sees the same page. The content stays in the HTML behind the overlay, and a
     legally required interstitial is not penalised by Google, so crawlers read pages normally. */
  var gate = $("#gate"), agreed = false;
  try { agreed = sessionStorage.getItem("av-agree") === "1"; } catch (e) {}
  if (gate && !agreed) {
    gate.hidden = false; document.body.style.overflow = "hidden";
    setTimeout(function () { $("#agree").focus(); }, 30);
    gate.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = gate.querySelectorAll("button,a[href]"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $("#agree").addEventListener("click", function () {
      gate.hidden = true; document.body.style.overflow = "";
      try { sessionStorage.setItem("av-agree", "1"); } catch (e) {}
      $("#main").focus();
    });
  }

  /* Consultation request form */
  var form = $("#consult-form");
  if (form) {
    var V = {
      name: function () { return $("#f-name").value.trim() ? "" : "Enter your full name."; },
      phone: function () { return $("#f-phone").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").length === 10 ? "" : "Enter a 10-digit mobile number."; },
      email: function () { var v = $("#f-email").value.trim(); return !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "" : "Enter an email address like name@example.com, or leave it blank."; },
      consent: function () { return $("#f-consent").checked ? "" : "Tick the consent box to continue."; }
    };
    var show = function (k) { var m = V[k](), el = $("#e-" + k); el.hidden = !m; el.textContent = m; $("#f-" + k).setAttribute("aria-invalid", m ? "true" : "false"); return m; };
    ["name", "phone", "email"].forEach(function (k) { $("#f-" + k).addEventListener("blur", function () { if (this.value) show(k); }); });
    $("#f-consent").addEventListener("change", function () { show("consent"); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errs = [];
      ["name", "phone", "email", "consent"].forEach(function (k) { var m = show(k); if (m) errs.push([k, m]); });
      var box = $("#err-summary"), status = $("#form-status");
      if (errs.length) {
        box.hidden = false;
        $("#err-list").innerHTML = errs.map(function (x) { return '<li><a href="#f-' + x[0] + '">' + x[1] + "</a></li>"; }).join("");
        box.focus(); return;
      }
      box.hidden = true;
      var endpoint = form.getAttribute("data-endpoint");
      if (!endpoint) { status.textContent = "Online requests open soon. Please call the office during office hours to book a time."; return; }
      status.textContent = "Sending…";
      fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) })
        .then(function (r) { if (!r.ok) throw new Error(); form.reset(); status.textContent = "Request received. The office will call you to confirm a time."; })
        .catch(function () { status.textContent = "The request could not be sent. Please call the office instead."; });
    });
  }
})();

/* ---- Cal.com inline booking (only on the consultation page, only when configured) ---- */
(function () {
  var el = document.getElementById("cal-inline");
  if (!el) return;
  var link = el.getAttribute("data-cal-link");
  (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", "consult", { origin: "https://app.cal.com" });
  Cal.ns.consult("inline", { elementOrSelector: "#cal-inline", calLink: link, config: { layout: "month_view", theme: "light" } });
  Cal.ns.consult("ui", { theme: "light", cssVarsPerTheme: { light: { "cal-brand": "#1E3A8A" } }, hideEventTypeDetails: false, layout: "month_view" });
})();

/* ---- Booking assistant (only when a chat endpoint is configured) ---- */
(function () {
  var meta = document.querySelector('meta[name="chat-endpoint"]');
  if (!meta) return;
  var endpoint = meta.getAttribute("content");
  var hi = document.documentElement.lang.indexOf("hi") === 0;
  var fab = document.createElement("button");
  fab.className = "btn btn-primary chat-fab"; fab.type = "button"; fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "chat");
  fab.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-msg"/></svg>' + (hi ? "सहायक से समय तय करें" : "Book with the assistant");
  var panel = document.createElement("div");
  panel.className = "card chat"; panel.id = "chat"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Booking assistant");
  panel.innerHTML = '<div class="chat-h"><div class="who"><span class="mono-mark" aria-hidden="true">AV</span><div><b>Office assistant</b><small>Books consultations · Hindi or English</small></div></div><button class="icon-btn" type="button" data-close aria-label="Close assistant"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></div><div class="msgs" aria-live="polite"></div><div class="quick"></div><form class="composer"><label for="chat-in" class="sr">Message</label><input id="chat-in" autocomplete="off" placeholder="e.g. I need a meeting about a service matter"><button class="btn btn-primary" type="submit" aria-label="Send"><svg class="i" aria-hidden="true"><use href="#i-send"/></svg></button></form><p class="chat-note">The assistant arranges meetings only and does not give legal advice.</p>';
  document.body.appendChild(fab); document.body.appendChild(panel);
  var msgs = panel.querySelector(".msgs"), quick = panel.querySelector(".quick"), form = panel.querySelector("form"), input = panel.querySelector("input"), sendBtn = form.querySelector("button");
  var turns = [], busy = false, started = false;
  function add(role, text) { var m = document.createElement("div"); m.className = "msg " + role; m.textContent = text; msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m; }
  function chips(list) { quick.innerHTML = ""; list.forEach(function (q) { var b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = function () { input.value = q; form.requestSubmit(); }; quick.appendChild(b); }); }
  function open() {
    panel.hidden = false; fab.hidden = true; fab.setAttribute("aria-expanded", "true"); input.focus();
    if (!started) { started = true; add("bot", hi ? "नमस्ते। मैं अधिवक्ता आस्था विश्वकर्मा के साथ 30 मिनट की पहली बैठक का समय तय करने में मदद कर सकती हूँ। आपका मामला किस विषय से जुड़ा है?" : "Namaste. I can find a time for a 30-minute first meeting with Advocate Aastha Vishwakarma and book it for you. What is your matter about, and when would suit you?"); chips(hi ? ["सबसे पहला उपलब्ध समय", "कार्यालय कहाँ है?"] : ["Earliest available time", "Where is the office?", "मुझे हिंदी में बात करनी है"]); }
  }
  function close() { panel.hidden = true; fab.hidden = false; fab.setAttribute("aria-expanded", "false"); fab.focus(); }
  fab.addEventListener("click", open);
  panel.querySelector("[data-close]").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault(); if (busy) return;
    var text = input.value.trim(); if (!text) return;
    input.value = ""; chips([]); add("me", text);
    turns.push({ role: "user", content: text }); if (turns.length > 20) turns = turns.slice(-20);
    while (turns.length && turns[0].role !== "user") turns.shift();
    busy = true; sendBtn.disabled = true;
    var bubble = add("bot", "…");
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: turns, lang: hi ? "hi" : "en" }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); })
      .then(function (j) { bubble.textContent = j.reply; turns.push({ role: "assistant", content: j.reply }); if (j.booked) { var s = add("sys", "Booked " + j.booked.ref); s.setAttribute("role", "status"); } })
      .catch(function () { bubble.textContent = hi ? "सहायक से संपर्क नहीं हो पाया। कृपया परामर्श पृष्ठ से समय चुनें या कार्यालय को फ़ोन करें।" : "The assistant could not be reached. Please use the consultation page or call the office."; turns.pop(); })
      .then(function () { busy = false; sendBtn.disabled = false; });
  });
})();
