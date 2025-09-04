import express from "express";
import cors from "cors";
import axios from "axios";
import NodeCache from "node-cache";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());

// API Keys
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// ==================== FUENTES ====================
const OFFICIAL_SOURCES = {
  twitter: {
    pc_sonora: "PC_Sonora",
    clima_sonora: "ClimaSonora",
    gobierno_sonora: "GobiernoSonora",
  },
  rss: [
    "https://www.elimparcial.com/rss/sonora.xml",
    "https://expreso.press/feed/",
  ],
};

// ==================== TWITTER ====================
async function fetchTwitterData() {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("⚠️ Twitter Bearer Token no configurado.");
    return [];
  }

  try {
    const accounts = Object.values(OFFICIAL_SOURCES.twitter);
    const query = accounts.map((acc) => `from:${acc}`).join(" OR ");

    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=10&tweet.fields=created_at,author_id,text`,
      { headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` } }
    );

    return response.data.data || [];
  } catch (error) {
    console.error("❌ Error fetching Twitter:", error.message);
    return [];
  }
}

// ==================== NEWS API ====================
async function fetchNewsAPI() {
  if (!NEWS_API_KEY) {
    console.warn("⚠️ NEWS_API_KEY no configurado.");
    return [];
  }

  try {
    const url = `https://newsapi.org/v2/everything?q=huracán%20Lorena%20Sonora&language=es&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
    const response = await axios.get(url);
    return (
      response.data.articles.map((a, i) => ({
        id: `news_${i}`,
        timestamp: a.publishedAt,
        source_type: "news",
        source_name: a.source.name,
        source_url: a.url,
        headline: a.title,
        summary_120w: a.description || "",
        public_health_risk: "medium",
      })) || []
    );
  } catch (error) {
    console.error("❌ Error fetching NewsAPI:", error.message);
    return [];
  }
}

// ==================== MOCK DATA ====================
async function fetchOfficialAPIData() {
  return [
    {
      id: "pc_001",
      timestamp: new Date().toISOString(),
      source_type: "official",
      source_name: "Protección Civil Sonora",
      source_url: "https://sonora.gob.mx",
      topic: "clima",
      headline: "Alerta por lluvias intensas en el norte de Sonora",
      summary_120w:
        "Se emite alerta por lluvias intensas en los municipios del norte de Sonora.",
      public_health_risk: "high",
      change_flag: true,
      area: "Norte de Sonora",
    },
  ];
}

// ==================== PROCESAMIENTO ====================
function processTwitterData(tweets) {
  return tweets.map((tweet) => {
    const text = tweet.text.toLowerCase();
    let risk = "medium";
    if (text.includes("emergencia") || text.includes("alerta")) risk = "high";

    return {
      id: `tw_${tweet.id}`,
      timestamp: tweet.created_at,
      source_type: "social",
      source_name: `Twitter/@${tweet.author_id}`,
      source_url: `https://twitter.com/${tweet.author_id}/status/${tweet.id}`,
      social_platform: "twitter",
      topic: "general",
      headline:
        tweet.text.length > 50
          ? tweet.text.substring(0, 47) + "..."
          : tweet.text,
      summary_120w: tweet.text,
      public_health_risk: risk,
      area: "Sonora",
    };
  });
}

// ==================== FETCH ALL ====================
async function fetchEvents() {
  const cached = cache.get("emergency_events");
  if (cached) return cached;

  const [twitter, official, news] = await Promise.all([
    fetchTwitterData(),
    fetchOfficialAPIData(),
    fetchNewsAPI(),
  ]);

  const allEvents = [
    ...official,
    ...processTwitterData(twitter),
    ...news,
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  cache.set("emergency_events", allEvents);
  return allEvents;
}

// ==================== ENDPOINTS ====================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend MonSON en línea 🚀",
    endpoints: {
      events: "/api/events",
      summary: "/api/summary",
      stats: "/api/stats",
      health: "/api/health",
    },
  });
});

app.get("/api/events", async (req, res) => {
  try {
    res.json(await fetchEvents());
  } catch (e) {
    res.status(500).json({ error: "Error obteniendo eventos" });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const events = await fetchEvents();
    const riskLevels = { low: 0, medium: 1, high: 2 };
    let highestRisk = "low";
    events.forEach((e) => {
      if (riskLevels[e.public_health_risk] > riskLevels[highestRisk]) {
        highestRisk = e.public_health_risk;
      }
    });
    res.json({
      risk_level: highestRisk,
      total_events: events.length,
      critical_alerts: events.filter((e) => e.public_health_risk === "high")
        .length,
    });
  } catch (e) {
    res.status(500).json({ error: "Error generando resumen" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const events = await fetchEvents();
    res.json({
      total: events.length,
      by_type: {
        official: events.filter((e) => e.source_type === "official").length,
        social: events.filter((e) => e.source_type === "social").length,
        news: events.filter((e) => e.source_type === "news").length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Error generando estadísticas" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Servidor vivo 🚑",
    timestamp: new Date().toISOString(),
  });
});

// ==================== START ====================
app.listen(PORT, () =>
  console.log(`🚨 MonSON backend corriendo en puerto ${PORT}`)
);

export default app;
