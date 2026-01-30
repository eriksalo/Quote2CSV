/**
 * Extract structured data from PDF text
 * Handles variations in VDURA quotation formats
 */

/**
 * Normalize PDF text that has extra spaces inserted
 * pdf.js sometimes adds spaces in the middle of words
 */
function normalizePdfText(text) {
  let normalized = text;

  // Fix spaces around hyphens in product codes (VDP - VDURACare - 10 - HP -> VDP-VDURACare-10-HP)
  normalized = normalized.replace(/(\w)\s+-\s+(\w)/g, '$1-$2');

  // Fix split numbers (2 3 -> 23, 202 6 -> 2026)
  normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2');

  // Fix common split words
  normalized = normalized.replace(/Quot\s+ation/gi, 'Quotation');
  normalized = normalized.replace(/Com\s+pany/gi, 'Company');
  normalized = normalized.replace(/cwalle\s*rt/gi, 'cwallert');
  normalized = normalized.replace(/Q\s+TY/gi, 'QTY');
  normalized = normalized.replace(/VDURA\s+Care/gi, 'VDURA Care');

  // Fix split email addresses (xxx @ yyy -> xxx@yyy)
  normalized = normalized.replace(/(\S+)\s+@\s+(\S+)/g, '$1@$2');

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Parse a date string to MM/DD/YYYY format
 */
function parseDate(dateStr) {
  if (!dateStr) return '';

  // If already in MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Month name mappings (full and abbreviated)
  const months = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
  };

  // Parse "January 30, 2026" or "Jan 23, 2026" format
  const match = dateStr.match(/(\w+)\s*(\d{1,2})\s*,?\s*(\d{4})/i);
  if (match) {
    const month = months[match[1].toLowerCase()] || '01';
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${month}/${day}/${year}`;
  }

  return dateStr;
}

/**
 * Parse currency string to number
 */
function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,]/g, '')) || 0;
}

/**
 * Extract header information from PDF text
 */
export function extractHeader(text) {
  const normalized = normalizePdfText(text);

  const header = {
    quoteNumber: '',
    quoteDate: '',
    expires: '',
    customer: '',
    partner: '',
    preparedBy: '',
    email: ''
  };

  // Quote Number
  const quoteNumMatch = normalized.match(/Quote\s*Number\s*(\d+[-\d]*)/i);
  if (quoteNumMatch) {
    header.quoteNumber = quoteNumMatch[1];
  }

  // Quote Date
  const quoteDateMatch = normalized.match(/Quote\s*Date\s*([A-Za-z]+\s*\d{1,2}\s*,?\s*\d{4})/i);
  if (quoteDateMatch) {
    header.quoteDate = parseDate(quoteDateMatch[1]);
  }

  // Quote Expires
  const expiresMatch = normalized.match(/Quote\s*Expires\s*([A-Za-z]+\s*\d{1,2}\s*,?\s*\d{4})/i);
  if (expiresMatch) {
    header.expires = parseDate(expiresMatch[1]);
  }

  // Customer Name or Company
  let customerMatch = normalized.match(/Customer\s*Name\s+([A-Za-z0-9\s]+?)(?=\s+Quote|\s+Partner|\s+SOFTWARE)/i);
  if (!customerMatch) {
    customerMatch = normalized.match(/Company\s+([A-Za-z0-9\s]+?)(?=\s+Quote|\s+SOFTWARE)/i);
  }
  if (customerMatch) {
    header.customer = customerMatch[1].trim();
  }

  // Partner Name (optional)
  const partnerMatch = normalized.match(/Partner\s*Name\s+([A-Za-z0-9\s]+?)(?=\s+SOFTWARE|\s+COMMODITY)/i);
  if (partnerMatch) {
    header.partner = partnerMatch[1].trim();
  }

  // Prepared By
  const preparedByMatch = normalized.match(/Prepared\s*By\s+([A-Za-z\s]+?)(?=\s+Email|\s+Quote)/i);
  if (preparedByMatch) {
    header.preparedBy = preparedByMatch[1].trim();
  }

  // Email
  const emailMatch = normalized.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    header.email = emailMatch[1];
  }

  console.log('Normalized text sample:', normalized.substring(0, 500));
  console.log('Parsed header:', header);

  return header;
}

/**
 * Extract base product code from Notes section
 */
export function extractBaseProductCode(text) {
  const normalized = normalizePdfText(text);
  const configMatch = normalized.match(/V(\d+)\s*Configuration/i);
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
  const normalized = normalizePdfText(text);

  console.log('=== NORMALIZED TEXT (first 1500 chars) ===');
  console.log(normalized.substring(0, 1500));

  // ============================================
  // VDURACare items - HAVE months
  // Pattern: VDP-VDURACare-10-HP description 21 60 $500.00 $90.00 $113,400.00
  // ============================================
  const vduraCarePattern = /VDP-VDURACare-(\d+)-([A-Z]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;
  let match;

  while ((match = vduraCarePattern.exec(normalized)) !== null) {
    const code = `VDP-VDURACare-${match[1]}-${match[2]}`;
    console.log('Found VDURACare:', code, 'QTY:', match[4], 'MONTHS:', match[5]);
    items.push({
      partNo: code,
      description: cleanDescription(match[3]),
      qty: parseInt(match[4]),
      months: parseInt(match[5]),
      listPrice: parseCurrency(match[6]),
      discountPrice: parseCurrency(match[7]),
      extendedPrice: parseCurrency(match[8])
    });
  }

  // ============================================
  // Service items (SVC-*) - NO months
  // Pattern: SVC-R1-CINT-PDEP-NORACK description 1 $15,180.00 $7,590.00 $7,590.00
  // ============================================
  const svcPattern = /(SVC-[A-Za-z0-9-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;

  while ((match = svcPattern.exec(normalized)) !== null) {
    console.log('Found SVC:', match[1], 'QTY:', match[3]);
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

  // ============================================
  // Hardware items (VCH-*) - NO months
  // Pattern: VCH-5100-D1N description 3 $48,618.39 $20,969.19 $62,907.57
  // ============================================
  const vchPattern = /(VCH-[A-Za-z0-9.-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;
  const seenVch = new Set();

  while ((match = vchPattern.exec(normalized)) !== null) {
    const itemKey = `${match[1]}-${match[3]}-${match[6]}`;
    if (!seenVch.has(itemKey)) {
      seenVch.add(itemKey);
      console.log('Found VCH:', match[1], 'QTY:', match[3]);
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
  }

  console.log('Total items found:', items.length);
  return items;
}

/**
 * Clean up description text
 */
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/PART NO\..*$/i, '')
    .replace(/DESCRIPTION.*$/i, '')
    .replace(/QTY.*$/i, '')
    .replace(/MONTHS.*$/i, '')
    .replace(/LIST PRICE.*$/i, '')
    .replace(/DISCOUNTED.*$/i, '')
    .replace(/EXTENDED.*$/i, '')
    .replace(/Total\s+Software.*$/i, '')
    .replace(/Total\s+Hardware.*$/i, '')
    .trim();
}
