(async () => {
  const empty = document.getElementById("empty");
  const loaded = document.getElementById("loaded");
  const titleEl = document.getElementById("title");
  const channelEl = document.getElementById("channel");
  const saveBtn = document.getElementById("save");
  const statusEl = document.getElementById("status");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/youtube\.com\/watch/.test(tab.url)) {
    return; // empty stays visible
  }

  let info = null;
  try {
    info = await chrome.tabs.sendMessage(tab.id, { type: "POPUP_GET_INFO" });
  } catch {
    // content script may not be present (page still loading)
  }

  if (info?.title) {
    titleEl.textContent = info.title;
    channelEl.textContent = info.channel ?? "";
  } else {
    titleEl.textContent =
      tab.title?.replace(/\s*-\s*YouTube\s*$/, "") ?? "YouTube video";
    channelEl.textContent = info ? "" : "Refresh the page if Save fails.";
  }
  empty.hidden = true;
  loaded.hidden = false;

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    statusEl.className = "";
    statusEl.textContent = "";

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, {
        type: "POPUP_CAPTURE_AND_INGEST",
      });
    } catch (e) {
      result = { ok: false, error: e?.message ?? "Tab not reachable" };
    }

    if (result?.ok) {
      statusEl.className = "ok";
      statusEl.textContent = result.alreadySaved
        ? "✓ Already in your library"
        : "✓ Saved to library";
      saveBtn.textContent = "✓ Saved";
    } else {
      statusEl.className = "err";
      statusEl.textContent = result?.error ?? "Save failed";
      saveBtn.disabled = false;
      saveBtn.textContent = "+ Save to library";
    }
  });
})();
