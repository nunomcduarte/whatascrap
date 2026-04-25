// Runs in YouTube's page world (NOT extension isolated world).
// Captures transcripts via two parallel paths and uses whichever returns first:
//   (A) Monkey-patch fetch and intercept /youtubei/v1/get_transcript
//   (B) Click the YouTube "Show transcript" button (or open the engagement
//       panel directly), then poll the DOM for ytd-transcript-segment-renderer
//       elements and parse them.
// Path (B) is robust to YouTube localizing aria-labels, the description-section
// "transcript" button doing something other than firing a fetch, and YouTube
// caching the transcript across visibility toggles.

(() => {
  if (window.__whatascrapInstalled) {
    console.log("[whatascrap page-world] already installed, skipping");
    return;
  }
  window.__whatascrapInstalled = true;
  console.log("[whatascrap page-world] installed");

  // ---------- Path A: fetch interception ----------
  let pendingFetchResolve = null;
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    if (url?.includes("/youtubei/v1/get_transcript") && pendingFetchResolve) {
      res.clone()
        .json()
        .then((j) => {
          if (pendingFetchResolve) {
            pendingFetchResolve({ source: "fetch", json: j });
            pendingFetchResolve = null;
          }
        })
        .catch(() => {});
    }
    return res;
  };

  // ---------- Path B: DOM scrape ----------
  function scrapeDomSegments() {
    const segs = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (!segs.length) return null;
    const out = [];
    for (const el of segs) {
      const tsEl = el.querySelector(".segment-timestamp");
      const textEl = el.querySelector(
        ".segment-text, yt-formatted-string.segment-text",
      );
      const startMs = parseInt(el.getAttribute("data-start-ms") ?? "", 10);
      const text = (textEl?.textContent || "").trim();
      if (!text) continue;
      out.push({
        startMs: Number.isFinite(startMs) ? startMs : tsToMs(tsEl?.textContent),
        endMs: 0,
        text,
      });
    }
    return out.length ? out : null;
  }

  function tsToMs(ts) {
    if (!ts) return 0;
    const parts = ts.trim().split(":").map((n) => parseInt(n, 10));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    let seconds = 0;
    for (const p of parts) seconds = seconds * 60 + p;
    return seconds * 1000;
  }

  function findTranscriptTrigger() {
    // 1) English aria-label (engagement-panel direct toggle, when present)
    const byLabel = document.querySelector('button[aria-label="Show transcript"]');
    if (byLabel) return byLabel;

    // 2) Description-section transcript renderer (newer UI, all languages)
    const sec = document.querySelector(
      "ytd-video-description-transcript-section-renderer",
    );
    if (!sec) return null;

    // The section has multiple buttons (info tooltip, help, etc.). The
    // primary CTA is wrapped in ytd-button-renderer with text like
    // "Show transcript" / "Mostrar transcrição" / etc.
    const renderer = sec.querySelector("ytd-button-renderer button");
    if (renderer) return renderer;

    // 3) Fallback: button whose visible text matches a transcript-y root
    //    (covers most languages — e.g. "trans" matches Show transcript,
    //    Mostrar transcrição, Transcripción mostrar, Afficher la transcription).
    const byText = Array.from(sec.querySelectorAll("button")).find((b) => {
      const txt = (b.textContent || "").toLowerCase();
      return /trans|transc/.test(txt);
    });
    if (byText) return byText;

    // 4) Last resort: first button
    return sec.querySelector("button") ?? null;
  }

  function clickToOpenPanel() {
    const btn = findTranscriptTrigger();
    if (!btn) return false;
    const panel = document.querySelector(
      '[target-id="engagement-panel-searchable-transcript"]',
    );
    const isOpen =
      panel?.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED";
    if (isOpen) {
      // Force re-open: collapse, then expand
      btn.click();
      setTimeout(() => btn.click(), 250);
    } else {
      btn.click();
    }
    return true;
  }

  function pollDomForSegments(timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const segs = scrapeDomSegments();
        if (segs) return resolve({ source: "dom", segments: segs });
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  // ---------- Capture orchestration ----------
  // Quick metadata-only request used by the popup before showing Save UI.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "WHATASCRAP_GET_INFO") return;
    const ipr = window.ytInitialPlayerResponse;
    if (!ipr?.videoDetails) {
      window.postMessage({ type: "WHATASCRAP_INFO", payload: null }, "*");
      return;
    }
    const microformat = ipr.microformat?.playerMicroformatRenderer;
    window.postMessage(
      {
        type: "WHATASCRAP_INFO",
        payload: {
          videoId: ipr.videoDetails.videoId,
          title: ipr.videoDetails.title,
          channel:
            microformat?.ownerChannelName || ipr.videoDetails.author || "",
        },
      },
      "*",
    );
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "WHATASCRAP_CAPTURE") return;
    console.log("[whatascrap page-world] CAPTURE message received");

    const reply = (payload) =>
      window.postMessage({ type: "WHATASCRAP_TRANSCRIPT", payload }, "*");

    const ipr = window.ytInitialPlayerResponse;
    if (!ipr?.videoDetails) {
      reply({ error: "No video metadata found on this page." });
      return;
    }

    const { videoId, title, author, lengthSeconds, thumbnail } = ipr.videoDetails;

    // Quick check: can we already see segments in the DOM? (User opened the
    // panel manually before clicking Save.)
    const immediateDom = scrapeDomSegments();
    let result = immediateDom
      ? { source: "dom", segments: immediateDom }
      : null;

    if (!result) {
      // Race the two capture paths.
      const fetchPromise = new Promise((resolve) => {
        pendingFetchResolve = resolve;
        setTimeout(() => {
          if (pendingFetchResolve === resolve) {
            pendingFetchResolve = null;
            resolve(null);
          }
        }, 8000);
      });
      const clicked = clickToOpenPanel();
      if (!clicked) {
        reply({
          error:
            "Could not find a transcript trigger. Make sure the video has captions and the description is expanded.",
        });
        return;
      }
      const domPromise = pollDomForSegments(8000);
      result = await Promise.race([fetchPromise, domPromise]);
      // Clear any pending fetch resolver to avoid leaks
      pendingFetchResolve = null;
    }

    if (!result) {
      reply({
        error:
          "Couldn't read the transcript. Open the transcript panel manually on YouTube, then click Save again.",
      });
      return;
    }

    let segments = [];
    if (result.source === "dom") {
      segments = result.segments;
    } else {
      const initialSegments =
        result.json?.actions?.[0]?.updateEngagementPanelAction?.content
          ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
          ?.transcriptSegmentListRenderer?.initialSegments;
      if (!initialSegments?.length) {
        reply({ error: "Transcript came back empty." });
        return;
      }
      segments = initialSegments
        .map((s) => {
          const r = s.transcriptSegmentRenderer;
          return {
            startMs: parseInt(r?.startMs ?? "0", 10) || 0,
            endMs: parseInt(r?.endMs ?? "0", 10) || 0,
            text:
              r?.snippet?.runs?.map((x) => x.text).join("") ||
              r?.snippet?.simpleText ||
              "",
          };
        })
        .filter((s) => s.text);
    }

    if (!segments.length) {
      reply({ error: "Transcript came back empty." });
      return;
    }

    const microformat = ipr.microformat?.playerMicroformatRenderer;
    const channel = microformat?.ownerChannelName || author || "Unknown";
    const uploadDate = microformat?.publishDate || microformat?.uploadDate || null;
    const thumbs = thumbnail?.thumbnails || [];
    const thumbnailUrl = thumbs[thumbs.length - 1]?.url || null;

    reply({
      videoId,
      title,
      channel,
      author,
      lengthSeconds: parseInt(lengthSeconds, 10) || 0,
      thumbnailUrl,
      uploadDate,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      transcript: segments,
    });
  });
})();
