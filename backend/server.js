const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// CRM Adapter Registry
class CrmAdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(name, adapter) {
    this.adapters.set(name, adapter);
  }

  get(name) {
    return this.adapters.get(name);
  }

  getActive() {
    const activeCrm = process.env.ACTIVE_CRM || 'oracle';
    return this.adapters.get(activeCrm);
  }
}

const crmRegistry = new CrmAdapterRegistry();

// Base CRM Adapter Interface
class BaseCrmAdapter {
  async syncWorkOrders() { throw new Error('syncWorkOrders not implemented'); }
  async syncWorkers() { throw new Error('syncWorkers not implemented'); }
  async getWorkOrderDetails(id) { throw new Error('getWorkOrderDetails not implemented'); }
  async submitWpsEntry(payload) { throw new Error('submitWpsEntry not implemented'); }
}

// Oracle CRM Adapter
class OracleCrmAdapter extends BaseCrmAdapter {
  constructor() {
    super();
    this.apiUrl = process.env.ORACLE_API_URL || 'https://api.oracle.com';
    this.apiKey = process.env.ORACLE_API_KEY;
  }

  async syncWorkOrders() {
    // Implementation for Oracle CRM work order sync
    try {
      const response = await fetch(`${this.apiUrl}/work-orders`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      const data = await response.json();

      // Transform and save to database
      for (const order of data) {
        await pool.query(
          'INSERT INTO work_orders (order_number, title, description, priority, status, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (order_number) DO UPDATE SET status = EXCLUDED.status',
          [order.number, order.title, order.description, order.priority, order.status, new Date()]
        );
      }

      return { success: true, synced: data.length };
    } catch (error) {
      console.error('Oracle CRM sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async syncWorkers() {
    // Implementation for Oracle CRM worker sync
    try {
      const response = await fetch(`${this.apiUrl}/workers`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      const data = await response.json();

      for (const worker of data) {
        await pool.query(
          'INSERT INTO workers (employee_id, first_name, last_name, email, department, position, status, hire_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (employee_id) DO UPDATE SET status = EXCLUDED.status',
          [worker.id, worker.firstName, worker.lastName, worker.email, worker.department, worker.position, worker.status, worker.hireDate]
        );
      }

      return { success: true, synced: data.length };
    } catch (error) {
      console.error('Oracle CRM worker sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getWorkOrderDetails(id) {
    try {
      const response = await fetch(`${this.apiUrl}/work-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Oracle CRM work order details failed:', error);
      return null;
    }
  }

  async submitWpsEntry(payload) {
    try {
      const response = await fetch(`${this.apiUrl}/wps/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      return { success: response.ok, reference: result.reference };
    } catch (error) {
      console.error('Oracle CRM WPS submission failed:', error);
      return { success: false, reference: null };
    }
  }
}

// Register adapters
crmRegistry.register('oracle', new OracleCrmAdapter());

// CRM Integration Routes
app.post('/api/crm/sync/work-orders', async (req, res) => {
  try {
    const adapter = crmRegistry.getActive();
    const result = await adapter.syncWorkOrders();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/sync/workers', async (req, res) => {
  try {
    const adapter = crmRegistry.getActive();
    const result = await adapter.syncWorkers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/crm/work-orders/:id', async (req, res) => {
  try {
    const adapter = crmRegistry.getActive();
    const details = await adapter.getWorkOrderDetails(req.params.id);
    if (details) {
      res.json(details);
    } else {
      res.status(404).json({ error: 'Work order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crm/wps/submit', async (req, res) => {
  try {
    const adapter = crmRegistry.getActive();
    const result = await adapter.submitWpsEntry(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

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

// Protected routes (workers, work orders, fleet) remain the same...

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
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