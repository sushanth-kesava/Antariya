const express = require('express');
const router = express.Router();
const c = require('../controllers/forecast.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
router.use(requireAuth);
router.get('/dashboard', requireRole('admin', 'superadmin', 'manager'), c.getDashboard);
module.exports = router;
