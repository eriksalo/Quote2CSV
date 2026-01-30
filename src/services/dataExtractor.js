/**
 * Extract structured data from PDF text
 */

/**
 * Parse a date string like "January 30, 2026" to "01/30/2026"
 */
function parseDate(dateStr) {
  if (!dateStr) return '';

  // If already in MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Parse "January 30, 2026" format
  const months = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  const match = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const month = months[match[1].toLowerCase()] || '01';
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${month}/${day}/${year}`;
  }

  return dateStr;
}

/**
 * Parse currency string like "$500.00" or "$15,180.00" to number
 */
function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,]/g, '')) || 0;
}

/**
 * Extract header information from PDF text
 */
export function extractHeader(text) {
  const header = {
    quoteNumber: '',
    quoteDate: '',
    expires: '',
    customer: '',
    partner: '',
    preparedBy: '',
    email: ''
  };

  // Quote Number - pattern like "Quote Number 10178-12345"
  const quoteNumMatch = text.match(/Quote\s+Number\s+(\S+)/i);
  if (quoteNumMatch) {
    header.quoteNumber = quoteNumMatch[1];
  }

  // Quote Date - pattern like "Quote Date January 30, 2026"
  const quoteDateMatch = text.match(/Quote\s+Date\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (quoteDateMatch) {
    header.quoteDate = parseDate(quoteDateMatch[1]);
  }

  // Quote Expires - pattern like "Quote Expires February 13, 2026"
  const expiresMatch = text.match(/Quote\s+Expires\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (expiresMatch) {
    header.expires = parseDate(expiresMatch[1]);
  }

  // Customer Name
  const customerMatch = text.match(/Customer\s+Name\s+([^\n]+?)(?=\s+Quote\s+)/i);
  if (customerMatch) {
    header.customer = customerMatch[1].trim();
  }

  // Partner Name
  const partnerMatch = text.match(/Partner\s+Name\s+([^\n]+?)(?=\s+SOFTWARE|\s+COMMODITY|\s+PART)/i);
  if (partnerMatch) {
    header.partner = partnerMatch[1].trim();
  }

  // Prepared By
  const preparedByMatch = text.match(/Prepared\s+By\s+([^\n]+?)(?=\s+Email)/i);
  if (preparedByMatch) {
    header.preparedBy = preparedByMatch[1].trim();
  }

  // Email
  const emailMatch = text.match(/Email\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    header.email = emailMatch[1];
  }

  return header;
}

/**
 * Extract base product code from Notes section
 */
export function extractBaseProductCode(text) {
  const configMatch = text.match(/V(\d+)\s+Configuration/i);
  if (configMatch) {
    return `v${configMatch[1]}`;
  }
  return 'v5000';
}

/**
 * Extract line items from the quotation table
 */
export function extractLineItems(text) {
  const items = [];

  // VDURACare items - these HAVE months (QTY MONTHS LIST DISCOUNT EXTENDED)
  // Pattern: VDP-VDURACare-10-HP ... 43 36 $500.00 $80.00 $123,840.00
  const vduraCarePattern = /(VDP-VDURACare-\d+-[A-Z]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)/g;
  let match;

  while ((match = vduraCarePattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: cleanDescription(match[2]),
      qty: parseInt(match[3]),
      months: parseInt(match[4]),
      listPrice: parseCurrency(match[5]),
      discountPrice: parseCurrency(match[6]),
      extendedPrice: parseCurrency(match[7])
    });
  }

  // Service items - NO months (QTY LIST DISCOUNT EXTENDED)
  // Pattern: SVC-R1-CINT-PDEP-NORACK ... 1 $15,180.00 $7,590.00 $7,590.00
  const svcPattern = /(SVC-[A-Za-z0-9-]+)\s+(.+?)\s+(\d+)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)/g;

  while ((match = svcPattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: cleanDescription(match[2]),
      qty: parseInt(match[3]),
      months: null,
      listPrice: parseCurrency(match[4]),
      discountPrice: parseCurrency(match[5]),
      extendedPrice: parseCurrency(match[6])
    });
  }

  // Hardware items (VCH-*) - NO months (QTY LIST DISCOUNT EXTENDED)
  // Pattern: VCH-5100-D1N ... 3 $29,955.99 $20,969.19 $62,907.57
  const vchPattern = /(VCH-[A-Za-z0-9.-]+)\s+(.+?)\s+(\d+)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)/g;

  while ((match = vchPattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: cleanDescription(match[2]),
      qty: parseInt(match[3]),
      months: null,
      listPrice: parseCurrency(match[4]),
      discountPrice: parseCurrency(match[5]),
      extendedPrice: parseCurrency(match[6])
    });
  }

  return items;
}

/**
 * Clean up description text
 */
function cleanDescription(desc) {
  return desc
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/PART NO\..*$/i, '')
    .replace(/DESCRIPTION.*$/i, '')
    .replace(/QTY.*$/i, '')
    .replace(/MONTHS.*$/i, '')
    .replace(/LIST PRICE.*$/i, '')
    .trim();
}
