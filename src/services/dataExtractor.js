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
 * This parses the specific VDURA PDF format
 */
export function extractLineItems(text) {
  const items = [];

  // The PDF has two sections:
  // 1. SOFTWARE AND SUPPORT (items have QTY, MONTHS, LIST PRICE, DISCOUNTED PRICE, EXTENDED PRICE)
  // 2. COMMODITY HARDWARE (items have QTY, [MONTHS optional], LIST PRICE, DISCOUNTED PRICE, EXTENDED PRICE)

  // Split into software and hardware sections
  const softwareSection = text.match(/SOFTWARE AND SUPPORT.*?(?=COMMODITY HARDWARE|Total Software)/is);
  const hardwareSection = text.match(/COMMODITY HARDWARE.*?(?=Total Hardware|Quote Cost|Notes)/is);

  if (softwareSection) {
    const softwareItems = extractItemsFromSection(softwareSection[0], true);
    items.push(...softwareItems);
  }

  if (hardwareSection) {
    const hardwareItems = extractItemsFromSection(hardwareSection[0], false);
    items.push(...hardwareItems);
  }

  return items;
}

/**
 * Extract items from a section of the PDF
 */
function extractItemsFromSection(sectionText, isSoftwareSection) {
  const items = [];

  // Product code patterns
  const productPatterns = [
    /VDP-VDURACare-\d+-\w+/g,
    /VDP-[A-Za-z0-9-]+/g,
    /SVC-[A-Za-z0-9-]+/g,
    /VCH-[A-Za-z0-9.-]+/g,
    /HW-[A-Za-z0-9-]+/g
  ];

  // Find all product codes in this section
  const allCodes = new Set();
  for (const pattern of productPatterns) {
    const matches = sectionText.matchAll(pattern);
    for (const match of matches) {
      // Skip if it's a child product code pattern we add ourselves
      if (!match[0].startsWith('HW-Support')) {
        allCodes.add(match[0]);
      }
    }
  }

  // For each product code, extract its row data
  for (const code of allCodes) {
    const item = extractItemData(sectionText, code, isSoftwareSection);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Extract data for a specific product code
 */
function extractItemData(text, productCode, isSoftwareSection) {
  // Escape special regex characters in product code
  const escapedCode = productCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find the line containing this product code and extract numbers after it
  // Pattern: ProductCode Description QTY [MONTHS] $ListPrice $DiscountPrice $ExtendedPrice

  // Get text starting from this product code
  const codeIndex = text.indexOf(productCode);
  if (codeIndex === -1) return null;

  // Get a chunk of text after the product code (enough to capture the row data)
  const chunk = text.substring(codeIndex, codeIndex + 500);

  // Extract description - text between product code and the first number
  let description = '';
  const descMatch = chunk.match(new RegExp(`^${escapedCode}\\s+(.+?)(?=\\s+\\d+\\s+)`));
  if (descMatch) {
    description = descMatch[1].trim()
      .replace(/\s+/g, ' ')
      .replace(/PART NO\..*/i, '')
      .replace(/DESCRIPTION.*/i, '')
      .trim();
  }

  // Extract all numbers and currency values from the chunk
  // Look for pattern: QTY [MONTHS] $LIST $DISCOUNT $EXTENDED
  const numbers = [];
  const numPattern = /(\d+)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/;
  const numMatch = chunk.match(numPattern);

  if (numMatch) {
    // Has months: QTY MONTHS LIST DISCOUNT EXTENDED
    return {
      partNo: productCode,
      description: description || productCode,
      qty: parseInt(numMatch[1]),
      months: parseInt(numMatch[2]),
      listPrice: parseCurrency(numMatch[3]),
      discountPrice: parseCurrency(numMatch[4]),
      extendedPrice: parseCurrency(numMatch[5])
    };
  }

  // Try without months: QTY $LIST $DISCOUNT $EXTENDED
  const numPatternNoMonths = /(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/;
  const numMatchNoMonths = chunk.match(numPatternNoMonths);

  if (numMatchNoMonths) {
    return {
      partNo: productCode,
      description: description || productCode,
      qty: parseInt(numMatchNoMonths[1]),
      months: null,
      listPrice: parseCurrency(numMatchNoMonths[2]),
      discountPrice: parseCurrency(numMatchNoMonths[3]),
      extendedPrice: parseCurrency(numMatchNoMonths[4])
    };
  }

  return null;
}

/**
 * Alternative: Parse using known PDF structure
 * This is more reliable for the specific VDURA format
 */
export function extractLineItemsStructured(text) {
  const items = [];

  // Known product codes from VDURA quotations
  // We'll search for each pattern and extract the associated data

  // VDURACare items (software subscription with months)
  const vduraCarePattern = /(VDP-VDURACare-\d+-\w+)\s+(.+?)\s+(\d+)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/g;
  let match;

  while ((match = vduraCarePattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: match[2].trim(),
      qty: parseInt(match[3]),
      months: parseInt(match[4]),
      listPrice: parseCurrency(match[5]),
      discountPrice: parseCurrency(match[6]),
      extendedPrice: parseCurrency(match[7])
    });
  }

  // Service items (may or may not have months)
  const svcPattern = /(SVC-[A-Za-z0-9-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/g;
  while ((match = svcPattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: match[2].trim(),
      qty: parseInt(match[3]),
      months: null,
      listPrice: parseCurrency(match[4]),
      discountPrice: parseCurrency(match[5]),
      extendedPrice: parseCurrency(match[6])
    });
  }

  // Hardware items (no months)
  const vchPattern = /(VCH-[A-Za-z0-9.-]+)\s+(.+?)\s+(\d+)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/g;
  while ((match = vchPattern.exec(text)) !== null) {
    items.push({
      partNo: match[1],
      description: match[2].trim(),
      qty: parseInt(match[3]),
      months: null,
      listPrice: parseCurrency(match[4]),
      discountPrice: parseCurrency(match[5]),
      extendedPrice: parseCurrency(match[6])
    });
  }

  return items;
}
