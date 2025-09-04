const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos

// Middleware
app.use(cors());
app.use(express.json());

// Claves de API (configurar en .env)
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Fuentes oficiales de Sonora
const OFFICIAL_SOURCES = {
  twitter: {
    pc_sonora: 'PC_Sonora',
    clima_sonora: 'ClimaSonora',
    gobierno_sonora: 'GobiernoSonora',
    ayto_hermosillo: 'AytoHermosillo'
  },
  apis: {
    proteccion_civil: 'https://api.sonora.gob.mx/emergencias',
    clima: 'https://api.sonora.gob.mx/clima/alertas'
  }
};

// Función para obtener datos de Twitter
async function fetchTwitterData() {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn('Twitter Bearer Token no configurado');
    return [];
  }

  try {
    const accounts = Object.values(OFFICIAL_SOURCES.twitter);
    const query = accounts.map(acc => `from:${acc}`).join(' OR ');
    
    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,author_id,text,public_metrics`,
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

// Función para obtener noticias de emergencias
async function fetchNewsData() {
  if (!NEWS_API_KEY) {
    console.warn('News API Key no configurado');
    return [];
  }

  try {
    const query = 'emergencia OR inundación OR incendio OR sismo Sonora Hermosillo';
    const response = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=es&sortBy=publishedAt&pageSize=10`,
      {
        headers: {
          'X-API-Key': NEWS_API_KEY
        }
      }
    );
    
    return response.data.articles || [];
  } catch (error) {
    console.error('Error fetching news data:', error.message);
    return [];
  }
}

// Función para obtener datos de APIs oficiales (simuladas por ahora)
async function fetchOfficialAPIData() {
  try {
    // En un entorno real, estas APIs requerirían autorización especial
    // Por ahora, simulamos algunos datos oficiales típicos
    const mockOfficialData = [
      {
        id: 'pc_001',
        fecha: new Date().toISOString(),
        tipo: 'inundaciones',
        titulo: 'Monitoreo de niveles de agua en arroyos',
        descripcion: 'Protección Civil mantiene vigilancia constante en los principales arroyos de Hermosillo debido a las precipitaciones registradas.',
        nivel: 'medio',
        zona_afectada: 'Hermosillo Centro',
        ubicacion: { lat: 29.0892, lng: -110.9613 },
        enlace: 'https://www.sonora.gob.mx/proteccion-civil'
      }
    ];

    return processAPIData({ emergencias: mockOfficialData }, 'proteccion_civil');
  } catch (error) {
    console.error('Error fetching official API data:', error.message);
    return [];
  }
}

// Procesar datos de API oficial
function processAPIData(data, source) {
  const events = [];
  
  if (source === 'proteccion_civil' && data.emergencias) {
    data.emergencias.forEach(emergencia => {
      events.push({
        id: `pc_${emergencia.id}`,
        timestamp: emergencia.fecha,
        source_type: 'official',
        source_name: 'Protección Civil Sonora',
        source_url: emergencia.enlace || OFFICIAL_SOURCES.apis.proteccion_civil,
        topic: emergencia.tipo,
        headline: emergencia.titulo,
        summary_120w: emergencia.descripcion,
        public_health_risk: calcularNivelRiesgo(emergencia.nivel),
        change_flag: emergencia.actualizacion || false,
        lat: emergencia.ubicacion?.lat,
        lng: emergencia.ubicacion?.lng,
        area: emergencia.zona_afectada,
        antecedentes: `Evento reportado por ${source} el ${new Date(emergencia.fecha).toLocaleDateString('es-MX')}`,
        situacion_actual: emergencia.descripcion,
        acciones_realizadas: 'Monitoreo constante por parte de las autoridades competentes',
        acciones_por_realizar: 'Continuar vigilancia y evaluación de la situación'
      });
    });
  }
  
  return events;
}

// Función para calcular nivel de riesgo
function calcularNivelRiesgo(nivel) {
  const niveles = {
    'bajo': 'low',
    'medio': 'medium',
    'alto': 'high',
    'extremo': 'high',
    'crítico': 'high'
  };
  
  return niveles[nivel?.toLowerCase()] || 'medium';
}

