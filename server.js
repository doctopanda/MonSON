import express from "express";
import axios from "axios";
import cors from "cors";
import Parser from "rss-parser";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// ============================
// 🔑 Configuración de APIs
// ============================
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || null;
const NEWS_API_KEY = process.env.NEWS_API_KEY || "e607a631a3de4743a7c91876ab5e37b4";
const rssParser = new Parser();

// ============================
// 📌 Fuentes oficiales de Sonora
// ============================
const OFFICIAL_SOURCES = {
  twitter: {
    pc_sonora: "PC_Sonora",
    clima_sonora: "ClimaSonora",
    gobierno_sonora: "GobiernoSonora",
  },
  web: [
    "https://proteccioncivil.sonora.gob.mx",
    "https://twitter.com/PC_Sonora",
    "https://twitter.com/GobiernoSonora",
  ],
};

// ============================
// 📌 Mocks iniciales
// ============================
const OFFICIAL_EVENTS = [
  {
    id: "official_1",
    timestamp: new Date().toISOString(),
    source_type: "official",
    source_name: "Protección Civil Sonora",
    source_url: "https://proteccioncivil.sonora.gob.mx",
    topic: "alerta",
    headline: "Alerta preventiva por Huracán Lorena en Sonora",
    summary_120w: "Protección Civil emite recomendaciones preventivas ante el Huracán Lorena en la región costera de Sonora.",
    public_health_risk: "high",
    change_flag: true,
    area: "Costa de Sonora",
  },
  {
    id: "official_2",
    timestamp: new Date().toISOString(),
    source_type: "official",
    source_name: "Gobierno de Sonora",
    source_url: "https://twitter.com/GobiernoSonora",
    topic: "salud pública",
    headline: "Gobierno del Estado activa refugios temporales",
    summary_120w: "Se habilitan refugios temporales en Guaymas y Empalme debido al impacto del Huracán Lorena.",
    public_health_risk: "medium",
    change_flag: true,
    area: "Guaymas y Empalme",
  },
];

// ============================
// 📡 Fetch de Twitter
// ============================
async function fetchTwitterData() {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("⚠️ Twitter Bearer Token no configurado.");
    return [];
  }

  try {
    const accounts = Object.values(OFFICIAL_SOURCES.twitter);
    const query = accounts.map(acc => `from:${acc}`).join(" OR ");

    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id,text`,
      {
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    return (response.data.data || []).map((tweet) => ({
      id: tweet.id,
      timestamp: tweet.created_at,
      source_type: "twitter",
      source_name: tweet.author_id,
      source_url: `https://twitter.com/i/web/status/${tweet.id}`,
      topic: "huracan",
      headline: tweet.text.substring(0, 80) + "...",
      summary_120w: tweet.text,
      public_health_risk: "medium",
      change_flag: false,
      area: "Sonora",
    }));
  } catch (error) {
    console.error("Error fetching Twitter data:", error.message);
    return [];
  }
}

// ============================
// 📰 Fetch de NewsAPI
// ============================
async function fetchNewsAPIData() {
  if (!NEWS_API_KEY) {
    console.warn("⚠️ NEWS_API_KEY no configurado.");
    return [];
  }

  try {
    const url = `https://newsapi.org/v2/everything?q=huracan+lorena+sonora&language=es&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;
    const response = await axios.get(url);

    return response.data.articles.map((article, i) => ({
      id: `news_${i}`,
      timestamp: article.publishedAt,
      source_type: "news",
      source_name: article.source.name,
      source_url: article.url,
      topic: "huracan",
      headline: article.title,
      summary_120w: article.description || article.title,
      public_health_risk: "medium",
      change_flag: false,
      area: "Sonora",
    }));
  } catch (error) {
    console.error("Error fetching NewsAPI data:", error.message);
    return [];
  }
}

// ============================
// 📰 Fetch de Google News RSS
// ============================
async function fetchGoogleNewsRSS() {
  try {
    const feed = await rssParser.parseURL(
      "https://news.google.com/rss/search?q=huracan+lorena+sonora&hl=es-419&gl=MX&ceid=MX:es-419"
    );

    return feed.items.map((item, i) => ({
      id: `rss_${i}`,
      timestamp: item.pubDate,
      source_type: "rss",
      source_name: item.source || "Google News",
      source_url: item.link,
      topic: "huracan",
      headline: item.title,
      summary_120w: item.contentSnippet || item.title,
      public_health_risk: "low",
      change_flag: false,
      area: "Sonora",
    }));
  } catch (error) {
    console.error("Error fetching Google RSS data:", error.message);
    return [];
  }
}

// ============================
// 🚀 Endpoint principal
// ============================
app.get("/api/events", async (req, res) => {
  let events = [...OFFICIAL_EVENTS];

  // Twitter
  let twitterData = await fetchTwitterData();
  events = events.concat(twitterData);

  // Si Twitter no devolvió nada, usar NewsAPI
  if (twitterData.length === 0) {
    let newsData = await fetchNewsAPIData();
    events = events.concat(newsData);

    // Si tampoco hay nada en NewsAPI, usar RSS
    if (newsData.length === 0) {
      let rssData = await fetchGoogleNewsRSS();
      events = events.concat(rssData);
    }
  }

  res.json(events);
});

// ============================
// 🚀 Iniciar servidor
// ============================
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});
