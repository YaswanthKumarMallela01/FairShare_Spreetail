import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  groupsAPI,
  expensesAPI,
  settlementsAPI,
  balancesAPI,
  importAPI,
  reportsAPI,
} from '../services/api';
import GlassCard from '../components/GlassCard';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import StatsCard from '../components/StatsCard';
import BalanceCard from '../components/BalanceCard';
import DebtArrow from '../components/DebtArrow';
import ExpenseItem from '../components/ExpenseItem';
import SplitForm from '../components/SplitForm';
import AnomalyCard from '../components/AnomalyCard';
import MemberAvatar from '../components/MemberAvatar';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
} from 'recharts';

// Markdown Helpers
const parseInline = (text) => {
  if (!text) return "";
  // Split by bold symbols (**bold**)
  const boldParts = text.split(/\*\*([^*]+)\*\*/g);
  return boldParts.flatMap((part, bIdx) => {
    if (bIdx % 2 === 1) {
      return [<strong key={`b-${bIdx}`} style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{part}</strong>];
    }
    // Split by inline code (code)
    const codeParts = part.split(/`([^`]+)`/g);
    return codeParts.flatMap((cPart, cIdx) => {
      if (cIdx % 2 === 1) {
        return [<code key={`c-${bIdx}-${cIdx}`} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.85em' }}>{cPart}</code>];
      }
      // Highlight @mentions (e.g. @Alex)
      const mentionParts = cPart.split(/(@[a-zA-Z0-9_]+)/g);
      return mentionParts.map((mPart, mIdx) => {
        if (mIdx % 2 === 1) {
          return <span key={`m-${bIdx}-${cIdx}-${mIdx}`} style={{ color: 'var(--accent-cyan)', fontWeight: 600, background: 'rgba(6, 182, 212, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>{mPart}</span>;
        }
        return mPart;
      });
    });
  });
};

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key}`} style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'disc' }}>
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Horizontal Rule
    if (trimmed === '***' || trimmed === '---' || trimmed === '___') {
      flushList(index);
      elements.push(
        <hr 
          key={index} 
          style={{ 
            border: 'none', 
            borderTop: '1px solid var(--glass-border)', 
            margin: '16px 0',
            opacity: 0.5 
          }} 
        />
      );
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList(index);
      elements.push(
        <h4 
          key={index} 
          style={{ 
            margin: '16px 0 8px 0', 
            fontSize: '1.1rem', 
            fontWeight: 700, 
            color: 'white',
            letterSpacing: '0.5px'
          }}
        >
          {parseInline(trimmed.substring(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList(index);
      elements.push(
        <h3 
          key={index} 
          style={{ 
            margin: '20px 0 10px 0', 
            fontSize: '1.25rem', 
            fontWeight: 700, 
            color: 'white' 
          }}
        >
          {parseInline(trimmed.substring(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList(index);
      elements.push(
        <h2 
          key={index} 
          style={{ 
            margin: '24px 0 12px 0', 
            fontSize: '1.4rem', 
            fontWeight: 800, 
            color: 'white' 
          }}
        >
          {parseInline(trimmed.substring(2))}
        </h2>
      );
      return;
    }

    // List Items
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const bulletText = trimmed.substring(2);
      currentList.push(
        <li key={`li-${index}`} style={{ margin: '6px 0', color: 'var(--text-primary)' }}>
          {parseInline(bulletText)}
        </li>
      );
      return;
    }

    // Empty Line
    if (trimmed === '') {
      flushList(index);
      elements.push(<div key={`empty-${index}`} style={{ height: '8px' }} />);
      return;
    }

    // Regular line / Paragraph
    flushList(index);
    elements.push(
      <p key={index} style={{ margin: '8px 0', lineHeight: '1.6' }}>
        {parseInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
};

export default function GroupDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('expenses');
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState(null);
  const [detailedBalances, setDetailedBalances] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [importReports, setImportReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  
  // Form States
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    paid_by: '',
    split_type: 'equal',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    split_data: [],
  });
  const [settlementForm, setSettlementForm] = useState({
    paid_by: '',
    paid_to: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [newMemberUsername, setNewMemberUsername] = useState('');
  
  // Actions states
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [reminding, setReminding] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('fairshare_user') || '{}');

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete this group? This will permanently delete all expenses, settlements, and reports.')) return;
    setSubmitting(true);
    try {
      await groupsAPI.delete(id);
      alert('Group deleted successfully.');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to delete group.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!window.confirm('Do you want to request to leave this group? This requires admin approval.')) return;
    setSubmitting(true);
    try {
      await groupsAPI.requestLeave(id);
      alert('Leave request submitted successfully. Waiting for admin approval.');
      loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to request leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLeave = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to approve ${username}'s request to leave the group?`)) return;
    setSubmitting(true);
    try {
      await groupsAPI.approveLeave(id, userId);
      alert(`${username} has left the group.`);
      loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to approve leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectLeave = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to reject ${username}'s request to leave the group?`)) return;
    setSubmitting(true);
    try {
      await groupsAPI.rejectLeave(id, userId);
      alert(`Leave request rejected for ${username}.`);
      loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to reject leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminders = async () => {
    setReminding(true);
    try {
      const res = await groupsAPI.sendReminders(id);
      alert(res.data.detail);
    } catch (err) {
      console.error(err);
      alert('Error: ' + (err.response?.data?.detail || 'Failed to send reminders.'));
    } finally {
      setReminding(false);
    }
  };

  // AI Roommate Advisor states
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: "👋 Hello! I am your Gemini-powered FairShare AI Roommate. Click '📊 Generate Report' to get a quick summary of this group's spending, or type any questions below about your bills, who owes who, or roommate habits!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Spend insights categories
  const getCategory = (desc) => {
    const d = desc.toLowerCase();
    if (d.includes('food') || d.includes('dinner') || d.includes('lunch') || d.includes('restaurant') || d.includes('pizza') || d.includes('cafe')) return 'Food & Drinks';
    if (d.includes('uber') || d.includes('cab') || d.includes('flight') || d.includes('petrol') || d.includes('train') || d.includes('travel')) return 'Travel';
    if (d.includes('rent') || d.includes('stay') || d.includes('hotel') || d.includes('airbnb')) return 'Rent & Stay';
    if (d.includes('electricity') || d.includes('wifi') || d.includes('bill') || d.includes('water') || d.includes('laundry')) return 'Utilities';
    if (d.includes('movie') || d.includes('show') || d.includes('game') || d.includes('party')) return 'Entertainment';
    return 'Miscellaneous';
  };

  const loadData = async () => {
    try {
      const groupRes = await groupsAPI.detail(id);
      setGroup(groupRes.data);

      const expRes = await expensesAPI.list(id);
      setExpenses(expRes.data.results || expRes.data);

      const setRes = await settlementsAPI.list(id);
      setSettlements(setRes.data.results || setRes.data);

      const balRes = await balancesAPI.getSummary(id);
      setBalances(balRes.data);

      const detRes = await balancesAPI.getDetailed(id);
      setDetailedBalances(detRes.data);

      try {
        const timeRes = await balancesAPI.getTimeline(id);
        setTimeline(timeRes.data.snapshots || timeRes.data);
      } catch (err) {
        console.error('Timeline not available yet:', err);
      }

      const repRes = await reportsAPI.list(id);
      setImportReports(repRes.data.results || repRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (timeline && timeline.length > 0) {
      setTimelineIndex(timeline.length - 1);
    }
  }, [timeline]);

  const handleChatSubmit = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    const queryText = customQuery || chatInput;
    if (!queryText.trim()) return;

    const userMsg = { sender: 'user', text: queryText };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setAiLoading(true);
    setAiError('');

    try {
      const res = await groupsAPI.getAIAssistance(id, {
        messages: chatMessages,
        question: queryText
      });
      const aiMsg = { sender: 'ai', text: res.data.advice };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setAiError(err.response?.data?.detail || 'Failed to fetch AI roommate advice. Check network/API keys.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateReport = () => {
    handleChatSubmit(null, "Provide a short, engaging financial analysis of this group. Include a Financial Health Check, spend patterns, and settlement advice.");
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.paid_by) {
      alert('Please fill in required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const amountDec = parseFloat(expenseForm.amount);
      const splitPayload = expenseForm.split_data.map(sd => ({
        user_id: sd.user,
        amount_owed: parseFloat(sd.amount)
      }));

      await expensesAPI.create(id, {
        description: expenseForm.description,
        amount: amountDec,
        original_amount: amountDec,
        original_currency: expenseForm.currency,
        exchange_rate: 1.0,
        paid_by: expenseForm.paid_by,
        split_type: expenseForm.split_type,
        notes: expenseForm.notes,
        date: expenseForm.date,
        split_data: splitPayload
      });

      setExpenseForm({
        description: '',
        amount: '',
        currency: 'INR',
        paid_by: '',
        split_type: 'equal',
        notes: '',
        date: new Date().toISOString().split('T')[0],
        split_data: [],
      });
      setExpenseModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error creating expense: ' + (err.response?.data?.detail || 'Validation failed. Check split values.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    if (!settlementForm.paid_by || !settlementForm.paid_to || !settlementForm.amount) {
      alert('Please fill in required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await settlementsAPI.create(id, {
        paid_by: settlementForm.paid_by,
        paid_to: settlementForm.paid_to,
        amount: parseFloat(settlementForm.amount),
        date: settlementForm.date,
        notes: settlementForm.notes,
      });
      setSettlementForm({
        paid_by: '',
        paid_to: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setSettlementModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error recording settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberUsername) return;
    setSubmitting(true);
    try {
      // Create user and member mapping in backend
      await groupsAPI.addMember(id, { username: newMemberUsername });
      setNewMemberUsername('');
      setMemberModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to add member. Check username.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will seed Aisha, Rohan, Priya, Meera, Dev, and Sam into this group. Proceed?')) return;
    setSubmitting(true);
    try {
      const res = await groupsAPI.seed(id);
      alert(res.data.detail);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to seed flatmates.');
    } finally {
      setSubmitting(false);
    }
  };


  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setImportStatus('Uploading and analyzing CSV file...');
    try {
      const res = await importAPI.uploadCSV(id, formData);
      setImportStatus(`Success! Imported ${res.data.imported_count} rows, detected ${res.data.anomaly_count} anomalies.`);
      loadData();
      // Load reports
      const repRes = await reportsAPI.list(id);
      setImportReports(repRes.data.results || repRes.data);
      if (res.data.id) {
        const detailRes = await reportsAPI.detail(id, res.data.id);
        setSelectedReport(detailRes.data);
      }
    } catch (err) {
      console.error(err);
      setImportStatus('CSV Import failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Recharts Data Transformation
  const getCategoryData = () => {
    const map = {};
    expenses.forEach(e => {
      const cat = getCategory(e.description);
      map[cat] = (map[cat] || 0) + parseFloat(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  };

  const getLeaderboardData = () => {
    if (!balances) return [];
    return balances.member_balances.map(mb => ({
      name: mb.username,
      Paid: parseFloat(mb.total_paid),
      Owed: parseFloat(mb.total_owed),
      Net: parseFloat(mb.net_balance),
    })).sort((a, b) => b.Paid - a.Paid);
  };

  // SVG Graph Coordinate Generation
  const getGraphNodesAndEdges = () => {
    if (!balances || !group) return { nodes: [], edges: [] };
    const members = group.memberships || [];
    const debts = balances.simplified_debts || [];
    
    const nodes = members.map((m, i) => {
      const angle = (2 * Math.PI * i) / members.length;
      const radius = 165;
      const cx = 250 + radius * Math.cos(angle);
      const cy = 250 + radius * Math.sin(angle);
      return {
        id: m.user_id || m.id,
        name: m.username,
        x: cx,
        y: cy,
      };
    });

    const edges = debts.map((d, i) => {
      const sourceNode = nodes.find(n => n.name.toLowerCase() === d.from_username.toLowerCase());
      const targetNode = nodes.find(n => n.name.toLowerCase() === d.to_username.toLowerCase());
      return {
        id: `edge-${i}`,
        source: sourceNode,
        target: targetNode,
        amount: d.amount,
      };
    }).filter(e => e.source && e.target);

    return { nodes, edges };
  };

  if (loading || !group) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  const chartColors = ['#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f97316', '#ef4444'];
  const { nodes, edges } = getGraphNodesAndEdges();

  return (
    <div className="page-container">
      {/* Back to Dashboard Link */}
      <div style={{ marginBottom: '20px' }}>
        <Link 
          to="/" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-cyan)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <span>←</span> Back to Dashboard
        </Link>
      </div>

      {/* Group Header */}
      <GlassCard padding="24px 32px" hover={false} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <h1 className="page-title">{group.name}</h1>
              <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                Invite Code: <strong>{group.invite_code}</strong>
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{group.description || 'No description.'}</p>
            
            {(() => {
              const pendingRequests = group.memberships?.filter(m => m.pending_leave_request && m.is_active) || [];
              if (currentUser.id === group.created_by && pendingRequests.length > 0) {
                return (
                  <div style={{
                    marginTop: '16px',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: '600px'
                  }}>
                    <h4 style={{ color: '#fbbf24', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0' }}>
                      ⏳ Pending Leave Requests
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {pendingRequests.map(req => (
                        <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            <strong>{req.username}</strong> requested to leave the group.
                          </span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleApproveLeave(req.user_id, req.username)}
                              disabled={submitting}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#34d399',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '4px 10px'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRejectLeave(req.user_id, req.username)}
                              disabled={submitting}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '4px 10px'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {group.memberships?.map(m => (
                <MemberAvatar key={m.id} name={m.username} size={28} showName={true} />
              ))}
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}
                onClick={() => setMemberModalOpen(true)}
              >
                ➕ Add Member
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setSettlementModalOpen(true)}>🤝 Settle Up</button>
            <button className="btn btn-primary" onClick={() => setExpenseModalOpen(true)}>💸 Add Expense</button>
            {currentUser.id === group.created_by ? (
              <button 
                className="btn btn-ghost" 
                onClick={handleDeleteGroup}
                disabled={submitting}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                🗑️ Delete Group
              </button>
            ) : (
              (() => {
                const myMem = group.memberships?.find(m => m.user_id === currentUser.id);
                if (myMem?.pending_leave_request) {
                  return (
                    <button 
                      className="btn btn-ghost" 
                      disabled={true}
                      style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        cursor: 'not-allowed',
                        fontWeight: 600
                      }}
                    >
                      ⏳ Leave Requested
                    </button>
                  );
                }
                return (
                  <button 
                    className="btn btn-ghost" 
                    onClick={handleRequestLeave}
                    disabled={submitting}
                    style={{
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    🚪 Leave Group
                  </button>
                );
              })()
            )}
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>📝 Expenses</button>
        <button className={`tab-btn ${activeTab === 'settlements' ? 'active' : ''}`} onClick={() => setActiveTab('settlements')}>🤝 Settlements</button>
        <button className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>🕸️ Balances & Graph</button>
        <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>📊 Spending Insights</button>
        <button className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>🕵️ CSV Anomaly Detective</button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'expenses' && (
          <motion.div key="expenses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-2" style={{ marginBottom: 20 }}>
              <StatsCard icon="📈" value={`₹${expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)}`} label="Total Group Spend" />
              <StatsCard icon="💸" value={expenses.length} label="Expenses Logged" gradient="var(--gradient-accent)" />
            </div>

            {expenses.length === 0 ? (
              <GlassCard padding="48px" style={{ textAlign: 'center' }} hover={false}>
                <div className="empty-state">
                  <span className="empty-state-icon">📝</span>
                  <h4 className="empty-state-title">No Expenses Logged</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>Log your first expense or upload a CSV file under the Detective tab.</p>
                </div>
              </GlassCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {expenses.map((expense, idx) => (
                  <ExpenseItem 
                    key={expense.id} 
                    expense={{
                      ...expense,
                      paid_by_name: expense.paid_by_username,
                      participants: expense.splits
                    }} 
                    delay={idx * 0.03} 
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'settlements' && (
          <motion.div key="settlements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {settlements.length === 0 ? (
              <GlassCard padding="48px" style={{ textAlign: 'center' }} hover={false}>
                <div className="empty-state">
                  <span className="empty-state-icon">🤝</span>
                  <h4 className="empty-state-title">No Settlements Recorded</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>Record a settlement when one group member pays back another.</p>
                </div>
              </GlassCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {settlements.map((s, idx) => (
                  <GlassCard key={s.id} delay={idx * 0.03}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <MemberAvatar name={s.paid_by_username} size={32} />
                        <span style={{ fontSize: '0.95rem' }}>
                          <strong>{s.paid_by_username}</strong> settled with <strong>{s.paid_to_username}</strong>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="text-gradient-success" style={{ fontWeight: 800, fontSize: '1.15rem' }}>
                          ₹{parseFloat(s.amount).toFixed(2)}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.date}
                        </div>
                      </div>
                    </div>
                    {s.notes && (
                      <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        💬 {s.notes}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'balances' && (
          <motion.div key="balances" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-2" style={{ gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
              {/* Balances List */}
              <div>
                <h3 style={{ marginBottom: 16 }}>Individual Balances</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {balances?.member_balances.map(mb => (
                    <BalanceCard key={mb.user_id} member={mb.username} balance={parseFloat(mb.net_balance)} />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <h3 style={{ margin: 0 }}>Simplified Settlements</h3>
                  {currentUser.id === group.created_by && balances?.simplified_debts.length > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleSendReminders}
                      disabled={reminding}
                      style={{
                        background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        color: 'var(--accent-cyan)',
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: reminding ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      ✉️ {reminding ? 'Sending Reminders...' : 'Send Email Reminders'}
                    </button>
                  )}
                </div>
                {balances?.simplified_debts.length === 0 ? (
                  <GlassCard padding="20px" style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>🎉 Group is fully settled up!</span>
                  </GlassCard>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {balances?.simplified_debts.map((d, i) => (
                      <DebtArrow key={i} from={d.from_username} to={d.to_username} amount={parseFloat(d.amount)} />
                    ))}
                  </div>
                )}
              </div>

              {/* Debt Graph Card */}
              <div>
                <h3 style={{ marginBottom: 16 }}>Debt Network Visualizer</h3>
                <GlassCard hover={false} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 560 }}>
                  {nodes.length === 0 ? (
                    <div className="empty-state">No network data</div>
                  ) : (
                    <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 500, height: 'auto' }}>
                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-cyan)" />
                        </marker>
                      </defs>
                      
                      {/* Edges */}
                      {edges.map(e => (
                        <g key={e.id}>
                          <path
                            d={`M ${e.source.x} ${e.source.y} L ${e.target.x} ${e.target.y}`}
                            stroke="rgba(6, 182, 212, 0.4)"
                            strokeWidth={2}
                            markerEnd="url(#arrow)"
                          />
                          {/* Animated flow line */}
                          <path
                            d={`M ${e.source.x} ${e.source.y} L ${e.target.x} ${e.target.y}`}
                            stroke="url(#flowGradient)"
                            strokeWidth={2}
                            strokeDasharray="10, 15"
                            style={{
                              animation: 'flowAnimation 1.5s linear infinite',
                              stroke: 'var(--accent-cyan)',
                            }}
                          />
                          {/* Label on path */}
                          <foreignObject
                            x={(e.source.x + e.target.x) / 2 - 35}
                            y={(e.source.y + e.target.y) / 2 - 12}
                            width="70"
                            height="24"
                          >
                            <div style={{
                              background: 'rgba(10, 10, 26, 0.85)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: 4,
                              color: 'var(--accent-pink)',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '2px 0',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}>
                              ₹{parseFloat(e.amount).toFixed(0)}
                            </div>
                          </foreignObject>
                        </g>
                      ))}

                      {/* Nodes */}
                      {nodes.map(n => (
                        <g key={n.id}>
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r="28"
                            fill="url(#nodeGradient)"
                            stroke="var(--accent-violet)"
                            strokeWidth="2"
                            style={{ filter: 'drop-shadow(0 4px 10px rgba(124,58,237,0.3))' }}
                          />
                          <text
                            x={n.x}
                            y={n.y + 5}
                            textAnchor="middle"
                            fill="white"
                            fontWeight="800"
                            fontSize="13"
                            style={{ userSelect: 'none' }}
                          >
                            {n.name.substring(0, 2).toUpperCase()}
                          </text>
                          <text
                            x={n.x}
                            y={n.y + 42}
                            textAnchor="middle"
                            fill="var(--text-secondary)"
                            fontWeight="600"
                            fontSize="11"
                            style={{ userSelect: 'none' }}
                          >
                            {n.name}
                          </text>
                        </g>
                      ))}
                      
                      <style>{`
                        @keyframes flowAnimation {
                          to {
                            stroke-dashoffset: -25;
                          }
                        }
                      `}</style>
                    </svg>
                  )}
                  
                  {/* Timeline playbacks */}
                  {timeline && timeline.length > 0 && (
                    <div style={{ width: '100%', marginTop: 24, padding: '0 16px' }}>
                      <label className="form-label">
                        🗓️ Balance History Timeline Playback: <strong>{timeline[timelineIndex]?.date}</strong>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={timeline.length - 1}
                        value={timelineIndex}
                        onChange={(e) => setTimelineIndex(parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: 'var(--accent-violet)',
                          cursor: 'pointer',
                          marginTop: 8
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        <span>{timeline[0]?.date}</span>
                        <span>{timeline[timeline.length - 1]?.date}</span>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* AI Roommate Advisory Card - Chat Interface with Memory */}
            <GlassCard hover={false} style={{ marginBottom: 24, padding: 28 }} glow={true} glowColor="var(--accent-violet)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: '2.5rem' }}>🤖</span>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gemini AI Roommate Advisor</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                      Ask questions, query bill details, and get witty financial advice with full conversation memory.
                    </p>
                  </div>
                </div>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={handleGenerateReport}
                  disabled={aiLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
                >
                  📊 Generate Report
                </button>
              </div>

              {/* Chat Conversation Box */}
              <div style={{
                maxHeight: '380px',
                overflowY: 'auto',
                padding: '16px',
                background: 'rgba(10, 10, 26, 0.4)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '16px',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)'
              }}>
                {chatMessages.map((msg, index) => (
                  <div 
                    key={index}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.sender === 'user' ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      borderTopRightRadius: msg.sender === 'user' ? '0px' : '12px',
                      borderTopLeftRadius: msg.sender === 'ai' ? '0px' : '12px',
                      maxWidth: '80%',
                      fontSize: '0.92rem',
                      lineHeight: '1.5',
                      border: msg.sender === 'ai' ? '1px solid var(--glass-border)' : 'none',
                      whiteSpace: msg.sender === 'user' ? 'pre-wrap' : 'normal',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    {msg.sender === 'ai' ? renderMarkdown(msg.text) : msg.text}
                  </div>
                ))}

                {aiLoading && (
                  <div style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-muted)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    borderTopLeftRadius: '0px',
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.9rem',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <LoadingSpinner size={16} />
                    <span>Roommate is typing...</span>
                  </div>
                )}
              </div>

              {aiError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 16,
                  fontSize: '0.85rem'
                }}>
                  ⚠️ {aiError}
                </div>
              )}

              {/* Chat Input Bar */}
              <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ask a question (e.g. Why does Rohan owe Aisha? or Who spent on groceries?)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={aiLoading}
                  style={{ flex: 1, height: '46px' }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={aiLoading || !chatInput.trim()}
                  style={{ width: '100px', height: '46px' }}
                >
                  Send
                </button>
              </form>
            </GlassCard>

            <div className="grid grid-2" style={{ gap: 24 }}>
              {/* Pie Chart: Spending by Category */}
              <GlassCard hover={false} style={{ minHeight: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ alignSelf: 'flex-start', marginBottom: 20 }}>Spending by Category</h3>
                {expenses.length === 0 ? (
                  <div className="empty-state">No data</div>
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getCategoryData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {getCategoryData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(value) => `₹${parseFloat(value).toFixed(2)}`} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>

              {/* Bar Chart: Paid vs Owed Leaderboard */}
              <GlassCard hover={false} style={{ minHeight: 380 }}>
                <h3 style={{ marginBottom: 20 }}>Leaderboard (Paid vs Owed)</h3>
                {expenses.length === 0 ? (
                  <div className="empty-state">No data</div>
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getLeaderboardData()}>
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                        <ChartTooltip formatter={(value) => `₹${parseFloat(value).toFixed(0)}`} />
                        <Legend />
                        <Bar dataKey="Paid" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Owed" fill="var(--accent-violet)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        )}

        {activeTab === 'csv' && (
          <motion.div key="csv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-3" style={{ gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'flex-start' }}>
              
              {/* Sidebar upload zone */}
              <GlassCard hover={false}>
                <h3 style={{ marginBottom: 16 }}>Import Expenses</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
                  Upload a CSV file containing your shared bills. The AI agent detects 20 types of data anomalies.
                </p>
                
                <div style={{
                  border: '2px dashed var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 24,
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  marginBottom: 16
                }}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                    disabled={uploading}
                  />
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📤</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {uploading ? 'Processing file...' : 'Choose or Drag CSV'}
                  </span>
                </div>

                {importStatus && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 12,
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {importStatus}
                  </div>
                )}

                <div className="divider" />

                <h4 style={{ marginBottom: 12 }}>Import Reports</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflow: 'auto' }}>
                  {importReports.map(rep => (
                    <button
                      key={rep.id}
                      onClick={async () => {
                        const detailRes = await reportsAPI.detail(id, rep.id);
                        setSelectedReport(detailRes.data);
                      }}
                      style={{
                        background: selectedReport?.id === rep.id ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: selectedReport?.id === rep.id ? '1px solid var(--accent-violet)' : '1px solid var(--glass-border)',
                        color: 'var(--text-primary)',
                        padding: 10,
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{rep.filename}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>
                        {rep.imported_count}/{rep.total_rows} rows imported • {rep.anomaly_count} anomalies
                      </div>
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Anomalies List Zone */}
              <GlassCard hover={false} style={{ minHeight: 450 }}>
                {selectedReport ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 20 }}>
                      <div>
                        <h3>Anomalies in {selectedReport.filename}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2 }}>
                          Analyzed {selectedReport.total_rows} rows • Imported {selectedReport.imported_count} clean records • Flagged {selectedReport.anomaly_count} issues
                        </p>
                      </div>
                      <a 
                        href={`${(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api/').replace(/\/$/, '')}/import-reports/${selectedReport.id}/excel/`}
                        download
                        className="btn btn-success btn-sm"
                        style={{ height: '36px' }}
                      >
                        📊 Excel Report
                      </a>
                    </div>

                    {selectedReport.anomalies.length === 0 ? (
                      <div className="empty-state">
                        <span style={{ fontSize: '3rem' }}>🎉</span>
                        <h4 className="empty-state-title" style={{ marginTop: 12 }}>Clean Dataset!</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>No anomalies detected in this CSV import.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {selectedReport.anomalies.map((anom, idx) => (
                          <AnomalyCard key={anom.id} anomaly={anom} delay={idx * 0.02} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-state" style={{ minHeight: 380 }}>
                    <span className="empty-state-icon">🕵️</span>
                    <h4 className="empty-state-title">Select an Import Report</h4>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '350px' }}>
                      Upload a CSV file or select a previous report from the list on the left to review parsed data anomalies.
                    </p>
                  </div>
                )}
              </GlassCard>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <Modal 
        isOpen={expenseModalOpen} 
        onClose={() => setExpenseModalOpen(false)} 
        title="Add Expense"
      >
        <form onSubmit={handleExpenseSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="expense-desc">Description*</label>
            <input
              id="expense-desc"
              type="text"
              className="input-field"
              placeholder="e.g. Dinner party, Uber ride"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="expense-amount">Amount*</label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ width: 120 }}>
              <label className="form-label" htmlFor="expense-curr">Currency</label>
              <select
                id="expense-curr"
                className="input-field"
                value={expenseForm.currency}
                onChange={(e) => setExpenseForm({ ...expenseForm, currency: e.target.value })}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-payer">Paid By*</label>
            <select
              id="expense-payer"
              className="input-field"
              value={expenseForm.paid_by}
              onChange={(e) => setExpenseForm({ ...expenseForm, paid_by: e.target.value })}
            >
              <option value="">Select payer</option>
              {group.memberships?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.username}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-split-type">Split Type</label>
            <select
              id="expense-split-type"
              className="input-field"
              value={expenseForm.split_type}
              onChange={(e) => setExpenseForm({ ...expenseForm, split_type: e.target.value })}
            >
              <option value="equal">Split Equally</option>
              <option value="unequal">Split Unequally (Exact Rupees)</option>
              <option value="percentage">Split by Percentages</option>
              <option value="share">Split by Shares</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <SplitForm
              splitType={expenseForm.split_type}
              members={group.memberships || []}
              totalAmount={parseFloat(expenseForm.amount) || 0}
              onChange={(splits) => setExpenseForm({ ...expenseForm, split_data: splits })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label" htmlFor="expense-notes">Notes</label>
            <textarea
              id="expense-notes"
              className="input-field"
              placeholder="Any additional details..."
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setExpenseModalOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Settlement Modal */}
      <Modal 
        isOpen={settlementModalOpen} 
        onClose={() => setSettlementModalOpen(false)} 
        title="Record Settlement"
      >
        <form onSubmit={handleSettlementSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="settlement-from">Who Paid? (From)*</label>
            <select
              id="settlement-from"
              className="input-field"
              value={settlementForm.paid_by}
              onChange={(e) => setSettlementForm({ ...settlementForm, paid_by: e.target.value })}
            >
              <option value="">Select sender</option>
              {group.memberships?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.username}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settlement-to">Who was Paid? (To)*</label>
            <select
              id="settlement-to"
              className="input-field"
              value={settlementForm.paid_to}
              onChange={(e) => setSettlementForm({ ...settlementForm, paid_to: e.target.value })}
            >
              <option value="">Select recipient</option>
              {group.memberships?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.username}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settlement-amount">Amount*</label>
            <input
              id="settlement-amount"
              type="number"
              step="0.01"
              className="input-field"
              placeholder="0.00"
              value={settlementForm.amount}
              onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label" htmlFor="settlement-notes">Notes</label>
            <textarea
              id="settlement-notes"
              className="input-field"
              placeholder="e.g. Paid via GPay"
              value={settlementForm.notes}
              onChange={(e) => setSettlementForm({ ...settlementForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setSettlementModalOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Modal */}
      <Modal 
        isOpen={memberModalOpen} 
        onClose={() => setMemberModalOpen(false)} 
        title="Add Group Member"
      >
        <form onSubmit={handleAddMember}>
          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label" htmlFor="member-username">Username*</label>
            <input
              id="member-username"
              type="text"
              className="input-field"
              placeholder="Enter user username"
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setMemberModalOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SVG node gradients */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <radialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
