// Runs in extension isolated world on https://www.youtube.com/watch*.
// Injects page-world.js (which has access to YouTube's globals) and bridges
// messages between the extension popup and the page-world capture logic.
//
// No DOM-injected button anymore — the entry point lives in the toolbar
// popup, which is more robust against YouTube re-renders.

(() => {
  // Inject the page-world script.
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("page-world.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);

  // Popup → content script messaging
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "POPUP_GET_INFO") {
      requestVideoInfo().then(sendResponse);
      return true;
    }
    if (msg?.type === "POPUP_CAPTURE_AND_INGEST") {
      captureAndIngest().then(sendResponse);
      return true;
    }
  });
})();

function requestVideoInfo() {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "WHATASCRAP_INFO") return;
      window.removeEventListener("message", handler);
      resolve(event.data.payload);
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "WHATASCRAP_GET_INFO" }, "*");
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 2000);
  });
}

function captureAndIngest() {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "WHATASCRAP_TRANSCRIPT") return;
      window.removeEventListener("message", handler);
      const payload = event.data.payload;
      if (payload?.error) {
        resolve({ ok: false, error: payload.error });
        return;
      }
      chrome.runtime.sendMessage({ type: "INGEST", payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message ?? "Background error",
          });
          return;
        }
        resolve(response ?? { ok: false, error: "No response from background" });
      });
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "WHATASCRAP_CAPTURE" }, "*");
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ ok: false, error: "Capture timed out after 12s" });
    }, 12000);
  });
}
