/**
 * Extract structured data from PDF text
 * Handles variations in VDURA quotation formats
 */

/**
 * Parse a date string to MM/DD/YYYY format
 * Handles: "January 30, 2026", "Jan 23, 2026", "01/30/2026"
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
 * Handles variations in field names and formats
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

  // Quote Number - pattern like "Quote Number 10178-12345" or "1404-31909"
  const quoteNumMatch = text.match(/Quote\s+Number\s+(\S+)/i);
  if (quoteNumMatch) {
    header.quoteNumber = quoteNumMatch[1];
  }

  // Quote Date - handles "January 30, 2026" or "Jan 23, 2026"
  const quoteDateMatch = text.match(/Quote\s+Date\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (quoteDateMatch) {
    header.quoteDate = parseDate(quoteDateMatch[1]);
  }

  // Quote Expires - handles "February 13, 2026" or "Feb 6, 2026"
  const expiresMatch = text.match(/Quote\s+Expires\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (expiresMatch) {
    header.expires = parseDate(expiresMatch[1]);
  }

  // Customer Name - try multiple patterns
  // Pattern 1: "Customer Name Test Customer"
  let customerMatch = text.match(/Customer\s+Name\s+([^\n]+?)(?=\s+Quote|\s+Partner|\s+SOFTWARE)/i);
  // Pattern 2: "Company Good Year"
  if (!customerMatch || !customerMatch[1].trim()) {
    customerMatch = text.match(/Company\s+([^\n]+?)(?=\s+Quote|\s+SOFTWARE)/i);
  }
  if (customerMatch) {
    header.customer = customerMatch[1].trim();
  }

  // Partner Name (optional - may not exist in all quotes)
  const partnerMatch = text.match(/Partner\s+Name\s+([^\n]+?)(?=\s+SOFTWARE|\s+COMMODITY|\s+PART)/i);
  if (partnerMatch) {
    header.partner = partnerMatch[1].trim();
  }

  // Prepared By
  const preparedByMatch = text.match(/Prepared\s+By\s+([^\n]+?)(?=\s+Email|\s+Quote)/i);
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
 * Uses flexible patterns to handle different PDF text layouts
 */
export function extractLineItems(text) {
  const items = [];

  // Normalize whitespace for easier matching
  const normalizedText = text.replace(/\s+/g, ' ');

  // ============================================
  // VDURACare items - HAVE months
  // Pattern: VDP-VDURACare-10-HP ... 21 60 $500.00 $90.00 $113,400.00
  // ============================================
  const vduraCarePattern = /(VDP-VDURACare-\d+-[A-Z]+)/g;
  let match;
  const vduraCareMatches = [...normalizedText.matchAll(vduraCarePattern)];

  for (const codeMatch of vduraCareMatches) {
    const code = codeMatch[1];
    const startIdx = codeMatch.index;
    const chunk = normalizedText.substring(startIdx, startIdx + 400);

    // Look for: description QTY MONTHS $LIST $DISCOUNT $EXTENDED
    const dataMatch = chunk.match(new RegExp(
      code.replace(/[-]/g, '[-]') +
      '\\s+(.+?)\\s+(\\d+)\\s+(\\d+)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)'
    ));

    if (dataMatch) {
      items.push({
        partNo: code,
        description: cleanDescription(dataMatch[1]),
        qty: parseInt(dataMatch[2]),
        months: parseInt(dataMatch[3]),
        listPrice: parseCurrency(dataMatch[4]),
        discountPrice: parseCurrency(dataMatch[5]),
        extendedPrice: parseCurrency(dataMatch[6])
      });
    }
  }

  // ============================================
  // Service items (SVC-*) - NO months
  // Pattern: SVC-R1-CINT-PDEP-NORACK ... 1 $15,180.00 $7,590.00 $7,590.00
  // ============================================
  const svcPattern = /(SVC-[A-Za-z0-9-]+)/g;
  const svcMatches = [...normalizedText.matchAll(svcPattern)];

  for (const codeMatch of svcMatches) {
    const code = codeMatch[1];
    const startIdx = codeMatch.index;
    const chunk = normalizedText.substring(startIdx, startIdx + 400);

    // Look for: description QTY $LIST $DISCOUNT $EXTENDED (no months)
    const dataMatch = chunk.match(new RegExp(
      code.replace(/[-]/g, '[-]') +
      '\\s+(.+?)\\s+(\\d+)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)'
    ));

    if (dataMatch) {
      items.push({
        partNo: code,
        description: cleanDescription(dataMatch[1]),
        qty: parseInt(dataMatch[2]),
        months: null,
        listPrice: parseCurrency(dataMatch[3]),
        discountPrice: parseCurrency(dataMatch[4]),
        extendedPrice: parseCurrency(dataMatch[5])
      });
    }
  }

  // ============================================
  // Hardware items (VCH-*) - NO months
  // Pattern: VCH-5100-D1N ... 3 $48,618.39 $20,969.19 $62,907.57
  // ============================================
  const vchPattern = /(VCH-[A-Za-z0-9.-]+)/g;
  const vchMatches = [...normalizedText.matchAll(vchPattern)];
  const seenVch = new Set();

  for (const codeMatch of vchMatches) {
    const code = codeMatch[1];

    // Skip duplicates (same code may appear multiple times in text)
    const key = `${code}-${codeMatch.index}`;

    const startIdx = codeMatch.index;
    const chunk = normalizedText.substring(startIdx, startIdx + 400);

    // Look for: description QTY $LIST $DISCOUNT $EXTENDED (no months)
    const dataMatch = chunk.match(new RegExp(
      code.replace(/[-]/g, '[-]').replace(/[.]/g, '[.]') +
      '\\s+(.+?)\\s+(\\d+)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)\\s+\\$([\\d,]+\\.?\\d*)'
    ));

    if (dataMatch) {
      // Create unique key for deduplication
      const itemKey = `${code}-${dataMatch[2]}-${dataMatch[6]}`;
      if (!seenVch.has(itemKey)) {
        seenVch.add(itemKey);
        items.push({
          partNo: code,
          description: cleanDescription(dataMatch[1]),
          qty: parseInt(dataMatch[2]),
          months: null,
          listPrice: parseCurrency(dataMatch[3]),
          discountPrice: parseCurrency(dataMatch[4]),
          extendedPrice: parseCurrency(dataMatch[5])
        });
      }
    }
  }

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
