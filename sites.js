const cheerio = require('cheerio');

// Timeout'lu fetch
async function get(url, ms = 7000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// Başlıktan kalite/ses tahmini (ortak yardımcı)
function guess(text = '') {
  const t = text.toLowerCase();
  const quality = (t.match(/2160p|4k|1080p|720p|480p/) || ['?'])[0];
  const audio = /dublaj|turkce|türkçe/.test(t)
    ? 'TR Dublaj'
    : /altyaz/.test(t)
    ? 'Altyazılı'
    : /dual/.test(t)
    ? 'Dual'
    : 'Orijinal';
  return { quality, audio };
}

// Her site: { name, find({title, year, season, episode}) -> [{url, label}] }
// ORNEK-SITE kısmını ve seçicileri kendi sitene göre değiştir.
// Yeni site eklemek = diziye yeni bir obje eklemek.
module.exports = [
  {
    name: 'Site1',
    async find({ title, season, episode }) {
      const q = encodeURIComponent(title);
      const html = await get(`https://ORNEK-SITE1.com/?s=${q}`);
      const $ = cheerio.load(html);

      // 1) arama sonucunun ilk linki
      let link = $('.result a, article a').first().attr('href');
      if (!link) return [];
      if (season) link += `?sezon=${season}&bolum=${episode}`; // sitene göre uyarla

      // 2) sayfadaki video kaynakları
      const page = cheerio.load(await get(link));
      const out = [];
      page('video source, a[href$=".mp4"], a[href$=".m3u8"]').each((_, el) => {
        const url = page(el).attr('src') || page(el).attr('href');
        const text = page(el).text() + ' ' + (page(el).attr('title') || '') + ' ' + url;
        if (url) out.push({ url, ...guess(text) });
      });
      return out;
    },
  },

  // { name: 'Site2', async find(ctx) { ... } },
  // ...
  // { name: 'Site10', async find(ctx) { ... } },
];
