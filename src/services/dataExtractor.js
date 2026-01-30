/**
 * Extract structured data from PDF text
 */

/**
 * Extract header information from PDF text
 * @param {string} text - Raw PDF text
 * @returns {Object} - Header data
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

  // Quote Number - look for pattern like "10178-12345" or similar
  const quoteNumMatch = text.match(/Quote\s*(?:Number|#|No\.?)?\s*[:\s]*(\d+(?:-\d+)?)/i);
  if (quoteNumMatch) {
    header.quoteNumber = quoteNumMatch[1];
  }

  // Date patterns - look for "Date: MM/DD/YYYY" or similar
  const dateMatch = text.match(/Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateMatch) {
    header.quoteDate = dateMatch[1];
  }

  // Expires pattern
  const expiresMatch = text.match(/Expires[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (expiresMatch) {
    header.expires = expiresMatch[1];
  }

  // Customer - look for "Customer:" or "Customer Name:"
  const customerMatch = text.match(/Customer(?:\s*Name)?[:\s]+([^\n\r]+?)(?=\s*(?:Partner|Prepared|Email|Date|$))/i);
  if (customerMatch) {
    header.customer = customerMatch[1].trim();
  }

  // Partner - look for "Partner:" or "Partner Name:"
  const partnerMatch = text.match(/Partner(?:\s*Name)?[:\s]+([^\n\r]+?)(?=\s*(?:Customer|Prepared|Email|Date|$))/i);
  if (partnerMatch) {
    header.partner = partnerMatch[1].trim();
  }

  // Prepared By
  const preparedByMatch = text.match(/Prepared\s*By[:\s]+([^\n\r]+?)(?=\s*(?:Email|Date|Customer|Partner|$))/i);
  if (preparedByMatch) {
    header.preparedBy = preparedByMatch[1].trim();
  }

  // Email - look for email pattern
  const emailMatch = text.match(/Email[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    header.email = emailMatch[1];
  } else {
    // Try to find any email in the text near "Prepared By"
    const anyEmailMatch = text.match(/([a-zA-Z0-9._%+-]+@vdura\.com)/i);
    if (anyEmailMatch) {
      header.email = anyEmailMatch[1];
    }
  }

  return header;
}

/**
 * Extract base product code from Notes section
 * @param {string} text - Raw PDF text
 * @returns {string} - Base product code (e.g., "v5000")
 */
export function extractBaseProductCode(text) {
  // Look for V5000 Configuration or similar in Notes
  const configMatch = text.match(/V(\d+)\s*Configuration/i);
  if (configMatch) {
    return `v${configMatch[1]}`;
  }
  return 'v5000'; // default
}

/**
 * Extract line items from the quotation table
 * @param {string} text - Raw PDF text
 * @returns {Array} - Array of line item objects
 */
