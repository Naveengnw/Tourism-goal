document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([7.8, 80.5], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let allAssets = [];
    const categoryColors = {
        'religious': '#FFD700',
        'heritage': '#8B4513',
        'nature': '#228B22',
        'accommodation': '#4682B4',
        'urban': '#696969',
        'default': '#777777'
    };

    function getCategoryColor(category) {
        const cat = category ? category.toLowerCase() : 'default';
        for (const key in categoryColors) {
            if (cat.includes(key)) return categoryColors[key];
        }
        return categoryColors['default'];
    }

    const assetLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: 6,
            fillColor: getCategoryColor(feature.properties.category),
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }),
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const popupContent = `<h3>${props.name}</h3><p><strong>Category:</strong> ${props.category}</p>`;
            layer.bindPopup(popupContent);
            layer.on('click', () => {
                document.getElementById('asset-description').innerHTML = `
                    <h3>${props.name}</h3>
                    <p><strong>Category:</strong> ${props.category}</p>
                    <p>${props.description || 'Details will be available soon.'}</p>
                    ${props.image_url ? `<img src="${props.image_url}" alt="${props.name}" style="width:100%; margin-top:10px; border-radius:5px;">` : ''}
                `;
            });
        }
    }).addTo(map);

    async function loadBoundary() {
        try {
            const response = await fetch('/data/NWP_BOUNDARY.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const boundaryData = await response.json();
            const boundaryLayer = L.geoJSON(boundaryData, {
                style: { color: "#2c5c3b", weight: 3, opacity: 0.7, fill: false }
            }).addTo(map);
            map.fitBounds(boundaryLayer.getBounds());
        } catch (error) {
            console.error("Could not load the province boundary:", error);
            document.getElementById('asset-description').innerHTML = `<p class="error">Could not load the province boundary.</p>`;
        }
    }

    async function loadAssets() {
        try {
            const response = await fetch('/api/assets');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const geojsonData = await response.json();
            allAssets = geojsonData.features;
            assetLayer.addData(geojsonData); // Add the entire GeoJSON FeatureCollection
        } catch (error) {
            console.error("Failed to load assets:", error);
            document.getElementById('asset-description').innerHTML = `<p class="error">Failed to load assets.</p>`;
        }
    }

    document.getElementById('filter-controls').addEventListener('click', (e) => {
        if (e.target.tagName === "BUTTON") {
            const category = e.target.getAttribute('data-category');
            document.querySelectorAll('#filter-controls button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            assetLayer.clearLayers();
            const filteredAssets = (category === 'all') 
                ? allAssets 
                : allAssets.filter(asset => asset.properties.category && asset.properties.category.toLowerCase().includes(category));

             const geoJsonFiltered = {
                type: "FeatureCollection",
                features: filteredAssets
            };
            assetLayer.addData(geoJsonFiltered);
        }
    });

    loadBoundary();
    loadAssets();
});