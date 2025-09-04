# Panel de Monitoreo de Emergencias - Sonora

Sistema completo de monitoreo en tiempo real de emergencias en el estado de Sonora, México, con backend Node.js y frontend web.

## Características

### Frontend
- Panel de control web responsive
- Visualización de eventos en tiempo real
- Mapa interactivo de zonas afectadas
- Sistema de semáforo de riesgo
- Exportación de reportes en PDF y DOC
- Filtros por tipo de evento y fuente
- Alertas críticas en tiempo real

### Backend
- API REST con Node.js y Express
- Conexión a fuentes oficiales (Twitter, APIs gubernamentales, noticias)
- Sistema de caché para optimizar rendimiento
- Procesamiento inteligente de datos de múltiples fuentes
- Análisis automático de nivel de riesgo
- Endpoints para estadísticas y resúmenes ejecutivos

## Instalación y Configuración

### Prerrequisitos
- Node.js 16+ 
- NPM o Yarn
- Claves de API de Twitter y NewsAPI (opcionales)

### Configuración del Backend

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Editar el archivo `.env` con tus claves de API:
```env
PORT=3001
TWITTER_BEARER_TOKEN=tu_token_de_twitter
NEWS_API_KEY=tu_clave_de_newsapi
```

3. **Iniciar el servidor:**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

### Configuración del Frontend

El frontend está en la carpeta `public/` y se sirve como archivos estáticos. Para desarrollo local:

1. Abrir `public/index.html` en un navegador
2. O usar un servidor web local:
```bash
# Con Python
cd public && python -m http.server 8000

# Con Node.js (http-server)
npx http-server public -p 8000
```

## APIs y Fuentes de Datos

### Fuentes Oficiales Integradas
- **Twitter:** @PC_Sonora, @ClimaSonora, @GobiernoSonora, @AytoHermosillo
- **NewsAPI:** Noticias de emergencias en español
- **APIs Gubernamentales:** Protección Civil y Servicios Meteorológicos (cuando estén disponibles)

### Endpoints de la API

- `GET /api/events` - Obtener todos los eventos de emergencia
- `GET /api/summary` - Resumen ejecutivo de la situación
- `GET /api/stats` - Estadísticas detalladas
- `GET /api/health` - Estado del servidor

## Obtención de Claves de API

### Twitter API
1. Crear cuenta de desarrollador en [developer.twitter.com](https://developer.twitter.com)
2. Crear una nueva aplicación
3. Generar Bearer Token
4. Agregar el token al archivo `.env`

### NewsAPI
1. Registrarse en [newsapi.org](https://newsapi.org)
2. Obtener clave gratuita (hasta 1000 requests/día)
3. Agregar la clave al archivo `.env`

## Estructura del Proyecto

```
monitoreo-sonora/
├── server.js              # Servidor backend principal
├── package.json           # Dependencias del backend
├── .env.example          # Plantilla de variables de entorno
├── public/               # Frontend estático
│   ├── index.html        # Aplicación web principal
│   ├── css/
│   └── js/
├── README.md
└── netlify.toml          # Configuración de despliegue
```

## Funcionalidades Técnicas

### Procesamiento de Datos
- **Normalización:** Todos los eventos se procesan a un formato estándar
- **Análisis de Riesgo:** Algoritmo que evalúa el nivel de riesgo basado en palabras clave
- **Geolocalización:** Extracción automática de ubicaciones mencionadas
- **Deduplicación:** Evita eventos duplicados de múltiples fuentes

### Sistema de Caché
- Caché en memoria con TTL de 5 minutos
- Reduce llamadas a APIs externas
- Mejora tiempo de respuesta del frontend

### Manejo de Errores
- Fallback a datos locales si las APIs fallan
- Logs detallados para debugging
- Reintentos automáticos para APIs temporalmente no disponibles

## Despliegue

### Frontend (Netlify)
El frontend se puede desplegar en Netlify como sitio estático.

### Backend (Heroku/Railway/DigitalOcean)
```bash
# Ejemplo para Heroku
heroku create monitoreo-sonora-api
heroku config:set TWITTER_BEARER_TOKEN=tu_token
heroku config:set NEWS_API_KEY=tu_clave
git push heroku main
```

### Docker (Opcional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Contribución

1. Fork el proyecto
2. Crear rama para nueva funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## Licencia

MIT License - ver archivo LICENSE para detalles.

## Soporte

Para reportar problemas o solicitar funcionalidades, crear un issue en GitHub.