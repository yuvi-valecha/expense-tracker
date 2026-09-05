const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  extractedData: {
    merchant: String,
    date: String,
    total: Number,
    currency: { type: String, default: 'USD' },
    lineItems: [{ description: String, price: Number }],
    category: String
  },
  validationPassed: { type: Boolean, default: true },
  savedData: { type: Object, default: null },
  isConfirmed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Receipt', ReceiptSchema);
