const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true }, // Mapped from 'BATCH ID'
  merchantName: { type: String, required: true }, // Mapped from 'MERCHANT DETAILS'
  
  // Financials
  settlementAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  deductedAmount: { type: Number, default: 0 },
  partialSettlementAmount: { type: Number, default: 0 },

  // Counts & Status
  transactionsCount: { type: Number, default: 0 }, // New Field
  payoutStatus: { type: String, default: 'Not Yet Settled' },
  payoutMessage: { type: String, default: '-' },   // New Field for error messages
  isPartial: { type: String, default: 'No' },

  // Dates
  dateRange: { type: String }, 
  createdAt: { type: Date },   
  completedAt: { type: String, default: null }, // Changed to String as input might be "-" or text

  // Bank Details
  operatorId: { type: String, default: '-' },
  utr: { type: String, default: '-' },
  paymentMethod: { type: String, default: 'NEFT' },
  bankName: { type: String, default: 'XYZ Bank' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Settlement', SettlementSchema);