require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./src/config/db');
const { ensureAdmin, seedDemoForms } = require('./src/utils/seed');
const publicRoutes = require('./src/routes/public.routes');
const adminRoutes = require('./src/routes/admin.routes');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();

app.set('trust proxy', true); // honour X-Forwarded-For from reverse proxies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

/* ------------------------------ static pages ------------------------------ */
const PUBLIC = path.join(__dirname, 'public');

// Explicit page routes first (avoid express.static's /admin → /admin/ redirect)
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/f/:formId', (req, res) => res.sendFile(path.join(PUBLIC, 'attend.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin', 'index.html')));

app.use(express.static(PUBLIC));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

(async () => {
  try {
    await connectDB();
    await ensureAdmin();
    await seedDemoForms();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  GPS Attendance System running  →  http://localhost:${PORT}`);
      console.log(`  Student page  →  http://localhost:${PORT}/`);
      console.log(`  Admin panel   →  http://localhost:${PORT}/admin\n`);
    });
  } catch (e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
})();
