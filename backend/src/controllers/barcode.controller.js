const BarcodeService = require('../services/barcode.service');
const LabelService = require('../services/label.service');

// ─── BARCODE GENERATION & MANAGEMENT ─────────────────────────────

exports.generateBarcode = async (req, res) => {
  try {
    const { productId, warehouseId, variantId } = req.body;
    if (!productId || !warehouseId) {
      return res.status(400).json({ success: false, message: 'productId and warehouseId are required' });
    }

    const result = await BarcodeService.generateBarcode({
      productId, warehouseId, variantId,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkGenerateBarcodes = async (req, res) => {
  try {
    const { warehouseId, productIds } = req.body;
    if (!warehouseId) {
      return res.status(400).json({ success: false, message: 'warehouseId is required' });
    }

    const result = await BarcodeService.bulkGenerateBarcodes({
      warehouseId, productIds,
      userId: req.user._id
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchBarcodes = async (req, res) => {
  try {
    const { query, warehouseId, page, limit } = req.query;
    const result = await BarcodeService.searchBarcodes({
      query, warehouseId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProductBarcodes = async (req, res) => {
  try {
    const barcodes = await BarcodeService.getProductBarcodes(req.params.productId);
    res.json({ success: true, data: barcodes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordPrint = async (req, res) => {
  try {
    const { barcodeId, labelSize } = req.body;
    const barcode = await BarcodeService.recordPrint({
      barcodeId, labelSize,
      userId: req.user._id
    });

    res.json({ success: true, data: barcode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SCANNER ─────────────────────────────────────────────────────

exports.processScan = async (req, res) => {
  try {
    const { barcodeData, action, quantity, warehouseId } = req.body;
    if (!barcodeData) {
      return res.status(400).json({ success: false, message: 'barcodeData is required' });
    }

    const result = await BarcodeService.processScan({
      barcodeData,
      action: action || 'view',
      quantity: parseInt(quantity) || 1,
      warehouseId,
      userId: req.user._id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.findByBarcodeData = async (req, res) => {
  try {
    const barcode = await BarcodeService.findByBarcodeData(req.params.barcodeData);
    res.json({ success: true, data: barcode });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

// ─── WAREHOUSE BIN MANAGEMENT ────────────────────────────────────

exports.createBin = async (req, res) => {
  try {
    const { warehouseId, rack, shelf, bin, zone, capacity } = req.body;
    if (!warehouseId || !rack || !shelf || !bin) {
      return res.status(400).json({ success: false, message: 'warehouseId, rack, shelf, bin are required' });
    }

    const result = await BarcodeService.createBin({
      warehouseId, rack, shelf, bin, zone, capacity,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkCreateBins = async (req, res) => {
  try {
    const { warehouseId, rack, shelves, binsPerShelf, zone } = req.body;
    if (!warehouseId || !rack || !shelves || !binsPerShelf) {
      return res.status(400).json({ success: false, message: 'warehouseId, rack, shelves, binsPerShelf required' });
    }

    const bins = await BarcodeService.bulkCreateBins({
      warehouseId, rack, shelves, binsPerShelf, zone,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: { created: bins.length, bins } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignProductToBin = async (req, res) => {
  try {
    const { binId, productId, sku, quantity } = req.body;
    if (!binId || !productId || !quantity) {
      return res.status(400).json({ success: false, message: 'binId, productId, quantity required' });
    }

    const result = await BarcodeService.assignProductToBin({
      binId, productId, sku, quantity,
      userId: req.user._id
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getWarehouseBins = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const { rack, shelf, zone, status, page, limit } = req.query;

    const result = await BarcodeService.getWarehouseBins({
      warehouseId, rack, shelf, zone, status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProductLocation = async (req, res) => {
  try {
    const locations = await BarcodeService.getProductLocation(req.params.productId);
    res.json({ success: true, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── STOCK MOVEMENTS ─────────────────────────────────────────────

exports.recordMovement = async (req, res) => {
  try {
    const {
      productId, sku, variantId, movementType,
      fromWarehouse, toWarehouse, fromBin, toBin,
      quantity, reason, referenceType, referenceId,
      referenceNumber, batch, scannedBarcode
    } = req.body;

    if (!productId || !movementType || !quantity || !reason) {
      return res.status(400).json({
        success: false,
        message: 'productId, movementType, quantity, reason are required'
      });
    }

    const movement = await BarcodeService.recordMovement({
      productId, sku, variantId, movementType,
      fromWarehouse, toWarehouse, fromBin, toBin,
      quantity: parseInt(quantity),
      reason, referenceType, referenceId, referenceNumber,
      batch, scannedBarcode,
      userId: req.user._id,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: movement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMovementHistory = async (req, res) => {
  try {
    const { productId, warehouseId, movementType, startDate, endDate, userId, page, limit } = req.query;

    const result = await BarcodeService.getMovementHistory({
      productId, warehouseId, movementType,
      startDate, endDate, userId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PHYSICAL INVENTORY COUNT ────────────────────────────────────

exports.createAuditSession = async (req, res) => {
  try {
    const { title, description, warehouseId, countType, scheduledDate, assignedTeam, filters } = req.body;
    if (!title || !warehouseId || !scheduledDate) {
      return res.status(400).json({ success: false, message: 'title, warehouseId, scheduledDate required' });
    }

    const session = await BarcodeService.createAuditSession({
      title, description, warehouseId, countType, scheduledDate,
      assignedTeam, filters,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordCount = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemId, countedQuantity, scannedBarcode } = req.body;
    if (!itemId || countedQuantity === undefined) {
      return res.status(400).json({ success: false, message: 'itemId and countedQuantity required' });
    }

    const session = await BarcodeService.recordCount({
      sessionId, itemId,
      countedQuantity: parseInt(countedQuantity),
      scannedBarcode,
      userId: req.user._id
    });

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.completeAuditSession = async (req, res) => {
  try {
    const session = await BarcodeService.completeAuditSession(req.params.sessionId, req.user._id);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveAuditAdjustments = async (req, res) => {
  try {
    const { notes } = req.body;
    const session = await BarcodeService.approveAuditAdjustments({
      sessionId: req.params.sessionId,
      userId: req.user._id,
      notes
    });

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAuditSessions = async (req, res) => {
  try {
    const { warehouseId, status, page, limit } = req.query;
    const result = await BarcodeService.getAuditSessions({
      warehouseId, status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DASHBOARD ───────────────────────────────────────────────────

exports.getDashboardStats = async (req, res) => {
  try {
    const { warehouseId } = req.query;
    const stats = await BarcodeService.getDashboardStats(warehouseId || null);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── LABEL DOWNLOAD ──────────────────────────────────────────────

exports.downloadLabel = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantSku, labelSize } = req.query;

    const pdfBuffer = await LabelService.generateLabel({
      productId,
      variantSku: variantSku || null,
      labelSize: labelSize || '50x30'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="label-${variantSku || productId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadBulkLabels = async (req, res) => {
  try {
    const { productIds, labelSize } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'productIds array is required' });
    }

    const pdfBuffer = await LabelService.generateBulkLabels({
      productIds,
      labelSize: labelSize || '50x30'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="product-labels-bulk.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
