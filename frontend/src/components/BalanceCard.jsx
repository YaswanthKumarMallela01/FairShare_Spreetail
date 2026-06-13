import MemberAvatar from './MemberAvatar';

export default function BalanceCard({ member, balance, currency = '₹', id }) {
  const isPositive = balance > 0;
  const isZero = balance === 0;
  const absBalance = Math.abs(balance).toFixed(2);

  return (
    <div
      id={id}
      className="glass-card"
      style={{
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: `3px solid ${isZero ? 'var(--text-muted)' : isPositive ? 'var(--accent-green)' : 'var(--accent-red)'}`,
      }}
    >
      <MemberAvatar name={member} size={36} showName />
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: isZero
              ? 'var(--text-muted)'
              : isPositive
              ? 'var(--accent-green)'
              : 'var(--accent-red)',
          }}
        >
          {isZero ? 'Settled' : `${isPositive ? '+' : '-'}${currency}${absBalance}`}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {isZero ? 'No dues' : isPositive ? 'is owed' : 'owes'}
        </div>
      </div>
    </div>
  );
}
