const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

// Request logging middleware (logs all incoming requests)
app.use(requestLogger);

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

module.exports = app;
