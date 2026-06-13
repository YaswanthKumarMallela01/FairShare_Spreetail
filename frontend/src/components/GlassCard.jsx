import { motion, AnimatePresence } from 'framer-motion';

export default function GlassCard({
  children,
  className = '',
  padding = '24px',
  hover = true,
  glow = false,
  glowColor = 'var(--accent-violet)',
  delay = 0,
  onClick,
  id,
  style = {},
}) {
  return (
    <motion.div
      id={id}
      className={`glass-card ${className}`}
      onClick={onClick}
      style={{
        padding,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        ...style,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={
        hover
          ? {
              y: -4,
              boxShadow: glow
                ? `0 12px 40px rgba(0,0,0,0.4), 0 0 30px ${glowColor}33`
                : '0 12px 40px rgba(0,0,0,0.4)',
            }
          : {}
      }
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: -1,
            borderRadius: 'inherit',
            background: `linear-gradient(135deg, ${glowColor}33, transparent 50%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </motion.div>
  );
}
