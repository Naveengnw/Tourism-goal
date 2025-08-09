// server.js
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fastcsv = require('fast-csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const tmp = require('tmp');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_dev', // Use a strong, randomly generated secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { // Configure cookie settings for better security
        secure: process.env.NODE_ENV === 'production', // Set to true in production (HTTPS)
        httpOnly: true, // Prevents client-side JavaScript access
        maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expires after 7 days (adjust as needed)
    }
}));

// Configure Cloudinary (only if environment variables are set)
if (process.env.CLOUDINARY_API_KEY) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
        api_key: process.env.CLOUDINARY_API_KEY || '',
        api_secret: process.env.CLOUDINARY_API_SECRET || '',
    });
} else {
    console.warn("Cloudinary API key not found. Image uploads will not work.");
}

// Create a PostgreSQL pool using the DATABASE_URL from environment variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Test the database connection immediately after pool creation
pool.connect()
    .then(() => console.log('Database connection established'))
    .catch(err => console.error('Database connection error:', err));

// Multer setup for handling file uploads (memory storage is fine for smaller files)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit file size to 10MB
});

// Nodemailer setup (only if email settings are in environment)
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
} else {
    console.warn("Email settings not found. Email notifications will not work.");
}

const isAdmin = (req, res, next) => {
    if (req.session && req.session.admin) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

const loadNWPBoundary = async () => {
    try {
        const data = await fs.promises.readFile(path.join(__dirname, 'public', 'data', 'NWP_BOUNDARY.geojson'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading boundary GeoJSON:", error);
        return null;
    }
};

let nwpBoundary = null;
(async () => {
    nwpBoundary = await loadNWPBoundary();
})();

// Basic middleware setup
app.use(cors({ origin: '*' })); // Enable CORS for all origins (adjust as needed for production)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

// API endpoints

// 1. Feedback submission endpoint (POST /submit)
app.post('/submit', upload.single('image'), async (req, res) => {
    try {
        const { name, comment, latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, error: 'Latitude and Longitude are required.' });
        }

        const point = turf.point([parseFloat(longitude), parseFloat(latitude)]);
        if (!nwpBoundary) {
            return res.status(500).json({ success: false, error: 'NWP boundary data not loaded.' });
        }
        const inside = turf.booleanPointInPolygon(point, turf.polygon(nwpBoundary.geometry.coordinates));

        if (!inside) {
            return res.status(400).json({ success: false, error: 'The location is outside the North Western Province.' });
        }

        let imageUrl = null;
        if (req.file && process.env.CLOUDINARY_API_KEY) {
            try {
                const result = await cloudinary.uploader.upload(req.file.buffer.toString('base64'), { // Use buffer as base64
                    resource_type: 'image',
                    folder: 'tourist-feedback'
                });
                imageUrl = result.secure_url;
            } catch (cloudinaryError) {
                console.error("Cloudinary upload error:", cloudinaryError);
                return res.status(500).json({ success: false, error: 'Failed to upload image.' });
            }
        }

        await pool.query(
            'INSERT INTO feedback (name, comment, latitude, longitude, image_url) VALUES ($1,$2,$3,$4,$5)',
            [name, comment, latitude, longitude, imageUrl]
        );

        // Send email notification (if transporter is configured)
        if (transporter) {
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'New Tourist Feedback Submitted',
                text: `New feedback from ${name}.`,
            }).catch(mailErr => console.error('Mail error:', mailErr));
        } else {
            console.warn("Skipping email notification: transporter not configured.");
        }

        res.json({ success: true, message: 'Feedback submitted!' });
    } catch (err) {
        console.error("Feedback submission error:", err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 2. Get all feedback (Admin only) (GET /admin/feedback)
app.get('/admin/feedback', isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error("Error fetching feedback:", err);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// 3. Admin login (POST /admin/login)
app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { rows } = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        req.session.admin = true;
        res.json({ success: true, message: 'Logged in' });
    } catch (err) {
        console.error("Admin login error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Admin logout (POST /admin/logout)
app.post('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).json({ success: false, message: "Failed to logout" });
        }
        res.json({ success: true, message: "Logged out successfully" });
    });
});

// 5. Update feedback status (Admin only) (POST /admin/feedback/:id/status)
app.post('/admin/feedback/:id/status', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const id = req.params.id;
        await pool.query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true, message: "Feedback status updated" });
    } catch (err) {
        console.error("Error updating feedback status:", err);
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
});

// 6. Export feedback as CSV (Admin only) (GET /admin/export/csv)
app.get('/admin/export/csv', isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="feedback.csv"');
        const csvStream = fastcsv.format({ headers: true });
        csvStream.pipe(res);
        rows.forEach(row => csvStream.write(row));
        csvStream.end();
    } catch (err) {
        console.error("CSV export error:", err);
        res.status(500).json({ error: 'Export failed' });
    }
});

