const bwipjs = require('bwip-js');
const { Buffer } = require('buffer');
const Barcode = require('../models/Barcode');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const WarehouseBin = require('../models/WarehouseBin');
const StockMovement = require('../models/StockMovement');
const PhysicalInventoryCount = require('../models/PhysicalInventoryCount');
const InventoryItem = require('../models/InventoryItem');

class BarcodeService {

  // ─── BARCODE GENERATION ──────────────────────────────────────────

  /**
   * Generate barcode data string for a product
   * Uses the product's existing SKU directly
   */
  static generateBarcodeData(product, warehouseId, variantId = null) {
    const sku = product.sku || product._id.toString().slice(-8).toUpperCase();
    return variantId ? `${sku}-${variantId}` : sku;
  }

  /**
   * Generate a Code-128 barcode image as base64 PNG
   */
  static async generateBarcodeImage(text) {
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: text,
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: 'center',
      });
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (err) {
      console.warn('[Barcode] Image generation failed:', err.message);
      return null;
    }
  }

  /**
   * Generate a QR code image as base64 PNG
   */
  static async generateQRImage(data) {
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: typeof data === 'string' ? data : JSON.stringify(data),
        scale: 3,
        width: 30,
        height: 30,
      });
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (err) {
      console.warn('[Barcode] QR image generation failed:', err.message);
      return null;
    }
  }

  /**
   * Generate QR data object for a product
   */
  static generateQRData(product, warehouse, inventoryItem = null) {
    return {
      productName: product.name || product.title,
      currentStock: inventoryItem?.quantity || 0,
      warehouse: warehouse?.name || 'Unknown',
      batch: inventoryItem?.batch || 'N/A',
      manufacturingDate: inventoryItem?.manufacturingDate || null,
      supplier: product.supplier || 'N/A',
      price: product.price || 0,
      category: product.category || 'General'
    };
  }

  /**
   * Create or update barcode for a product
   */
  static async generateBarcode({ productId, warehouseId, variantId, userId }) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) throw new Error('Warehouse not found');

    // If product has variants with custom SKUs, generate barcodes per variant
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const variantsWithSku = hasVariants
      ? product.variants.filter(v => v.sku && v.sku.trim())
      : [];

    // If called for a specific variant or product has no variants
    if (variantId || variantsWithSku.length === 0) {
      const sku = variantId
        ? (variantsWithSku.find(v => v.sku === variantId)?.sku || variantId)
        : (product.sku || product._id.toString());
      return this._createBarcodeRecords({ productId, sku, variantId, warehouseId, product, warehouse, userId });
    }

    // Generate barcodes for ALL variants with custom SKUs
    let lastResult = null;
    for (const variant of variantsWithSku) {
      lastResult = await this._createBarcodeRecords({
        productId,
        sku: variant.sku,
        variantId: variant.sku,
        warehouseId,
        product,
        warehouse,
        userId
      });
    }
    return lastResult;
  }

  /**
   * Internal: create CODE128 + QR barcode records for a single SKU
   */
  static async _createBarcodeRecords({ productId, sku, variantId, warehouseId, product, warehouse, userId }) {
    const barcodeData = sku;

    // Generate actual barcode image
    const barcodeImage = await this.generateBarcodeImage(barcodeData);

    // Check if barcode already exists
    let barcode = await Barcode.findOne({ productId, warehouseId, variantId, barcodeType: 'CODE128' });

    if (barcode) {
      barcode.barcodeData = barcodeData;
      barcode.sku = sku;
      barcode.barcodeImage = barcodeImage;
      await barcode.save();
    } else {
      barcode = await Barcode.create({
        productId,
        sku,
        variantId,
        warehouseId,
        barcodeType: 'CODE128',
        barcodeData,
        barcodeImage,
        createdBy: userId
      });
    }

    return { barcode };
  }

  /**
   * Bulk generate barcodes for all products in a warehouse
   */
  static async bulkGenerateBarcodes({ warehouseId, productIds, userId }) {
    const results = [];
    const errors = [];

    const products = productIds
      ? await Product.find({ _id: { $in: productIds } })
      : await Product.find({ isActive: true });

    for (const product of products) {
      try {
        const result = await this.generateBarcode({
          productId: product._id,
          warehouseId,
          variantId: null,
          userId
        });
        results.push({ productId: product._id, sku: product.sku, success: true });
      } catch (err) {
        errors.push({ productId: product._id, error: err.message });
      }
    }

    return { generated: results.length, errors: errors.length, results, errors };
  }

  /**
   * Get barcode by scan data
   */
  static async findByBarcodeData(barcodeData) {
    // Search by barcodeData OR by sku (since variant SKUs are used as barcode data)
    const barcode = await Barcode.findOne({
      $or: [{ barcodeData }, { sku: barcodeData }]
    })
      .populate('productId', 'name sku price images category')
      .populate('warehouseId', 'name location');

    if (!barcode) throw new Error('Barcode not found');
    if (!barcode.productId) throw new Error('Product associated with this barcode no longer exists');
    return barcode;
  }

  /**
   * Record barcode print
   */
  static async recordPrint({ barcodeId, userId, labelSize }) {
    const barcode = await Barcode.findById(barcodeId);
    if (!barcode) throw new Error('Barcode not found');

    barcode.printCount += 1;
    barcode.lastPrintedAt = new Date();
    barcode.lastPrintedBy = userId;
    if (labelSize) barcode.labelSize = labelSize;

    await barcode.save();
    return barcode;
  }

  /**
   * Get barcodes for a product
   */
  static async getProductBarcodes(productId) {
    return Barcode.find({ productId, isActive: true })
      .populate('warehouseId', 'name location')
      .sort({ createdAt: -1 });
  }

  /**
   * Search barcodes
   */
  static async searchBarcodes({ query, warehouseId, page = 1, limit = 20 }) {
    const filter = { isActive: true };

    if (warehouseId) filter.warehouseId = warehouseId;
    if (query) {
      filter.$or = [
        { sku: { $regex: query, $options: 'i' } },
        { barcodeData: { $regex: query, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [barcodes, total] = await Promise.all([
      Barcode.find(filter)
        .populate('productId', 'name sku price images')
        .populate('warehouseId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Barcode.countDocuments(filter)
    ]);

    return { barcodes, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── WAREHOUSE BIN MANAGEMENT ────────────────────────────────────

  /**
   * Create a warehouse bin
   */
  static async createBin({ warehouseId, rack, shelf, bin, zone, capacity, userId }) {
    const binCode = `${warehouseId.toString().slice(-4)}-${rack}-${shelf}-${bin}`.toUpperCase();

    const existing = await WarehouseBin.findOne({ binCode });
    if (existing) throw new Error(`Bin ${binCode} already exists`);

    return WarehouseBin.create({
      warehouseId,
      rack,
      shelf,
      bin,
      binCode,
      zone: zone || 'storage',
      capacity: capacity || { maxItems: 100, currentItems: 0, maxWeight: 50, currentWeight: 0 },
      createdBy: userId
    });
  }

  /**
   * Bulk create bins (e.g., create all bins for a rack)
   */
  static async bulkCreateBins({ warehouseId, rack, shelves, binsPerShelf, zone, userId }) {
    const bins = [];
    for (const shelf of shelves) {
      for (let i = 1; i <= binsPerShelf; i++) {
        const binNum = i.toString().padStart(2, '0');
        const binCode = `${warehouseId.toString().slice(-4)}-${rack}-${shelf}-${binNum}`.toUpperCase();

        const existing = await WarehouseBin.findOne({ binCode });
        if (!existing) {
          bins.push({
            warehouseId,
            rack,
            shelf,
            bin: binNum,
            binCode,
            zone: zone || 'storage',
            createdBy: userId
          });
        }
      }
    }

    if (bins.length > 0) {
      return WarehouseBin.insertMany(bins);
    }
    return [];
  }

  /**
   * Assign a product to a bin
   */
  static async assignProductToBin({ binId, productId, sku, quantity, userId }) {
    const warehouseBin = await WarehouseBin.findById(binId);
    if (!warehouseBin) throw new Error('Bin not found');

    if (warehouseBin.status === 'full') throw new Error('Bin is full');
    if (warehouseBin.status === 'maintenance') throw new Error('Bin is under maintenance');

    // Check if product already assigned
    const existingIdx = warehouseBin.assignedProducts.findIndex(
      p => p.productId.toString() === productId.toString()
    );

    if (existingIdx >= 0) {
      warehouseBin.assignedProducts[existingIdx].quantity += quantity;
    } else {
      warehouseBin.assignedProducts.push({ productId, sku, quantity });
    }

    // Update capacity
    warehouseBin.capacity.currentItems = warehouseBin.assignedProducts.reduce(
      (sum, p) => sum + p.quantity, 0
    );

    if (warehouseBin.capacity.currentItems >= warehouseBin.capacity.maxItems) {
      warehouseBin.status = 'full';
    }

    await warehouseBin.save();
    return warehouseBin;
  }

  /**
   * Get warehouse bin structure
   */
  static async getWarehouseBins({ warehouseId, rack, shelf, zone, status, page = 1, limit = 50 }) {
    const filter = { warehouseId, isActive: true };
    if (rack) filter.rack = rack;
    if (shelf) filter.shelf = shelf;
    if (zone) filter.zone = zone;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [bins, total] = await Promise.all([
      WarehouseBin.find(filter)
        .populate('assignedProducts.productId', 'name sku images')
        .sort({ rack: 1, shelf: 1, bin: 1 })
        .skip(skip)
        .limit(limit),
      WarehouseBin.countDocuments(filter)
    ]);

    return { bins, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Get bin location for a product
   */
  static async getProductLocation(productId) {
    const bins = await WarehouseBin.find({
      'assignedProducts.productId': productId,
      isActive: true
    }).populate('warehouseId', 'name location');

    return bins.map(b => ({
      binId: b._id,
      binCode: b.binCode,
      warehouse: b.warehouseId?.name,
      rack: b.rack,
      shelf: b.shelf,
      bin: b.bin,
      zone: b.zone,
      quantity: b.assignedProducts.find(p => p.productId.toString() === productId.toString())?.quantity || 0
    }));
  }

  // ─── STOCK MOVEMENT ──────────────────────────────────────────────

  /**
   * Record a stock movement
   */
  static async recordMovement({
    productId, sku, variantId, movementType,
    fromWarehouse, toWarehouse, fromBin, toBin,
    quantity, reason, referenceType, referenceId, referenceNumber,
    batch, scannedBarcode, userId, ipAddress
  }) {
    // Get current stock
    const inventoryItem = await InventoryItem.findOne({
      productId,
      warehouseId: fromWarehouse || toWarehouse
    });

    const oldQuantity = inventoryItem?.available || inventoryItem?.onHand || 0;
    let newQuantity = oldQuantity;

    // Calculate new quantity based on movement type
    switch (movementType) {
      case 'received':
        newQuantity = oldQuantity + quantity;
        break;
      case 'sold':
      case 'damaged':
        newQuantity = oldQuantity - quantity;
        break;
      case 'transferred':
        newQuantity = oldQuantity - quantity; // from warehouse perspective
        break;
      case 'returned':
        newQuantity = oldQuantity + quantity;
        break;
      case 'adjusted':
      case 'manual':
        newQuantity = quantity; // absolute value
        break;
    }

    // Create movement record
    const movement = await StockMovement.create({
      productId,
      sku: sku || inventoryItem?.sku,
      variantId,
      movementType,
      fromWarehouse,
      toWarehouse,
      fromBin,
      toBin,
      quantity,
      oldQuantity,
      newQuantity,
      reason,
      referenceType: referenceType || 'manual',
      referenceId,
      referenceNumber,
      batch,
      scannedBarcode,
      performedBy: userId,
      ipAddress
    });

    // Update inventory
    if (inventoryItem) {
      inventoryItem.onHand = newQuantity;
      inventoryItem.available = Math.max(0, newQuantity - (inventoryItem.reserved || 0));
      await inventoryItem.save();
    }

    // If transfer, update destination warehouse inventory
    if (movementType === 'transferred' && toWarehouse) {
      let destInventory = await InventoryItem.findOne({ productId, warehouseId: toWarehouse });
      if (destInventory) {
        destInventory.onHand += quantity;
        destInventory.available += quantity;
        await destInventory.save();
      } else {
        await InventoryItem.create({
          productId,
          warehouseId: toWarehouse,
          variantSku: sku || '',
          onHand: quantity,
          available: quantity
        });
      }
    }

    return movement;
  }

  /**
   * Get stock movement history
   */
  static async getMovementHistory({
    productId, warehouseId, movementType,
    startDate, endDate, userId,
    page = 1, limit = 20
  }) {
    const filter = {};
    if (productId) filter.productId = productId;
    if (warehouseId) {
      filter.$or = [
        { fromWarehouse: warehouseId },
        { toWarehouse: warehouseId }
      ];
    }
    if (movementType) filter.movementType = movementType;
    if (userId) filter.performedBy = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .populate('productId', 'name sku images')
        .populate('fromWarehouse', 'name')
        .populate('toWarehouse', 'name')
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(filter)
    ]);

    return { movements, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── PHYSICAL INVENTORY COUNT ────────────────────────────────────

  /**
   * Create a stock audit session
   */
  static async createAuditSession({
    title, description, warehouseId, countType, scheduledDate,
    assignedTeam, filters, userId
  }) {
    // Generate count number
    const count = await PhysicalInventoryCount.countDocuments();
    const countNumber = `PIC-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

    // Get inventory items to count
    const inventoryFilter = { warehouseId };
    if (filters?.categories?.length) {
      const products = await Product.find({ category: { $in: filters.categories } }).select('_id');
      inventoryFilter.productId = { $in: products.map(p => p._id) };
    }

    const inventoryItems = await InventoryItem.find(inventoryFilter)
      .populate('productId', 'name sku category');

    const items = inventoryItems.map(item => ({
      productId: item.productId._id,
      sku: item.variantSku || item.productId.sku,
      productName: item.productId.name,
      expectedQuantity: item.available || item.onHand || 0,
      status: 'pending'
    }));

    const session = await PhysicalInventoryCount.create({
      countNumber,
      title,
      description,
      warehouseId,
      countType: countType || 'full',
      status: 'draft',
      scheduledDate: new Date(scheduledDate),
      items,
      summary: { totalItems: items.length },
      assignedTeam: assignedTeam || [],
      filters: filters || {},
      createdBy: userId
    });

    return session;
  }

  /**
   * Record a count for an item in an audit session
   */
  static async recordCount({ sessionId, itemId, countedQuantity, scannedBarcode, userId }) {
    const session = await PhysicalInventoryCount.findById(sessionId);
    if (!session) throw new Error('Audit session not found');
    if (!['draft', 'in_progress'].includes(session.status)) {
      throw new Error('Audit session is not active');
    }

    // Start session if still in draft
    if (session.status === 'draft') {
      session.status = 'in_progress';
      session.startedAt = new Date();
    }

    const item = session.items.id(itemId);
    if (!item) throw new Error('Item not found in session');

    item.countedQuantity = countedQuantity;
    item.variance = countedQuantity - item.expectedQuantity;
    item.variancePercentage = item.expectedQuantity > 0
      ? ((item.variance / item.expectedQuantity) * 100).toFixed(2)
      : 0;
    item.scannedBarcode = scannedBarcode;
    item.countedBy = userId;
    item.countedAt = new Date();

    // Determine item status
    if (item.variance === 0) item.status = 'matched';
    else if (item.variance < 0) item.status = 'missing';
    else item.status = 'extra';

    // Update summary
    const counted = session.items.filter(i => i.status !== 'pending');
    session.summary.countedItems = counted.length;
    session.summary.matchedItems = counted.filter(i => i.status === 'matched').length;
    session.summary.missingItems = counted.filter(i => i.status === 'missing').length;
    session.summary.extraItems = counted.filter(i => i.status === 'extra').length;
    session.summary.totalVariance = counted.reduce((sum, i) => sum + Math.abs(i.variance || 0), 0);
    session.summary.accuracyPercentage = session.summary.totalItems > 0
      ? ((session.summary.matchedItems / session.summary.totalItems) * 100).toFixed(2)
      : 0;

    await session.save();
    return session;
  }

  /**
   * Complete an audit session
   */
  static async completeAuditSession(sessionId, userId) {
    const session = await PhysicalInventoryCount.findById(sessionId);
    if (!session) throw new Error('Audit session not found');

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();
    return session;
  }

  /**
   * Approve stock adjustments from audit
   */
  static async approveAuditAdjustments({ sessionId, userId, notes }) {
    const session = await PhysicalInventoryCount.findById(sessionId);
    if (!session) throw new Error('Audit session not found');
    if (session.status !== 'completed') throw new Error('Session must be completed first');

    // Apply adjustments
    const adjustedItems = session.items.filter(i => i.variance !== 0);
    for (const item of adjustedItems) {
      await this.recordMovement({
        productId: item.productId,
        sku: item.sku,
        movementType: 'adjusted',
        fromWarehouse: session.warehouseId,
        toWarehouse: session.warehouseId,
        quantity: item.countedQuantity,
        reason: `Physical inventory count adjustment (${session.countNumber})`,
        referenceType: 'audit',
        referenceId: session._id,
        referenceNumber: session.countNumber,
        userId
      });
    }

    session.adjustmentApproval.approvedBy = userId;
    session.adjustmentApproval.approvedAt = new Date();
    session.adjustmentApproval.approvalNotes = notes || '';
    session.adjustmentApproval.status = 'approved';
    session.status = 'approved';
    await session.save();

    return session;
  }

  /**
   * Get audit sessions
   */
  static async getAuditSessions({ warehouseId, status, page = 1, limit = 10 }) {
    const filter = {};
    if (warehouseId) filter.warehouseId = warehouseId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      PhysicalInventoryCount.find(filter)
        .populate('warehouseId', 'name')
        .populate('createdBy', 'name email')
        .select('-items')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PhysicalInventoryCount.countDocuments(filter)
    ]);

    return { sessions, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── SCANNER ACTIONS ─────────────────────────────────────────────

  /**
   * Process a barcode scan and perform an action
   */
  static async processScan({ barcodeData, action, quantity, warehouseId, userId, ipAddress }) {
    const barcode = await this.findByBarcodeData(barcodeData);
    const product = barcode.productId;
    if (!product || !product._id) throw new Error('Product not found for this barcode. It may have been deleted.');

    switch (action) {
      case 'view':
        return { action: 'view', product, barcode };

      case 'stock_in':
        const inMovement = await this.recordMovement({
          productId: product._id,
          sku: barcode.sku,
          movementType: 'received',
          toWarehouse: warehouseId || barcode.warehouseId,
          quantity: quantity || 1,
          reason: 'Stock in via barcode scan',
          scannedBarcode: barcodeData,
          userId,
          ipAddress
        });
        return { action: 'stock_in', movement: inMovement };

      case 'stock_out':
        const outMovement = await this.recordMovement({
          productId: product._id,
          sku: barcode.sku,
          movementType: 'sold',
          fromWarehouse: warehouseId || barcode.warehouseId,
          quantity: quantity || 1,
          reason: 'Stock out via barcode scan',
          scannedBarcode: barcodeData,
          userId,
          ipAddress
        });
        return { action: 'stock_out', movement: outMovement };

      case 'transfer':
        // Transfer requires additional params handled in controller
        return { action: 'transfer', product, barcode };

      case 'dispatch':
        const dispatchMovement = await this.recordMovement({
          productId: product._id,
          sku: barcode.sku,
          movementType: 'sold',
          fromWarehouse: warehouseId || barcode.warehouseId,
          quantity: quantity || 1,
          reason: 'Dispatched via barcode scan',
          referenceType: 'order',
          scannedBarcode: barcodeData,
          userId,
          ipAddress
        });
        return { action: 'dispatch', movement: dispatchMovement };

      case 'receive':
        const receiveMovement = await this.recordMovement({
          productId: product._id,
          sku: barcode.sku,
          movementType: 'received',
          toWarehouse: warehouseId || barcode.warehouseId,
          quantity: quantity || 1,
          reason: 'Received via barcode scan',
          referenceType: 'purchase_order',
          scannedBarcode: barcodeData,
          userId,
          ipAddress
        });
        return { action: 'receive', movement: receiveMovement };

      default:
        return { action: 'view', product, barcode };
    }
  }

  // ─── DASHBOARD STATS ─────────────────────────────────────────────

  /**
   * Get barcode inventory dashboard stats
   */
  static async getDashboardStats(warehouseId = null) {
    const filter = warehouseId ? { warehouseId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalBarcodes,
      scannedToday,
      transfersToday,
      lowStockItems,
      recentMovements
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Barcode.countDocuments({ ...filter, isActive: true }),
      StockMovement.countDocuments({ createdAt: { $gte: today }, scannedBarcode: { $ne: null } }),
      StockMovement.countDocuments({ movementType: 'transferred', createdAt: { $gte: today } }),
      InventoryItem.countDocuments({ ...(warehouseId ? { warehouseId } : {}), available: { $lte: 10, $gt: 0 } }),
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('productId', 'name sku')
        .populate('performedBy', 'name')
    ]);

    // Inventory accuracy from last audit
    const lastAudit = await PhysicalInventoryCount.findOne({
      ...(warehouseId ? { warehouseId } : {}),
      status: { $in: ['completed', 'approved'] }
    }).sort({ completedAt: -1 });

    // Fast/slow moving products (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const movementAgg = await StockMovement.aggregate([
      { $match: { movementType: 'sold', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
      { $sort: { totalSold: -1 } }
    ]);

    const fastMoving = movementAgg.slice(0, 5);
    const slowMoving = movementAgg.slice(-5).reverse();

    // Stock aging (products with no movement in 30+ days)
    const allProducts = await InventoryItem.find(warehouseId ? { warehouseId } : {}).select('productId');
    const movedProductIds = movementAgg.map(m => m._id.toString());
    const agingCount = allProducts.filter(p => !movedProductIds.includes(p.productId.toString())).length;

    return {
      totalProducts,
      totalBarcodes,
      scannedToday,
      transfersToday,
      lowStockItems,
      inventoryAccuracy: lastAudit?.summary?.accuracyPercentage || 'N/A',
      stockAging: agingCount,
      fastMoving,
      slowMoving,
      recentMovements
    };
  }
}

module.exports = BarcodeService;
