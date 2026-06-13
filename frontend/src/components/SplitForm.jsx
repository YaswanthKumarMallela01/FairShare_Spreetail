import { useState, useEffect } from 'react';

export default function SplitForm({
  splitType,
  members = [],
  totalAmount = 0,
  value = [],
  onChange,
  id,
}) {
  const [splits, setSplits] = useState([]);

  useEffect(() => {
    if (!members.length) return;
    if (value && value.length) {
      setSplits(value);
      return;
    }
    // Initialize default splits
    const defaults = members.map((m) => ({
      user: m.id || m.user_id || m.username,
      username: m.username || m.name,
      amount: splitType === 'equal' ? (totalAmount / members.length).toFixed(2) : '',
      percentage: splitType === 'percentage' ? (100 / members.length).toFixed(1) : '',
      shares: splitType === 'share' ? 1 : '',
      included: true,
    }));
    setSplits(defaults);
    if (onChange) onChange(defaults);
  }, [members.length, splitType]);

  const handleChange = (index, field, val) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: val };

    // Recalculate amounts for equal type
    if (splitType === 'equal') {
      const includedCount = updated.filter((s) => s.included).length || 1;
      updated.forEach((s) => {
        s.amount = s.included ? (totalAmount / includedCount).toFixed(2) : '0.00';
      });
    }

    // Recalculate amounts for percentage type
    if (splitType === 'percentage') {
      updated.forEach((s) => {
        const pct = parseFloat(s.percentage) || 0;
        s.amount = ((pct / 100) * totalAmount).toFixed(2);
      });
    }

    // Recalculate amounts for share type
    if (splitType === 'share') {
      const totalShares = updated.reduce((sum, s) => sum + (parseFloat(s.shares) || 0), 0) || 1;
      updated.forEach((s) => {
        const sh = parseFloat(s.shares) || 0;
        s.amount = ((sh / totalShares) * totalAmount).toFixed(2);
      });
    }

    setSplits(updated);
    if (onChange) onChange(updated);
  };

  if (splitType === 'equal') {
    return (
      <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="form-label">Split equally among:</label>
        {splits.map((split, i) => (
          <div
            key={split.user}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
              <input
                type="checkbox"
                checked={split.included}
                onChange={(e) => handleChange(i, 'included', e.target.checked)}
                style={{ accentColor: 'var(--accent-violet)', width: 18, height: 18 }}
                id={`split-check-${i}`}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{split.username}</span>
            </label>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              ₹{split.amount}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (splitType === 'unequal') {
    return (
      <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="form-label">Enter exact amounts:</label>
        {splits.map((split, i) => (
          <div key={split.user} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minWidth: 100 }}>
              {split.username}
            </span>
            <input
              id={`split-amount-${i}`}
              type="number"
              className="input-field"
              placeholder="0.00"
              value={split.amount}
              onChange={(e) => handleChange(i, 'amount', e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        ))}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Total: ₹{splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0).toFixed(2)} / ₹{totalAmount.toFixed(2)}
        </div>
      </div>
    );
  }

  if (splitType === 'percentage') {
    return (
      <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="form-label">Enter percentages:</label>
        {splits.map((split, i) => (
          <div key={split.user} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minWidth: 100 }}>
              {split.username}
            </span>
            <input
              id={`split-pct-${i}`}
              type="number"
              className="input-field"
              placeholder="0"
              value={split.percentage}
              onChange={(e) => handleChange(i, 'percentage', e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: 60, textAlign: 'right' }}>
              ₹{split.amount}
            </span>
          </div>
        ))}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Total: {splits.reduce((s, sp) => s + (parseFloat(sp.percentage) || 0), 0).toFixed(1)}%
        </div>
      </div>
    );
  }

  if (splitType === 'share') {
    return (
      <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="form-label">Enter shares:</label>
        {splits.map((split, i) => (
          <div key={split.user} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minWidth: 100 }}>
              {split.username}
            </span>
            <input
              id={`split-share-${i}`}
              type="number"
              className="input-field"
              placeholder="1"
              value={split.shares}
              onChange={(e) => handleChange(i, 'shares', e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>shares</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: 60, textAlign: 'right' }}>
              ₹{split.amount}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
