import { apps } from './apps.mjs';

export const siteOrigin = 'https://www.rajuit.online';
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`;
export const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...apps.map(app => `/apps/${app.slug}`)].map(path => `  <url><loc>${siteOrigin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;

export function searchMetadata(html, app) {
  const canonical = siteOrigin + (app ? `/apps/${app.slug}` : '/');
  const verification = process.env.GOOGLE_SITE_VERIFICATION;
  return html.replace('</head>', `  <link rel="canonical" href="${canonical}">\n${verification ? `  <meta name="google-site-verification" content="${escape(verification)}">\n` : ''}</head>`);
}
