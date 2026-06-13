import { motion } from 'framer-motion';
import MemberAvatar from './MemberAvatar';

export default function ExpenseItem({ expense, delay = 0, onClick, id }) {
  const {
    description = 'Untitled',
    amount = 0,
    currency = 'INR',
    date,
    paid_by_name,
    paid_by_username,
    split_type = 'equal',
    participants = [],
  } = expense;

  const currencySymbol = currency === 'USD' ? '$' : '₹';
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const splitLabels = {
    equal: 'Equal',
    unequal: 'Unequal',
    percentage: 'Percentage',
    share: 'By Shares',
  };

  return (
    <motion.div
      id={id}
      className="glass-card"
      style={{ padding: '16px 20px', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ x: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>{description}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {formattedDate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formattedDate}</span>
            )}
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--accent-violet)',
                fontWeight: 600,
              }}
            >
              {splitLabels[split_type] || split_type}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <MemberAvatar name={paid_by_name || paid_by_username || 'Unknown'} size={22} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              paid by <strong>{paid_by_name || paid_by_username || 'Unknown'}</strong>
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              background: 'var(--gradient-accent)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {currencySymbol}{parseFloat(amount).toFixed(2)}
          </div>
          {participants.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
