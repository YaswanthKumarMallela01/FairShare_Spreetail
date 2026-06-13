import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { authAPI } from './services/api';

// Pages (defined inline or imported — we'll create separate page files shortly)
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';

function ProtectedLayout({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('fairshare_user');
    const token = localStorage.getItem('fairshare_token');
    if (!token) {
      navigate('/login');
    } else if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('fairshare_token');
    localStorage.removeItem('fairshare_user');
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    // split by uppercase letters or space/underscore
    const parts = name.split(/(?=[A-Z])|[\s_-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().substring(0, 2);
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="glass-card" style={{
        margin: '16px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-md)',
        backdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        position: 'sticky',
        top: '16px',
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(10, 10, 26, 0.5), 0 0 15px rgba(124, 58, 237, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/" style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              color: 'white',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
            }}>
              ⚡
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800
            }}>
              FairShare
            </span>
          </Link>
        </div>
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                color: 'white',
                boxShadow: '0 0 12px rgba(124, 58, 237, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                position: 'relative'
              }}>
                {getInitials(user.username)}
                <span style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '0px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '1.5px solid #0a0a1a',
                  boxShadow: '0 0 8px #10b981'
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>Logged in as</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.username}</span>
              </div>
            </div>
            
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.04)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: '0 16px 40px 16px' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route 
          path="/" 
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          } 
        />
        
        <Route 
          path="/group/:id" 
          element={
            <ProtectedLayout>
              <GroupDetail />
            </ProtectedLayout>
          } 
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