// Procesar datos de Twitter
function processTwitterData(tweets) {
  return tweets.map(tweet => {
    const text = tweet.text.toLowerCase();
    let risk = 'medium';
    
    // Análisis de riesgo basado en palabras clave
    if (text.includes('emergencia') || text.includes('evacuación') || text.includes('alerta roja') || text.includes('peligro')) {
      risk = 'high';
    } else if (text.includes('precaución') || text.includes('lluvia') || text.includes('viento') || text.includes('alerta')) {
      risk = 'medium';
    } else {
      risk = 'low';
    }
    
    return {
      id: `tw_${tweet.id}`,
      timestamp: tweet.created_at,
      source_type: 'social',
      source_name: `Twitter/@${getTwitterUsername(tweet.author_id)}`,
      source_url: `https://twitter.com/i/status/${tweet.id}`,
      social_platform: 'twitter',
      topic: extractTopicFromTweet(tweet.text),
      headline: tweet.text.length > 80 ? tweet.text.substring(0, 77) + '...' : tweet.text,
      summary_120w: tweet.text,
      public_health_risk: risk,
      change_flag: text.includes('actualización') || text.includes('nuevo') || text.includes('urgente'),
      area: extractLocationFromTweet(tweet.text),
      lat: getCoordinatesForLocation(extractLocationFromTweet(tweet.text))?.lat,
      lng: getCoordinatesForLocation(extractLocationFromTweet(tweet.text))?.lng
    };
  });
}

// Procesar datos de noticias
function processNewsData(articles) {
  return articles.map(article => {
    const text = (article.title + ' ' + article.description).toLowerCase();
    let risk = 'medium';
    
    if (text.includes('emergencia') || text.includes('evacuación') || text.includes('desastre')) {
      risk = 'high';
    } else if (text.includes('alerta') || text.includes('daños') || text.includes('afectados')) {
      risk = 'medium';
    } else {
      risk = 'low';
    }
    
    return {
      id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: article.publishedAt,
      source_type: 'media',
      source_name: article.source.name,
      source_url: article.url,
      topic: extractTopicFromText(article.title + ' ' + article.description),
      headline: article.title,
      summary_120w: article.description || article.title,
      public_health_risk: risk,
      change_flag: false,
      area: extractLocationFromText(article.title + ' ' + article.description),
      lat: getCoordinatesForLocation(extractLocationFromText(article.title + ' ' + article.description))?.lat,
      lng: getCoordinatesForLocation(extractLocationFromText(article.title + ' ' + article.description))?.lng
    };
  });
}

// Función auxiliar para obtener username de Twitter
function getTwitterUsername(authorId) {
  const userMap = {
    [OFFICIAL_SOURCES.twitter.pc_sonora]: 'PC_Sonora',
    [OFFICIAL_SOURCES.twitter.clima_sonora]: 'ClimaSonora',
    [OFFICIAL_SOURCES.twitter.gobierno_sonora]: 'GobiernoSonora',
    [OFFICIAL_SOURCES.twitter.ayto_hermosillo]: 'AytoHermosillo'
  };
  
  return userMap[authorId] || `Usuario_${authorId}`;
}

// Función auxiliar para extraer tema de texto
function extractTopicFromTweet(text) {
  return extractTopicFromText(text);
}

function extractTopicFromText(text) {
  const topics = {
    'inundación|inundaciones|lluvia|lluvias|agua|arroyo': 'inundaciones',
    'incendio|fuego|quemadura|humo': 'incendios',
    'sismo|temblor|terremoto': 'sismos',
    'accidente|choque|colisión|tráfico': 'accidentes',
    'evacuación|desalojo|refugio': 'evacuaciones',
    'alerta|emergencia|peligro|urgente': 'alertas',
    'salud|hospital|médico|sanitario': 'salud',
    'infraestructura|carretera|puente|servicio': 'infraestructura'
  };
  
  for (const [pattern, topic] of Object.entries(topics)) {
    if (new RegExp(pattern, 'i').test(text)) {
      return topic;
    }
  }
  
  return 'general';
}

// Función auxiliar para extraer ubicación
function extractLocationFromTweet(text) {
  return extractLocationFromText(text);
}

function extractLocationFromText(text) {
  const locations = {
    'hermosillo': 'Hermosillo',
    'nogales': 'Nogales',
    'ciudad obregón|obregon': 'Ciudad Obregón',
    'navojoa': 'Navojoa',
    'guaymas|san carlos': 'Guaymas',
    'sonoyta': 'Sonoyta',
    'puerto peñasco': 'Puerto Peñasco',
    'água prieta': 'Água Prieta',
    'caborca': 'Caborca',
    'cananea': 'Cananea'
  };
  
  for (const [pattern, location] of Object.entries(locations)) {
    if (new RegExp(pattern, 'i').test(text)) {
      return location;
    }
  }
  
  return 'Sonora';
}

