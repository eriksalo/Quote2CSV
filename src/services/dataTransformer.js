import { VDURACARE_CHILDREN, VDURACARE_PATTERN, DEFAULT_STATUS, BASE_PRODUCT_CODE, BASE_DESCRIPTION } from '../utils/constants.js';

/**
 * Calculate discount percentage
 * Formula: ((List - Discounted) / List) × 100
 */
function calculateDiscountPercentage(listPrice, discountPrice) {
  if (listPrice === 0) return 0;
  return ((listPrice - discountPrice) / listPrice) * 100;
}

/**
 * Format number to 2 decimal places
 */
function formatPrice(num) {
  if (num === null || num === undefined || num === '') return '';
  return Number(num).toFixed(2);
}

/**
 * Transform extracted data into CSV-ready rows
 */
export function transformData(header, lineItems, opportunityId, baseProductCode = BASE_PRODUCT_CODE) {
  const rows = [];

  for (const item of lineItems) {
    // Check if this is a VDURACare item
    const vduraCareMatch = item.partNo.match(VDURACARE_PATTERN);

    if (vduraCareMatch) {
      // This is a VDURACare parent item - generates parent + 2 children
      const tier = vduraCareMatch[1]; // "HP" or "C"
      const childDefs = VDURACARE_CHILDREN[tier];

      // Add parent row
      rows.push(createRow(header, item, opportunityId, baseProductCode, null));

      if (childDefs) {
        // Calculate child prices based on parent's discount price
        const parentDiscountPrice = item.discountPrice;
        const supportPrice = childDefs.support.fixedPrice;
        const softwarePrice = parentDiscountPrice - supportPrice;

        // Add software child (price = parent discount price - support price)
        rows.push(createVduraCareChildRow(
          header,
          item,
          opportunityId,
          baseProductCode,
          childDefs.software.code,
          childDefs.software.description,
          softwarePrice,
          item.partNo
        ));

        // Add support child (fixed price)
        rows.push(createVduraCareChildRow(
          header,
          item,
          opportunityId,
          baseProductCode,
          childDefs.support.code,
          childDefs.support.description,
          supportPrice,
          item.partNo
        ));
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
 *
 * For HP tier:
 *   - HW-Support-HP-NBD: fixed price $3.00
 *   - VDP-SW-P-10-HP: price = parent discount price - $3.00
 *
 * For C tier:
 *   - HW-Support-C-NBD: fixed price $0.30
 *   - VDP-SW-P-10-C: price = parent discount price - $0.30
 *
 * List Price = Discount Price (0% discount on children)
 * Extended Price = price × QTY × MONTHS
 */
function createVduraCareChildRow(header, parentItem, opportunityId, baseProductCode, childCode, childDescription, childPrice, parentProductCode) {
  const qty = parentItem.qty;
  const months = parentItem.months || 1;
  const extendedPrice = childPrice * qty * months;

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
    productCode: childCode,
    parentProductCode: parentProductCode,
    listPrice: formatPrice(childPrice),        // List = Discount (no discount)
    discountPercentage: formatPrice(0),        // 0% discount
    discountPrice: formatPrice(childPrice),    // Calculated price
    optionQty: qty,
    month: months,
    extendedPrice: formatPrice(extendedPrice),
    optionDescription: childDescription,
    quoteExpires: header.expires,
    status: DEFAULT_STATUS
  };
}
