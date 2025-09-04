document.addEventListener('DOMContentLoaded', function () {
    const TIMEZONE = 'America/Hermosillo';

    // --- Mock Data ---
    // En un sistema real, estos datos vendrían de un backend.
    const eventData = [
        {
            "id": "evt001", "timestamp_local": "2025-09-03T02:00:00-07:00", "source_type": "official", "source_name": "SMN/CONAGUA", "topic": "rain",
            "headline": "Lluvias intensas registran acumulado de 83 mm en Hermosillo", "summary_120w": "El Servicio Meteorológico Nacional reporta lluvias torrenciales durante la madrugada, con un acumulado de 83 milímetros en la zona norte de Hermosillo, superando los pronósticos iniciales.",
            "verification": "verified", "public_health_risk": "medium", "change_flag": false,
            "location": { "lat": 29.0892, "lng": -110.9613, "area": "Hermosillo Norte" }
        },
        {
            "id": "evt002", "timestamp_local": "2025-09-03T04:30:00-07:00", "source_type": "media", "source_name": "El Imparcial", "topic": "infrastructure",
            "headline": "Inundaciones severas en colonias Mirasoles, Bachoco y La Caridad", "summary_120w": "Medios locales informan de inundaciones significativas y arrastre de vehículos en varias colonias del norte de la ciudad. Se reportan cortes de energía y caída de árboles.",
            "verification": "verified", "public_health_risk": "medium", "change_flag": false,
            "location": { "lat": 29.1056, "lng": -110.9428, "area": "Mirasoles" }
        },
        {
            "id": "evt003", "timestamp_local": "2025-09-03T07:00:00-07:00", "source_type": "official", "source_name": "Ayuntamiento de Hermosillo", "topic": "evacuation",
            "headline": "Evalúan evacuación de 40 familias en la colonia La Caridad", "summary_120w": "Autoridades municipales informan que 40 viviendas en La Caridad sufrieron daños por inundación. Se está analizando el traslado de los afectados a refugios temporales.",
            "verification": "verified", "public_health_risk": "high", "change_flag": true,
            "location": { "lat": 29.1201, "lng": -110.9542, "area": "La Caridad" }
        },
        {
            "id": "evt004", "timestamp_local": "2025-09-03T08:15:00-07:00", "source_type": "official", "source_name": "Protección Civil Sonora", "topic": "shelters",
            "headline": "Habilitan 5 refugios temporales en Hermosillo", "summary_120w": "Se habilitan oficialmente los Centros Hábitat, Solidaridad 1, Minitas, Casa Galilea y Miguel Alemán como refugios temporales para recibir a las familias afectadas por las inundaciones.",
            "verification": "verified", "public_health_risk": "high", "change_flag": true,
            "location": { "lat": 29.0726, "lng": -110.9556, "area": "Centro" }
        },
        {
            "id": "evt005", "timestamp_local": "2025-09-03T09:00:00-07:00", "source_type": "official", "source_name": "Secretaría de Salud Sonora", "topic": "healthcare",
            "headline": "Emiten alerta sanitaria por riesgos tras inundaciones", "summary_120w": "La Secretaría de Salud emite recomendaciones para prevenir enfermedades diarreicas y transmitidas por vector (dengue). Se pide a la población clorar el agua, manejar adecuadamente los residuos y evitar el contacto con aguas estancadas.",
            "verification": "verified", "public_health_risk": "high", "change_flag": true,
            "location": { "lat": 29.0669, "lng": -110.9669, "area": "Hermosillo Sur" }
        }
    ].sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local));

    // --- Elementos del DOM ---
    const lastUpdateTime = document.getElementById('last-update-time');
    const riskLight = document.getElementById('risk-light');
    const riskText = document.getElementById('risk-text');
    const executiveSummary = document.getElementById('executive-summary');
    const timelineContainer = document.getElementById('timeline-container');
    const filterButtonsContainer = document.getElementById('filter-buttons');
    const searchInput = document.getElementById('search-events');
    const tickerList = document.getElementById('ticker-list');
    const alertButton = document.getElementById('alert-button');
    const alertCount = document.getElementById('alert-count');
    const alertsModal = document.getElementById('alerts-modal');
    const modalClose = document.getElementById('modal-close');
    const modalBody = document.getElementById('modal-body');
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const mapContainer = document.getElementById('map-container');
    const mapPlaceholder = document.getElementById('map-placeholder');

    // Variables de estado
    let currentFilter = 'all';
    let currentSearchTerm = '';

    // --- Funciones de Renderizado ---
    function formatTime(isoString) {
        const options = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TIMEZONE };
        return new Date(isoString).toLocaleTimeString('es-MX', options);
    }

    function filterEvents() {
        let filteredData = eventData;
        
        // Aplicar filtro por tipo
        if (currentFilter !== 'all') {
            filteredData = filteredData.filter(event => 
                event.source_type === currentFilter || event.topic === currentFilter
            );
        }
        
        // Aplicar búsqueda
        if (currentSearchTerm) {
            const searchTerm = currentSearchTerm.toLowerCase();
            filteredData = filteredData.filter(event => 
                event.headline.toLowerCase().includes(searchTerm) || 
                event.summary_120w.toLowerCase().includes(searchTerm) ||
                event.source_name.toLowerCase().includes(searchTerm)
            );
        }
        
        return filteredData;
    }

    function renderTimeline() {
        const filteredData = filterEvents();

        if (filteredData.length === 0) {
            timelineContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>No hay eventos que coincidan con los criterios de búsqueda.</p>
                </div>
            `;
            return;
        }

        timelineContainer.innerHTML = filteredData.map(event => `
            <div class="flex gap-4 fade-in">
                <div class="text-right w-20 flex-shrink-0">
                    <p class="font-bold text-sm text-blue-600">${formatTime(event.timestamp_local)}</p>
                    <p class="text-xs text-gray-500">${new Date(event.timestamp_local).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</p>
                </div>
                <div class="relative w-full">
                    <div class="absolute top-1 left-[-22px] w-4 h-4 rounded-full bg-white border-2 ${event.change_flag ? 'border-red-500' : 'border-blue-500'}"></div>
                    <div class="border-l-2 ${event.change_flag ? 'border-red-500' : 'border-blue-500'} pl-6 pb-4">
                        <p class="font-semibold">${event.headline}</p>
                        <p class="text-sm text-gray-600 mt-1">${event.summary_120w}</p>
                        <div class="flex justify-between items-center mt-2">
                            <p class="text-xs text-gray-500">Fuente: ${event.source_name} <span class="uppercase font-bold">${event.source_type}</span></p>
                            ${event.location ? `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${event.location.area}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderSummary() {
        const latestRisk = eventData[0]?.public_health_risk || 'low';
        
        riskLight.classList.remove('risk-low', 'risk-medium', 'risk-high', 'pulse');
        riskLight.classList.add(`risk-${latestRisk}`);
        
        // Hacer parpadear el semáforo si el riesgo es alto
        if (latestRisk === 'high') {
            riskLight.classList.add('pulse');
        }
        
        riskText.textContent = latestRisk;
        
        const summaryText = {
            low: "La situación está controlada. El impacto es menor y los servicios operan con normalidad. Se mantiene monitoreo preventivo.",
            medium: "Impacto moderado en infraestructura y servicios. Existen riesgos sanitarios localizados. Se recomienda a la población mantenerse informada y seguir indicaciones.",
            high: "Situación crítica con impacto severo. Hay evacuaciones activas y riesgos significativos para la salud pública. Se requiere máxima precaución y atención a las directivas de las autoridades."
        };
        executiveSummary.textContent = summaryText[latestRisk];
    }
    
    function renderTicker() {
        const verifiedEvents = eventData.filter(e => e.verification === 'verified').slice(0, 5);
        
        if (verifiedEvents.length === 0) {
            tickerList.innerHTML = '<p class="text-gray-500 text-center py-4">No hay novedades verificadas recientemente.</p>';
            return;
        }
        
        tickerList.innerHTML = verifiedEvents.map(event => `
            <div class="fade-in">
                <p class="font-semibold truncate">${event.headline}</p>
                <p class="text-xs text-gray-500">${event.source_name} - ${formatTime(event.timestamp_local)}</p>
            </div>
        `).join('<hr class="my-2">');
    }

    function renderAlerts() {
        const criticalAlerts = eventData.filter(e => e.change_flag);
        alertCount.textContent = criticalAlerts.length;
        
        if (criticalAlerts.length === 0) {
            modalBody.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>No hay alertas críticas en este momento.</p>
                </div>
            `;
            return;
        }
        
        modalBody.innerHTML = criticalAlerts.map(alert => `
            <div class="border-l-4 border-red-500 bg-red-50 p-4 rounded fade-in">
                <p class="font-bold">${alert.headline}</p>
                <p class="text-sm mt-1">${alert.summary_120w}</p>
                <div class="flex justify-between items-center mt-2">
                    <p class="text-xs text-gray-500">Registrado a las ${formatTime(alert.timestamp_local)}</p>
                    ${alert.location ? `<span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">${alert.location.area}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    function renderMap() {
        // Crear un mapa básico con elementos HTML/CSS (sin dependencias externas)
        mapPlaceholder.classList.add('hidden');
        
        // Crear contenedor del mapa
        const mapElement = document.createElement('div');
        mapElement.id = 'map';
        mapContainer.appendChild(mapElement);
        
        // Estilizar el mapa
        mapElement.style.position = 'relative';
        mapElement.style.backgroundImage = 'linear-gradient(to bottom, #a5f3fc, #0ea5e9)';
        mapElement.style.overflow = 'hidden';
        
        // Añadir marcadores para eventos con ubicación
        eventData.filter(event => event.location).forEach(event => {
            const marker = document.createElement('div');
            marker.className = `map-marker risk-${event.public_health_risk}`;
            marker.style.left = `${50 + (event.location.lng + 111) * 100}px`;
            marker.style.top = `${50 + (29 - event.location.lat) * 100}px`;
            marker.title = event.headline;
            
            // Tooltip para el marcador
            marker.addEventListener('mouseover', function() {
                const tooltip = document.createElement('div');
                tooltip.className = 'map-tooltip';
                tooltip.textContent = event.headline;
                tooltip.style.left = `${marker.offsetLeft}px`;
                tooltip.style.top = `${marker.offsetTop - 40}px`;
                mapElement.appendChild(tooltip);
                marker._tooltip = tooltip;
            });
            
            marker.addEventListener('mouseout', function() {
                if (marker._tooltip) {
                    mapElement.removeChild(marker._tooltip);
                    marker._tooltip = null;
                }
            });
            
            // Hacer clic en el marcador muestra el evento en la línea de tiempo
            marker.addEventListener('click', function() {
                // Filtrar para mostrar solo este evento
                currentSearchTerm = event.headline;
                searchInput.value = currentSearchTerm;
                currentFilter = 'all';
                document.querySelectorAll('.filter-button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.filter === 'all');
                });
                renderTimeline();
                
                // Desplazar a la vista
                timelineContainer.scrollTop = 0;
            });
            
            mapElement.appendChild(marker);
        });
        
        // Añadir leyenda al mapa
        const legend = document.createElement('div');
        legend.style.position = 'absolute';
        legend.style.bottom = '10px';
        legend.style.left = '10px';
        legend.style.background = 'white';
        legend.style.padding = '10px';
        legend.style.borderRadius = '5px';
        legend.style.fontSize = '12px';
        legend.innerHTML = `
            <div class="font-semibold mb-2">Leyenda:</div>
            <div class="flex items-center mb-1"><div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div> Alto Riesgo</div>
            <div class="flex items-center mb-1"><div class="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div> Medio Riesgo</div>
            <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div> Bajo Riesgo</div>
        `;
        mapElement.appendChild(legend);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Mostrar notificación
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Ocultar después de 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 5000);
    }

    function simulateRealTimeUpdates() {
        // Simular actualizaciones en tiempo real (cada 60 segundos)
        setInterval(() => {
            // Simular una nueva actualización (en un caso real, esto vendría de una API)
            const now = new Date();
            const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TIMEZONE };
            lastUpdateTime.textContent = now.toLocaleTimeString('es-MX', options);
            
            // Mostrar notificación de actualización
            showNotification('Datos actualizados correctamente.', 'info');
        }, 60000);
    }

    // --- Event Listeners ---
    filterButtonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-button')) {
            currentFilter = e.target.dataset.filter;
            filterButtonsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            renderTimeline();
        }
    });

    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        renderTimeline();
    });

    alertButton.addEventListener('click', () => {
        renderAlerts();
        alertsModal.classList.remove('hidden');
    });
    
    modalClose.addEventListener('click', () => alertsModal.classList.add('hidden'));
    
    // Cerrar modal al hacer clic fuera del contenido
    alertsModal.addEventListener('click', (e) => {
        if (e.target === alertsModal) {
            alertsModal.classList.add('hidden');
        }
    });
    
    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    exportJsonBtn.addEventListener('click', () => {
        const jsonData = JSON.stringify(eventData, null, 2);
        downloadFile('monitoreo_eventos.json', jsonData, 'application/json');
        showNotification('Datos exportados en formato JSON.', 'info');
    });

    exportCsvBtn.addEventListener('click', () => {
        const headers = "id,timestamp_local,source_type,source_name,topic,headline,summary_120w,verification,public_health_risk,change_flag";
        const rows = eventData.map(e => `"${e.id}","${e.timestamp_local}","${e.source_type}","${e.source_name}","${e.topic}","${e.headline.replace(/"/g, '""')}","${e.summary_120w.replace(/"/g, '""')}","${e.verification}","${e.public_health_risk}",${e.change_flag}`);
        const csvData = `${headers}\n${rows.join('\n')}`;
        downloadFile('monitoreo_eventos.csv', csvData, 'text/csv;charset=utf-8;');
        showNotification('Datos exportados en formato CSV.', 'info');
    });

    // --- Inicialización ---
    function init() {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TIMEZONE };
        lastUpdateTime.textContent = now.toLocaleTimeString('es-MX', options);
        
        renderTimeline();
        renderSummary();
        renderTicker();
        renderAlerts();
        renderMap();
        
        // Simular actualizaciones en tiempo real
        simulateRealTimeUpdates();
    }

    init();
});
