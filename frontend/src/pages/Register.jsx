import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.register({ username, email, password });
      localStorage.setItem('fairshare_token', response.data.token);
      localStorage.setItem('fairshare_user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      let errMsg = 'Registration failed.';
      if (data) {
        if (typeof data === 'string') {
          errMsg = data;
        } else {
          errMsg = Object.values(data).flat().join(' ');
        }
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: '🤖', title: 'Gemini 3.1 AI Roommate', desc: 'Get analytical financial insights and witty advice about roommate habits.' },
    { icon: '🕸️', title: 'Interactive Debt Graph', desc: 'Trace transactional flows visually with physics-based glowing SVG arrows.' },
    { icon: '🕵️', title: '20+ Anomaly Checks', desc: 'Auto-detect formatting issues, duplicates, and departed members from CSVs.' },
    { icon: '⚡', title: 'Simple Token Auth', desc: 'Secure session management with one-click settle up options.' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'window.innerWidth > 768 ? "1.1fr 1fr" : "1fr"',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative'
    }} className="auth-grid-layout">
      
      {/* Left Column: Product Showcase */}
      <motion.div 
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '24px',
        }}
        className="auth-showcase"
      >
        <div>
          <span style={{
            background: 'var(--gradient-accent)',
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.2)'
          }}>
            Spreetail Intern Assignment
          </span>
          <h1 style={{
            fontSize: '3.2rem',
            fontWeight: 900,
            lineHeight: 1.15,
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginTop: '16px',
            marginBottom: '12px'
          }}>
            FairShare
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1.15rem',
            lineHeight: 1.6,
            maxWidth: '480px'
          }}>
            Split expenses beautifully. Ingest messy spreadsheet exports, check for anomalies, simplify debts, and collaborate with your roommates.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0
              }}>
                {f.icon}
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{f.title}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', lineHeight: 1.4 }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Right Column: Glassmorphic Auth Card */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        style={{ display: 'flex', justifyContent: 'center' }}
      >
        <GlassCard 
          padding="40px" 
          glow={true} 
          glowColor="var(--accent-pink)"
          style={{ width: '100%', maxWidth: '440px' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Create Account
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Sign up to start tracking shared bills.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              color: '#f87171',
              fontSize: '0.9rem',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="e.g. rohan"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="e.g. rohan@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-accent w-full"
              disabled={loading}
              style={{ height: '48px' }}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
            <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </div>
        </GlassCard>
      </motion.div>

      {/* Responsive layout styles */}
      <style>{`
        .auth-grid-layout {
          grid-template-columns: 1.1fr 1fr;
        }
        @media (max-width: 768px) {
          .auth-grid-layout {
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 24px;
          }
          .auth-showcase {
            text-align: center;
            align-items: center;
          }
          .auth-showcase p {
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
