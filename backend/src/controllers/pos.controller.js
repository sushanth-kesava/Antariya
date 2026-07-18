const POSService = require('../services/pos.service');

exports.createSale = async (req, res) => { try { const invoice = await POSService.createSale({ ...req.body, userId: req.auth.sub }); res.status(201).json({ success: true, data: invoice }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
exports.getInvoices = async (req, res) => { try { const { startDate, endDate, customerPhone, status, page, limit } = req.query; const r = await POSService.getInvoices({ startDate, endDate, customerPhone, status, page: parseInt(page) || 1, limit: parseInt(limit) || 20 }); res.json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
exports.getInvoiceById = async (req, res) => { try { const inv = await POSService.getInvoiceById(req.params.id); if (!inv) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data: inv }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
exports.processReturn = async (req, res) => { try { const inv = await POSService.processReturn({ invoiceId: req.params.id, ...req.body, userId: req.auth.sub }); res.json({ success: true, data: inv }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
exports.getDashboard = async (req, res) => { try { const s = await POSService.getDashboard(); res.json({ success: true, data: s }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
exports.searchProducts = async (req, res) => { try { const { q } = req.query; const products = await POSService.searchProducts(q || ''); res.json({ success: true, data: products }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const { jsPDF } = require('jspdf');
    const invoice = await POSService.getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 44;
    const contentW = pageWidth - marginX * 2;

    // Brand colors (matching Antariya storefront)
    const BRAND = { r: 122, g: 42, b: 30 };
    const INK = { r: 30, g: 30, b: 30 };
    const MUTED = { r: 120, g: 120, b: 120 };
    const LIGHT = { r: 247, g: 243, b: 242 };
    const LINE = { r: 228, g: 222, b: 220 };

    const inr = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`;

    let y = 54;

    // ============ Header ============
    doc.setFont('times', 'bold'); doc.setFontSize(30);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('Antariya', marginX, y);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text('INVOICE', pageWidth - marginX, y - 4, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text('Premium Embroidery & Textile Marketplace', marginX, y + 14);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(invoice.invoiceNumber, pageWidth - marginX, y + 14, { align: 'right' });

    // Brand divider
    y += 30;
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b); doc.setLineWidth(1.5);
    doc.line(marginX, y, pageWidth - marginX, y);

    // ============ Parties ============
    y += 26;
    const col1X = marginX;
    const col2X = marginX + 180;
    const col3X = marginX + 340;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('FROM', col1X, y); doc.text('BILL TO', col2X, y); doc.text('INVOICE DETAILS', col3X, y);

    const bodyY = y + 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text('Antariya', col1X, bodyY);
    doc.text('support@antariyaofficial.com', col1X, bodyY + 12);
    doc.text('antariyaofficial.com', col1X, bodyY + 24);

    doc.text(invoice.customerName || 'Walk-in Customer', col2X, bodyY);
    if (invoice.customerPhone) doc.text(invoice.customerPhone, col2X, bodyY + 12);
    if (invoice.customerEmail) doc.text(invoice.customerEmail, col2X, bodyY + 24);

    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, col3X, bodyY);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, col3X, bodyY + 12);
    doc.text(`Payment: ${(invoice.paymentMethod || 'Cash').toUpperCase()}`, col3X, bodyY + 24);
    doc.text(`Status: ${invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus}`, col3X, bodyY + 36);

    y = bodyY + 56;

    // ============ Items Table ============
    const colItemX = marginX;
    const colQtyX = pageWidth - marginX - 190;
    const colPriceX = pageWidth - marginX - 96;
    const colTotalX = pageWidth - marginX;

    // Header bar
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(marginX, y - 13, contentW, 24, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('ITEM', colItemX + 10, y + 3);
    doc.text('QTY', colQtyX, y + 3, { align: 'right' });
    doc.text('PRICE', colPriceX, y + 3, { align: 'right' });
    doc.text('AMOUNT', colTotalX - 10, y + 3, { align: 'right' });

    y += 24;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(INK.r, INK.g, INK.b);

    for (let idx = 0; idx < invoice.items.length; idx++) {
      const item = invoice.items[idx];
      if (idx % 2 === 1) { doc.setFillColor(LIGHT.r, LIGHT.g, LIGHT.b); doc.rect(marginX, y - 13, contentW, 32, 'F'); }

      doc.setFontSize(9.5); doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text((item.productName || '').slice(0, 45), colItemX + 10, y);
      const variantInfo = [item.size, item.color].filter(Boolean).join(' / ');
      if (variantInfo || item.variantSku) {
        doc.setFontSize(7.5); doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
        doc.text(`${variantInfo}    SKU: ${item.variantSku || item.sku || '—'}`, colItemX + 10, y + 11);
      }

      doc.setFontSize(9.5); doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text(String(item.quantity), colQtyX, y, { align: 'right' });
      doc.text(inr(item.unitPrice), colPriceX, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(inr(item.lineTotal), colTotalX - 10, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 32;
      doc.setDrawColor(LINE.r, LINE.g, LINE.b); doc.setLineWidth(0.5);
      doc.line(marginX, y - 7, pageWidth - marginX, y - 7);
    }

    // ============ Totals Panel ============
    y += 16;
    const panelW = 210; const panelX = pageWidth - marginX - panelW;
    doc.setFillColor(LIGHT.r, LIGHT.g, LIGHT.b);
    doc.roundedRect(panelX, y - 4, panelW, 100, 6, 6, 'F');

    let ty = y + 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text('Subtotal', panelX + 14, ty);
    doc.setTextColor(INK.r, INK.g, INK.b); doc.text(inr(invoice.subtotal), pageWidth - marginX - 14, ty, { align: 'right' });
    ty += 16;
    if (invoice.discountAmount > 0) {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text('Discount', panelX + 14, ty);
      doc.setTextColor(34, 139, 34); doc.text(`-${inr(invoice.discountAmount)}`, pageWidth - marginX - 14, ty, { align: 'right' }); ty += 16;
    }
    // Grand total
    ty += 4;
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b); doc.setLineWidth(1); doc.line(panelX + 14, ty - 6, pageWidth - marginX - 14, ty - 6);
    ty += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('Total', panelX + 14, ty);
    doc.text(inr(invoice.totalAmount), pageWidth - marginX - 14, ty, { align: 'right' });

    // Payment info (left side)
    let py = y + 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('PAYMENT', marginX, py); py += 15;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text('Method:', marginX, py);
    doc.setTextColor(INK.r, INK.g, INK.b); doc.text((invoice.paymentMethod || 'Cash').toUpperCase(), marginX + 52, py); py += 13;
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text('Status:', marginX, py);
    doc.setTextColor(INK.r, INK.g, INK.b); doc.text(invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus, marginX + 52, py); py += 13;
    if (invoice.changeGiven > 0) {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text('Change:', marginX, py);
      doc.setTextColor(INK.r, INK.g, INK.b); doc.text(inr(invoice.changeGiven), marginX + 52, py);
    }

    // ============ Footer ============
    const footerY = doc.internal.pageSize.getHeight() - 54;
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b); doc.setLineWidth(1);
    doc.line(marginX, footerY - 18, pageWidth - marginX, footerY - 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('Thank you for shopping with Antariya.', marginX, footerY);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text('Every Stitch Tells a Story.', marginX, footerY + 12);
    doc.text('antariyaofficial.com', pageWidth - marginX, footerY, { align: 'right' });
    doc.text('This is a computer-generated invoice.', pageWidth - marginX, footerY + 12, { align: 'right' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
