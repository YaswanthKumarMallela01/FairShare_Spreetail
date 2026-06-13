import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { groupsAPI } from '../services/api';
import GlassCard from '../components/GlassCard';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  
  // New Group Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Join Group State
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchGroups = async () => {
    try {
      const response = await groupsAPI.list();
      setGroups(response.data.results || response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name) {
      setFormError('Group name is required.');
      return;
    }
    setCreating(true);
    setFormError('');

    try {
      const res = await groupsAPI.create({ name, description });
      setName('');
      setDescription('');
      setModalOpen(false);
      fetchGroups();
      
      // Auto redirect to new group
      if (res.data && res.data.id) {
        navigate(`/group/${res.data.id}`);
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!inviteCode) {
      setJoinError('Invite code is required.');
      return;
    }
    setJoining(true);
    setJoinError('');

    try {
      const res = await groupsAPI.join(inviteCode);
      setInviteCode('');
      setJoinModalOpen(false);
      navigate(`/group/${res.data.group_id}`);
    } catch (err) {
      console.error(err);
      setJoinError(err.response?.data?.detail || 'Failed to join group. Check the invite code.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  const user = JSON.parse(localStorage.getItem('fairshare_user') || '{}');

  const copyToClipboard = (text, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    alert(`Invite code "${text}" copied to clipboard!`);
  };

  const MemberAvatarStack = ({ memberships }) => {
    const displayLimit = 4;
    const list = memberships || [];
    const excess = list.length - displayLimit;
    
    const getInitials = (name) => {
      if (!name) return '?';
      return name.substring(0, 2).toUpperCase();
    };

    const colors = [
      'linear-gradient(135deg, #7c3aed, #ec4899)',
      'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {list.slice(0, displayLimit).map((m, idx) => (
          <div
            key={m.id || idx}
            title={m.username}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: colors[idx % colors.length],
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '2px solid #0a0a1a',
              marginLeft: idx === 0 ? 0 : '-8px',
              zIndex: displayLimit - idx,
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            {getInitials(m.username)}
          </div>
        ))}
        {excess > 0 && (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid #0a0a1a',
              marginLeft: '-8px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700,
              zIndex: 0,
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            +{excess}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  const isRecruiter = user.username === 'RecruiterDemo';

  return (
    <div className="page-container">
      {/* Hero Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '32px' }}
      >
        <GlassCard padding="32px" hover={false} style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(6, 182, 212, 0.05))',
          borderColor: 'rgba(124, 58, 237, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {isRecruiter ? 'Recruiter Preview Active' : 'Dashboard'}
              </span>
              <h1 style={{ marginTop: '12px', fontSize: '2.2rem', fontWeight: 800 }}>
                Welcome back, <span style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user.username}</span>! ✨
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1rem', maxWidth: '600px' }}>
                {isRecruiter 
                  ? 'We have pre-seeded your account with 6 distinct groups representing roommate scenarios, road trips, and workspaces to help you test the balance engine and AI advice immediately.' 
                  : 'Manage split bills, analyze formatting anomalies, view temporal playback timelines, and consult your Gemini AI roommate.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                id="join-group-btn" 
                className="btn btn-ghost"
                onClick={() => setJoinModalOpen(true)}
                style={{ padding: '12px 20px' }}
              >
                🔑 Join with Code
              </button>
              <button 
                id="create-group-btn" 
                className="btn btn-primary"
                onClick={() => setModalOpen(true)}
                style={{ padding: '12px 20px' }}
              >
                ➕ Create Group
              </button>
            </div>
          </div>

          <div className="divider" style={{ margin: '24px 0 20px 0' }} />

          {/* Quick Stats Grid */}
          <div className="grid grid-3" style={{ gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>📁</span>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{groups.length} Groups</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active expense boards</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🤖</span>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Gemini 3.1 AI</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active roommate insights</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🕵️</span>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Triage Active</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>20+ CSV anomaly checkers</div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px'
        }}>
          ⚠️ {error}
        </div>
      )}

      <h2 style={{ marginBottom: '20px', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
        Your Shared Expenses Workspace
      </h2>

      {groups.length === 0 ? (
        <GlassCard padding="64px 32px" style={{ textAlign: 'center' }} hover={false}>
          <div className="empty-state">
            <span className="empty-state-icon" style={{ fontSize: '4rem' }}>👥</span>
            <h3 className="empty-state-title">No Groups Yet</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px auto' }}>
              Create a group and invite your friends, or enter an invite code to join an existing group.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setJoinModalOpen(true)}>
                Join a Group
              </button>
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                Create a Group
              </button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-2">
          {groups.map((group, index) => (
            <Link key={group.id} to={`/group/${group.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <GlassCard 
                delay={index * 0.04} 
                glow={true} 
                glowColor={index % 2 === 0 ? 'var(--accent-violet)' : 'var(--accent-cyan)'}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px 28px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      📂 {group.name}
                    </h3>
                    
                    {/* Invite Code Badge with copy capability */}
                    <button 
                      onClick={(e) => copyToClipboard(group.invite_code, e)}
                      title="Click to copy invite code"
                      style={{
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        color: 'var(--accent-cyan)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.25)';
                      }}
                    >
                      🔑 {group.invite_code}
                    </button>
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px', minHeight: '40px' }}>
                    {group.description || 'No description provided.'}
                  </p>
                </div>
                
                <div>
                  <div className="divider" style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Collaborator stack */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MemberAvatarStack memberships={group.memberships} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {group.memberships?.length || 0} active
                      </span>
                    </div>
                    
                    <span 
                      style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 700, 
                        color: 'var(--accent-violet)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Open Board ➔
                    </span>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title="Create New Group"
        id="create-group-modal"
      >
        {formError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            ⚠️ {formError}
          </div>
        )}
        <form onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label className="form-label" htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              type="text"
              className="input-field"
              placeholder="e.g. Flat 304, Goa Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label" htmlFor="group-desc">Description</label>
            <textarea
              id="group-desc"
              className="input-field"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              rows={3}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              type="button" 
              className="btn btn-ghost" 
              onClick={() => setModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join Group Modal */}
      <Modal 
        isOpen={joinModalOpen} 
        onClose={() => setJoinModalOpen(false)} 
        title="Join Group via Invite Code"
        id="join-group-modal"
      >
        {joinError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            ⚠️ {joinError}
          </div>
        )}
        <form onSubmit={handleJoinGroup}>
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label" htmlFor="invite-code">6-Character Invite Code</label>
            <input
              id="invite-code"
              type="text"
              className="input-field"
              placeholder="e.g. AB12XY"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              disabled={joining}
              maxLength={12}
              style={{ letterSpacing: '2px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              type="button" 
              className="btn btn-ghost" 
              onClick={() => setJoinModalOpen(false)}
              disabled={joining}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={joining}
            >
              {joining ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
