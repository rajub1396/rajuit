import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const apps = [
  { slug: 'ryt', name: 'RYT', category: 'Video Downloader', file: 'RYT-universal.apk', icon: '▶', color: '#ccff5f', description: 'Download videos with RYT on your Android device.' },
  { slug: 'rvpn', name: 'RVpn', category: 'VPN', file: 'RVpn.apk', icon: 'V', color: '#86baff', description: 'Get RVpn for your Android device.' },
  { slug: 'rplayer', name: 'RPlayer', category: 'Media Player', file: 'RPlayer.apk', icon: '▷', color: '#c7a0ff', description: 'Get RPlayer for your Android device.' },
  { slug: 'rtik', name: 'RTik', category: 'Video Downloader', file: 'RTik.apk', icon: 'T', color: '#ff99b0', description: 'Get RTik Video Downloader for Android.' },
  { slug: 'rins', name: 'RIns', category: 'Video Downloader', file: 'RIns.apk', icon: 'I', color: '#ffc383', description: 'Get RIns Video Downloader for Android.' }
];

const defaultDownloads = fileURLToPath(new URL('downloads/', import.meta.url));

export function apkPath(app, directory = defaultDownloads) {
  return resolve(directory, app.file);
}

export function apkSize(app, directory) {
  try { const info = statSync(apkPath(app, directory)); return info.isFile() && info.size > 0 ? info.size : null; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

const homeTemplate = readFileSync(new URL('public/index.html', import.meta.url), 'utf8');
const appTemplate = readFileSync(new URL('public/app.html', import.meta.url), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderHome(directory) {
  const cards = apps.map(app => {
    const available = apkSize(app, directory) !== null;
    return `<a class="app-tile" href="/apps/${app.slug}" style="--app-accent:${app.color}">
      <div class="tile-top"><span class="tile-icon" aria-hidden="true">${app.icon}</span><span class="availability ${available ? 'ready' : ''}">${available ? 'APK available' : 'Coming soon'}</span></div>
      <p class="tile-category">${app.category}</p><h3>${app.name}</h3><p class="tile-description">${app.description}</p>
      <span class="tile-link">View download page <span aria-hidden="true">↗</span></span>
    </a>`;
  }).join('\n');
  return homeTemplate.replace('{{APP_CARDS}}', cards);
}

export function renderApp(app, directory) {
  const size = apkSize(app, directory);
  const available = size !== null;
  const values = {
    NAME: app.name, CATEGORY: app.category, DESCRIPTION: app.description,
    FILE: app.file, ICON: app.icon, COLOR: app.color,
    SIZE: available ? `${(size / 1000000).toFixed(1)} MB` : 'Coming soon',
    AVAILABLE: String(available),
    HINT: available ? 'First click opens an ad. Click again to download the APK.' : 'The APK will be added soon. Your download button is ready here.',
    RELEASE_FOOT: available ? 'Ready to download and install.' : 'APK not yet available.'
  };
  return appTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => escape(values[key]));
}
