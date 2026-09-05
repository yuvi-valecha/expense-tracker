import React, { useState, useRef } from 'react';
import { Camera, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { scanReceipt, createExpense } from '../api';

const CATEGORIES = [
  'food','groceries','transport','shopping','entertainment','bills','health','travel','housing','other'
];

export default function ReceiptScanner({ onSuccess, onCancel }) {
  const [stage, setStage] = useState('idle');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [validationErrors, setValidationErrors] = useState(null);
  const [form, setForm] = useState({
    merchant: '', date: '', amount: '', category: 'other', notes: '', lineItems: []
  });
  const inputRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setScanError(null);
    setValidationErrors(null);
    startScan(f);
  }

  async function startScan(f) {
    setStage('scanning');
    try {
      const res = await scanReceipt(f);
      setReceiptId(res.receiptId);
      setForm({
        merchant: res.data.merchant || '',
        date: res.data.date || new Date().toISOString().split('T')[0],
        amount: res.data.total ?? '',
        category: res.data.category || 'other',
        notes: '',
        lineItems: res.data.lineItems || []
      });
      setStage('review');
    } catch (err) {
      const d = err.data || {};
      setScanError(d.error || 'Scan failed');
      setValidationErrors(d.validationErrors || null);
      if (d.rawExtracted) {
        const raw = d.rawExtracted;
        setForm(prev => ({
          ...prev,
          merchant: raw.merchant || '',
          date: raw.date || new Date().toISOString().split('T')[0],
          amount: raw.total ?? '',
          category: raw.category || 'other',
          lineItems: raw.lineItems || []
        }));
      }
      setStage('manual');
    }
  }

  async function handleSave() {
    if (!form.merchant || !form.amount) return;
    setStage('saving');
    try {
      await createExpense({
        merchant: form.merchant,
        date: form.date,
        amount: Number(form.amount),
        category: form.category,
        notes: form.notes,
        lineItems: form.lineItems,
        receiptId: receiptId || undefined
      });
      onSuccess?.();
    } catch (err) {
      setScanError(err.message);
      setStage('review');
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  if (stage === 'idle') return (
    <div style={styles.wrap}>
      <div style={styles.dropZone} onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => inputRef.current?.click()}>
        <Camera size={32} color="var(--accent)" />
        <p style={styles.dropLabel}>Drop receipt or tap to upload</p>
        <p style={styles.dropSub}>JPEG · PNG · WebP · HEIC · max 8 MB</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={e => handleFile(e.target.files[0])} />
      </div>
      <button style={styles.btnGhost} onClick={onCancel}>Cancel</button>
    </div>
  );

  if (stage === 'scanning') return (
    <div style={{ ...styles.wrap, alignItems: 'center', gap: 16 }}>
      {previewUrl && <img src={previewUrl} alt="" style={styles.thumbLg} />}
      <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      <p>Scanning receipt with AI…</p>
    </div>
  );

  if (stage === 'saving') return (
    <div style={{ ...styles.wrap, alignItems: 'center', gap: 16 }}>
      <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      <p>Saving expense…</p>
    </div>
  );

  const isManual = stage === 'manual';

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        {previewUrl && <img src={previewUrl} alt="" style={styles.thumbSm} />}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {isManual
              ? <><AlertTriangle size={15} color="#f59e0b" /><span style={{ color: '#f59e0b', fontSize: 13 }}>Scan incomplete — complete manually</span></>
              : <><Check size={15} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 13 }}>Scanned — review &amp; confirm</span></>
            }
          </div>
          {scanError && <p style={styles.errMsg}>{scanError}</p>}
          {validationErrors && (
            <ul style={styles.validList}>
              {Object.entries(validationErrors).map(([k, msgs]) =>
                <li key={k}><b>{k}</b>: {msgs.join(', ')}</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div style={styles.formGrid}>
        {[
          { label: 'Merchant', key: 'merchant', type: 'text', placeholder: 'Store name' },
          { label: 'Date', key: 'date', type: 'date' },
          { label: 'Amount', key: 'amount', type: 'number', placeholder: '0.00' }
        ].map(({ label, key, type, placeholder }) => (
          <label key={key} style={styles.label}>
            {label}
            <input
              style={styles.input}
              type={type}
              step={type === 'number' ? '0.01' : undefined}
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              placeholder={placeholder}
            />
          </label>
        ))}

        <label style={styles.label}>
          Category
          <select style={styles.input} value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </label>

        <label style={{ ...styles.label, gridColumn: '1/-1' }}>
          Notes
          <input style={styles.input} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional note" />
        </label>
      </div>

      {form.lineItems.length > 0 && (
        <div style={styles.lineItems}>
          <p style={styles.liTitle}>Line Items</p>
          {form.lineItems.map((item, i) => (
            <div key={i} style={styles.liRow}>
              <input style={{ ...styles.input, flex: 1 }} value={item.description}
                onChange={e => { const li = [...form.lineItems]; li[i] = { ...li[i], description: e.target.value }; set('lineItems', li); }}
                placeholder="Description" />
              <input style={{ ...styles.input, width: 90 }} type="number" step="0.01" value={item.price}
                onChange={e => { const li = [...form.lineItems]; li[i] = { ...li[i], price: Number(e.target.value) }; set('lineItems', li); }}
                placeholder="Price" />
              <button style={styles.liDel} onClick={() => set('lineItems', form.lineItems.filter((_, j) => j !== i))}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button style={styles.addLine} onClick={() => set('lineItems', [...form.lineItems, { description: '', price: 0 }])}>
        + Add line item
      </button>

      <div style={styles.actions}>
        <button style={styles.btnGhost} onClick={onCancel}>Cancel</button>
        <button style={{ ...styles.btnPrimary, opacity: (!form.merchant || !form.amount) ? 0.5 : 1 }}
          onClick={handleSave} disabled={!form.merchant || !form.amount}>
          <Check size={15} /> Save Expense
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' },
  dropZone: {
    border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    cursor: 'pointer', transition: 'border-color .2s'
  },
  dropLabel: { margin: 0, fontWeight: 600, color: 'var(--text-h)' },
  dropSub: { margin: 0, fontSize: 12, color: 'var(--text)' },
  thumbLg: { width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8 },
  thumbSm: { width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 },
  headerRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  errMsg: { margin: '4px 0 0', fontSize: 12, color: '#ef4444' },
  validList: { margin: '4px 0 0', padding: '0 0 0 16px', fontSize: 12, color: '#f59e0b' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  input: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text-h)', fontSize: 14, outline: 'none'
  },
  lineItems: { display: 'flex', flexDirection: 'column', gap: 8 },
  liTitle: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  liRow: { display: 'flex', gap: 8, alignItems: 'center' },
  liDel: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text)' },
  addLine: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, padding: 0, textAlign: 'left' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },
  btnGhost: {
    padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text)'
  },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
  }
};
