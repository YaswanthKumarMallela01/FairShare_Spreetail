import { motion } from 'framer-motion';

const SEVERITY_MAP = {
  FATAL: { emoji: '💀', label: 'FATAL', cls: 'badge-fatal' },
  CRITICAL: { emoji: '🚨', label: 'CRITICAL', cls: 'badge-critical' },
  WARNING: { emoji: '⚠️', label: 'WARNING', cls: 'badge-warning' },
  AUTO_FIXED: { emoji: '🔧', label: 'AUTO_FIXED', cls: 'badge-auto-fixed' },
  INFO: { emoji: '💡', label: 'INFO', cls: 'badge-info' },
};

export default function AnomalyCard({
  anomaly,
  delay = 0,
  onApprove,
  onEdit,
  onDiscard,
  id,
}) {
  const {
    severity = 'INFO',
    row_number,
    original_data,
    description = '',
    action_taken = '',
    needs_review = false,
  } = anomaly;

  const sev = SEVERITY_MAP[severity] || SEVERITY_MAP.INFO;

  return (
    <motion.div
      id={id}
      className="glass-card"
      style={{ padding: 20, borderLeft: '3px solid' }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ x: 4 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`badge ${sev.cls}`}>
            {sev.emoji} {sev.label}
          </span>
          {row_number != null && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Row #{row_number}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: 12, lineHeight: 1.5 }}>
        {description}
      </p>

      {original_data && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--glass-border)',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            overflowX: 'auto',
          }}
        >
          {typeof original_data === 'string' ? original_data : JSON.stringify(original_data, null, 2)}
        </div>
      )}

      {action_taken && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
          <strong>Action:</strong> {action_taken}
        </p>
      )}

      {needs_review && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {onApprove && (
            <button id={id ? `${id}-approve` : undefined} className="btn btn-success btn-sm" onClick={onApprove}>
              ✓ Approve
            </button>
          )}
          {onEdit && (
            <button id={id ? `${id}-edit` : undefined} className="btn btn-ghost btn-sm" onClick={onEdit}>
              ✎ Edit
            </button>
          )}
          {onDiscard && (
            <button id={id ? `${id}-discard` : undefined} className="btn btn-danger btn-sm" onClick={onDiscard}>
              ✕ Discard
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
