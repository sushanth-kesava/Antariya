const POSInvoice = require('../models/POSInvoice');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const FinanceTransaction = require('../models/FinanceTransaction');
const StockMovement = require('../models/StockMovement');
const Warehouse = require('../models/Warehouse');

class POSService {

  /**
   * Create a POS sale — generates invoice, deducts inventory, records finance
   */
  static async createSale({ items, customerName, customerPhone, customerEmail, paymentMethod, amountPaid, discountType, discountValue, notes, storeName, storeLocation, userId }) {
    // Validate products and calculate totals
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);

      const variant = item.variantSku
        ? product.variants?.find(v => v.sku === item.variantSku)
        : null;

      const unitPrice = item.unitPrice || variant?.price || product.price;
      const lineDiscount = item.discount || 0;
      const lineTotal = (unitPrice * item.quantity) - lineDiscount;

      lineItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku || '',
        variantSku: item.variantSku || '',
        size: variant?.size || item.size || '',
        color: variant?.color || item.color || '',
        quantity: item.quantity,
        unitPrice,
        discount: lineDiscount,
        lineTotal
      });

      subtotal += lineTotal;
    }

    // Apply overall discount
    let discountAmount = 0;
    if (discountType === 'flat') discountAmount = discountValue || 0;
    else if (discountType === 'percentage') discountAmount = (subtotal * (discountValue || 0)) / 100;

    const totalAmount = subtotal - discountAmount;
    const paid = amountPaid || totalAmount;
    const changeGiven = paid > totalAmount ? paid - totalAmount : 0;
    const balanceDue = paid < totalAmount ? totalAmount - paid : 0;

    // Generate invoice number
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const todayCount = await POSInvoice.countDocuments({
      createdAt: { $gte: new Date(today.setHours(0, 0, 0, 0)) }
    });
    const invoiceNumber = `POS-${dateStr}-${(todayCount + 1).toString().padStart(4, '0')}`;

    // Create invoice
    const invoice = await POSInvoice.create({
      invoiceNumber,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      items: lineItems,
      subtotal,
      discountAmount,
      discountType: discountType || 'none',
      discountValue: discountValue || 0,
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: balanceDue > 0 ? 'partial' : 'paid',
      amountPaid: paid,
      changeGiven,
      balanceDue,
      storeName: storeName || 'Antariya Store',
      storeLocation: storeLocation || '',
      notes: notes || '',
      billedBy: userId
    });

    // Deduct inventory for each item
    const defaultWarehouse = await Warehouse.findOne({ code: "DEFAULT" }) || await Warehouse.findOne({});
    if (defaultWarehouse) {
      for (const item of lineItems) {
        // Deduct from Inventory (available bucket)
        const invRow = await Inventory.findOne({ product: item.productId, warehouse: defaultWarehouse._id, variantSku: item.variantSku || '' });
        let oldQty = 0;

        if (invRow) {
          oldQty = invRow.available;
          invRow.available = Math.max(0, invRow.available - item.quantity);
          await invRow.save();
        } else {
          // Fallback: read current stock from product
          const prod = await Product.findById(item.productId);
          oldQty = prod?.stock || 0;
        }

        // Always deduct from product.stock (storefront field)
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });

        // Also deduct variant stock if applicable
        if (item.variantSku) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'variants.sku': item.variantSku },
            { $inc: { 'variants.$.stock': -item.quantity } }
          );
        }

        // Record stock movement
        await StockMovement.create({
          productId: item.productId,
          sku: item.variantSku || item.sku,
          movementType: 'sold',
          fromWarehouse: defaultWarehouse._id,
          quantity: item.quantity,
          oldQuantity: oldQty,
          newQuantity: Math.max(0, oldQty - item.quantity),
          reason: `POS sale: ${invoiceNumber}`,
          referenceType: 'order',
          referenceId: invoice._id,
          referenceNumber: invoiceNumber,
          performedBy: userId
        });
      }
    }

    // Record as finance transaction
    try {
      const count = await FinanceTransaction.countDocuments();
      await FinanceTransaction.create({
        transactionNumber: `PMT-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`,
        type: 'payment_received',
        category: 'sales',
        subCategory: 'pos_sale',
        amount: subtotal,
        taxAmount: 0,
        netAmount: totalAmount,
        paidAmount: paid,
        balanceAmount: balanceDue,
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: balanceDue > 0 ? 'partial' : 'paid',
        accountHead: 'income',
        description: `POS Sale: ${invoiceNumber}`,
        partyType: 'customer',
        partyName: customerName || 'Walk-in Customer',
        partyEmail: customerEmail || '',
        referenceType: 'order',
        referenceId: invoice._id,
        referenceNumber: invoiceNumber,
        createdBy: userId
      });
    } catch (err) {
      console.warn('[POS] Finance transaction creation failed:', err.message);
    }

    return invoice;
  }

  /**
   * Get POS invoices with filters
   */
  static async getInvoices({ startDate, endDate, customerPhone, status, page = 1, limit = 20 }) {
    const filter = {};
    if (status) filter.status = status;
    if (customerPhone) filter.customerPhone = { $regex: customerPhone, $options: 'i' };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [invoices, total] = await Promise.all([
      POSInvoice.find(filter).populate('billedBy', 'displayName').sort({ createdAt: -1 }).skip(skip).limit(limit),
      POSInvoice.countDocuments(filter)
    ]);
    return { invoices, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Get single invoice
   */
  static async getInvoiceById(id) {
    return POSInvoice.findById(id).populate('billedBy', 'displayName email').populate('items.productId', 'name images');
  }

  /**
   * Process a return
   */
  static async processReturn({ invoiceId, lineItemId, quantity, reason, userId }) {
    const invoice = await POSInvoice.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const lineItem = invoice.items.id(lineItemId);
    if (!lineItem) throw new Error('Line item not found');
    if (quantity > lineItem.quantity) throw new Error('Return quantity exceeds sold quantity');

    const refundAmount = (lineItem.unitPrice * quantity) - ((lineItem.discount / lineItem.quantity) * quantity);

    invoice.returnedItems.push({ lineItemId, quantity, reason, refundAmount });
    invoice.status = 'partially_returned';
    await invoice.save();

    // Add stock back
    const defaultWarehouse = await Warehouse.findOne({ code: "DEFAULT" }) || await Warehouse.findOne({});
    if (defaultWarehouse) {
      await Inventory.findOneAndUpdate(
        { product: lineItem.productId, warehouse: defaultWarehouse._id, variantSku: lineItem.variantSku || '' },
        { $inc: { available: quantity } }
      );
      await Product.findByIdAndUpdate(lineItem.productId, { $inc: { stock: quantity } });

      await StockMovement.create({
        productId: lineItem.productId,
        sku: lineItem.variantSku || lineItem.sku,
        movementType: 'returned',
        toWarehouse: defaultWarehouse._id,
        quantity,
        oldQuantity: 0,
        newQuantity: quantity,
        reason: `POS return: ${invoice.invoiceNumber} — ${reason}`,
        referenceType: 'return',
        referenceId: invoice._id,
        referenceNumber: invoice.invoiceNumber,
        performedBy: userId
      });
    }

    return invoice;
  }

  /**
   * POS Dashboard — today's sales summary
   */
  static async getDashboard() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todaySales, monthSales, todayInvoices, monthInvoices, recentInvoices, topProducts] = await Promise.all([
      POSInvoice.aggregate([{ $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      POSInvoice.aggregate([{ $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      POSInvoice.countDocuments({ createdAt: { $gte: today } }),
      POSInvoice.countDocuments({ createdAt: { $gte: thisMonth } }),
      POSInvoice.find({ status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(10).populate('billedBy', 'displayName'),
      POSInvoice.aggregate([
        { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.lineTotal' } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 }
      ])
    ]);

    return {
      todayRevenue: todaySales[0]?.total || 0,
      todayOrders: todaySales[0]?.count || 0,
      monthRevenue: monthSales[0]?.total || 0,
      monthOrders: monthSales[0]?.count || 0,
      todayInvoices,
      monthInvoices,
      recentInvoices,
      topProducts
    };
  }

  /**
   * Search products for POS billing (quick search by name/SKU)
   */
  static async searchProducts(query) {
    const filter = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { sku: { $regex: query, $options: 'i' } },
        { 'variants.sku': { $regex: query, $options: 'i' } }
      ]
    };
    return Product.find(filter).select('name price sku variants images stock category').limit(10);
  }
}

module.exports = POSService;
