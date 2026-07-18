const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hr.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Dashboard
router.get('/dashboard', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.getDashboard);

// Employees
router.post('/employees', requireRole('admin', 'superadmin', 'hr_manager'), hrController.createEmployee);
router.get('/employees', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.getEmployees);
router.get('/employees/:id', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.getEmployeeById);
router.patch('/employees/:id', requireRole('admin', 'superadmin', 'hr_manager'), hrController.updateEmployee);
router.delete('/employees/:id', requireRole('admin', 'superadmin'), hrController.deleteEmployee);

// Attendance
router.post('/attendance', requireRole('admin', 'superadmin', 'hr_manager'), hrController.markAttendance);
router.post('/attendance/bulk', requireRole('admin', 'superadmin', 'hr_manager'), hrController.bulkMarkAttendance);
router.get('/attendance', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.getAttendance);

// Leave
router.post('/leaves', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.createLeaveRequest);
router.get('/leaves', requireRole('admin', 'superadmin', 'hr_manager', 'manager'), hrController.getLeaveRequests);
router.patch('/leaves/:id', requireRole('admin', 'superadmin', 'hr_manager'), hrController.approveLeave);

// Payroll
router.post('/payroll', requireRole('admin', 'superadmin', 'hr_manager'), hrController.processPayroll);
router.get('/payroll', requireRole('admin', 'superadmin', 'hr_manager'), hrController.getPayrolls);
router.patch('/payroll/:id/approve', requireRole('admin', 'superadmin'), hrController.approvePayroll);

module.exports = router;
