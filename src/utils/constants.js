// VDURACare child item definitions
// Support prices are fixed; Software price = parent discount price - support price

export const VDURACARE_CHILDREN = {
  HP: {
    software: {
      code: 'VDP-SW-P-10-HP',
      description: 'VDURA Data Platform – Physical, 10TB, High Performance Tier, One Month Subscription Term'
    },
    support: {
      code: 'HW-Support-HP-NBD',
      fixedPrice: 3.00,  // Always $3.00
      description: 'VDURA Care – Physical 10TB, High Performance Tier, Basic Support'
    }
  },
  C: {
    software: {
      code: 'VDP-SW-P-10-C',
      description: 'VDURA Data Platform – Physicial, 10TB, Capacity Tier, One Month Subscription Term'
    },
    support: {
      code: 'HW-Support-C-NBD',
      fixedPrice: 0.30,  // Always $0.30
      description: 'VDURA Care – Physical 10TB, Capacity Tier, Basic Support'
    }
  }
};

// Pattern to identify VDURACare items and their tier
export const VDURACARE_PATTERN = /VDP-VDURACare-\d+-(\w+)/;

// CSV column headers
export const CSV_HEADERS = [
  'Quote Date',
  'Opportunity ID',
  'Customer Name',
  'Partner Name',
  'Prepared By',
  'Email',
  'Quote Number',
  'Base Product Code',
  'Base Description',
  'Product Code',
  'Parent Product Code',
  'List Price',
  'Discount Percentage',
  'Discount Price',
  'Option QTY',
  'Month',
  'Extended Price',
  'Option Description',
  'Quote Expires',
  'Status'
];

// Default values
export const DEFAULT_STATUS = 'New';
export const BASE_PRODUCT_CODE = 'v5000';
export const BASE_DESCRIPTION = 'v5000';