export function extractLineItems(text) {
  const items = [];

  // Pattern to match line items in the table
  // Part No | Description | QTY | Months | List Price | Discounted Price | Extended Price

  // First, try to find product codes and their associated data
  // Common product code patterns: VDP-*, VCH-*, SVC-*, HW-*
  const productCodePattern = /\b(VDP-[A-Za-z0-9-]+|VCH-[A-Za-z0-9-]+|SVC-[A-Za-z0-9-]+|HW-[A-Za-z0-9-]+)\b/g;

  let match;
  const productCodes = [];
  while ((match = productCodePattern.exec(text)) !== null) {
    productCodes.push({
      code: match[1],
      index: match.index
    });
  }

  // For each product code, try to extract the associated data
  // We'll look for patterns of numbers that follow the product code
  for (const { code, index } of productCodes) {
    // Get a chunk of text around the product code
    const chunk = text.substring(index, index + 500);

    // Look for the description and numeric values
    // Pattern: code ... description ... qty months listPrice discountPrice extendedPrice

    // Try to extract numeric values (looking for currency and quantity patterns)
    const numbersPattern = /\$?([\d,]+\.?\d*)/g;
    const numbers = [];
    let numMatch;
    const chunkAfterCode = chunk.substring(code.length);

    while ((numMatch = numbersPattern.exec(chunkAfterCode)) !== null) {
      const val = parseFloat(numMatch[1].replace(/,/g, ''));
      if (!isNaN(val)) {
        numbers.push(val);
      }
    }

    // We expect: QTY, Months (optional), List Price, Discounted Price, Extended Price
    // Minimum 4 numbers for a valid line item
    if (numbers.length >= 4) {
      // Try to find description - text between product code and first number
      let description = '';
      const descMatch = chunkAfterCode.match(/^[\s,]*([^$\d]+?)(?=\s*\d)/);
      if (descMatch) {
        description = descMatch[1].trim()
          .replace(/\s+/g, ' ')
          .replace(/^[,\s]+/, '')
          .replace(/[,\s]+$/, '');
      }

      // Determine if this item has months (subscription items)
      // VDURACare items have months, hardware items typically don't
      const isSubscription = code.includes('VDURACare');

      let qty, months, listPrice, discountPrice, extendedPrice;

      if (isSubscription && numbers.length >= 5) {
        // Subscription item: QTY, Months, List, Discount, Extended
        [qty, months, listPrice, discountPrice, extendedPrice] = numbers.slice(0, 5);
      } else if (numbers.length >= 4) {
        // Non-subscription: QTY, List, Discount, Extended (no months)
        qty = numbers[0];
        months = null;
        listPrice = numbers[1];
        discountPrice = numbers[2];
        extendedPrice = numbers[3];
      }

      // Only add if we have valid data
      if (qty && listPrice !== undefined && discountPrice !== undefined && extendedPrice !== undefined) {
        items.push({
          partNo: code,
          description: description || code,
          qty: qty,
          months: months,
          listPrice: listPrice,
          discountPrice: discountPrice,
          extendedPrice: extendedPrice
        });
      }
    }
  }

  // Remove duplicates (same product code might be captured multiple times)
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.partNo}-${item.qty}-${item.extendedPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Alternative extraction using more structured approach
 * Parses text looking for tabular data patterns
 */
export function extractLineItemsStructured(text) {
  const items = [];

  // Split text into lines and look for product code patterns
  const lines = text.split(/[\n\r]+/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains a product code
    const codeMatch = line.match(/\b(VDP-[A-Za-z0-9-]+|VCH-[A-Za-z0-9-]+|SVC-[A-Za-z0-9-]+|HW-[A-Za-z0-9-]+)\b/);

    if (codeMatch) {
      const code = codeMatch[1];

      // Extract numbers from this line and potentially the next few lines
      const textToSearch = lines.slice(i, i + 3).join(' ');
      const numbersPattern = /\$?([\d,]+\.?\d*)/g;
      const numbers = [];
      let numMatch;

      while ((numMatch = numbersPattern.exec(textToSearch)) !== null) {
        const val = parseFloat(numMatch[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          numbers.push(val);
        }
      }

      if (numbers.length >= 4) {
        // Try to extract description
        const afterCode = textToSearch.substring(textToSearch.indexOf(code) + code.length);
        const descMatch = afterCode.match(/^[\s,]*([^$\d]*?)(?=\s*[\d$])/);
        const description = descMatch ? descMatch[1].trim() : code;

        const isSubscription = code.includes('VDURACare');

        let item;
        if (isSubscription && numbers.length >= 5) {
          item = {
            partNo: code,
            description: description,
            qty: numbers[0],
            months: numbers[1],
            listPrice: numbers[2],
            discountPrice: numbers[3],
            extendedPrice: numbers[4]
          };
        } else {
          item = {
            partNo: code,
            description: description,
            qty: numbers[0],
            months: null,
            listPrice: numbers[1],
            discountPrice: numbers[2],
            extendedPrice: numbers[3]
          };
        }

        items.push(item);
      }
    }
  }

  // Remove duplicates
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.partNo}-${item.qty}-${item.extendedPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
