const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos

// Middleware
app.use(cors());
app.use(express.json());

// Claves de API (configurar en Render → Environment)
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Fuentes oficiales de Sonora (simuladas)
const OFFICIAL_SOURCES = {
  twitter: {
    pc_sonora: "PC_Sonora",
    clima_sonora: "ClimaSonora",
    gobierno_sonora: "GobiernoSonora"
  }
};

// ---- Fetch de Twitter ----
async function fetchTwitterData() {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("⚠️ Twitter Bearer Token no configurado. Omitiendo datos de Twitter.");
    return [];
  }

  try {
    const accounts = Object.values(OFFICIAL_SOURCES.twitter);
    const query = accounts.map(acc => `from:${acc}`).join(" OR ");

    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id,text`,
      {
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
        }
      }
    );

    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching Twitter data:", error.message);
    return [];
  }
}

// ---- Fetch de APIs oficiales (Mock) ----
async function fetchOfficialAPIData() {
  try {
    const mockOfficialData = [
      {
        id: "pc_001",
        timestamp: new Date().toISOString(),
        source_type: "official",
        source_name: "Protección Civil Sonora",
        source_url: "https://sonora.gob.mx",
        topic: "clima",
        headline: "Alerta por lluvias intensas en el norte de Sonora",
        summary_120w:
          "Se emite alerta por lluvias intensas en los municipios del norte de Sonora. Se recomienda precaución.",
        public_health_risk: "high",
        change_flag: true,
        lat: 29.1056,
        lng: -110.9428,
        area: "Norte de Sonora"
      },
      {
        id: "clima_001",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // hace 2 horas
        source_type: "official",
        source_name: "Servicio Meteorológico Sonora",
        source_url: "https://sonora.gob.mx",
        topic: "clima",
        headline: "Pronóstico de temperaturas elevadas para el fin de semana",
        summary_120w:
          "Se esperan temperaturas superiores a los 40°C en el sur del estado durante el fin de semana.",
        public_health_risk: "medium",
        change_flag: false,
        lat: 28.389,
        lng: -109.5,
        area: "Sur de Sonora"
      }
    ];

    return mockOfficialData;
  } catch (error) {
    console.error("Error fetching official API data:", error.message);
    return [];
  }
}

// ---- Procesar Tweets ----
function processTwitterData(tweets) {
  return tweets.map(tweet => {
    const text = tweet.text.toLowerCase();
    let risk = "medium";

    if (text.includes("emergencia") || text.includes("evacuación") || text.includes("alerta")) {
      risk = "high";
    } else if (text.includes("precaución") || text.includes("lluvia") || text.includes("viento")) {
      risk = "medium";
    } else {
      risk = "low";
    }

    return {
      id: `tw_${tweet.id}`,
      timestamp: tweet.created_at,
      source_type: "social",
      source_name: `Twitter/@${tweet.author_id}`,
      source_url: `https://twitter.com/${tweet.author_id}/status/${tweet.id}`,
      social_platform: "twitter",
      topic: "general",
      headline: tweet.text.length > 50 ? tweet.text.substring(0, 47) + "..." : tweet.text,
      summary_120w: tweet.text,
      public_health_risk: risk,
      change_flag: text.includes("actualización") || text.includes("nuevo"),
      area: "Sonora"
    };
  });
}

// ---- Función para obtener todos los eventos ----
async function fetchEvents() {
  const cachedData = cache.get("emergency_events");
  if (cachedData) return cachedData;

  const [twitterData, officialData] = await Promise.all([
    fetchTwitterData(),
    fetchOfficialAPIData()
  ]);

  const allEvents = [...officialData, ...processTwitterData(twitterData)];
  allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  cache.set("emergency_events", allEvents);
  return allEvents;
}

// ---- Endpoints ----
app.get("/api/events", async (req, res) => {
  try {
    const events = await fetchEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const events = await fetchEvents();
    const riskLevels = { low: 0, medium: 1, high: 2 };
    let highestRisk = "low";

    events.forEach(e => {
      if (riskLevels[e.public_health_risk] > riskLevels[highestRisk]) {
        highestRisk = e.public_health_risk;
      }
    });

    res.json({
      risk_level: highestRisk,
      summary:
        highestRisk === "high"
          ? "Situación crítica con impacto severo. Evacuaciones y riesgos significativos."
          : highestRisk === "medium"
          ? "Impacto moderado, riesgos sanitarios localizados. Mantente informado."
          : "Situación controlada, impacto menor.",
      total_events: events.length,
      critical_alerts: events.filter(e => e.public_health_risk === "high").length
    });
  } catch (err) {
    res.status(500).json({ error: "Error al generar resumen" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const events = await fetchEvents();
    res.json({
      total: events.length,
      by_type: {
        official: events.filter(e => e.source_type === "official").length,
        social: events.filter(e => e.source_type === "social").length
      },
      by_risk: {
        high: events.filter(e => e.public_health_risk === "high").length,
        medium: events.filter(e => e.public_health_risk === "medium").length,
        low: events.filter(e => e.public_health_risk === "low").length
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error al generar estadísticas" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend MonSON en línea 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend MonSON en línea 🚀",
    endpoints: {
      events: "/api/events",
      summary: "/api/summary",
      stats: "/api/stats",
      health: "/api/health"
    }
  });
});

// ---- Iniciar servidor ----
app.listen(PORT, () => {
  console.log(`🚨 Servidor corriendo en puerto ${PORT}`);
});
