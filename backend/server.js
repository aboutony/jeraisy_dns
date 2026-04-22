const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Database test route
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'Connected', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workers CRUD routes (protected)
app.get('/api/workers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM workers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workers', async (req, res) => {
  try {
    const { employee_id, first_name, last_name, email, phone, department, position } = req.body;
    const result = await pool.query(
      'INSERT INTO workers (employee_id, first_name, last_name, email, phone, department, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [employee_id, first_name, last_name, email, phone, department, position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Work Orders CRUD routes (protected)
app.get('/api/work-orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM work_orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/work-orders', async (req, res) => {
  try {
    const { order_number, title, description, priority, assigned_to } = req.body;
    const result = await pool.query(
      'INSERT INTO work_orders (order_number, title, description, priority, assigned_to) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order_number, title, description, priority, assigned_to]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // For demo, check against hardcoded admin or first worker
    // In production, hash passwords and verify from DB
    const result = await pool.query('SELECT * FROM workers WHERE email = $1 LIMIT 1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Demo: accept any password for existing users
    // In production: const validPassword = await bcrypt.compare(password, user.password_hash);
    const validPassword = true; // Demo only

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected route example
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workers WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Placeholder routes
app.get('/', (req, res) => {
  res.json({ message: 'Jeraisy DNS Backend API' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});