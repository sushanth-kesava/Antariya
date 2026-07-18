const FinanceTransaction = require('../models/FinanceTransaction');
const Expense = require('../models/Expense');
const Order = require('../models/Order');

class FinanceService {

  // ─── TRANSACTIONS ──────────────────────────────────────────────

  static async createTransaction(data) {
    const count = await FinanceTransaction.countDocuments();
    const prefix = data.type === 'invoice' ? 'INV' : data.type === 'payment_received' ? 'PMT' : data.type === 'expense' ? 'EXP' : 'TXN';
    data.transactionNumber = `${prefix}-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
    data.balanceAmount = (data.netAmount || data.amount) - (data.paidAmount || 0);
    
    return FinanceTransaction.create(data);
  }

  static async getTransactions({ type, category, paymentStatus, startDate, endDate, page = 1, limit = 20 }) {
    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      FinanceTransaction.find(filter)
        .populate('createdBy', 'displayName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FinanceTransaction.countDocuments(filter)
    ]);

    return { transactions, total, page, pages: Math.ceil(total / limit) };
  }

  static async recordPayment({ transactionId, amount, paymentMethod, bankTransactionId, notes, userId }) {
    const txn = await FinanceTransaction.findById(transactionId);
    if (!txn) throw new Error('Transaction not found');

    txn.paidAmount += amount;
    txn.balanceAmount = txn.netAmount - txn.paidAmount;
    txn.paymentMethod = paymentMethod || txn.paymentMethod;
    if (bankTransactionId) txn.bankTransactionId = bankTransactionId;
    if (notes) txn.notes = notes;

    if (txn.balanceAmount <= 0) {
      txn.paymentStatus = 'paid';
      txn.paidAt = new Date();
    } else {
      txn.paymentStatus = 'partial';
    }

    await txn.save();
    return txn;
  }

  // ─── EXPENSES ──────────────────────────────────────────────────

  static async createExpense(data) {
    const count = await Expense.countDocuments();
    data.expenseNumber = `EXP-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
    data.netAmount = data.amount + (data.taxAmount || 0);
    
    const expense = await Expense.create(data);

    // Also create a finance transaction for this expense
    await this.createTransaction({
      type: 'expense',
      category: 'expense',
      subCategory: data.category,
      amount: data.amount,
      taxAmount: data.taxAmount || 0,
      netAmount: data.netAmount,
      paymentMethod: data.paymentMethod,
      paymentStatus: 'paid',
      paidAmount: data.netAmount,
      accountHead: 'expenses',
      description: data.description,
      partyType: 'vendor',
      partyName: data.paidTo || '',
      referenceType: 'expense',
      referenceId: expense._id,
      referenceNumber: data.expenseNumber,
      createdBy: data.createdBy
    });

    return expense;
  }

  static async getExpenses({ category, status, startDate, endDate, page = 1, limit = 20 }) {
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('createdBy', 'displayName email')
        .sort({ expenseDate: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(filter)
    ]);

    return { expenses, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────

  static async getDashboardStats({ startDate, endDate } = {}) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateFilter = startDate ? { $gte: new Date(startDate), ...(endDate ? { $lte: new Date(endDate) } : {}) } : { $gte: thirtyDaysAgo };

    // Revenue (from sales transactions)
    const revenueAgg = await FinanceTransaction.aggregate([
      { $match: { type: { $in: ['invoice', 'payment_received'] }, createdAt: dateFilter } },
      { $group: { _id: null, total: { $sum: '$netAmount' }, paid: { $sum: '$paidAmount' } } }
    ]);

    // Expenses
    const expenseAgg = await FinanceTransaction.aggregate([
      { $match: { type: 'expense', createdAt: dateFilter } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } }
    ]);

    // Outstanding receivables
    const receivablesAgg = await FinanceTransaction.aggregate([
      { $match: { type: { $in: ['invoice'] }, paymentStatus: { $in: ['pending', 'partial', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
    ]);

    // Outstanding payables
    const payablesAgg = await FinanceTransaction.aggregate([
      { $match: { type: { $in: ['purchase_bill', 'vendor_payment'] }, paymentStatus: { $in: ['pending', 'partial', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
    ]);

    // GST payable
    const gstAgg = await FinanceTransaction.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: {
        _id: null,
        outputGst: { $sum: { $cond: [{ $in: ['$type', ['invoice', 'payment_received']] }, { $add: ['$gst.cgst', '$gst.sgst', '$gst.igst'] }, 0] } },
        inputGst: { $sum: { $cond: [{ $in: ['$type', ['purchase_bill', 'expense']] }, { $add: ['$gst.cgst', '$gst.sgst', '$gst.igst'] }, 0] } }
      }}
    ]);

    // Monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const monthlyRevenue = await FinanceTransaction.aggregate([
      { $match: { type: { $in: ['invoice', 'payment_received'] }, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$netAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    const monthlyExpenses = await FinanceTransaction.aggregate([
      { $match: { type: 'expense', createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$netAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    // Expense by category
    const expenseByCategory = await Expense.aggregate([
      { $match: { expenseDate: dateFilter } },
      { $group: { _id: '$category', total: { $sum: '$netAmount' } } },
      { $sort: { total: -1 } }
    ]);

    // Recent transactions
    const recentTransactions = await FinanceTransaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('createdBy', 'displayName');

    const revenue = revenueAgg[0]?.total || 0;
    const expenses = expenseAgg[0]?.total || 0;
    const profit = revenue - expenses;
    const gstData = gstAgg[0] || { outputGst: 0, inputGst: 0 };

    return {
      revenue,
      expenses,
      profit,
      profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0,
      receivables: receivablesAgg[0]?.total || 0,
      payables: payablesAgg[0]?.total || 0,
      gstPayable: (gstData.outputGst || 0) - (gstData.inputGst || 0),
      outputGst: gstData.outputGst || 0,
      inputGst: gstData.inputGst || 0,
      monthlyRevenue,
      monthlyExpenses,
      expenseByCategory,
      recentTransactions
    };
  }

  // ─── P&L REPORT ────────────────────────────────────────────────

  static async getProfitLoss({ startDate, endDate }) {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    const matchFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const income = await FinanceTransaction.aggregate([
      { $match: { ...matchFilter, type: { $in: ['invoice', 'payment_received'] } } },
      { $group: { _id: '$category', total: { $sum: '$netAmount' } } }
    ]);

    const expenses = await FinanceTransaction.aggregate([
      { $match: { ...matchFilter, type: 'expense' } },
      { $group: { _id: '$subCategory', total: { $sum: '$netAmount' } } }
    ]);

    const totalIncome = income.reduce((s, i) => s + i.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);

    return {
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      profitMargin: totalIncome > 0 ? (((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1) : 0
    };
  }
}

module.exports = FinanceService;
