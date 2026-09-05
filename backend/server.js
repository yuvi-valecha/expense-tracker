require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded receipt images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

connectDB();

app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/splits', require('./routes/splitRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Multer error handler
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max 8MB.' });
  }
  if (err.message?.startsWith('Unsupported file type')) {
    return res.status(415).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
