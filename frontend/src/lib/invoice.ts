import { jsPDF } from "jspdf";
import type { Order } from "@/lib/api/orders";
import type { CustomerProfileData } from "@/lib/api/customerProfile";
import { ANTARIYA_LOGO_PNG, ANTARIYA_LOGO_ASPECT } from "@/lib/antariya-logo";
import { formatINR, formatIndianDate } from "@/lib/india";

// Antariya brand palette (matches the storefront primary maroon).
const BRAND = { r: 122, g: 42, b: 30 };
const INK = { r: 30, g: 30, b: 30 };
const MUTED = { r: 120, g: 120, b: 120 };
const LIGHT = { r: 247, g: 243, b: 242 }; // subtle maroon-tinted row fill
const LINE = { r: 228, g: 222, b: 220 };

// Seller identity shown on every invoice.
const SELLER = {
  name: "Antariya",
  tagline: "Premium Embroidery & Textile Marketplace",
  email: "support@antariyaofficial.com",
  web: "antariyaofficial.com",
};

type BuyerDetails = {
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
};

function inr(value: number): string {
  // jsPDF's default fonts don't render the ₹ glyph reliably, so use "Rs.".
  return formatINR(Number(value || 0)).replace(/₹/g, "Rs. ");
}

function paymentMethodLabel(method?: string): string {
  if (method === "cod") return "Cash on Delivery";
  if (method === "upi") return "Online (UPI / Card / NetBanking)";
  return "—";
}

function paymentStatusLabel(status?: string, method?: string): string {
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "pending") return method === "cod" ? "Payable on Delivery" : "Pending";
  return "—";
}

/**
 * Build a branded Antariya invoice PDF for a single order and trigger download.
 */
