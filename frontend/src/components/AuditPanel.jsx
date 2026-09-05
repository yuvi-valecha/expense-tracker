import React, { useEffect, useState } from 'react';
import { getAuditLogs, getAuditAccuracy } from '../api';
import { ShieldCheck, TrendingUp, Edit3 } from 'lucide-react';

export default function AuditPanel() {
  const [accuracy, setAccuracy] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAuditAccuracy(), getAuditLogs({ limit: 10 })]).then(([acc, l]) => {
      setAccuracy(acc);
      setLogs(l.logs || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.wrap}><p style={{ color: 'var(--text)' }}>Loading audit data…</p></div>;

  if (!accuracy || accuracy.total === 0) return (
    <div style={s.wrap}>
      <p style={{ color: 'var(--text)', fontSize: 14 }}>No audit data yet. Scan receipts to start tracking AI accuracy.</p>
    </div>
  );

  const metrics = [
    { label: 'Merchant', val: accuracy.merchantAccuracy },
    { label: 'Category', val: accuracy.categoryAccuracy },
    { label: 'Date', val: accuracy.dateAccuracy },
    { label: 'Line Items', val: accuracy.lineItemAccuracy }
  ];

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <ShieldCheck size={18} color="var(--accent)" />
        <h3 style={s.title}>AI Accuracy — {accuracy.total} receipts</h3>
      </div>

      <div style={s.metricsRow}>
        {metrics.map(m => (
          <div key={m.label} style={s.metricCard}>
            <p style={s.metricVal(m.val)}>{m.val}%</p>
            <p style={s.metricLabel}>{m.label}</p>
          </div>
        ))}
        <div style={s.metricCard}>
          <p style={s.metricVal(null)}>${accuracy.avgAmountDelta?.toFixed(2)}</p>
          <p style={s.metricLabel}>Avg Δ Amount</p>
        </div>
      </div>

      {logs.length > 0 && (
        <>
          <p style={s.subtitle}>Recent edits</p>
          <div style={s.logList}>
            {logs.map(log => {
              const d = log.diff || {};
              const changes = [
                d.merchantChanged && 'Merchant',
                d.categoryChanged && 'Category',
                d.dateChanged && 'Date',
                d.amountDelta !== 0 && `Amount (Δ$${Math.abs(d.amountDelta || 0).toFixed(2)})`,
                d.lineItemsChanged && 'Line Items'
              ].filter(Boolean);

              return (
                <div key={log._id} style={s.logRow}>
                  <Edit3 size={13} color="var(--text)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.logMerchant}>{log.userEdited?.merchant || '—'}</p>
                    <p style={s.logChanges}>
                      {changes.length ? `Changed: ${changes.join(', ')}` : 'No changes from AI'}
                    </p>
                  </div>
                  <p style={s.logDate}>{new Date(log.createdAt).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-h)' },
  metricsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  metricCard: {
    flex: '1 1 80px', background: 'var(--code-bg)', borderRadius: 10,
    padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
  },
  metricVal: (v) => ({
    margin: 0, fontSize: 22, fontWeight: 700,
    color: v == null ? 'var(--text-h)' : v >= 85 ? '#22c55e' : v >= 70 ? '#f59e0b' : '#ef4444'
  }),
  metricLabel: { margin: 0, fontSize: 11, color: 'var(--text)' },
  subtitle: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  logList: { display: 'flex', flexDirection: 'column', gap: 8 },
  logRow: {
    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px',
    borderRadius: 8, border: '1px solid var(--border)'
  },
  logMerchant: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-h)' },
  logChanges: { margin: 0, fontSize: 12, color: 'var(--text)' },
  logDate: { margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap' }
};
