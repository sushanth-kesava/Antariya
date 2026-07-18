const FinanceService = require('../services/finance.service');

exports.createTransaction = async (req, res) => {
  try {
    const txn = await FinanceService.createTransaction({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { type, category, paymentStatus, startDate, endDate, page, limit } = req.query;
    const result = await FinanceService.getTransactions({
      type, category, paymentStatus, startDate, endDate,
      page: parseInt(page) || 1, limit: parseInt(limit) || 20
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const { transactionId, amount, paymentMethod, bankTransactionId, notes } = req.body;
    if (!transactionId || !amount) {
      return res.status(400).json({ success: false, message: 'transactionId and amount required' });
    }
    const txn = await FinanceService.recordPayment({ transactionId, amount, paymentMethod, bankTransactionId, notes, userId: req.auth.sub });
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const expense = await FinanceService.createExpense({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { category, status, startDate, endDate, page, limit } = req.query;
    const result = await FinanceService.getExpenses({
      category, status, startDate, endDate,
      page: parseInt(page) || 1, limit: parseInt(limit) || 20
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await FinanceService.getDashboardStats({ startDate, endDate });
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await FinanceService.getProfitLoss({ startDate, endDate });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