// Función para obtener coordenadas aproximadas por ubicación
function getCoordinatesForLocation(location) {
  const coordinates = {
    'Hermosillo': { lat: 29.0892, lng: -110.9613 },
    'Nogales': { lat: 31.3404, lng: -110.9342 },
    'Ciudad Obregón': { lat: 27.4827, lng: -109.9309 },
    'Navojoa': { lat: 27.0739, lng: -109.4425 },
    'Guaymas': { lat: 27.9202, lng: -110.9031 },
    'Puerto Peñasco': { lat: 31.3135, lng: -113.5336 },
    'Caborca': { lat: 30.7186, lng: -112.1590 },
    'Cananea': { lat: 30.9503, lng: -110.2982 },
    'Sonora': { lat: 29.2972, lng: -110.3309 }
  };
  
  return coordinates[location] || coordinates['Sonora'];
}

// Endpoint principal para obtener eventos
app.get('/api/events', async (req, res) => {
  try {
    // Verificar si hay datos en caché
    const cachedData = cache.get('emergency_events');
    if (cachedData) {
      return res.json(cachedData);
    }
    
    console.log('Obteniendo datos de fuentes externas...');
    
    // Obtener datos de todas las fuentes
    const [twitterData, newsData, officialData] = await Promise.all([
      fetchTwitterData(),
      fetchNewsData(),
      fetchOfficialAPIData()
    ]);
    
    console.log(`Datos obtenidos - Twitter: ${twitterData.length}, Noticias: ${newsData.length}, Oficial: ${officialData.length}`);
    
    // Combinar y procesar todos los datos
    const allEvents = [
      ...officialData,
      ...processTwitterData(twitterData),
      ...processNewsData(newsData)
    ];
    
    // Ordenar por fecha (más recientes primero)
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limitar a los últimos 50 eventos
    const limitedEvents = allEvents.slice(0, 50);
    
    // Guardar en caché
    cache.set('emergency_events', limitedEvents);
    
    console.log(`Enviando ${limitedEvents.length} eventos al frontend`);
    res.json(limitedEvents);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Error al obtener datos de emergencia' });
  }
});

// Endpoint para obtener resumen ejecutivo
app.get('/api/summary', async (req, res) => {
  try {
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
      critical_alerts: events.filter(e => e.public_health_risk === 'high').length,
      last_update: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Error al generar resumen' });
  }
});

// Endpoint para obtener estadísticas
app.get('/api/stats', async (req, res) => {
  try {
    const events = await fetchEvents();
    
    const stats = {
      total_events: events.length,
      by_source: {
        official: events.filter(e => e.source_type === 'official').length,
        social: events.filter(e => e.source_type === 'social').length,
        media: events.filter(e => e.source_type === 'media').length
      },
      by_risk: {
        high: events.filter(e => e.public_health_risk === 'high').length,
        medium: events.filter(e => e.public_health_risk === 'medium').length,
        low: events.filter(e => e.public_health_risk === 'low').length
      },
      by_topic: {}
    };
    
    // Contar por temas
    events.forEach(event => {
      stats.by_topic[event.topic] = (stats.by_topic[event.topic] || 0) + 1;
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error generating stats:', error);
    res.status(500).json({ error: 'Error al generar estadísticas' });
  }
});

// Endpoint de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache_keys: cache.keys().length
  });
});

// Función para obtener eventos (usada internamente)
async function fetchEvents() {
  const cachedData = cache.get('emergency_events');
  if (cachedData) {
    return cachedData;
  }
  
  const [twitterData, newsData, officialData] = await Promise.all([
    fetchTwitterData(),
    fetchNewsData(),
    fetchOfficialAPIData()
  ]);
  
  const allEvents = [
    ...officialData,
    ...processTwitterData(twitterData),
    ...processNewsData(newsData)
  ];
  
  return allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚨 Servidor de monitoreo de emergencias ejecutándose en puerto ${port}`);
  console.log(`📊 Panel disponible en: http://localhost:${port}`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - GET /api/events - Obtener eventos de emergencia`);
  console.log(`   - GET /api/summary - Obtener resumen ejecutivo`);
  console.log(`   - GET /api/stats - Obtener estadísticas`);
  console.log(`   - GET /api/health - Estado del servidor`);
});

module.exports = app;