document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([7.8, 80.5], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const getRandomColor = () => `rgba(${Math.floor(Math.random() * 150 + 50)}, ${Math.floor(Math.random() * 150 + 50)}, ${Math.floor(Math.random() * 150 + 50)}, 0.7)`;

    async function loadAnalysisData() {
        try {
            const statsResponse = await fetch('/api/stats/category-distribution');
            if (!statsResponse.ok) throw new Error(`HTTP error! status: ${statsResponse.status}`);
            const categoryData = await statsResponse.json();

            const assetsResponse = await fetch('/api/assets');
            if (!assetsResponse.ok) throw new Error(`HTTP error! status: ${assetsResponse.status}`);
            const allAssets = await assetsResponse.json();

            renderCategoryChart(categoryData);
            displayInsights(categoryData);
            displayAssetsOnMap(allAssets);
            loadBoundary(map);

        } catch (error) {
            console.error("Failed to load analysis data:", error);
            document.getElementById('insights').innerHTML = `<p class="error">Failed to load analysis data. Please try again later.</p>`; // Display error to user

        }
    }

    async function loadBoundary(mapInstance) {
         try {
            const response = await fetch('/data/NWP_BOUNDARY.geojson');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const boundaryData = await response.json();
            L.geoJSON(boundaryData, {
                style: { color: "#3388ff", weight: 2, opacity: 0.6, fill: false }
            }).addTo(mapInstance);
        } catch (error) {
            console.error("Could not load the province boundary:", error);
        }
    }

    function renderCategoryChart(data) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        const sortedData = data.sort((a, b) => parseInt(b.count) - parseInt(a.count));
        const labels = sortedData.map(item => (item.category || 'Uncategorized').replace(/_/g, ' ').toUpperCase());
        const counts = sortedData.map(item => item.count);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Assets',
                    data: counts,
                    backgroundColor: counts.map(() => getRandomColor()),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function displayInsights(data) {
        const insightsContainer = document.getElementById('insights');
        if (data.length === 0) {
            insightsContainer.innerHTML = `<p>No data available to generate insights. Please upload tourism asset data.</p>`;
            return;
        }

        const totalAssets = data.reduce((sum, item) => sum + parseInt(item.count, 10), 0);
        const topCategory = data.reduce((prev, current) => (parseInt(prev.count) > parseInt(current.count)) ? prev : current);

        insightsContainer.innerHTML = `
            <p>A total of <strong>${totalAssets}</strong> tourism assets have been cataloged in the province.</p>
            <p>The most common asset type is <strong>${(topCategory.category || 'N/A').replace(/_/g, ' ')}</strong>, with <strong>${topCategory.count}</strong> locations.</p>
            <p>This indicates a strong potential for cultural and religious tourism. Further analysis could reveal clusters and gaps in accommodation or transport relative to these key attractions.</p>
        `;
    }

    function displayAssetsOnMap(assets) {
       if (!assets || !assets.features || assets.features.length === 0) {
            console.warn("No assets data to display on the map.");
            return; // Exit if there are no assets
        }
        const heatPoints = assets.features.map(asset => {
            const coords = asset.geometry.coordinates;
            return [coords[1], coords[0], 0.5]; // lat, lng, intensity
        });

        if (window.L.heat) {
            L.heatLayer(heatPoints, { radius: 25, blur: 15 }).addTo(map);
        }
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.onload = () => {
        loadAnalysisData();
    };
    document.head.appendChild(script);
});