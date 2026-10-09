import { apps } from './apps.mjs';

export const siteOrigin = 'https://www.rajuit.online';
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`;
export const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...apps.map(app => `/${app.slug}-download`)].map(path => `  <url><loc>${siteOrigin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;

export function searchMetadata(html, app) {
  const canonical = siteOrigin + (app ? `/${app.slug}-download` : '/');
  const verification = process.env.GOOGLE_SITE_VERIFICATION;
  const title = app ? `${app.name} ${app.category} for Android | Social Media Downloader Apps` : 'Social Media Downloader Apps for Android | R Apps';
  const description = app ? `${app.description} Check APK availability and learn how to install on Android.` : 'Explore YouTube, TikTok and Instagram video downloader apps for Android, plus RVpn VPN and RPlayer video player.';
  const structured = app ? {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name: app.name, applicationCategory: app.slug === 'rvpn' ? 'UtilitiesApplication' : 'MultimediaApplication',
    operatingSystem: 'Android', description: app.description, url: canonical
  } : {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, description, url: canonical,
    mainEntity: { '@type': 'ItemList', itemListElement: apps.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: `${item.name} ${item.category}`, url: `${siteOrigin}/${item.slug}-download`
    })) }
  };
  const json = JSON.stringify(structured).replace(/</g, '\\u003c');
  return html.replace('</head>', `  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="R Apps">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <script type="application/ld+json">${json}</script>
${verification ? `  <meta name="google-site-verification" content="${escape(verification)}">\n` : ''}</head>`);
}
