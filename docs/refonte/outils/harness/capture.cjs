// Usage: node capture.cjs <fichier.dc.html> <largeur> <hauteur> <clair|sombre> <mouvement:0|1> <spec.json> <dossier-sortie>
// spec : [{wait:ms}|{click:"css"}|{role:"button",name:"..."}|{hover:"css"}|{press:"Escape"}|{scroll:["css",top]}|{shot:"nom"}]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
async function main() {
  const [file, w, h, theme, motion, specFile, outDir] = process.argv.slice(2);
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
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' + helmet + '<style>html,body{margin:0}</style></head><body><div id="root"></div><script>' + runtime + '</script><script>window.__boot(' + esc(tpl) + ',' + esc(sm[2]) + ',' + JSON.stringify(props) + ');</script></body></html>';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: motion === '1' ? 'no-preference' : 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.setContent(html, { waitUntil: 'load' });
  let t0 = Date.now();
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const st of spec) {
    if (st.at !== undefined) { const left = st.at - (Date.now() - t0); if (left > 0) await page.waitForTimeout(left); }
    if (st.wait) await page.waitForTimeout(st.wait);
    if (st.click) await page.locator(st.click).first().click();
    if (st.role) await page.getByRole(st.role, { name: new RegExp(st.name) }).first().click();
    if (st.hover) await page.locator(st.hover).first().hover();
    if (st.press) await page.keyboard.press(st.press);
    if (st.scroll) await page.evaluate(([s, top]) => { const e = document.querySelector(s); e.scrollTo ? e.scrollTo(0, top) : (e.scrollTop = top); }, st.scroll);
    if (st.eval) await page.evaluate(st.eval);
    if (st.shot) { await page.screenshot({ path: path.join(outDir, st.shot + '.png') }); console.log('capture', st.shot); }
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
