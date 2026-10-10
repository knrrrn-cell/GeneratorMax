const cheerio = require("cheerio");

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getDizigomCatalog(path, type) {
  const html = await get(`https://www.dizigom.news${path}`);
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $("a[href]").each((_, element) => {
    const a = $(element);
    const href = a.attr("href");

    if (!href) return;

    const url = new URL(href, "https://www.dizigom.news");
    const validPath =
      type === "movie"
        ? /^\/film\/[^/]+\/?$/.test(url.pathname)
        : /^\/diziler\/[^/]+\/?$/.test(url.pathname) ||
          /^\/anime\/[^/]+\/?$/.test(url.pathname);

    if (!validPath || seen.has(url.href)) return;

    const title =
      a.attr("title") ||
      a.find("img").attr("alt") ||
      a.find("h2, h3, h4").first().text().trim() ||
      a.text().trim();

    const poster =
      a.find("img").attr("data-src") ||
      a.find("img").attr("data-lazy-src") ||
      a.find("img").attr("src");

    if (!title || title.length < 2) return;

    seen.add(url.href);

    items.push({
      id: `dizigom:${type}:${encodeURIComponent(url.pathname)}`,
      type,
      name: title.trim(),
      poster: poster
        ? new URL(poster, "https://www.dizigom.news").href
        : undefined,
      description: "Dizigom kataloğundan"
    });
  });

  return items.slice(0, 100);
}

module.exports = {
  async movies() {
    return getDizigomCatalog("/filmler/", "movie");
  },

  async series() {
    return getDizigomCatalog("/dizi-izle/", "series");
  },

  async anime() {
    return getDizigomCatalog("/animes/", "series");
  }
};
