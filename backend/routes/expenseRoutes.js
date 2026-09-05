const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Receipt = require('../models/Receipt');
const AuditLog = require('../models/AuditLog');

/* helper: compute diff between AI extracted and user edited */
function buildDiff(ai, user) {
  return {
    merchantChanged: ai.merchant !== user.merchant,
    dateChanged: ai.date !== (user.date ? new Date(user.date).toISOString().split('T')[0] : null),
    amountDelta: Math.round((user.amount - (ai.total || 0)) * 100) / 100,
    categoryChanged: ai.category !== user.category,
    lineItemsChanged: JSON.stringify(ai.lineItems || []) !== JSON.stringify(user.lineItems || [])
  };
}

/* ── POST / — Create expense + audit log ─────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { amount, category, merchant, date, notes, receiptUrl, lineItems, receiptId } = req.body;

    const expense = await Expense.create({
      amount,
      category,
      merchant,
      date: date || new Date(),
      notes,
      receiptUrl,
      lineItems,
      status: 'confirmed'
    });

    if (receiptId) {
      const receipt = await Receipt.findById(receiptId);
      if (receipt) {
        const userEdited = { merchant, date, amount, category, notes, lineItems };
        const ai = receipt.extractedData || {};

        await AuditLog.create({
          expenseId: expense._id,
          receiptId: receipt._id,
          aiExtracted: {
            merchant: ai.merchant,
            date: ai.date,
            total: ai.total,
            category: ai.category,
            currency: ai.currency,
            lineItems: ai.lineItems
          },
          userEdited,
          diff: buildDiff(ai, userEdited)
        });

        await Receipt.findByIdAndUpdate(receiptId, {
          savedData: userEdited,
          isConfirmed: true
        });
      }
    }

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /export/csv ─────────────────────────────────────────── */
router.get('/export/csv', async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;
    const filter = { status: 'confirmed' };
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Date,Merchant,Category,Amount,Currency,Notes,LineItems\n';
    const rows = expenses.map(e => {
      const d = new Date(e.date).toISOString().split('T')[0];
      const items = (e.lineItems || []).map(i => `${i.description}:${i.price}`).join(' | ');
      return [d, esc(e.merchant), esc(e.category), e.amount, 'USD', esc(e.notes), esc(items)].join(',');
    }).join('\n');

    const ts = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${ts}.csv"`);
    res.status(200).send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET / — Paginated & filtered list ──────────────────────── */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 10, category,
      startDate, endDate, minAmount, maxAmount,
      sortBy = 'date', sortOrder = 'desc'
    } = req.query;

    const filter = { status: 'confirmed' };
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      Expense.countDocuments(filter)
    ]);

    res.json({ expenses, totalCount: total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /:id ────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── PUT /:id — Update + audit ───────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const updated = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Expense not found' });

    // Update audit trail if there's an existing audit for this expense
    const existingAudit = await AuditLog.findOne({ expenseId: req.params.id });
    if (existingAudit) {
      existingAudit.userEdited = {
        merchant: updated.merchant,
        date: updated.date,
        amount: updated.amount,
        category: updated.category,
        notes: updated.notes,
        lineItems: updated.lineItems
      };
      existingAudit.diff = buildDiff(existingAudit.aiExtracted, existingAudit.userEdited);
      await existingAudit.save();
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /:id ─────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
