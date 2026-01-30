import { VDURACARE_CHILDREN, VDURACARE_PATTERN, DEFAULT_STATUS, BASE_PRODUCT_CODE, BASE_DESCRIPTION } from '../utils/constants.js';

/**
 * Calculate discount percentage
 * @param {number} listPrice - Original list price
 * @param {number} discountPrice - Discounted price
 * @returns {number} - Discount percentage (0-100)
 */
function calculateDiscountPercentage(listPrice, discountPrice) {
  if (listPrice === 0) return 0;
  return ((listPrice - discountPrice) / listPrice) * 100;
}

/**
 * Format number to 2 decimal places
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
function formatPrice(num) {
  if (num === null || num === undefined) return '';
  return num.toFixed(2);
}

/**
 * Transform extracted data into CSV-ready rows
 * @param {Object} header - Header information
 * @param {Array} lineItems - Array of line items
 * @param {string} opportunityId - 18-digit Opportunity ID
 * @param {string} baseProductCode - Base product code (e.g., "v5000")
 * @returns {Array} - Array of row objects ready for CSV
 */
export function transformData(header, lineItems, opportunityId, baseProductCode = BASE_PRODUCT_CODE) {
  const rows = [];

  for (const item of lineItems) {
    // Check if this is a VDURACare item
    const vduraCareMatch = item.partNo.match(VDURACARE_PATTERN);

    if (vduraCareMatch) {
      // This is a VDURACare parent item - needs to generate parent + 2 children
      const tier = vduraCareMatch[1]; // "HP" or "C"
      const childDefs = VDURACARE_CHILDREN[tier];

      if (childDefs) {
        // Add parent row
        rows.push(createRow(header, item, opportunityId, baseProductCode, null));

        // Add software child
        const softwareChild = createChildRow(
          header,
          item,
          opportunityId,
          baseProductCode,
          childDefs.software,
          item.partNo
        );
        rows.push(softwareChild);

        // Add support child
        const supportChild = createChildRow(
          header,
          item,
          opportunityId,
          baseProductCode,
          childDefs.support,
          item.partNo
        );
        rows.push(supportChild);
      } else {
        // Unknown tier, just add as regular item
        rows.push(createRow(header, item, opportunityId, baseProductCode, null));
      }
    } else {
      // Regular item - add single row
      rows.push(createRow(header, item, opportunityId, baseProductCode, null));
    }
  }

  return rows;
}

/**
 * Create a standard CSV row from an item
 */
function createRow(header, item, opportunityId, baseProductCode, parentProductCode) {
  const discountPercentage = calculateDiscountPercentage(item.listPrice, item.discountPrice);

  return {
    quoteDate: header.quoteDate,
    opportunityId: opportunityId,
    customerName: header.customer,
    partnerName: header.partner,
    preparedBy: header.preparedBy,
    email: header.email,
    quoteNumber: header.quoteNumber,
    baseProductCode: baseProductCode,
    baseDescription: BASE_DESCRIPTION,
    productCode: item.partNo,
    parentProductCode: parentProductCode || '',
    listPrice: formatPrice(item.listPrice),
    discountPercentage: formatPrice(discountPercentage),
    discountPrice: formatPrice(item.discountPrice),
    optionQty: item.qty,
    month: item.months || '',
    extendedPrice: formatPrice(item.extendedPrice),
    optionDescription: item.description,
    quoteExpires: header.expires,
    status: DEFAULT_STATUS
  };
}

/**
 * Create a child row for VDURACare items
 */
function createChildRow(header, parentItem, opportunityId, baseProductCode, childDef, parentProductCode) {
  const qty = parentItem.qty;
  const months = parentItem.months || 1;
  const extendedPrice = childDef.price * qty * months;

  return {
    quoteDate: header.quoteDate,
    opportunityId: opportunityId,
    customerName: header.customer,
    partnerName: header.partner,
    preparedBy: header.preparedBy,
    email: header.email,
    quoteNumber: header.quoteNumber,
    baseProductCode: baseProductCode,
    baseDescription: BASE_DESCRIPTION,
    productCode: childDef.code,
    parentProductCode: parentProductCode,
    listPrice: formatPrice(childDef.price),
    discountPercentage: formatPrice(0), // Children have 0% discount
    discountPrice: formatPrice(childDef.price),
    optionQty: qty,
    month: months,
    extendedPrice: formatPrice(extendedPrice),
    optionDescription: childDef.description,
    quoteExpires: header.expires,
    status: DEFAULT_STATUS
  };
}
