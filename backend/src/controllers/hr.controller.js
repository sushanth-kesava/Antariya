const HRService = require('../services/hr.service');

exports.createEmployee = async (req, res) => {
  try {
    const emp = await HRService.createEmployee({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json({ success: true, data: emp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getEmployees = async (req, res) => {
  try {
    const { department, status, search, page, limit } = req.query;
    const result = await HRService.getEmployees({ department, status, search, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const emp = await HRService.getEmployeeById(req.params.id);
    res.json({ success: true, data: emp });
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
};

exports.updateEmployee = async (req, res) => {
  try {
    const emp = await HRService.updateEmployee(req.params.id, req.body);
    res.json({ success: true, data: emp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const Employee = require('../models/Employee');
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: 'Employee deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.markAttendance = async (req, res) => {
  try {
    const result = await HRService.markAttendance({ ...req.body, userId: req.auth.sub });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    const results = await HRService.bulkMarkAttendance({ records, userId: req.auth.sub });
    res.json({ success: true, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAttendance = async (req, res) => {
  try {
    const { employeeId, date, month, year, page, limit } = req.query;
    const result = await HRService.getAttendance({ employeeId, date, month: parseInt(month), year: parseInt(year), page: parseInt(page) || 1, limit: parseInt(limit) || 31 });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    const leave = await HRService.createLeaveRequest({ ...req.body });
    res.status(201).json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const { employeeId, status, page, limit } = req.query;
    const result = await HRService.getLeaveRequests({ employeeId, status, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveLeave = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const leave = await HRService.approveLeave({ leaveId: req.params.id, status, rejectionReason, userId: req.auth.sub });
    res.json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.processPayroll = async (req, res) => {
  try {
    const payroll = await HRService.processPayroll({ ...req.body, userId: req.auth.sub });
    res.status(201).json({ success: true, data: payroll });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getPayrolls = async (req, res) => {
  try {
    const { employeeId, month, year, status, page, limit } = req.query;
    const result = await HRService.getPayrolls({ employeeId, month, year, status, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approvePayroll = async (req, res) => {
  try {
    const payroll = await HRService.approvePayroll({ payrollId: req.params.id, userId: req.auth.sub });
    res.json({ success: true, data: payroll });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDashboard = async (req, res) => {
  try {
    const stats = await HRService.getDashboard();
    res.json({ success: true, data: stats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
