require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // serves public/index.html & admin.html

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_dev',
  resave: false,
  saveUninitialized: false,
}));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ message: 'Unauthorized' });
}

app.post('/submit', upload.single('image'), async (req, res) => {
  try {
    const { name, comment, latitude, longitude } = req.body;
    let imageUrl = null;

    if (req.file && process.env.CLOUDINARY_API_KEY) {
      imageUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'tourist-feedback' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        stream.end(req.file.buffer);
      });
    }
    // If Cloudinary not configured, imageUrl stays null.

    await pool.query(
      'INSERT INTO feedback (name, comment, latitude, longitude, image_url) VALUES ($1,$2,$3,$4,$5)',
      [name, comment, latitude || null, longitude || null, imageUrl]
    );

    // send simple email alert
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'New Tourist Feedback Submitted',
        text: `New feedback from ${name}.`,
      }).catch(err => console.error('Mail error:', err));
    }

    res.json({ success: true, message: 'Feedback submitted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/admin/feedback', isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);

    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.admin = true;
    res.json({ success: true, message: 'Logged in' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/admin/feedback/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;
    await pool.query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

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
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

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
      doc.text(`Date: ${fb.created_at}`);
      doc.moveDown();
    });
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
