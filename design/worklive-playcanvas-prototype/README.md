# Worklive — PlayCanvas prototype

A separate, local study of a small 3D office. Open **http://127.0.0.1:8775/** while the server is running.

This does not replace the installed Worklive app. It does not read or change its agents, memories, projects, runs or user data. All office activity is simulated; no Codex or Claude calls are made.

## Try it

1. Drag the office to orbit; scroll over it to zoom. **Overview** resets the view.
2. Choose **5, 10 or 20 people**. Provider shirts stay Codex teal `#2D9D8F` and Claude Code terracotta `#D97757`.
3. Click a monitor, or choose someone in the team panel and select **View desk screen**.
4. **Start browser demo** opens two fresh, isolated Chrome pages: PlayCanvas documentation for Ada and MDN documentation for Milo. Their actual screenshots appear on the desks. Expand one and choose **Visit another page** to observe real navigation. This is scripted browsing, not AI task execution; the enlarged image is not an interactive browser surface.
5. Use **Measure 15 seconds** with browsers off and on. **Eco** targets 30 FPS; **Smooth** targets 60. **Pause life** stops office animation and continuous rendering. The last captured browser images remain visible after stopping the demo and are labelled as last captures when enlarged.

## Run locally

Requires Node.js and npm. Google Chrome or Chromium on macOS is required only for the optional browser demo.

```sh
cd /Users/clemenshoenig/Documents/Codex/2026-09-30/i-w/outputs/worklive-playcanvas-prototype
npm ci --ignore-scripts
npm start
```

The server listens on loopback port 8775. To use another port, set `WORKLIVE_PROTOTYPE_PORT`. An alternative local Chromium executable can be selected with `WORKLIVE_CHROME_PATH`. Stop the server with Ctrl+C; its temporary browser is closed too.

```sh
npm run check
```

## What is implemented

- Original procedural office and characters in PlayCanvas 2.22.6, with standing desks, windows, plants, coffee counter, lounge and table tennis.
- GPU instancing for repeated geometry, one directional light, simple flat contact shading, no shadow maps or post-processing. No Blender assets or external asset downloads at runtime.
- A* walking routes, furniture clearance, reserved break destinations, separation checks, blocked-route replanning and fair admission to breaks. These local animations use no subscription capacity.
- Bounded display resolution: pixel ratio at most 1, with a 1700 × 1000 upper bound on the office drawing buffer. Only visible team members are submitted to the instance buffers.
- Rendered-frame cadence measurements. The 15-second measurement records average FPS, p95 frame interval and intervals over 50 ms. Changing the workload, opening a dialog, pausing or hiding the page cancels an in-progress measurement.
- Office drawing pauses when the page is hidden or a screen/about dialog is open. Browser capture suspends when there are no visible viewers; the temporary browser closes after roughly 90 seconds without a visible viewer.
- Two real anonymous browser pages in one fresh context inside a shared temporary Chromium instance. No personal Chrome profile, persistent login, credentials, arbitrary URL field, model endpoint or Worklive backend connection. Only predefined public documentation URLs are navigated; requests are restricted to an explicit HTTPS host list and GET/HEAD. Popups, downloads, service workers and WebSockets are not part of the demo.
- Captures target at most one every 5 seconds per small monitor, or every 0.8 seconds for the expanded monitor; sequential screenshots can make actual intervals longer. Navigation triggers a fresh capture. Desk textures use 256 × 160 thumbnails; the enlarged view retains the 1024 × 640 capture. Office animation is independent of screenshot delivery. A capture timeout retains the last good image and retries; an enlarged preview older than 12 seconds is labelled as a last capture. One transient capture timeout occurred during the loaded test session.

## Measurement limits

This is a browser rendering experiment, not a benchmark of the packaged Tauri app, real CLI jobs, local builds or 20 simultaneous working agents. Browser FPS does not measure total Mac CPU/GPU consumption or memory pressure. The graphics workload differs from the earlier Three.js studies, so these results do not establish an engine-to-engine performance ranking.

The draw-call display reads the engine's per-render counter. Triangles are calculated from the submitted instance counts and mesh index counts; this is a geometry budget, not GPU timing. The frame measurements include stalls while the office is visible, and skip the partial interval before the first measured frame. Reports are also exposed in the measurement paragraph's `data-report` attribute for repeatable read-only inspection.

Visual limitations: simple stylized geometry, flat contact patches and standing poses. Coffee breaks are local routines rather than generated conversations. The office does not expand beyond 20 seats. Changing team size resets the local routines to their desks, keeping newly shown agents from appearing inside moving characters. Team changes, camera settings and selections are temporary; refresh restores 20 agents. The server retains a running browser demo across refresh until stopped or idle cleanup occurs.

## Before integrating into Worklive

Measure sustained CPU/GPU use, whole-process memory and frame-time spikes inside the actual Tauri WKWebView, with two official CLI tasks and browser feeds running alongside ordinary apps. Reuse Worklive's reviewed task, memory and browser-control boundaries; do not port this demonstration server as a production security boundary. Respect Claude's separately maintained visual work.

## Verification

Verified on 2026-09-30 on this M1 Pro MacBook Pro (16 GB), in the Codex in-app browser at a 1280 × 900 viewport with a 969 × 637 office drawing buffer:

| Workload | Average FPS | p95 frame interval | Intervals over 50 ms |
| --- | ---: | ---: | ---: |
| 20 characters, browsers off | 59.95 | 17.7 ms | 0 |
| 20 characters, two optimized browser previews | 60.00 | 17.6 ms | 0 |

Each final run sampled approximately 15 seconds. Both used 55 draw calls and 74,340 submitted triangles. These are short observations, not a guaranteed sustained performance target. An earlier run with full-resolution desk textures and more frequent captures fell to 9.45 FPS while other browser/rendering work was also active. Both the capture pipeline and background workload changed, so no single-cause or controlled speedup claim is justified. The earlier result is retained in `measurements.json` alongside the final measurements. A later rolling UI sample also fell to about 9 FPS with browsers off, so sustained smoothness and the cause of intermittent drops remain unresolved.

- Prototype: **4 tests pass**, including five simulated minutes of 20 people with furniture clearance, minimum centre spacing of 0.88 m, and participation by all 18 idle agents. The two demo agents stay at their desks.
- Existing app regression checks: **39 JS tests pass** (34 worker + 5 office); **30 Rust tests pass, 2 live-subscription tests ignored**. Existing app source was not edited.
- Live browser checks: 20-person rendering; direct monitor click; Ada's PlayCanvas documentation and Milo's MDN preview; enlarged screen; alternate-page navigation; 5/10/20 team controls; Eco selection; pause/resume; stop/restart browser demo; no browser console warnings/errors observed in the checked session.
- Source and dependencies stay in this separate directory. No release build, app replacement, data migration, real CLI execution or packaged-Tauri performance verification was performed.

Screenshots are saved beside this directory as `worklive-playcanvas-overview.png` and `worklive-playcanvas-screen.png`.

Primary implementation references: [PlayCanvas hardware instancing](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/hardware-instancing/) and [Application API](https://api.playcanvas.com/engine/classes/Application.html). Dependencies are pinned in `package-lock.json`.
