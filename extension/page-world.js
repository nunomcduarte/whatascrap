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

  // 2026-04 capture-bug instrumentation. Removed in Task 5.
  const DIAG = (() => {
    const log = (...args) => {
      const printable = args.map((a) =>
        a !== null && typeof a === "object" ? JSON.stringify(a) : a,
      );
      console.log("[whatascrap diag]", ...printable);
    };
    const snapshotPanels = () => {
      const panels = document.querySelectorAll("[target-id]");
      return Array.from(panels).map((p) => ({
        targetId: p.getAttribute("target-id"),
        visibility: p.getAttribute("visibility"),
        innerTextLen: (p.innerText || "").length,
        firstChildTags: Array.from(p.querySelectorAll(":scope *"))
          .slice(0, 12)
          .map((e) => e.tagName.toLowerCase()),
      }));
    };
    const snapshotSegs = () => {
      const candidates = [
        "ytd-transcript-segment-renderer",
        "ytd-transcript-segment-list-renderer",
        "ytd-transcript-body-renderer",
        "ytd-transcript-renderer",
        "ytd-transcript-search-panel-renderer",
        '[class*="transcript-segment"]',
        '[class*="segment-text"]',
        "[data-start-ms]",
      ];
      const out = {};
      for (const sel of candidates) {
        try {
          out[sel] = document.querySelectorAll(sel).length;
        } catch {
          out[sel] = "selector-error";
        }
      }
      return out;
    };
    return { log, snapshotPanels, snapshotSegs };
  })();

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
    DIAG.log("=== CAPTURE START ===");
    DIAG.log("locale:", document.documentElement.lang);
    DIAG.log("url:", location.href);
    DIAG.log("panels(t=0):", DIAG.snapshotPanels());
    DIAG.log("segs(t=0):", DIAG.snapshotSegs());

    const reply = (payload) =>
      window.postMessage({ type: "WHATASCRAP_TRANSCRIPT", payload }, "*");

    const ipr = window.ytInitialPlayerResponse;
    if (!ipr?.videoDetails) {
      DIAG.log("FAIL: no ytInitialPlayerResponse.videoDetails");
      reply({ error: "No video metadata found on this page." });
      return;
    }
    DIAG.log("ipr.videoDetails.videoId:", ipr.videoDetails.videoId);
    DIAG.log(
      "url videoId match:",
      new URL(location.href).searchParams.get("v") === ipr.videoDetails.videoId,
    );

    const { videoId, title, author, lengthSeconds, thumbnail } = ipr.videoDetails;

    const immediateDom = scrapeDomSegments();
    DIAG.log("immediateDom segments:", immediateDom?.length ?? 0);
    let result = immediateDom
      ? { source: "dom", segments: immediateDom }
      : null;

    if (!result) {
      const fetchUrls = [];
      const origFetchInner = window.fetch;
      window.fetch = function (...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
        if (url) fetchUrls.push(url);
        return origFetchInner.apply(this, args);
      };

      const fetchPromise = new Promise((resolve) => {
        pendingFetchResolve = resolve;
        setTimeout(() => {
          if (pendingFetchResolve === resolve) {
            pendingFetchResolve = null;
            resolve(null);
          }
        }, 8000);
      });

      const trigger = findTranscriptTrigger();
      DIAG.log("trigger found:", !!trigger);
      DIAG.log("trigger outerHTML:", trigger?.outerHTML?.slice(0, 300));
      DIAG.log("trigger ariaLabel:", trigger?.getAttribute("aria-label"));
      DIAG.log("trigger parent tag:", trigger?.parentElement?.tagName);

      const clicked = clickToOpenPanel();
      DIAG.log("clicked:", clicked);
      if (!clicked) {
        reply({
          error:
            "Could not find a transcript trigger. Make sure the video has captions and the description is expanded.",
        });
        return;
      }

      // Snapshot DOM evolution at fixed offsets after click.
      const snapAt = async (ms, prevMs) => {
        await new Promise((r) => setTimeout(r, ms - prevMs));
        DIAG.log(`panels(t=${ms}ms):`, DIAG.snapshotPanels());
        DIAG.log(`segs(t=${ms}ms):`, DIAG.snapshotSegs());
      };
      await snapAt(250, 0);
      await snapAt(1000, 250);
      await snapAt(3000, 1000);

      const domPromise = pollDomForSegments(8000);
      result = await Promise.race([fetchPromise, domPromise]);
      pendingFetchResolve = null;

      // Final snapshot fires whenever the race resolves (3–8s window).
      DIAG.log("panels(post-race):", DIAG.snapshotPanels());
      DIAG.log("segs(post-race):", DIAG.snapshotSegs());
      DIAG.log("fetch URLs hit during capture:", fetchUrls);
      window.fetch = origFetchInner;
    }

    DIAG.log("final result.source:", result?.source);
    DIAG.log("final result.segments.length:", result?.segments?.length);
    DIAG.log("=== CAPTURE END ===");

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
