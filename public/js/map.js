document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map').setView([7.9, 80.4], 9); // Centered on NW Province

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let allData; // To store all fetched data
    let geoJsonLayer;

    // --- Dynamic Data Fetching ---
    async function fetchAndDisplayAssets() {
        try {
            const response = await fetch('/api/assets');
            if (!response.ok) throw new Error('Network response was not ok');
            
            allData = await response.json();
            filterData('all'); // Display all assets by default
        } catch (error) {
            console.error('Failed to fetch tourism assets:', error);
            // You could display an error message to the user on the page
        }
    }

    function style(feature) {
        return {
            fillColor: getCategoryColor(feature.properties.category),
            weight: 2,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.7
        };
    }

    function getCategoryColor(category) {
        switch (category) {
            case 'heritage': return '#8B4513'; // Brown
            case 'nature': return '#228B22';   // Green
            case 'religious': return '#FFD700'; // Gold
            case 'urban': return '#4682B4';    // Steel Blue
            default: return '#777';
        }
    }

    function onEachFeature(feature, layer) {
        if (feature.properties && feature.properties.name) {
            layer.bindPopup(`<h3>${feature.properties.name}</h3><p>Category: ${feature.properties.category}</p>`);
        }
    }

    function filterData(category) {
        if (geoJsonLayer) {
            map.removeLayer(geoJsonLayer);
        }
        
        let filteredFeatures = allData.features;
        if (category !== 'all') {
            filteredFeatures = allData.features.filter(feature => feature.properties.category === category);
        }
        
        geoJsonLayer = L.geoJSON({ type: "FeatureCollection", features: filteredFeatures }, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    }
    
    // Event listeners for filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            filterData(this.getAttribute('data-filter'));
        });
    });

    // Initial load
    fetchAndDisplayAssets();
});