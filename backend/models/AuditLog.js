const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: true },
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
  aiExtracted: {
    merchant: String,
    date: String,
    total: Number,
    category: String,
    currency: String,
    lineItems: [{ description: String, price: Number }]
  },
  userEdited: {
    merchant: String,
    date: String,
    amount: Number,
    category: String,
    notes: String,
    lineItems: [{ description: String, price: Number }]
  },
  diff: {
    merchantChanged: Boolean,
    dateChanged: Boolean,
    amountDelta: Number,        // userEdited.amount - aiExtracted.total
    categoryChanged: Boolean,
    lineItemsChanged: Boolean
  }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