// 7. Export feedback as PDF (Admin only) (GET /admin/export/pdf)
app.get('/admin/export/pdf', isAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="feedback.pdf"');
        doc.pipe(res);
        doc.fontSize(18).text('Tourist Feedback Report', { align: 'center' });
        doc.moveDown();
        rows.forEach(fb => {
            doc.fontSize(12).text(`Name: ${fb.name}`);
            doc.text(`Comment: ${fb.comment}`);
            doc.text(`Status: ${fb.status}`);
            doc.text(`Date: ${fb.created_at.toLocaleString()}`); // Use toLocaleString() for readable date format
            doc.moveDown();
        });
        doc.end();
    } catch (err) {
        console.error("PDF export error:", err);
        res.status(500).json({ error: 'Export failed' });
    }
});

// 8.  API to Get Tourism Assets (GET /api/assets)
app.get('/api/assets', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                id, 
                name, 
                category, 
                description, 
                latitude, 
                longitude,
                image_url,
                ST_AsGeoJSON(ST_MakePoint(longitude, latitude)) AS geojson
            FROM tourism_assets
            WHERE longitude IS NOT NULL AND latitude IS NOT NULL
        `);

        const features = rows.map(row => ({
            type: 'Feature',
            properties: {
                id: row.id,
                name: row.name,
                category: row.category,
                description: row.description,
                image_url: row.image_url
            },
            geometry: JSON.parse(row.geojson)
        }));

        const geoJson = {
            type: 'FeatureCollection',
            features: features
        };
        res.json(geoJson);
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to retrieve tourism assets' });
    }
});

// 9. API to Get Category Distribution (GET /api/stats/category-distribution)
app.get('/api/stats/category-distribution', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT category, COUNT(*) FROM tourism_assets GROUP BY category
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching category distribution:', error);
        res.status(500).json({ error: 'Failed to retrieve category distribution' });
    }
});

// 10. API to upload single assest
// API to Upload a Single Tourism Asset (POST /api/upload-asset)
app.post('/api/upload-asset', upload.single('dataFile'), async (req, res) => {
    try {
        const { name, category, description, lat, lng } = req.body;

        if (!lat || !lng) {
            return res.status(400).send('Latitude and Longitude are required.');
        }

        const point = turf.point([parseFloat(lng), parseFloat(lat)]);

        if (!nwpBoundary) {
            return res.status(500).json({ success: false, error: 'NWP boundary data not loaded.' });
        }
        const inside = turf.booleanPointInPolygon(point, turf.polygon(nwpBoundary.geometry.coordinates));

        if (!inside) {
            return res.status(400).json({ success: false, error: 'The location is outside the North Western Province.' });
        }

        let imageUrl = null;
        if (req.file && process.env.CLOUDINARY_API_KEY) {
            try {
                const result = await cloudinary.uploader.upload(req.file.buffer.toString('base64'), { // Convert buffer to base64
                    folder: 'tourism-assets',
                    resource_type: 'image'  // Specify resource type as image
                });
                imageUrl = result.secure_url;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).send("Cloudinary upload failed: " + uploadError.message);
            }
        }

        let query = `
            INSERT INTO tourism_assets (name, category, description, latitude, longitude, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [name, category, description, lat, lng, imageUrl];
        await pool.query(query, values);
        res.send('Asset uploaded successfully!');
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).send(error.message || 'Upload failed');
    }
});

// 11. API to upload geojson in bulk

// API to Upload GeoJSON File (POST /api/upload-geojson)
app.post('/api/upload-geojson', isAdmin, upload.single('geojsonFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const geojsonData = JSON.parse(req.file.buffer.toString());
        if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
            return res.status(400).send('Invalid GeoJSON format.');
        }

        let uploadedCount = 0;
        for (const feature of geojsonData.features) {
            if (feature.geometry.type !== 'Point' || !feature.properties) {
                continue;
            }

            const { name, category, description } = feature.properties;
            const { coordinates } = feature.geometry;
            const longitude = coordinates[0];
            const latitude = coordinates[1];

            if (!latitude || !longitude) {
                console.warn('Skipping asset due to missing coordinates:', feature);
                continue;
            }
            const point = turf.point([parseFloat(longitude), parseFloat(latitude)]);

            if (!nwpBoundary) {
                console.warn('Skipping asset: NWP boundary data not loaded.');
                continue;
            }
            const inside = turf.booleanPointInPolygon(point, turf.polygon(nwpBoundary.geometry.coordinates));

            if (!inside) {
                console.warn('Skipping asset outside NWP:', feature);
                continue;
            }

            let query = `
                INSERT INTO tourism_assets (name, category, description, latitude, longitude)
                VALUES ($1, $2, $3, $4, $5)
            `;
            const values = [name, category, description, latitude, longitude];
            try {
                await pool.query(query, values);
                uploadedCount++; // Increment the upload count for each successful upload
            } catch (dbError) {
                console.error(`Database insertion error for asset ${name}:`, dbError);
            }
        }

        res.send(`Successfully uploaded ${uploadedCount} assets.`); // Send back the count
    } catch (error) {
        console.error('GeoJSON upload error:', error);
        res.status(500).send(error.message || 'Failed to upload GeoJSON data.');
    }
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});