const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function req(method, path, body, isForm = false) {
  const opts = { method, headers: {} };
  if (body) {
    if (isForm) {
      opts.body = body; // FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data, status: res.status });
  return data;
}

/* Expenses */
export const getExpenses = (params = {}) =>
  req('GET', `/expenses?${new URLSearchParams(params)}`);
export const getExpense = (id) => req('GET', `/expenses/${id}`);
export const createExpense = (body) => req('POST', '/expenses', body);
export const updateExpense = (id, body) => req('PUT', `/expenses/${id}`, body);
export const deleteExpense = (id) => req('DELETE', `/expenses/${id}`);
export const exportCSV = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  window.location.href = `${BASE}/expenses/export/csv${qs ? '?' + qs : ''}`;
};

/* AI */
export const scanReceipt = (file) => {
  const form = new FormData();
  form.append('receipt', file);
  return req('POST', '/ai/scan-receipt', form, true);
};

/* Dashboard */
export const getMonthlySummary = (p) => req('GET', `/dashboard/monthly-summary?${new URLSearchParams(p)}`);
export const getSpendTrend = (months = 6) => req('GET', `/dashboard/spend-trend?months=${months}`);
export const getTopMerchants = (limit = 5) => req('GET', `/dashboard/top-merchants?limit=${limit}`);
export const getBudgetUsage = (p) => req('GET', `/dashboard/budget-usage?${new URLSearchParams(p)}`);
export const getRollingAverages = () => req('GET', '/dashboard/rolling-averages');
export const getAnomalyCheck = (category) => req('GET', `/dashboard/anomaly-check?category=${category}`);

/* Budgets */
export const getBudgets = () => req('GET', '/budgets');
export const setBudget = (body) => req('POST', '/budgets', body);
export const deleteBudget = (id) => req('DELETE', `/budgets/${id}`);

/* Audit */
export const getAuditLogs = (p) => req('GET', `/audit?${new URLSearchParams(p)}`);
export const getAuditAccuracy = () => req('GET', '/audit/accuracy');
export const getExpenseAudit = (expenseId) => req('GET', `/audit/${expenseId}`);
