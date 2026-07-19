const { jsPDF } = require('jspdf');
const bwipjs = require('bwip-js');
const Product = require('../models/Product');
const Barcode = require('../models/Barcode');

class LabelService {

  /**
   * Generate a product label PDF with barcode
   * Returns a Buffer containing the PDF
   */
  static async generateLabel({ productId, variantSku, labelSize = '50x30' }) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    // Find the variant if SKU provided
    let variant = null;
    let sku = variantSku;
    if (variantSku && product.variants?.length) {
      variant = product.variants.find(v => v.sku === variantSku);
    }
    if (!sku && product.variants?.length) {
      variant = product.variants[0];
      sku = variant?.sku;
    }
    if (!sku) sku = product.sku || product._id.toString();

    const price = variant?.price || product.price || 0;
    const size = variant?.size || '';
    const color = variant?.color || '';

    // Generate barcode image as PNG buffer
    const barcodePng = await bwipjs.toBuffer({
      bcid: 'code128',
      text: sku,
      scale: 4,
      height: 15,
      includetext: true,
      textxalign: 'center',
      textsize: 10,
    });

    // Convert PNG to base64 for jsPDF
    const barcodeBase64 = `data:image/png;base64,${barcodePng.toString('base64')}`;

    // Create PDF based on label size
    let doc;
    let width, height;

    switch (labelSize) {
      case '30x20':
        width = 30; height = 20;
        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [30, 20] });
        break;
      case 'A4':
        width = 210; height = 297;
        doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        break;
      case 'thermal':
        width = 80; height = 50;
        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [80, 50] });
        break;
      case '50x30':
      default:
        width = 60; height = 40;
        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [60, 40] });
        break;
    }

    if (labelSize === 'A4') {
      // A4 sheet with multiple labels
      this._renderA4Sheet(doc, { product, variant, sku, price, size, color, barcodeBase64 });
    } else {
      // Single label
      this._renderSingleLabel(doc, { product, variant, sku, price, size, color, barcodeBase64, width, height });
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generate bulk labels PDF (multiple products on A4 sheet)
   */
  static async generateBulkLabels({ productIds, labelSize = '50x30' }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const labelW = labelSize === '30x20' ? 30 : 50;
    const labelH = labelSize === '30x20' ? 20 : 30;
    const gap = 3;

    const cols = Math.floor((pageWidth - 2 * margin + gap) / (labelW + gap));
    const rows = Math.floor((pageHeight - 2 * margin + gap) / (labelH + gap));

    let col = 0, row = 0, pageAdded = false;

    for (const productId of productIds) {
      const product = await Product.findById(productId);
      if (!product) continue;

      const variants = product.variants?.filter(v => v.sku) || [];
      const items = variants.length > 0
        ? variants.map(v => ({ sku: v.sku, price: v.price || product.price, size: v.size, color: v.color }))
        : [{ sku: product.sku || product._id.toString(), price: product.price, size: '', color: '' }];

      for (const item of items) {
        if (row >= rows) {
          doc.addPage();
          row = 0; col = 0;
        }

        const x = margin + col * (labelW + gap);
        const y = margin + row * (labelH + gap);

        try {
          const barcodePng = await bwipjs.toBuffer({
            bcid: 'code128',
            text: item.sku,
            scale: 2,
            height: 10,
            includetext: true,
            textxalign: 'center',
            textsize: 7,
          });
          const barcodeBase64 = `data:image/png;base64,${barcodePng.toString('base64')}`;

          // Draw label border
          doc.setDrawColor(200);
          doc.rect(x, y, labelW, labelH);

          // Brand name
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('ANTARIYA', x + labelW / 2, y + 3, { align: 'center' });

          // Product name (truncated)
          doc.setFontSize(5);
          doc.setFont('helvetica', 'normal');
          const name = product.name?.slice(0, 30) || '';
          doc.text(name, x + labelW / 2, y + 6, { align: 'center' });

          // Size & Color
          if (item.size || item.color) {
            doc.setFontSize(5);
            const details = [item.size, item.color].filter(Boolean).join(' | ');
            doc.text(details, x + labelW / 2, y + 9, { align: 'center' });
          }

          // Barcode image
          doc.addImage(barcodeBase64, 'PNG', x + 3, y + 10, labelW - 6, labelH - 18);

          // Price
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(`₹${item.price}`, x + labelW / 2, y + labelH - 2, { align: 'center' });

        } catch (err) {
          // Skip this label on error
        }

        col++;
        if (col >= cols) { col = 0; row++; }
      }
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  // ─── INTERNAL RENDERERS ────────────────────────────────────────

  static _renderSingleLabel(doc, { product, variant, sku, price, size, color, barcodeBase64, width, height }) {
    const centerX = width / 2;

    // Border
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(1, 1, width - 2, height - 2);

    // Brand name
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ANTARIYA', centerX, 7, { align: 'center' });

    // Product name (truncated)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const name = product.name?.slice(0, 40) || '';
    doc.text(name, centerX, 11, { align: 'center' });

    // Size & Color
    if (size || color) {
      doc.setFontSize(6);
      const details = [size, color].filter(Boolean).join(' | ');
      doc.text(details, centerX, 14.5, { align: 'center' });
    }

    // Barcode
    const barcodeY = size || color ? 16 : 13;
    const barcodeH = height - barcodeY - 10;
    doc.addImage(barcodeBase64, 'PNG', 5, barcodeY, width - 10, barcodeH);

    // Price
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`MRP ₹${price}`, centerX, height - 3, { align: 'center' });
  }

  static _renderA4Sheet(doc, { product, variant, sku, price, size, color, barcodeBase64 }) {
    // Single large label centered on A4
    const cx = 105, cy = 148;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ANTARIYA', cx, 40, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(product.name || '', cx, 55, { align: 'center' });

    if (size || color) {
      doc.setFontSize(10);
      doc.text([size, color].filter(Boolean).join(' | '), cx, 65, { align: 'center' });
    }

    // Large barcode
    doc.addImage(barcodeBase64, 'PNG', 40, 80, 130, 50);

    // SKU text
    doc.setFontSize(11);
    doc.text(`SKU: ${sku}`, cx, 145, { align: 'center' });

    // Price
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`MRP ₹${price}`, cx, 165, { align: 'center' });
  }
}

module.exports = LabelService;
