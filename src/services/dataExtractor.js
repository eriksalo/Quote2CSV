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

  // Fix split alphanumeric segments in product codes (e.g., -J 78 -> -J78, -J 108 -> -J108)
  // pdf.js sometimes splits letter-digit boundaries within hyphenated part numbers
  normalized = normalized.replace(/(-[A-Za-z])\s+(\d)/g, '$1$2');

  // Fix split year numbers only (202 6 -> 2026) - 4 digit years
  normalized = normalized.replace(/(\d{3})\s+(\d{1})(?!\d)/g, '$1$2');

  // Fix split day numbers in dates (2 3 , -> 23,)
  normalized = normalized.replace(/(\d)\s+(\d)\s*,/g, '$1$2,');

  // Fix common split words
  normalized = normalized.replace(/Quot\s*ation/gi, 'Quotation');
  normalized = normalized.replace(/Com\s*pany/gi, 'Company');
  normalized = normalized.replace(/Q\s*TY/gi, 'QTY');
  normalized = normalized.replace(/VDURA\s+Care/gi, 'VDURA Care');
  normalized = normalized.replace(/Phy\s*sical/gi, 'Physical');
  normalized = normalized.replace(/Sub\s*scription/gi, 'Subscription');
  normalized = normalized.replace(/Sup\s*port/gi, 'Support');
  normalized = normalized.replace(/Soft\s*ware/gi, 'Software');
  normalized = normalized.replace(/Dis\s*counted/gi, 'Discounted');
  normalized = normalized.replace(/Ex\s*tended/gi, 'Extended');

  // Fix split email addresses (xxx @ yyy -> xxx@yyy)
  normalized = normalized.replace(/(\S+)\s*@\s*(\S+)/g, '$1@$2');

  // Fix split currency ($ 500 -> $500)
  normalized = normalized.replace(/\$\s+(\d)/g, '$$1');

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Parse a date string to MM/DD/YYYY format
 */
function parseDate(dateStr) {
  if (!dateStr) return '';

  // Clean up any remaining split numbers in date
  let cleaned = dateStr.replace(/(\d)\s+(\d)/g, '$1$2');

  // If already in MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
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
  const match = cleaned.match(/(\w+)\s*(\d{1,2})\s*,?\s*(\d{4})/i);
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
  // Remove $ and commas, handle spaces
  const cleaned = str.replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
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

  console.log('=== NORMALIZED TEXT (first 2000 chars) ===');
  console.log(normalized.substring(0, 2000));

  // ============================================
  // VDURACare items - HAVE months
  // Pattern: VDP-VDURACare-10-HP description QTY MONTHS $LIST $DISCOUNT $EXTENDED
  // ============================================
  // More flexible pattern that handles various spacing
  const vduraCarePattern = /(VDP-VDURACare-\d+-[A-Z]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;
  let match;
  const seenVduraCare = new Set();

  while ((match = vduraCarePattern.exec(normalized)) !== null) {
    const code = match[1];
    const itemKey = `${code}-${match[3]}-${match[4]}`;
    if (!seenVduraCare.has(itemKey)) {
      seenVduraCare.add(itemKey);
      console.log('Found VDURACare:', code, 'QTY:', match[3], 'MONTHS:', match[4]);
      items.push({
        partNo: code,
        description: cleanDescription(match[2]),
        qty: parseInt(match[3]),
        months: parseInt(match[4]),
        listPrice: parseCurrency(match[5]),
        discountPrice: parseCurrency(match[6]),
        extendedPrice: parseCurrency(match[7])
      });
    }
  }

  // ============================================
  // Service items (SVC-*) - NO months
  // Pattern: SVC-xxx description QTY $LIST $DISCOUNT $EXTENDED
  // ============================================
  const svcPattern = /(SVC-[A-Za-z0-9-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;
  const seenSvc = new Set();

  while ((match = svcPattern.exec(normalized)) !== null) {
    const code = match[1];
    const itemKey = `${code}-${match[3]}-${match[6]}`;
    if (!seenSvc.has(itemKey)) {
      seenSvc.add(itemKey);
      console.log('Found SVC:', code, 'QTY:', match[3]);
      items.push({
        partNo: code,
        description: cleanDescription(match[2]),
        qty: parseInt(match[3]),
        months: null,
        listPrice: parseCurrency(match[4]),
        discountPrice: parseCurrency(match[5]),
        extendedPrice: parseCurrency(match[6])
      });
    }
  }

  // ============================================
  // Hardware items (VCH-*) - NO months
  // Pattern: VCH-xxx description QTY $LIST $DISCOUNT $EXTENDED
  // ============================================
  const vchPattern = /(VCH-[A-Za-z0-9.-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/gi;
  const seenVch = new Set();

  while ((match = vchPattern.exec(normalized)) !== null) {
    const code = match[1];
    const itemKey = `${code}-${match[3]}-${match[6]}`;
    if (!seenVch.has(itemKey)) {
      seenVch.add(itemKey);
      console.log('Found VCH:', code, 'QTY:', match[3]);
      items.push({
        partNo: code,
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
