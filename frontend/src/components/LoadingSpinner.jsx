import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 40, label = 'Loading...', id }) {
  return (
    <div
      id={id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
      }}
    >
      <motion.div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: 'var(--accent-violet)',
          borderRightColor: 'var(--accent-cyan)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {label && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: 500,
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
