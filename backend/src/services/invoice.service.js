const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");

// Antariya brand colours (match the storefront).
const BRAND = { r: 122, g: 42, b: 30 };
const INK = { r: 30, g: 30, b: 30 };
const MUTED = { r: 120, g: 120, b: 120 };

// Load the Antariya logo once and cache it as a data URL.
let cachedLogo = null;
function getLogoDataUrl() {
  if (cachedLogo !== null) return cachedLogo;
  try {
    const logoPath = path.resolve(__dirname, "../assets/antariya-logo.png");
    const b64 = fs.readFileSync(logoPath).toString("base64");
    cachedLogo = `data:image/png;base64,${b64}`;
  } catch {
    cachedLogo = "";
  }
  return cachedLogo;
}

const LOGO_ASPECT = 854 / 261; // width / height of the generated wordmark

function inr(value) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Build a branded Antariya invoice for an order.
 * @param {object} order  Normalized order ({ id, items, subtotal, shipping, tax, total, status, createdAt })
 * @param {object} buyer  { name, email, phone, address }
 * @returns {Buffer} PDF file contents.
 */
function buildInvoicePdf(order, buyer = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 50;

  // ---- Header: logo image + INVOICE ----
  const logo = getLogoDataUrl();
  const logoHeight = 34;
  const logoWidth = logoHeight * LOGO_ASPECT;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, y - 26, logoWidth, logoHeight);
    } catch {
      doc.setFont("times", "bold");
      doc.setFontSize(30);
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("Antariya", marginX, y);
    }
  } else {
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Antariya", marginX, y);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("INVOICE", pageWidth - marginX, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Premium Embroidery & Textile Marketplace", marginX, y);

  y += 14;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  // ---- Bill To + Invoice meta ----
  y += 28;
  const metaX = pageWidth - marginX;
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", marginX, y);
  doc.text("Invoice Details", metaX, y, { align: "right" });

  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const buyerLines = [];
  buyerLines.push(buyer.name || "Valued Customer");
  if (buyer.email) buyerLines.push(buyer.email);
  if (buyer.phone) buyerLines.push(String(buyer.phone));
  if (buyer.address) buyerLines.push(...doc.splitTextToSize(buyer.address, 240));

  const shortId = order.id ? String(order.id).slice(-8).toUpperCase() : "N/A";
  const metaLines = [
    `Invoice No: INV-${shortId}`,
    `Order ID: ${order.id || "N/A"}`,
    `Date: ${formatDate(order.createdAt)}`,
    `Status: ${order.status || "Processing"}`,
  ];

  const blockStartY = y;
  doc.setTextColor(INK.r, INK.g, INK.b);
  buyerLines.forEach((line, i) => doc.text(line, marginX, blockStartY + i * 13));
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  metaLines.forEach((line, i) => doc.text(line, metaX, blockStartY + i * 13, { align: "right" }));

  y = blockStartY + Math.max(buyerLines.length, metaLines.length) * 13 + 20;

  // ---- Items table ----
  const colItemX = marginX;
  const colQtyX = pageWidth - marginX - 200;
  const colPriceX = pageWidth - marginX - 110;
  const colTotalX = pageWidth - marginX;

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(marginX, y - 12, pageWidth - marginX * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Item", colItemX + 8, y + 3);
  doc.text("Qty", colQtyX, y + 3, { align: "right" });
  doc.text("Price", colPriceX, y + 3, { align: "right" });
  doc.text("Amount", colTotalX - 8, y + 3, { align: "right" });

  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK.r, INK.g, INK.b);

  (order.items || []).forEach((item) => {
    const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);
    const nameLines = doc.splitTextToSize(item.name || "Item", colQtyX - colItemX - 20);
    doc.setFontSize(9.5);
    doc.text(nameLines, colItemX + 8, y);

    const variantBits = item.variant
      ? [item.variant.size, item.variant.color, item.variant.gender].filter(Boolean).join(" / ")
      : "";
    let rowHeight = nameLines.length * 12;
    if (variantBits) {
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.text(variantBits, colItemX + 8, y + rowHeight);
      doc.setTextColor(INK.r, INK.g, INK.b);
      rowHeight += 11;
    }

    doc.setFontSize(9.5);
    doc.text(String(item.quantity || 0), colQtyX, y, { align: "right" });
    doc.text(inr(item.price), colPriceX, y, { align: "right" });
    doc.text(inr(lineTotal), colTotalX - 8, y, { align: "right" });

    y += Math.max(rowHeight, 16) + 8;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(marginX, y - 6, pageWidth - marginX, y - 6);

    if (y > pageHeight - 140) {
      doc.addPage();
      y = 50;
    }
  });

  // ---- Totals ----
  y += 10;
  const labelX = pageWidth - marginX - 150;
  const valueX = pageWidth - marginX - 8;
  const totalsRow = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(bold ? BRAND.r : INK.r, bold ? BRAND.g : INK.g, bold ? BRAND.b : INK.b);
    doc.text(label, labelX, y, { align: "right" });
    doc.text(value, valueX, y, { align: "right" });
    y += bold ? 20 : 15;
  };

  totalsRow("Subtotal", inr(order.subtotal));
  totalsRow("Shipping", Number(order.shipping) > 0 ? inr(order.shipping) : "Free");
  if (Number(order.tax) > 0) totalsRow("Tax", inr(order.tax));

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1);
  doc.line(labelX - 40, y - 6, valueX, y - 6);
  y += 8;
  totalsRow("Total", inr(order.total), true);

  // ---- Footer ----
  const footerY = pageHeight - 60;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY - 14, pageWidth - marginX, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Thank you for shopping with Antariya.", marginX, footerY);
  doc.text("Every Stitch Tells a Story.", marginX, footerY + 12);
  doc.text("antariyaofficial.com", pageWidth - marginX, footerY, { align: "right" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

module.exports = { buildInvoicePdf };
