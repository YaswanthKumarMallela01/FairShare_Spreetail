import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import GlassCard from '../components/GlassCard';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Password Reset Flow States
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'otp' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await authAPI.login({ username, password });
      localStorage.setItem('fairshare_token', response.data.token);
      localStorage.setItem('fairshare_user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        err.response?.data?.non_field_errors?.[0] || 
        'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await authAPI.demoLogin();
      localStorage.setItem('fairshare_token', response.data.token);
      localStorage.setItem('fairshare_user', JSON.stringify(response.data.user));
      
      // Navigate to dashboard to see all 5-6 seeded groups!
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to launch Demo Mode. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await authAPI.forgotPassword({ email });
      setSuccessMessage('OTP code sent successfully to your email.');
      setMode('otp');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to send OTP. Please check the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await authAPI.verifyOTP({ email, otp });
      setSuccessMessage('OTP verified successfully! Please choose a new password.');
      setMode('reset');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.resetPassword({ email, otp, new_password: newPassword });
      setSuccessMessage('Your password has been reset successfully! You can now sign in.');
      setMode('login');
      setUsername('');
      setPassword('');
      setEmail('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to reset password. Please request a new OTP.');
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
            background: 'var(--gradient-primary)',
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
          }}>
            Spreetail Intern Assignment
          </span>
          <h1 style={{
            fontSize: '3.2rem',
            fontWeight: 900,
            lineHeight: 1.15,
            background: 'var(--gradient-primary)',
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
          style={{ width: '100%', maxWidth: '440px' }}
        >
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Sign In
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Log in to manage your flat sharing.
              </p>
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Forgot Password
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Receive a 6-digit OTP code to reset your password.
              </p>
            </div>
          )}

          {mode === 'otp' && (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Verify OTP
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Enter the 6-digit verification code sent to your email.
              </p>
            </div>
          )}

          {mode === 'reset' && (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Reset Password
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                Enter a strong new password for your account.
              </p>
            </div>
          )}

          {successMessage && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              color: '#34d399',
              fontSize: '0.9rem',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              ✨ {successMessage}
            </div>
          )}

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

          {/* Render forms dynamically based on Mode */}
          {mode === 'login' && (
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
                  disabled={loading || demoLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 500,
                      textDecoration: 'underline'
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || demoLoading}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || demoLoading}
                style={{ height: '48px', marginBottom: '16px', marginTop: '16px' }}
              >
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPasswordSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  placeholder="e.g. aicertificatemanagement@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ height: '48px', marginBottom: '16px' }}
              >
                {loading ? 'Sending OTP...' : 'Send OTP Code'}
              </button>

              <button
                type="button"
                className="btn w-full"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMessage('');
                }}
                disabled={loading}
                style={{
                  height: '48px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)'
                }}
              >
                Back to Sign In
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOTPSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="otp">One-Time Password (OTP)</label>
                <input
                  id="otp"
                  type="text"
                  className="input-field"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={loading}
                  maxLength={6}
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ height: '48px', marginBottom: '16px' }}
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn w-full"
                  onClick={handleForgotPasswordSubmit}
                  disabled={loading}
                  style={{
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  className="btn w-full"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setSuccessMessage('');
                  }}
                  disabled={loading}
                  style={{
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPassword"
                    type={showResetPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    {showResetPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmPassword"
                    type={showResetPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    {showResetPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ height: '48px', marginBottom: '16px' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <button
                type="button"
                className="btn w-full"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMessage('');
                }}
                disabled={loading}
                style={{
                  height: '48px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)'
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {/* Quick Demo Mode Login Button (only show on login screen) */}
          {mode === 'login' && (
            <>
              <div style={{ position: 'relative', margin: '24px 0 16px 0', textAlign: 'center' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'var(--glass-border)',
                  zIndex: 0
                }} />
                <span style={{
                  position: 'relative',
                  background: '#13132c',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  zIndex: 1,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.05em'
                }}>
                  Recruiter Preview
                </span>
              </div>

              <button
                type="button"
                className="btn w-full"
                onClick={handleDemoLogin}
                disabled={loading || demoLoading}
                style={{
                  height: '48px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.7)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.1)';
                }}
              >
                {demoLoading ? 'Seeding Demo Data...' : '⚡ Quick Demo Mode'}
              </button>

              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Don't have an account? </span>
                <Link to="/register" style={{ fontWeight: 600 }}>Create account</Link>
              </div>
            </>
          )}
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
