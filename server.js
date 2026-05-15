require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');

const connectDB          = require('./config/db');
const logger             = require('./config/logger');
const { apiLimiter }     = require('./middleware/rateLimitMiddleware');
const errorHandler       = require('./middleware/errorMiddleware');

const authRoutes      = require('./routes/authRoutes');
const userRoutes      = require('./routes/userRoutes');
const taskRoutes      = require('./routes/taskRoutes');
const noteRoutes      = require('./routes/noteRoutes');
const sessionRoutes   = require('./routes/sessionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// ── Connect to MongoDB ───────────────────────────────────────
connectDB();

const app = express();

// ── Security & Utility Middleware ────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // allow inline scripts in frontend
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Serve uploaded avatars statically ───────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Global API rate limit ────────────────────────────────────
app.use('/api', apiLimiter);

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/notes',     noteRoutes);
app.use('/api/sessions',  sessionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Zenith API is running', timestamp: new Date().toISOString() });
});

// ── Serve Frontend Static Files ──────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));

// ── All other routes → serve index.html (SPA fallback) ───────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ── Error Handling ───────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`🚀 Zenith API running on http://localhost:${PORT}`);
});

module.exports = app;
