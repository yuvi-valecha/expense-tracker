const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');

/* ── GET / — All audit logs (paginated) ─────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [logs, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('expenseId', 'merchant amount category date'),
      AuditLog.countDocuments()
    ]);
    res.json({ logs, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /accuracy — Overall AI accuracy stats ─────────────── */
router.get('/accuracy', async (req, res) => {
  try {
    const logs = await AuditLog.find({ 'diff': { $exists: true } });

    const total = logs.length;
    if (total === 0) return res.json({ total: 0, message: 'No audit data yet' });

    const stats = logs.reduce((acc, log) => {
      const d = log.diff || {};
      acc.merchantChanges += d.merchantChanged ? 1 : 0;
      acc.categoryChanges += d.categoryChanged ? 1 : 0;
      acc.dateChanges += d.dateChanged ? 1 : 0;
      acc.totalAmountDelta += Math.abs(d.amountDelta || 0);
      acc.lineItemChanges += d.lineItemsChanged ? 1 : 0;
      return acc;
    }, { merchantChanges: 0, categoryChanges: 0, dateChanges: 0, totalAmountDelta: 0, lineItemChanges: 0 });

    res.json({
      total,
      merchantAccuracy: Math.round(((total - stats.merchantChanges) / total) * 100),
      categoryAccuracy: Math.round(((total - stats.categoryChanges) / total) * 100),
      dateAccuracy: Math.round(((total - stats.dateChanges) / total) * 100),
      avgAmountDelta: Math.round((stats.totalAmountDelta / total) * 100) / 100,
      lineItemAccuracy: Math.round(((total - stats.lineItemChanges) / total) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /:expenseId ─────────────────────────────────────────── */
router.get('/:expenseId', async (req, res) => {
  try {
    const log = await AuditLog.findOne({ expenseId: req.params.expenseId });
    if (!log) return res.status(404).json({ error: 'No audit log for this expense' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
