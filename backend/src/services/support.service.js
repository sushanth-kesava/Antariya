const SupportTicket = require('../models/SupportTicket');

const SLA_HOURS = { low: { response: 24, resolution: 72 }, medium: { response: 8, resolution: 48 }, high: { response: 4, resolution: 24 }, urgent: { response: 1, resolution: 8 } };

class SupportService {
  static async createTicket(data) {
    const count = await SupportTicket.countDocuments();
    data.ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
    const sla = SLA_HOURS[data.priority || 'medium'];
    data.responseDeadline = new Date(Date.now() + sla.response * 3600000);
    data.resolutionDeadline = new Date(Date.now() + sla.resolution * 3600000);
    return SupportTicket.create(data);
  }

  static async getTickets({ status, priority, category, assignedTo, search, page = 1, limit = 20 }) {
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (search) { filter.$or = [{ ticketNumber: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }, { customerName: { $regex: search, $options: 'i' } }]; }
    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).populate('assignedTo', 'displayName email').sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit),
      SupportTicket.countDocuments(filter)
    ]);
    return { tickets, total, page, pages: Math.ceil(total / limit) };
  }

  static async getTicketById(id) {
    return SupportTicket.findById(id).populate('assignedTo', 'displayName email').populate('notes.createdBy', 'displayName email');
  }

  static async updateStatus({ ticketId, status, userId }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = new Date();
    if (status === 'closed') ticket.closedAt = new Date();
    if (status === 'assigned' && !ticket.assignedTo) { ticket.assignedTo = userId; ticket.assignedAt = new Date(); }
    await ticket.save();
    return ticket;
  }

  static async assignTicket({ ticketId, assignedTo }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.assignedTo = assignedTo;
    ticket.assignedAt = new Date();
    if (ticket.status === 'open') ticket.status = 'assigned';
    await ticket.save();
    return ticket;
  }

  static async addNote({ ticketId, message, isInternal, attachments, userId }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.notes.push({ message, isInternal: isInternal || false, attachments: attachments || [], createdBy: userId });
    if (!ticket.firstResponseAt && !isInternal) ticket.firstResponseAt = new Date();
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();
    return ticket;
  }

  static async getDashboard() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [open, inProgress, resolved, total, todayNew, categoryBreakdown, avgResponseTime] = await Promise.all([
      SupportTicket.countDocuments({ status: { $in: ['open', 'assigned'] } }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: { $in: ['resolved', 'closed'] }, resolvedAt: { $gte: thirtyDaysAgo } }),
      SupportTicket.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      SupportTicket.countDocuments({ createdAt: { $gte: today } }),
      SupportTicket.aggregate([{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      SupportTicket.aggregate([{ $match: { firstResponseAt: { $ne: null }, createdAt: { $gte: thirtyDaysAgo } } }, { $project: { responseTime: { $subtract: ['$firstResponseAt', '$createdAt'] } } }, { $group: { _id: null, avg: { $avg: '$responseTime' } } }])
    ]);
    const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : 0;
    const avgResp = avgResponseTime[0]?.avg ? (avgResponseTime[0].avg / 3600000).toFixed(1) : 'N/A';
    return { openTickets: open, inProgress, resolved, totalThisMonth: total, todayNew, resolutionRate: Number(resolutionRate), avgResponseHours: avgResp, topCategories: categoryBreakdown };
  }
}

module.exports = SupportService;
