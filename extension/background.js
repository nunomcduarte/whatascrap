// MV3 service worker. Receives capture payload from content script and
// POSTs it to the whatascrap backend with credentials so the user's
// session cookie is attached.

const API_URL_DEV = "http://localhost:3000/api/ingest";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "INGEST") return;
  ingest(msg.payload).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function ingest(payload) {
  if (!payload || payload.error) {
    return { ok: false, error: payload?.error ?? "Empty payload" };
  }
  try {
    const res = await fetch(API_URL_DEV, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      return {
        ok: false,
        error: "Sign in to whatascrap (localhost:3000) first.",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Server ${res.status}: ${text.slice(0, 120)}` };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, alreadySaved: !!json.alreadySaved };
  } catch (e) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
