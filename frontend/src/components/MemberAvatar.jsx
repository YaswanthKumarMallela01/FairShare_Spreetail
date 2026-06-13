import { useMemo } from 'react';

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const GRADIENT_PAIRS = [
  ['#7c3aed', '#06b6d4'],
  ['#ec4899', '#f97316'],
  ['#10b981', '#06b6d4'],
  ['#ef4444', '#ec4899'],
  ['#7c3aed', '#ec4899'],
  ['#06b6d4', '#10b981'],
  ['#f97316', '#ef4444'],
  ['#8b5cf6', '#06b6d4'],
  ['#14b8a6', '#7c3aed'],
  ['#f43f5e', '#f97316'],
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MemberAvatar({ name, size = 40, fontSize, showName = false, id }) {
  const gradientPair = useMemo(() => {
    const index = hashString(name || '') % GRADIENT_PAIRS.length;
    return GRADIENT_PAIRS[index];
  }, [name]);

  const initials = getInitials(name);
  const computedFontSize = fontSize || size * 0.4;

  return (
    <div
      id={id}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      title={name}
    >
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${gradientPair[0]}, ${gradientPair[1]})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: computedFontSize,
          fontWeight: 700,
          color: 'white',
          boxShadow: `0 4px 15px ${gradientPair[0]}44`,
          border: '2px solid rgba(255,255,255,0.15)',
          letterSpacing: '0.5px',
          userSelect: 'none',
        }}
      >
        {initials}
      </div>
      {showName && (
        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
          {name}
        </span>
      )}
    </div>
  );
}
