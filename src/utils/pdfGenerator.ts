import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Invoice } from '../types/invoices';
import { FeeTransaction } from '../types/models';
import { SCHOOL_CONFIG } from '../constants/schoolConfig';

const loadLogoAsBase64 = async (imageAsset: any): Promise<string | null> => {
  try {
    const asset = Asset.fromModule(imageAsset);
    await asset.downloadAsync();
    if (!asset.localUri) return null;

    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: 'base64'
    });

    return `data:image/png;base64,${base64}`;
  } catch (error) {

    return null;
  }
};

export const generateReceiptPDF = async (transaction: FeeTransaction) => {
  try {
    const studentName = transaction.student_name || 'Student';
    const admissionNo = transaction.admission_no || 'N/A';
    const paidAtStr = transaction.paid_at || new Date().toISOString();
    const date = new Date(paidAtStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const feeName = transaction.fee_type || 'School Fee';
    const amountNum = Number(transaction.amount || 0);
    const amount = amountNum.toLocaleString('en-IN');
    const paymentMethod = (transaction.payment_method || 'Cash').toUpperCase();
    const receiptNo = transaction.transaction_ref || (transaction.id ? transaction.id.slice(0, 8).toUpperCase() : 'N/A');

    // Load Logo
    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const logoHtml = logoBase64 ?
    `<img src="${logoBase64}" style="width: 60px; height: 60px; object-fit: contain;" />` :
    `<div style="font-size: 24px; font-weight: bold;">${SCHOOL_CONFIG.name}</div>`;

    const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica', Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
              .receipt-container { border: 1px solid #eee; padding: 20px; max-width: 600px; margin: auto; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
              .school-info { flex: 1; }
              .school-name { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
              .school-sub { font-size: 11px; color: #666; }
              .receipt-label { font-size: 22px; font-weight: bold; color: #111; text-align: right; }
              .details { margin-bottom: 20px; display: flex; justify-content: space-between; }
              .detail-box h3 { font-size: 11px; color: #888; text-transform: uppercase; margin: 0 0 4px 0; }
              .detail-box p { font-size: 14px; font-weight: 500; margin: 0; }
              .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .table th { text-align: left; padding: 10px; background: #f5f5f5; font-size: 12px; border-bottom: 1px solid #ddd; }
              .table td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
              .total-section { text-align: right; margin-top: 10px; }
              .total-amount { font-size: 18px; font-weight: bold; color: #059669; }
              .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
              .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
              .sig-line { border-top: 1px solid #333; width: 150px; text-align: center; padding-top: 5px; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <div class="school-info">
                  ${logoHtml}
                  <div class="school-name">${SCHOOL_CONFIG.name}</div>
                  <div class="school-sub">${SCHOOL_CONFIG.address || ''}</div>
                </div>
                <div>
                  <div class="receipt-label">RECEIPT</div>
                  <div style="text-align: right; font-size: 12px; color: #666;">No: #${receiptNo}</div>
                </div>
              </div>

              <div class="details">
                <div class="detail-box">
                  <h3>Paid By</h3>
                  <p>${studentName}</p>
                  <p style="font-size: 12px; color: #666;">Adm No: ${admissionNo}</p>
                </div>
                <div class="detail-box" style="text-align: right;">
                  <h3>Date</h3>
                  <p>${date}</p>
                  <p style="font-size: 12px; color: #666;">Mode: ${paymentMethod}</p>
                </div>
              </div>

              <table class="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Payment for <strong>${feeName}</strong></td>
                    <td style="text-align: right;">₹${amount}</td>
                  </tr>
                </tbody>
              </table>

              <div class="total-section">
                <span style="font-size: 14px; margin-right: 10px;">Total Received:</span>
                <span class="total-amount">₹${amount}</span>
              </div>

              <div class="signature">
                <div class="sig-line">Authorized Signatory</div>
              </div>

              <div class="footer">
                <p>This is a computer generated receipt and does not require a physical signature.</p>
                <p>${SCHOOL_CONFIG.contact ? `Contact: ${SCHOOL_CONFIG.contact}` : ''} | ${SCHOOL_CONFIG.website || ''}</p>
              </div>
            </div>
          </body>
        </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

  } catch (error) {

    throw error;
  }
};

export const generateInvoicePDF = async (invoice: Invoice) => {
  try {
    const studentName = invoice.student?.person?.display_name || 'Student';
    const admissionNo = invoice.student?.admission_no || 'N/A';
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-IN');
    const feeName = invoice.fee_structure?.fee_type?.name || 'School Fee';
    const amount = invoice.amount_due.toLocaleString('en-IN');
    const status = invoice.status.toUpperCase();

    // Load Logo
    const logoBase64 = await loadLogoAsBase64(SCHOOL_CONFIG.logo);
    const logoHtml = logoBase64 ?
    `<img src="${logoBase64}" style="width: 80px; height: 80px; object-fit: contain;" />` :
    `<div class="logo">${SCHOOL_CONFIG.name}</div>`;

    const invoiceNo = `INV-${new Date(invoice.created_at).getFullYear()}-${invoice.id.slice(0, 8).toUpperCase()}`;

    const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
              .logo-container { display: flex; flex-direction: column; align-items: flex-start; }
              .school-name { font-size: 20px; font-weight: bold; color: #111; margin-top: 5px; }
              .invoice-title { font-size: 32px; font-weight: bold; color: #111; text-align: right; }
              .meta { display: flex; justify-content: space-between; margin-bottom: 40px; }
              .meta-box h3 { font-size: 14px; color: #888; margin-bottom: 5px; text-transform: uppercase; }
              .meta-box p { font-size: 16px; font-weight: 500; margin: 0; }
              .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              .table th { text-align: left; padding: 15px; background: #f9f9f9; font-weight: 600; color: #555; border-bottom: 1px solid #ddd; }
              .table td { padding: 15px; border-bottom: 1px solid #eee; }
              .total-row { display: flex; justify-content: flex-end; margin-top: 20px; }
              .total-box { width: 200px; }
              .total-item { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
              .grand-total { font-size: 20px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
              .footer { margin-top: 60px; text-align: center; color: #aaa; font-size: 12px; }
              .status { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
              .status-paid { background: #d1fae5; color: #065f46; }
              .status-pending { background: #fef3c7; color: #92400e; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo-container">
                  ${logoHtml}
                  <div class="school-name">${SCHOOL_CONFIG.name}</div>
                  <div style="font-size: 12px; color: #666;">${SCHOOL_CONFIG.address || ''}</div>
              </div>
              <div>
                <div class="invoice-title">INVOICE</div>
                <div style="text-align: right; color: #666; margin-top: 5px;">#${invoiceNo}</div>
              </div>
            </div>

            <div class="meta">
              <div class="meta-box">
                <h3>Bill To</h3>
                <p>${studentName}</p>
                <p>Adm No: ${admissionNo}</p>
              </div>
              <div class="meta-box" style="text-align: right;">
                <h3>Date</h3>
                <p>${invoiceDate}</p>
                <div style="margin-top: 10px;">
                    <span class="status status-${invoice.status === 'paid' ? 'paid' : 'pending'}">${status}</span>
                </div>
              </div>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${feeName}</strong><br>
                    <span style="font-size: 12px; color: #888;">${invoice.fee_structure?.fee_type?.description || ''}</span>
                  </td>
                  <td style="text-align: right;">₹${amount}</td>
                </tr>
              </tbody>
            </table>

            <div class="total-row">
              <div class="total-box">
                <div class="total-item">
                  <span>Subtotal:</span>
                  <span>₹${amount}</span>
                </div>
                <div class="total-item">
                  <span>Discount:</span>
                  <span>₹${invoice.discount.toLocaleString('en-IN')}</span>
                </div>
                 <div class="total-item">
                  <span>Paid:</span>
                  <span>₹${invoice.amount_paid.toLocaleString('en-IN')}</span>
                </div>
                <div class="total-item grand-total">
                  <span>Due:</span>
                  <span>₹${(invoice.amount_due - invoice.discount - invoice.amount_paid).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for your business. Please pay by the due date.</p>
              <p>System Generated Invoice</p>
              <p>${SCHOOL_CONFIG.contact ? `Contact: ${SCHOOL_CONFIG.contact}` : ''} | ${SCHOOL_CONFIG.website || ''}</p>
            </div>
          </body>
        </html>
        `;

    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

  } catch (error) {

    throw error;
  }
};