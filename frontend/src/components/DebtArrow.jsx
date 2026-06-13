import MemberAvatar from './MemberAvatar';

export default function DebtArrow({ from, to, amount, currency = '₹', id }) {
  return (
    <div
      id={id}
      className="glass-card"
      style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <MemberAvatar name={from} size={32} showName />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          justifyContent: 'center',
          minWidth: 120,
        }}
      >
        <div
          style={{
            height: 2,
            flex: 1,
            maxWidth: 60,
            background: 'linear-gradient(90deg, var(--accent-red), var(--accent-orange))',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(249, 115, 22, 0.15)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            color: 'var(--accent-orange)',
            fontWeight: 700,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          {currency}{Math.abs(amount).toFixed(2)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div
            style={{
              height: 2,
              width: 30,
              background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-green))',
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderLeft: '8px solid var(--accent-green)',
            }}
          />
        </div>
      </div>
      <MemberAvatar name={to} size={32} showName />
    </div>
  );
}
