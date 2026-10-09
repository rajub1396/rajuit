# R Apps — Node.js + Render

A Node.js Android app collection for RYT, RVpn, RPlayer, RTik, and RIns. The homepage links to a separate APK download page for every app. RYT, RVpn, RPlayer, and RTik are available now; RIns keeps its download button and shows Coming soon until its file is added. No runtime dependencies are installed.

## Run locally

Use Node.js 24. Run `npm ci`, then `npm start`. Open http://localhost:3000. Run `npm test` to verify the homepage, health check, exact APK bytes, resumed downloads, and restricted routes.

## GitHub and Render

Upload this directory as the root of your GitHub repository, including `downloads/RYT-universal.apk`. The APK is about 55 MB, so use Git to upload it; GitHub's browser uploader does not accept files this large.

In Render, choose **New → Blueprint**, connect the GitHub repository, and apply the included `render.yaml`. It creates a free Node web service with:

- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/healthz`
- Node version: `24.x` from `package.json`

Alternatively choose **New → Web Service** and use these settings. Render sets `PORT`; the server listens on `0.0.0.0` and that port. If your repository contains this folder instead of its contents at the root, set the Render Root Directory to `render-site`.

Free Render services sleep after 15 minutes of inactivity, so the first visitor may wait for startup. Render bandwidth quotas apply to APK downloads. See https://render.com/docs/free.

## Update the APK

Place each APK in `downloads/` using the exact filename below, then commit and push. Availability and file sizes update automatically; no HTML edits are needed. Render can automatically deploy commits from the connected branch. APKs are part of the deployed source and survive service restarts.

| App | Page | APK file |
| --- | --- | --- |
| RYT | `/ryt-download` | `downloads/RYT-universal.apk` |
| RVpn | `/rvpn-download` | `downloads/RVpn.apk` |
| RPlayer | `/rplayer-download` | `downloads/RPlayer.apk` |
| RTik | `/rtik-download` | `downloads/RTik.apk` |
| RIns | `/rins-download` | `downloads/RIns.apk` |

App names, descriptions, and filenames are configured in `apps.mjs`. All available APKs support direct downloads, HEAD requests, and resumable byte ranges. Unknown files and source files remain inaccessible.

## Ads

Existing ad placements are retained on the app download pages in `public/app.html`, with a native ad placement on the homepage. Actual ad delivery and earnings depend on the provider.

Nine website-rendered sponsored banners link to the same Smartlink in a small fixed box on every page. They are links rather than nine provider-served ad creatives. Clicking an offer navigates in the same tab. The existing native placement remains in the page. Close hides the box; it reappears after six seconds. The same placement is retained rather than requesting fresh ads on a timer. Download APK first shows the inline box, then starts the APK download on the second click. Unavailable APKs show a coming-soon message. Automatic Smartlink tabs and additional popup scripts have been removed. Actual ad content and delivery depend on the provider.