export function generateInvoicePdf(order: Order, buyer: BuyerDetails = {}): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const contentW = pageWidth - marginX * 2;
  let y = 54;

  // ============ Header ============
  const logoHeight = 34;
  const logoWidth = logoHeight * ANTARIYA_LOGO_ASPECT;
  try {
    doc.addImage(ANTARIYA_LOGO_PNG, "PNG", marginX, y - 26, logoWidth, logoHeight);
  } catch {
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Antariya", marginX, y);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text("INVOICE", pageWidth - marginX, y - 4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(SELLER.tagline, marginX, y + 14);

  const shortId = order.id ? order.id.slice(-8).toUpperCase() : "N/A";
  doc.setFontSize(9.5);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold");
  doc.text(`INV-${shortId}`, pageWidth - marginX, y + 14, { align: "right" });

  // Brand divider
  y += 30;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  // ============ Parties + meta (three columns) ============
  y += 26;
  const colGap = 16;
  const colW = (contentW - colGap * 2) / 3;
  const col1X = marginX;
  const col2X = marginX + colW + colGap;
  const col3X = marginX + (colW + colGap) * 2;

  const labelRow = (text: string, x: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(text.toUpperCase(), x, y);
  };

  labelRow("From", col1X);
  labelRow("Bill To", col2X);
  labelRow("Invoice Details", col3X);

  const bodyStartY = y + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  // From (seller)
  const fromLines = [SELLER.name, SELLER.email, SELLER.web];
  doc.setTextColor(INK.r, INK.g, INK.b);
  fromLines.forEach((line, i) => doc.text(line, col1X, bodyStartY + i * 12));

  // Bill To (buyer)
  const buyerLines: string[] = [];
  buyerLines.push(buyer.name || "Valued Customer");
  if (buyer.email) buyerLines.push(buyer.email);
  if (buyer.phone) buyerLines.push(String(buyer.phone));
  if (buyer.address) buyerLines.push(...doc.splitTextToSize(buyer.address, colW));
  doc.setTextColor(INK.r, INK.g, INK.b);
  buyerLines.forEach((line, i) => doc.text(line, col2X, bodyStartY + i * 12));

  // Invoice details (meta)
  const metaPairs: [string, string][] = [
    ["Invoice No", `INV-${shortId}`],
    ["Order ID", order.id || "N/A"],
    ["Date", formatIndianDate(order.createdAt)],
    ["Status", order.status || "Processing"],
  ];
  const metaLines: string[] = [];
  metaPairs.forEach(([k, v]) => {
    metaLines.push(...doc.splitTextToSize(`${k}: ${v}`, colW));
  });
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  metaLines.forEach((line, i) => doc.text(line, col3X, bodyStartY + i * 12));

  const blockLines = Math.max(fromLines.length, buyerLines.length, metaLines.length);
  y = bodyStartY + blockLines * 12 + 22;

  // ============ Items table ============
  const colItemX = marginX;
  const colQtyX = pageWidth - marginX - 190;
  const colPriceX = pageWidth - marginX - 96;
  const colTotalX = pageWidth - marginX;

  // Header bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(marginX, y - 13, contentW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ITEM", colItemX + 10, y + 3);
  doc.text("QTY", colQtyX, y + 3, { align: "right" });
  doc.text("PRICE", colPriceX, y + 3, { align: "right" });
  doc.text("AMOUNT", colTotalX - 10, y + 3, { align: "right" });

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK.r, INK.g, INK.b);

  (order.items || []).forEach((item, idx) => {
    const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);
    const nameLines = doc.splitTextToSize(item.name || "Item", colQtyX - colItemX - 24);

    const variantBits = item.variant
      ? [item.variant.size, item.variant.color, item.variant.gender].filter(Boolean).join(" / ")
      : "";
    const skuValue = item.variant?.sku || item.variantSku || "";
    const variantLine = [variantBits, `SKU: ${skuValue || "\u2014"}`]
      .filter(Boolean)
      .join("    ");

    // Compute row height first, so we can paint the zebra background.
    let rowTextHeight = nameLines.length * 12;
    if (variantLine) rowTextHeight += 11;
    const rowHeight = Math.max(rowTextHeight, 18) + 10;

    // Zebra striping for readability.
    if (idx % 2 === 1) {
      doc.setFillColor(LIGHT.r, LIGHT.g, LIGHT.b);
      doc.rect(marginX, y - 13, contentW, rowHeight, "F");
    }

    // Item name
    doc.setFontSize(9.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(nameLines, colItemX + 10, y);

    let subY = y + nameLines.length * 12;
    if (variantLine) {
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.text(variantLine, colItemX + 10, subY);
      subY += 11;
    }

    // Numeric columns (top-aligned with item name)
    doc.setFontSize(9.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(String(item.quantity || 0), colQtyX, y, { align: "right" });
    doc.text(inr(item.price), colPriceX, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(inr(lineTotal), colTotalX - 10, y, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowHeight;

    // Row separator
    doc.setDrawColor(LINE.r, LINE.g, LINE.b);
    doc.setLineWidth(0.5);
    doc.line(marginX, y - 7, pageWidth - marginX, y - 7);

    if (y > pageHeight - 170) {
      doc.addPage();
      y = 54;
    }
  });

  // ============ Totals panel ============
  y += 16;
  const panelW = 210;
  const panelX = pageWidth - marginX - panelW;
  const labelX = panelX + 14;
  const valueX = pageWidth - marginX - 14;

  const rows: [string, string, boolean][] = [
    ["Subtotal", inr(order.subtotal), false],
    ["Shipping", Number(order.shipping) > 0 ? inr(order.shipping) : "Free", false],
  ];
  if (Number(order.tax) > 0) rows.push(["Tax", inr(order.tax), false]);

  const rowH = 16;
  const panelPadTop = 12;
  const panelPadBottom = 14;
  const grandRowH = 24;
  const panelH = panelPadTop + rows.length * rowH + 8 + grandRowH + panelPadBottom;

  // Panel background
  doc.setFillColor(LIGHT.r, LIGHT.g, LIGHT.b);
  doc.roundedRect(panelX, y - 4, panelW, panelH, 6, 6, "F");

  let ty = y + panelPadTop + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rows.forEach(([label, value]) => {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(label, labelX, ty);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(value, valueX, ty, { align: "right" });
    ty += rowH;
  });

  // Divider before grand total
  ty += 2;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1);
  doc.line(labelX, ty - 4, valueX, ty - 4);
  ty += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Total", labelX, ty);
  doc.text(inr(order.total), valueX, ty, { align: "right" });

  // ============ Payment summary (left, aligned with totals panel) ============
  const payX = marginX;
  let py = y + panelPadTop + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("PAYMENT", payX, py);
  py += 15;

  const payPairs: [string, string][] = [
    ["Method", paymentMethodLabel(order.paymentMethod)],
    ["Status", paymentStatusLabel(order.paymentStatus, order.paymentMethod)],
  ];
  if (order.razorpayPaymentId) payPairs.push(["Txn ID", order.razorpayPaymentId]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  payPairs.forEach(([k, v]) => {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`${k}:`, payX, py);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(doc.splitTextToSize(v, panelX - payX - 60), payX + 52, py);
    py += 13;
  });

  y = Math.max(y + panelH, py) + 24;

  // ============ Footer ============
  const footerY = pageHeight - 54;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(1);
  doc.line(marginX, footerY - 18, pageWidth - marginX, footerY - 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Thank you for shopping with Antariya.", marginX, footerY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Every Stitch Tells a Story.", marginX, footerY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(SELLER.web, pageWidth - marginX, footerY, { align: "right" });
  doc.text("This is a computer-generated invoice.", pageWidth - marginX, footerY + 12, { align: "right" });

  doc.save(`Antariya-Invoice-INV-${shortId}.pdf`);
}
