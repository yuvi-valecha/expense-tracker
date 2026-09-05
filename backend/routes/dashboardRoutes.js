const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');

/* ── GET /monthly-summary ───────────────────────────────────── */
router.get('/monthly-summary', async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month) - 1 : now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [categoryTotals, budgets] = await Promise.all([
      Expense.aggregate([
        { $match: { status: 'confirmed', date: { $gte: start, $lte: end } } },
        { $group: { _id: '$category', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { totalSpent: -1 } }
      ]),
      Budget.find()
    ]);

    const totalSpent = categoryTotals.reduce((s, c) => s + c.totalSpent, 0);

    const budgetVsActual = budgets.map(b => {
      const found = categoryTotals.find(c => c._id === b.category);
      const actual = found ? found.totalSpent : 0;
      const pctUsed = b.monthlyCap > 0 ? Math.round((actual / b.monthlyCap) * 100) : 0;
      return {
        category: b.category,
        budget: b.monthlyCap,
        actual,
        pctUsed,
        thresholdStatus: pctUsed >= 100 ? 'over' : pctUsed >= 80 ? 'warning' : 'ok'
      };
    });

    res.json({ categoryTotals, budgetVsActual, totalSpent, month: month + 1, year });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /spend-trend ────────────────────────────────────────── */
router.get('/spend-trend', async (req, res) => {
  try {
    const monthsLimit = parseInt(req.query.months) || 6;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsLimit - 1), 1);

    const trend = await Expense.aggregate([
      { $match: { status: 'confirmed', date: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          totalSpent: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /top-merchants ──────────────────────────────────────── */
router.get('/top-merchants', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const now = new Date();
    const startDate = req.query.allTime
      ? new Date(0)
      : new Date(now.getFullYear(), now.getMonth() - 2, 1); // last 3 months

    const topMerchants = await Expense.aggregate([
      { $match: { status: 'confirmed', date: { $gte: startDate } } },
      { $group: { _id: '$merchant', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: limit }
    ]);

    res.json(topMerchants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /budget-usage ───────────────────────────────────────── */
router.get('/budget-usage', async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month) - 1 : now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [actuals, budgets] = await Promise.all([
      Expense.aggregate([
        { $match: { status: 'confirmed', date: { $gte: start, $lte: end } } },
        { $group: { _id: '$category', actual: { $sum: '$amount' } } }
      ]),
      Budget.find()
    ]);

    const usage = budgets.map(b => {
      const found = actuals.find(a => a._id === b.category);
      const actual = found ? found.actual : 0;
      const pctUsed = b.monthlyCap > 0 ? Math.round((actual / b.monthlyCap) * 100) : 0;
      return {
        category: b.category,
        budget: b.monthlyCap,
        actual,
        remaining: Math.max(0, b.monthlyCap - actual),
        pctUsed,
        thresholdStatus: pctUsed >= 100 ? 'over' : pctUsed >= 80 ? 'warning' : 'ok'
      };
    });

    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /rolling-averages — 3-month rolling avg per category ── */
router.get('/rolling-averages', async (req, res) => {
  try {
    const now = new Date();
    // exclude current month; average the 3 prior months
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const results = await Expense.aggregate([
      { $match: { status: 'confirmed', date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            category: '$category',
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          monthlyTotal: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          totalOver3Months: { $sum: '$monthlyTotal' },
          monthCount: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          rollingAvg: { $round: [{ $divide: ['$totalOver3Months', 3] }, 2] },
          monthCount: 1
        }
      },
      { $sort: { rollingAvg: -1 } }
    ]);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /anomaly-check ──────────────────────────────────────── */
router.get('/anomaly-check', async (req, res) => {
  try {
    const targetCategory = req.query.category || 'groceries';
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfThreeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const stats = await Expense.aggregate([
      {
        $match: {
          category: targetCategory,
          status: 'confirmed',
          date: { $gte: startOfThreeMonthsAgo }
        }
      },
      {
        $group: {
          _id: { isCurrentMonth: { $gte: ['$date', startOfCurrentMonth] } },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const currentSpent = stats.find(s => s._id.isCurrentMonth)?.total || 0;
    const pastTotal = stats.find(s => !s._id.isCurrentMonth)?.total || 0;
    const rollingAvg = Math.round((pastTotal / 3) * 100) / 100;
    const anomalyPercent = rollingAvg > 0
      ? Math.round(((currentSpent - rollingAvg) / rollingAvg) * 100)
      : 0;

    res.json({
      category: targetCategory,
      currentSpent,
      rollingAvg,
      anomalyPercent,
      anomalyMessage: anomalyPercent > 20
        ? `${targetCategory} up ${anomalyPercent}% vs your 3-month average`
        : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
