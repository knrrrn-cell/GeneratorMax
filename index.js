const http = require('http');
const sites = require('./sites');

const PORT = process.env.PORT || 3000;
const TTL = 20 * 60 * 1000; // 20 dk önbellek
const cache = new Map();

const manifest = {
  id: 'community.multisite.addon',
  version: '1.0.0',
  name: 'Çoklu Site Tarayıcı',
  description: 'Seçili sitelerden görüntü ve ses seçeneklerini listeler',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

// IMDb id'den başlık al (Cinemeta)
async function getTitle(type, imdb) {
  const r = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdb}.json`);
  const j = await r.json();
  return { title: j.meta?.name, year: j.meta?.year };
}

async function findStreams(type, id) {
  const key = `${type}:${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;

  const [imdb, season, episode] = id.split(':');
  const { title, year } = await getTitle(type, imdb);
  if (!title) return [];

  const ctx = { title, year, season, episode };
  const results = await Promise.allSettled(
    sites.map(async (s) => {
      const list = await s.find(ctx);
      return list.map((x) => ({
        name: s.name,
        title: `${x.quality} | ${x.audio}\n${s.name}`,
        url: x.url,
      }));
    })
  );

  const seen = new Set();
  const streams = results
    .flatMap((r, i) => {
      if (r.status === 'rejected') console.log(`${sites[i].name} hata:`, r.reason?.message);
      return r.status === 'fulfilled' ? r.value : [];
    })
    .filter((s) => !seen.has(s.url) && seen.add(s.url));

  cache.set(key, { t: Date.now(), data: streams });
  return streams;
}

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const path = decodeURIComponent(req.url.split('?')[0]);

    try {
      if (path === '/manifest.json') return res.end(JSON.stringify(manifest));

      const m = path.match(/^\/stream\/(movie|series)\/(.+)\.json$/);
      if (m) return res.end(JSON.stringify({ streams: await findStreams(m[1], m[2]) }));

      if (path === '/') return res.end(JSON.stringify({ ok: true }));
      res.statusCode = 404;
      res.end('{}');
    } catch (e) {
      console.log('hata:', e.message);
      res.end(JSON.stringify({ streams: [] }));
    }
  })
  .listen(PORT, () => console.log('Addon hazır:', PORT));
