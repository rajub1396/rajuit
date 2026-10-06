# RYT Video Downloader — Node.js + Render

A Node.js website with a direct, resumable download of the supplied Android APK. No runtime dependencies are installed. The homepage includes the supplied Adsterra ad script.

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

Replace `downloads/RYT-universal.apk`, update the size shown in `public/index.html`, commit, and push. Render can automatically deploy commits from the connected branch. The APK is part of the deployed source, so it survives service restarts.

## Ads

The supplied Adsterra code is installed once in the labeled advertisement placement after the hero in `public/index.html`. The second placement remains hidden. Deploy the updated files to enable this code on the live website; actual ad delivery and earnings depend on Adsterra. Review the site's privacy/consent handling for the provider before publishing.
