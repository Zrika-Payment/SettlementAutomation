module.exports = {
  // Raw Report Headers
  rawHeaders: {
    merchantName: 'TSP_Merchant Name',
    merchantId: 'TSP_Merchant ID',
    netAmount: 'TSP_Net Amount (₹)',       // "SETTLEMENT AMOUNT"
    totalAmount: 'TSP_Amount (₹)',         // "TOTAL AMOUNT"
    gst1: 'TSP_GST (₹)',                   // First Tax Column
    gst2: 'TSP_GST (₹)_2',                 // Second Tax Column (Renamed by code)
    status: 'TSP_Status',
    date: 'TSP_Initiated At'
  },
  
  // Static Defaults for Settlement Batch
  defaults: {
    bankName: 'XYZ Bank',
    accountNumber: '0000000123',
    ifsc: 'XYZ0000001',
    paymentMethod: 'NEFT'
  }
};