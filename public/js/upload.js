document.getElementById('asset-upload-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    if (isNaN(lat) || isNaN(lng) || lat.trim() === '' || lng.trim() === '') {
        alert('Latitude and Longitude must be filled in and must be valid numbers.');
        return;
    }
    const form = event.target;
    const formData = new FormData(form);
    const statusP = document.getElementById('upload-status');
    statusP.textContent = 'Uploading...';
    statusP.style.color = '#333';

    try {
        const response = await fetch('/api/upload-asset', {
            method: 'POST',
            body: formData,
        });
        const responseText = await response.text();
        if (response.ok) {
            statusP.textContent = 'Upload successful!';
            statusP.style.color = 'green';
            form.reset();
        } else {
            throw new Error(responseText);
        }
    } catch (error) {
        statusP.textContent = `Upload failed: ${error.message}`;
        statusP.style.color = 'red';
    }
});

document.getElementById('geojson-upload-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const statusP = document.getElementById('geojson-upload-status');
    statusP.textContent = 'Uploading and processing file... This may take a moment.';
    statusP.style.color = '#333';

    try {
        const response = await fetch('/api/upload-geojson', {
            method: 'POST',
            body: formData,
        });
        const responseText = await response.text();
        if (response.ok) {
            statusP.textContent = `${responseText} Refresh the Assets or Analysis page to see the changes.`;
            statusP.style.color = 'green';
            form.reset();
        } else {
            throw new Error(responseText);
        }
    } catch (error) {
        statusP.textContent = `Upload failed: ${error.message}`;
        statusP.style.color = 'red';
    }
});