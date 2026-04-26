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

  // ---------- Multi-name lookup tables (2026-04 hardening) ----------
  // YouTube renames internal element ids and tag names periodically.
  // Each table lists candidates ordered legacy → newest. Multi-name
  // lookup is what survives renames; specific names are the fillings.

  const TRANSCRIPT_PANEL_TARGET_IDS = [
    "engagement-panel-searchable-transcript",
    "PAmodern_transcript_view", // 2026-04-26: new modern UI panel (pt-BR Chrome 147)
  ];

  function findTranscriptPanel() {
    for (const id of TRANSCRIPT_PANEL_TARGET_IDS) {
      const p = document.querySelector(`[target-id="${id}"]`);
      if (p) return p;
    }
    return null;
  }

  function isPanelExpanded(p) {
    return (
      p?.getAttribute("visibility") ===
      "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"
    );
  }

  // ---------- Path A: fetch interception ----------
  // Multi-pattern matcher because YouTube migrated transcript loading
  // from `/youtubei/v1/get_transcript` to `/youtubei/v1/get_panel` (which
  // is multiplexed across panel types — chapters, comments, transcript).
  // We accept any URL matching the pattern list, then filter by response
  // shape: only resolve if the parsed JSON contains a transcript-shaped
  // initialSegments array.

  const TRANSCRIPT_ENDPOINT_PATTERNS = [
    "/youtubei/v1/get_transcript",
    "/youtubei/v1/get_panel", // 2026-04-26: new multiplexed endpoint
  ];

  function findInitialSegments(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findInitialSegments(item);
        if (found) return found;
      }
      return null;
    }
    if (
      Array.isArray(obj.initialSegments) &&
      obj.initialSegments.some((s) => s?.transcriptSegmentRenderer)
    ) {
      return obj.initialSegments;
    }
    for (const key of Object.keys(obj)) {
      const found = findInitialSegments(obj[key]);
      if (found) return found;
    }
    return null;
  }

  let pendingFetchResolve = null;
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    if (
      url &&
      TRANSCRIPT_ENDPOINT_PATTERNS.some((p) => url.includes(p)) &&
      pendingFetchResolve
    ) {
      DIAG.log("MATCHED FETCH URL:", url);
      res
        .clone()
        .json()
        .then((j) => {
          const segs = findInitialSegments(j);
          DIAG.log("MATCHED FETCH walker result count:", segs?.length ?? null);
          DIAG.log(
            "MATCHED FETCH body top-level keys:",
            j && typeof j === "object" ? Object.keys(j) : typeof j,
          );
          // Truncated body so the paste back is bounded.
          DIAG.log(
            "MATCHED FETCH body slice (first 4000 chars):",
            JSON.stringify(j).slice(0, 4000),
          );
          if (segs && pendingFetchResolve) {
            pendingFetchResolve({ source: "fetch", segments: segs });
            pendingFetchResolve = null;
          }
        })
        .catch((e) => {
          DIAG.log("MATCHED FETCH parse error:", e?.message);
        });
    }
    return res;
  };

  // ---------- Path B: DOM scrape ----------
  const SEGMENT_SELECTORS = [
    "ytd-transcript-segment-renderer",
    // 2026-04-26 probe: no new tag observed (panel never populates in new UI)
    // — but the multi-name structure stays so future renames are 1-line adds.
  ];

  function scrapeDomSegments() {
    let segs = null;
    for (const sel of SEGMENT_SELECTORS) {
      const found = document.querySelectorAll(sel);
      if (found.length) {
        segs = found;
        break;
      }
    }
    if (!segs?.length) return null;
    const out = [];
    for (const el of segs) {
      const tsEl = el.querySelector(
        '.segment-timestamp, [class*="timestamp"]',
      );
      const textEl = el.querySelector(
        '.segment-text, yt-formatted-string.segment-text, [class*="segment-text"]',
      );
      const startMsAttr =
        el.getAttribute("data-start-ms") ?? el.getAttribute("data-start");
      const startMs = parseInt(startMsAttr ?? "", 10);
      const text = (textEl?.textContent || el.textContent || "").trim();
      if (!text) continue;
      out.push({
        startMs: Number.isFinite(startMs)
          ? startMs
          : tsToMs(tsEl?.textContent),
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

  async function clickToOpenPanelAndVerify() {
    const btn = findTranscriptTrigger();
    if (!btn) return false;
    const panel = findTranscriptPanel();
    if (panel && isPanelExpanded(panel)) {
      // Already open; force re-open to refresh content.
      btn.click();
      await new Promise((r) => setTimeout(r, 300));
      btn.click();
    } else {
      btn.click();
    }
    // Verify panel transitions to EXPANDED within 2s.
    const start = Date.now();
    while (Date.now() - start < 2000) {
      const p = findTranscriptPanel();
      if (p && isPanelExpanded(p)) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  async function tryAlternateOpeners() {
    // Strategy 2: more-actions menu (...) on the watch page → "Show transcript".
    const moreBtn = document.querySelector(
      "ytd-watch-metadata #actions ytd-menu-renderer yt-button-shape button, " +
        "ytd-watch-metadata #actions ytd-menu-renderer button",
    );
    if (moreBtn) {
      moreBtn.click();
      await new Promise((r) => setTimeout(r, 400));
      const items = document.querySelectorAll(
        "tp-yt-paper-listbox ytd-menu-service-item-renderer, " +
          "ytd-menu-service-item-renderer, " +
          "ytd-menu-navigation-item-renderer",
      );
      const item = Array.from(items).find((el) => {
        const txt = (el.innerText || "").toLowerCase();
        return /trans/.test(txt);
      });
      if (item) {
        item.click();
        await new Promise((r) => setTimeout(r, 600));
        const p = findTranscriptPanel();
        if (p && isPanelExpanded(p)) return true;
      }
    }
    return false;
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

      let opened = await clickToOpenPanelAndVerify();
      DIAG.log("opened (primary):", opened);
      if (!opened) {
        opened = await tryAlternateOpeners();
        DIAG.log("opened (alternate):", opened);
      }
      // Note: in some new YouTube UI variants the panel never visually
      // expands even though the underlying fetch fires. We do NOT bail
      // on !opened — Path A (fetch interception) is the primary capture
      // path and runs in parallel. We only bail if BOTH paths produce
      // nothing within 8 seconds, handled by the existing `if (!result)`.

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
      // Path A: result.segments is the raw initialSegments array (transcriptSegmentRenderer wrappers).
      const initialSegments = result.segments;
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
