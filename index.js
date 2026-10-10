const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const sites = require("./sites");

const manifest = {
  id: "community.film-kaynak-addon",
  version: "2.0.0",
  name: "Film Kaynak Tarayıcı",
  description: "Film, dizi ve anime katalogları",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "film-kaynak-movies",
      name: "Filmler"
    },
    {
      type: "series",
      id: "film-kaynak-series",
      name: "Diziler"
    },
    {
      type: "series",
      id: "film-kaynak-anime",
      name: "Anime"
    }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id }) => {
  try {
    let metas = [];

    if (id === "film-kaynak-movies" && type === "movie") {
      metas = await sites.movies();
    } else if (id === "film-kaynak-series" && type === "series") {
      metas = await sites.series();
    } else if (id === "film-kaynak-anime" && type === "series") {
      metas = await sites.anime();
    }

    return { metas };
  } catch (error) {
    console.error("Katalog hatası:", error.message);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ type, id }) => {
  try {
    const match = id.match(/^dizigom:(movie|series):(.+)$/);

    if (!match) return { meta: null };

    const path = decodeURIComponent(match[2]);
    const url = new URL(path, "https://www.dizigom.news");

    if (url.origin !== "https://www.dizigom.news") {
      return { meta: null };
    }

    const response = await fetch(url.href, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!response.ok) return { meta: null };

    const html = await response.text();
    const $ = require("cheerio").load(html);

    const name =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim();

    const poster =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (!name) return { meta: null };

    return {
      meta: {
        id,
        type,
        name,
        poster: poster
          ? new URL(poster, url.href).href
          : undefined,
        description:
          $('meta[property="og:description"]').attr("content") || ""
      }
    };
  } catch (error) {
    console.error("Meta hatası:", error.message);
    return { meta: null };
  }
});

builder.defineStreamHandler(async () => {
  // Yetkili oynatma kaynakları eklenene kadar boş döner.
  return { streams: [] };
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
