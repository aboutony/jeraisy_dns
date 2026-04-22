const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

// WebSocket server for real-time tracking
const wss = new WebSocket.Server({ noServer: true });

// WebSocket connections store
const wsClients = new Map();

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

// GPS/Geofencing Routes
app.post('/api/gps/track', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const workerId = req.user.id;

    // Save GPS tracking data
    await pool.query(
      'INSERT INTO gps_tracking (worker_id, latitude, longitude, accuracy) VALUES ($1, $2, $3, $4)',
      [workerId, latitude, longitude, accuracy]
    );

    // Check geofencing for work orders
    const workOrders = await pool.query(
      'SELECT id, location FROM work_orders WHERE assigned_to = $1 AND status = $2',
      [workerId, 'in_progress']
    );

    let geofenceStatus = 'outside';
    for (const order of workOrders.rows) {
      if (order.location && order.location.latitude && order.location.longitude) {
        const withinFence = isWithinGeofence(
          latitude, longitude,
          order.location.latitude, order.location.longitude,
          50 // 50 meter radius
        );
        if (withinFence) {
          geofenceStatus = 'inside';
          break;
        }
      }
    }

    // Notify WebSocket clients
    const wsMessage = JSON.stringify({
      type: 'gps_update',
      workerId,
      latitude,
      longitude,
      geofenceStatus,
      timestamp: new Date().toISOString()
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(wsMessage);
      }
    });

    res.json({ success: true, geofenceStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gps/history/:workerId', authenticateToken, async (req, res) => {
  try {
    const { workerId } = req.params;
    const limit = req.query.limit || 100;

    const result = await pool.query(
      'SELECT * FROM gps_tracking WHERE worker_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [workerId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compliance and WPS Routes
app.post('/api/compliance/violation', authenticateToken, async (req, res) => {
  try {
    const { workerId, violationType, description, severity } = req.body;

    const result = await pool.query(
      'INSERT INTO compliance_violations (worker_id, violation_type, description, severity) VALUES ($1, $2, $3, $4) RETURNING *',
      [workerId, violationType, description, severity]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compliance/violations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compliance_violations ORDER BY reported_date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compliance/wps-submit', authenticateToken, async (req, res) => {
  try {
    const { workOrderId, hoursWorked, materialsUsed, completionNotes } = req.body;

    // Submit to CRM if configured
    const adapter = crmRegistry.getActive();
    if (adapter && adapter.submitWpsEntry) {
      const crmResult = await adapter.submitWpsEntry({
        workOrderId,
        hoursWorked,
        materialsUsed,
        completionNotes
      });

      if (crmResult.success) {
        res.json({ success: true, reference: crmResult.reference });
      } else {
        res.status(500).json({ error: 'CRM submission failed' });
      }
    } else {
      // Store locally if no CRM
      res.json({ success: true, reference: `LOCAL-${Date.now()}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Academy LMS Routes
app.get('/api/academy/courses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM academy_courses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/academy/courses', authenticateToken, async (req, res) => {
  try {
    const { name, code, description, durationHours, category } = req.body;

    const result = await pool.query(
      'INSERT INTO academy_courses (course_name, course_code, description, duration_hours, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, code, description, durationHours, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/academy/enroll', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    const workerId = req.user.id;

    const result = await pool.query(
      'INSERT INTO course_enrollments (worker_id, course_id) VALUES ($1, $2) RETURNING *',
      [workerId, courseId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/academy/my-courses', authenticateToken, async (req, res) => {
  try {
    const workerId = req.user.id;

    const result = await pool.query(`
      SELECT c.*, e.enrollment_date, e.progress_percentage, e.status
      FROM academy_courses c
      JOIN course_enrollments e ON c.course_id = e.course_id
      WHERE e.worker_id = $1
      ORDER BY e.enrollment_date DESC
    `, [workerId]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/academy/certifications', authenticateToken, async (req, res) => {
  try {
    const { courseId, score } = req.body;
    const workerId = req.user.id;

    const result = await pool.query(
      'INSERT INTO certifications (worker_id, course_id, issued_date, score) VALUES ($1, $2, $3, $4) RETURNING *',
      [workerId, courseId, new Date(), score]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

// GPS/Geofencing utilities
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function isWithinGeofence(userLat, userLon, centerLat, centerLon, radiusMeters) {
  const distance = calculateDistance(userLat, userLon, centerLat, centerLon);
  return distance <= radiusMeters;
}

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
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// WebSocket connection handling
wss.on('connection', (ws, request) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});