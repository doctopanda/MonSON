import express from "express";
import cors from "cors";
import axios from "axios";
import NodeCache from "node-cache";
import dotenv from "dotenv";

// Configurar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos

// Middleware
app.use(cors({
    origin: [
        'https://mon-son.netlify.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());

// Claves de API (configurar en .env)
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Fuentes oficiales de Sonora
const OFFICIAL_SOURCES = {
  twitter: {
    pc_sonora: 'PC_Sonora',
    clima_sonora: 'ClimaSonora',
    gobierno_sonora: 'GobiernoSonora'
  }
};

// Función para obtener datos de Twitter
async function fetchTwitterData() {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn('Twitter Bearer Token no configurado. Omitiendo datos de Twitter.');
    return [];
  }

  try {
    const accounts = Object.values(OFFICIAL_SOURCES.twitter);
    const query = accounts.map(acc => `from:${acc}`).join(' OR ');
    
    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id,text`,
      {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
        }
      }
    );
    
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching Twitter data:', error.message);
    return [];
  }
}

// Función para obtener datos de APIs oficiales
async function fetchOfficialAPIData() {
  try {
    // Simulamos datos de API ya que las URLs reales pueden requerir autenticación
    // En producción, reemplazar con llamadas reales a las APIs
    
    const mockOfficialData = [
      {
        id: "pc_001",
        timestamp: new Date().toISOString(),
        source_type: "official",
        source_name: "Protección Civil Sonora",
        source_url: "https://sonora.gob.mx",
        topic: "clima",
        headline: "Alerta por lluvias intensas en el norte de Sonora",
        summary_120w: "Se emite alerta por lluvias intensas en los municipios del norte de Sonora. Se recomienda precaución.",
        public_health_risk: "high",
        change_flag: true,
        lat: 29.1056,
        lng: -110.9428,
        area: "Norte de Sonora",
        antecedentes: "Las condiciones meteorológicas indican la formación de tormentas intensas.",
        situacion_actual: "Lluvias intensas en los municipios del norte con posibilidad de inundaciones.",
        acciones_realizadas: "Monitoreo constante y coordinación con municipios afectados.",
        acciones_por_realizar: "Evaluación de daños y necesidades de la población afectada."
      },
      {
        id: "clima_001",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Hace 2 horas
        source_type: "official",
        source_name: "Servicio Meteorológico Sonora",
        source_url: "https://sonora.gob.mx",
        topic: "clima",
        headline: "Pronóstico de temperaturas elevadas para el fin de semana",
        summary_120w: "Se esperan temperaturas superiores a los 40°C en el sur del estado durante el fin de semana.",
        public_health_risk: "medium",
        change_flag: false,
        lat: 28.3890,
        lng: -109.5000,
        area: "Sur de Sonora"
      }
    ];
    
    return mockOfficialData;
  } catch (error) {
    console.error('Error fetching official API data:', error.message);
    return [];
  }
}

// Procesar datos de Twitter
function processTwitterData(tweets) {
  return tweets.map(tweet => {
    // Análisis básico del tweet para determinar riesgo
    const text = tweet.text.toLowerCase();
    let risk = 'medium';
    
    if (text.includes('emergencia') || text.includes('evacuación') || text.includes('alerta')) {
      risk = 'high';
    } else if (text.includes('precaución') || text.includes('lluvia') || text.includes('viento')) {
      risk = 'medium';
    } else {
      risk = 'low';
    }
    
    return {
      id: `tw_${tweet.id}`,
      timestamp: tweet.created_at,
      source_type: 'social',
      source_name: `Twitter/@${tweet.author_id}`,
      source_url: `https://twitter.com/${tweet.author_id}/status/${tweet.id}`,
      social_platform: 'twitter',
      topic: extractTopicFromTweet(tweet.text),
      headline: tweet.text.length > 50 ? tweet.text.substring(0, 47) + '...' : tweet.text,
      summary_120w: tweet.text,
      public_health_risk: risk,
      change_flag: text.includes('actualización') || text.includes('nuevo'),
      area: extractLocationFromTweet(tweet.text)
    };
  });
}

// Función auxiliar para extraer tema de tweet
function extractTopicFromTweet(text) {
  const topics = {
    'inundación|inundaciones|lluvia|lluvias': 'inundaciones',
    'incendio|fuego|quemadura': 'incendios',
    'sismo|temblor|terremoto': 'sismos',
    'accidente|choque|colisión': 'accidentes',
    'evacuación|desalojo': 'evacuaciones',
    'alerta|emergencia|peligro': 'alertas'
  };
  
  for (const [pattern, topic] of Object.entries(topics)) {
    if (new RegExp(pattern, 'i').test(text)) {
      return topic;
    }
  }
  
  return 'general';
}

// Función auxiliar para extraer ubicación de tweet
function extractLocationFromTweet(text) {
  const locations = {
    'hermosillo': 'Hermosillo',
    'nogales': 'Nogales',
    'ciudad obregón|obregon': 'Ciudad Obregón',
    'navojoa': 'Navojoa',
    'guaymas|san carlos': 'Guaymas',
    'sonoyta': 'Sonoyta',
    'puerto peñasco': 'Puerto Peñasco',
    'água prieta': 'Água Prieta'
  };
  
  for (const [pattern, location] of Object.entries(locations)) {
    if (new RegExp(pattern, 'i').test(text)) {
      return location;
    }
  }
  
  return 'Sonora';
}

// Función para calcular nivel de riesgo
function calcularNivelRiesgo(nivel) {
  const niveles = {
    'bajo': 'low',
    'medio': 'medium',
    'alto': 'high',
    'extremo': 'high'
  };
  
  return niveles[nivel.toLowerCase()] || 'medium';
}

// Endpoint principal para obtener eventos
app.get("/api/events", async (req, res) => {
  try {
    // Verificar si hay datos en caché
    const cachedData = cache.get('emergency_events');
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // Obtener datos de todas las fuentes
    const [twitterData, officialData] = await Promise.all([
      fetchTwitterData(),
      fetchOfficialAPIData()
    ]);
    
    // Combinar y procesar todos los datos
    const allEvents = [...officialData, ...processTwitterData(twitterData)];
    
    // Ordenar por fecha (más recientes primero)
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Guardar en caché
    cache.set('emergency_events', allEvents);
    
    res.json(allEvents);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Error al obtener datos de emergencia' });
  }
});

// Endpoint para obtener resumen ejecutivo
app.get("/api/summary", async (req, res) => {
  try {
    // Obtener eventos
    const events = await fetchEvents();
    
    // Calcular el riesgo más alto
    const riskLevels = { 'low': 0, 'medium': 1, 'high': 2 };
    let highestRisk = 'low';
    
    events.forEach(event => {
      if (riskLevels[event.public_health_risk] > riskLevels[highestRisk]) {
        highestRisk = event.public_health_risk;
      }
    });
    
    const summaryText = {
      low: "La situación está controlada. El impacto es menor y los servicios operan con normalidad. Se mantiene monitoreo preventivo.",
      medium: "Impacto moderado en infraestructura y servicios. Existen riesgos sanitarios localizados. Se recomienda a la población mantenerse informada y seguir indicaciones.",
      high: "Situación crítica con impacto severo. Hay evacuaciones activas y riesgos significativos para la salud pública. Se requiere máxima precaución y atención a las directivas de las autoridades."
    };
    
    res.json({
      risk_level: highestRisk,
      summary: summaryText[highestRisk],
      total_events: events.length,
      critical_alerts: events.filter(e => e.public_health_risk === 'high').length
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Error al generar resumen' });
  }
});

// Endpoint para estadísticas
app.get("/api/stats", async (req, res) => {
  try {
    const events = await fetchEvents();
    
    const stats = {
      total: events.length,
      by_type: {
        official: events.filter(e => e.source_type === 'official').length,
        social: events.filter(e => e.source_type === 'social').length
      },
      by_risk: {
        high: events.filter(e => e.public_health_risk === 'high').length,
        medium: events.filter(e => e.public_health_risk === 'medium').length,
        low: events.filter(e => e.public_health_risk === 'low').length
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error generating stats:', error);
    res.status(500).json({ error: 'Error al generar estadísticas' });
  }
});

// Endpoint de salud
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Backend MonSON en línea 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta de prueba
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

// Función para obtener eventos (usada internamente)
async function fetchEvents() {
  const cachedData = cache.get('emergency_events');
  if (cachedData) {
    return cachedData;
  }
  
  const [twitterData, officialData] = await Promise.all([
    fetchTwitterData(),
    fetchOfficialAPIData()
  ]);
  
  return [...officialData, ...processTwitterData(twitterData)];
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚨 Servidor de monitoreo de emergencias ejecutándose en puerto ${PORT}`);
  console.log(`📊 Panel disponible en: http://localhost:${PORT}`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - GET /api/events - Obtener eventos de emergencia`);
  console.log(`   - GET /api/summary - Obtener resumen ejecutivo`);
  console.log(`   - GET /api/stats - Obtener estadísticas`);
  console.log(`   - GET /api/health - Estado del servidor`);
});

export default app;
