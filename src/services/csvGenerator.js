import { CSV_HEADERS } from '../utils/constants.js';

/**
 * Escape a value for CSV (handle quotes and commas)
 * @param {string|number} value - Value to escape
 * @returns {string} - Escaped value
 */
function escapeCSVValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert row object to CSV line
 * @param {Object} row - Row object with all fields
 * @returns {string} - CSV line
 */
function rowToCSVLine(row) {
  const values = [
    row.quoteDate,
    row.opportunityId,
    row.customerName,
    row.partnerName,
    row.preparedBy,
    row.email,
    row.quoteNumber,
    row.baseProductCode,
    row.baseDescription,
    row.productCode,
    row.parentProductCode,
    row.listPrice,
    row.discountPercentage,
    row.discountPrice,
    row.optionQty,
    row.month,
    row.extendedPrice,
    row.optionDescription,
    row.quoteExpires,
    row.status
  ];

  return values.map(escapeCSVValue).join(',');
}

/**
 * Generate CSV content from transformed rows
 * @param {Array} rows - Array of row objects
 * @returns {string} - Complete CSV content
 */
export function generateCSV(rows) {
  const headerLine = CSV_HEADERS.join(',');
  const dataLines = rows.map(rowToCSVLine);

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Generate filename for the CSV
 * @param {string} quoteNumber - Quote number from the PDF
 * @returns {string} - Filename
 */
export function generateFilename(quoteNumber) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `Quote_Number_${quoteNumber}_BOM_${timestamp}.csv`;
}

/**
 * Trigger CSV file download
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
