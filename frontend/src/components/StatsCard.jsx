import { motion } from 'framer-motion';

export default function StatsCard({ icon, value, label, gradient = 'var(--gradient-primary)', delay = 0, id }) {
  return (
    <motion.div
      id={id}
      className="glass-card"
      style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-md)',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
}
