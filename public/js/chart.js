document.addEventListener('DOMContentLoaded', function () {
    // --- Supply and Demand Chart ---
    const supplyDemandCtx = document.getElementById('supplyDemandChart')?.getContext('2d'); // Optional chaining
    let supplyDemandChart;

    if (supplyDemandCtx) {
        supplyDemandChart = new Chart(supplyDemandCtx, {
            type: 'line', // Or 'bar', 'line', etc.
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Supply (Available Accommodations)',
                    data: [120, 150, 180, 200, 220, 250, 230, 210, 190, 170, 150, 130],
                    borderColor: 'rgba(54, 162, 235, 1)', // Blue
                    borderWidth: 2,
                    fill: false
                }, {
                    label: 'Demand (Tourists)',
                    data: [80, 100, 130, 170, 200, 230, 250, 220, 180, 140, 110, 90],
                    borderColor: 'rgba(255, 99, 132, 1)', // Red
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } else {
        console.warn("Supply Demand Chart context not found, likely missing element with id 'supplyDemandChart'.");
    }

    // --- Occupancy Chart ---
    const occupancyCtx = document.getElementById('occupancyChart')?.getContext('2d'); // Optional chaining
    let occupancyChart;

    if (occupancyCtx) {
        occupancyChart = new Chart(occupancyCtx, {
            type: 'bar', // Or 'bar', 'line', etc.
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Occupancy Rate (%)',
                    data: [60, 65, 70, 75, 80, 85, 90, 80, 70, 65, 60, 55],
                    backgroundColor: 'rgba(75, 192, 192, 0.5)', // Teal
                    borderColor: 'rgba(75, 192, 192, 1)', // Teal border
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100 // Occupancy as a percentage
                    }
                }
            }
        });
    } else {
        console.warn("Occupancy Chart context not found, likely missing element with id 'occupancyChart'.");
    }

    // --- NEW File Upload Logic ---
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const uploadStatus = document.createElement('p'); // To show feedback
    const dataUploadSection = document.querySelector('.data-upload-section');
    if (dataUploadSection) {
        dataUploadSection.appendChild(uploadStatus);
    } else {
        console.warn("Data upload section not found.");
        return; // Exit if data upload section is missing
    }


    uploadButton.addEventListener('click', async function() {
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('dataFile', file); // 'dataFile' must match the name in multer

        uploadStatus.textContent = 'Uploading...';
        uploadStatus.style.color = 'orange';

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const responseText = await response.text();
                uploadStatus.textContent = responseText;
                uploadStatus.style.color = 'green';
                alert('Success! Refresh the Assets page to see the new data.');
                   if (supplyDemandChart) {
                    supplyDemandChart.destroy();
                }
                if (occupancyChart) {
                    occupancyChart.destroy();
                }
               // recreateCharts();

            } else {
                const errorResult = await response.json();
                uploadStatus.textContent = `Upload failed: ${errorResult.error}`;
                uploadStatus.style.color = 'red';
            }
        } catch (error) {
            console.error('Error during upload:', error);
            uploadStatus.textContent = 'An error occurred during upload.';
            uploadStatus.style.color = 'red';
        }
    });
});