const QCService = require('../services/qc.service');

exports.createInspection = async (req, res) => {
  try {
    const { productId, orderId, batchNumber, stage, supplier, factory, priority } = req.body;
    if (!productId || !stage) {
      return res.status(400).json({ success: false, message: 'productId and stage are required' });
    }

    const inspection = await QCService.createInspection({
      productId, orderId, batchNumber, stage, supplier, factory, priority,
      userId: req.auth.sub
    });

    res.status(201).json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInspections = async (req, res) => {
  try {
    const { productId, stage, status, priority, startDate, endDate, page, limit } = req.query;
    const result = await QCService.getInspections({
      productId, stage, status, priority, startDate, endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInspectionById = async (req, res) => {
  try {
    const inspection = await QCService.getInspectionById(req.params.id);
    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

exports.updateChecklist = async (req, res) => {
  try {
    const { checklistItemId, passed, notes, measuredValue } = req.body;
    if (!checklistItemId) {
      return res.status(400).json({ success: false, message: 'checklistItemId is required' });
    }

    const inspection = await QCService.updateChecklist({
      inspectionId: req.params.id,
      checklistItemId, passed, notes, measuredValue
    });

    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addDefect = async (req, res) => {
  try {
    const { defectType, severity, rootCause, assignedDepartment, correctiveAction, images, notes } = req.body;
    if (!defectType) {
      return res.status(400).json({ success: false, message: 'defectType is required' });
    }

    const inspection = await QCService.addDefect({
      inspectionId: req.params.id,
      defectType, severity, rootCause, assignedDepartment, correctiveAction, images, notes
    });

    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, quantity, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const inspection = await QCService.updateStatus({
      inspectionId: req.params.id,
      status, quantity, notes,
      userId: req.auth.sub
    });

    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addImages = async (req, res) => {
  try {
    const { imageType, imageUrls } = req.body;
    if (!imageType || !imageUrls?.length) {
      return res.status(400).json({ success: false, message: 'imageType and imageUrls are required' });
    }

    const inspection = await QCService.addImages({
      inspectionId: req.params.id,
      imageType, imageUrls
    });

    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const stats = await QCService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStageChecklist = async (req, res) => {
  try {
    const checklist = QCService.getStageChecklist(req.params.stage);
    res.json({ success: true, data: checklist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
