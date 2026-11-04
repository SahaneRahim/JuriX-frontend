// Usage: node render.cjs <fichier.dc.html> <sortie.png> <largeur> <hauteur> [clair|sombre] [reduit|mouvement] [attente_ms]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const [file, out, w, h, theme, motion, wait] = process.argv.slice(2);
  const src = fs.readFileSync(file, 'utf8');
  const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  const tpl = (src.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const sm = src.match(/<script type="text\/x-dc"([^>]*)>([\s\S]*?)<\/script>/);
  const dp = JSON.parse(((sm[1].match(/data-props='([\s\S]*?)'/) || [, '{}'])[1]));
  const props = {};
  Object.keys(dp).forEach((k) => { if (dp[k] && dp[k].default !== undefined) props[k] = dp[k].default; });
  if (theme === 'sombre') props.theme = 'dark';
  const runtime = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8');
  const esc = (s) => JSON.stringify(s).replace(/<\/(script)/gi, '<\\/$1');
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' + helmet +
    '<style>html,body{margin:0}</style></head><body><div id="root"></div><script>' + runtime + '</script><script>window.__boot(' +
    esc(tpl) + ',' + esc(sm[2]) + ',' + JSON.stringify(props) + ');</script></body></html>';

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h },
    reducedMotion: motion === 'mouvement' ? 'no-preference' : 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type() + ':', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(+wait || 500);
  const dims = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  console.log(path.basename(file), JSON.stringify(dims));
  if (process.env.CLIP) {
    const [x, y, cw, ch] = process.env.CLIP.split(',').map(Number);
    await page.screenshot({ path: out, fullPage: true, clip: { x, y, width: cw, height: ch } });
  } else {
    await page.screenshot({ path: out, fullPage: true });
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
