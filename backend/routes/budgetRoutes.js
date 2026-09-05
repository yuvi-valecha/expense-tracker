const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

/* ── GET / — All budgets with live usage ────────────────────── */
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month) - 1 : now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [budgets, actuals] = await Promise.all([
      Budget.find(),
      Expense.aggregate([
        { $match: { status: 'confirmed', date: { $gte: start, $lte: end } } },
        { $group: { _id: '$category', actual: { $sum: '$amount' } } }
      ])
    ]);

    const result = budgets.map(b => {
      const found = actuals.find(a => a._id === b.category);
      const actual = found ? found.actual : 0;
      const pctUsed = b.monthlyCap > 0 ? Math.round((actual / b.monthlyCap) * 100) : 0;
      return {
        _id: b._id,
        category: b.category,
        monthlyCap: b.monthlyCap,
        actual,
        remaining: Math.max(0, b.monthlyCap - actual),
        pctUsed,
        thresholdStatus: pctUsed >= 100 ? 'over' : pctUsed >= 80 ? 'warning' : 'ok'
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST / — Set or update a monthly cap ───────────────────── */
router.post('/', async (req, res) => {
  try {
    const { category, monthlyCap } = req.body;
    if (!category || monthlyCap == null) {
      return res.status(400).json({ error: 'category and monthlyCap are required' });
    }
    const budget = await Budget.findOneAndUpdate(
      { category },
      { monthlyCap: Number(monthlyCap) },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(200).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /:id ─────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    await Budget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
