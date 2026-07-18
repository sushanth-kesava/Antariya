const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Dashboard
router.get('/dashboard', requireRole('admin', 'superadmin', 'manager'), financeController.getDashboard);

// P&L Report
router.get('/profit-loss', requireRole('admin', 'superadmin', 'manager'), financeController.getProfitLoss);

// Transactions
router.post('/transactions', requireRole('admin', 'superadmin'), financeController.createTransaction);
router.get('/transactions', requireRole('admin', 'superadmin', 'manager'), financeController.getTransactions);
router.post('/transactions/payment', requireRole('admin', 'superadmin'), financeController.recordPayment);

// Expenses
router.post('/expenses', requireRole('admin', 'superadmin', 'manager'), financeController.createExpense);
router.get('/expenses', requireRole('admin', 'superadmin', 'manager'), financeController.getExpenses);

module.exports = router;
