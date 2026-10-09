import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const apps = [
  { slug: 'ryt', name: 'RYT', category: 'YouTube Video Downloader', file: 'RYT-universal.apk', icon: '▶', color: '#ccff5f', description: 'Download YouTube videos with RYT on your Android device.' },
  { slug: 'rvpn', name: 'RVpn', category: 'VPN', file: 'RVpn.apk', icon: 'V', color: '#86baff', description: 'Get RVpn for your Android device.' },
  { slug: 'rplayer', name: 'RPlayer', category: 'Video Player', file: 'RPlayer.apk', icon: '▷', color: '#c7a0ff', description: 'Play videos with RPlayer on your Android device.' },
  { slug: 'rtik', name: 'RTik', category: 'TikTok Video Downloader', file: 'RTik.apk', icon: 'T', color: '#ff99b0', description: 'Download TikTok videos with RTik on your Android device.' },
  { slug: 'rins', name: 'RIns', category: 'Instagram Video Downloader', file: 'RIns.apk', icon: 'I', color: '#ffc383', description: 'Explore RIns Instagram Video Downloader for Android.' }
];

export function appIcon(slug) {
  const paths = {
    ryt: '<rect x="3" y="6" width="26" height="20" rx="6"/><path d="m13 11 8 5-8 5V11Z" fill="currentColor" stroke="none"/>',
    rvpn: '<path d="M16 3 27 7v8c0 7-11 14-11 14S5 22 5 15V7l11-4Z"/><path d="m11 15 3 3 7-7"/>',
    rplayer: '<rect x="4" y="6" width="24" height="20" rx="5"/><path d="m13 11 7 5-7 5v-10Z" fill="currentColor" stroke="none"/>',
    rtik: '<path d="M19 5v16a6 6 0 1 1-6-6M19 5c1 6 5 8 9 8"/>',
    rins: '<rect x="5" y="5" width="22" height="22" rx="7"/><circle cx="16" cy="16" r="5"/><circle cx="23" cy="9" r="1" fill="currentColor" stroke="none"/>'
  };
  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g>${paths[slug]}</g><circle cx="30" cy="30" r="9" fill="var(--bg, #10151c)"/><path d="M30 24v9m-4-4 4 4 4-4M25 36h10"/></svg>`;
}

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
    return `<a class="app-tile" href="/${app.slug}-download" style="--app-accent:${app.color}">
      <div class="tile-top"><span class="tile-icon">${appIcon(app.slug)}</span><span class="availability ${available ? 'ready' : ''}">${available ? 'APK available' : 'Coming soon'}</span></div>
      <p class="tile-category">${app.category}</p><h3>${app.name}</h3><p class="tile-description">${app.description}</p>
      <span class="tile-link">View download page <span aria-hidden="true">↗</span></span>
    </a>`;
  }).join('\n');
  const featured = `<span class="showcase-icon">${appIcon('ryt')}</span>`;
  const satellites = apps.slice(1).map(app => `<span class="satellite satellite-${app.slug}" style="--app-accent:${app.color}"><span class="satellite-icon">${appIcon(app.slug)}</span><span>${app.name}</span></span>`).join('');
  return homeTemplate.replace('{{APP_CARDS}}', cards).replace('{{FEATURE_ICON}}', featured).replace('{{SATELLITES}}', satellites);
}

export function renderApp(app, directory) {
  const size = apkSize(app, directory);
  const available = size !== null;
  const values = {
    NAME: app.name, CATEGORY: app.category, DESCRIPTION: app.description,
    FILE: app.file, ICON: app.icon, COLOR: app.color,
    SIZE: available ? `${(size / 1000000).toFixed(1)} MB` : 'Coming soon',
    AVAILABLE: String(available),
    HINT: available ? 'First click shows the ad box. Click again to download the APK.' : 'The APK will be added soon. Your download button is ready here.',
    RELEASE_FOOT: available ? 'Ready to download and install.' : 'APK not yet available.'
  };
  return appTemplate.replace('{{APP_ICON}}', appIcon(app.slug)).replace(/\{\{(\w+)\}\}/g, (_, key) => escape(values[key]));
}
