# WhatAScrap browser extension (dev)

Saves YouTube transcripts to your whatascrap library in one click.

## Loading the unpacked extension (dev)

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Confirm the extension appears in the list

After making any code change, click the **reload icon** on the extension card (no need to re-select the folder).

## Using it

1. Sign in to whatascrap at <http://localhost:3000>
2. Open any YouTube video (e.g. <https://www.youtube.com/watch?v=qTgPSKKjfVg>)
3. Scroll until you see the **Show transcript** button (under the description). A red **+ Save to library** button appears next to it.
4. Click it. Within a few seconds you'll see a toast: *Saved to library*.
5. Refresh <http://localhost:3000>. The video should be in your list.

## Troubleshooting

- **"Sign in to whatascrap first"** — the extension carries your localhost:3000 session cookie. Open localhost:3000 in the same browser profile and sign in.
- **"Transcript fetch never fired"** — the video has no transcript, or YouTube cached the panel. Close the transcript panel manually and click Save again.
- **No Save button** — the extension only injects on `youtube.com/watch*` pages and only after the Show transcript button has rendered. Scroll down to load the description.
