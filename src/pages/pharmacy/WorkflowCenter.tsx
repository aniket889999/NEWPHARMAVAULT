import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Workflow, 
  UserCheck, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  History,
  Filter,
  RefreshCw,
  Zap,
  MoreVertical,
  Activity as ActivityIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const WorkflowCenter: React.FC = () => {
  const [activeWorkflows, setActiveWorkflows] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Pending' | 'Escalated' | 'Completed'>('All');
  const [isSeeding, setIsSeeding] = useState(false);

  const fetchWorkflows = async () => {
    try {
      const [activeRes, pendingRes, auditRes] = await Promise.all([
        apiClient.get('/workflows/active'),
        apiClient.get('/workflows/priorities'),
        apiClient.get('/workflows/audit')
      ]);

      setActiveWorkflows(activeRes.data);
      setPendingApprovals(pendingRes.data);
      setAuditHistory(auditRes.data);
    } catch (err) {
      toast.error("Failed to load workflow data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleApproval = async (id: string, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/workflows/approve/${id}`, { action });
      toast.success(`Workflow ${action}d successfully`);
      fetchWorkflows();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${action} workflow`);
    }
  };

  const seedDemo = async () => {
    setIsSeeding(true);
    try {
      await apiClient.post('/workflows/seed', {});
      toast.success("Demo workflows seeded!");
      fetchWorkflows();
    } catch (err) {
      toast.error("Failed to seed demo workflows");
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredHistory = auditHistory.filter(wf => {
    if (filter === 'All') return true;
    if (filter === 'Critical') return wf.priority === 'Critical';
    if (filter === 'Pending') return wf.approvalStatus === 'pending';
    if (filter === 'Escalated') return wf.escalationEvents?.length > 0;
    if (filter === 'Completed') return wf.status === 'completed';
    return true;
  });

  const stats = {
    active: activeWorkflows.length,
    pending: pendingApprovals.length,
    escalated: auditHistory.filter(h => h.escalationEvents?.length > 0 && h.status !== 'completed').length,
    completed: auditHistory.filter(h => h.status === 'completed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Workflow className="text-indigo-600" />
            Healthcare Operations Center
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Zap size={14} className="text-amber-500" />
            Semi-autonomous medical workflow automation engine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={seedDemo}
            disabled={isSeeding}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200"
          >
            <RefreshCw size={16} className={isSeeding ? 'animate-spin' : ''} />
            Demo Seed
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            SYSTEM HEALTHY
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Tasks', value: stats.active, icon: ActivityIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Approval', value: stats.pending, icon: UserCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Escalations Today', value: stats.escalated, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Completed 24h', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-4 rounded-xl border border-slate-200 shadow-sm`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                <h3 className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</h3>
              </div>
              <stat.icon className={`${stat.color} opacity-60`} size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert size={20} className="text-orange-600" />
                Human Approval Queue
              </h2>
              <span className="text-xs text-slate-500 font-medium">Requiring Pharmacist Verification</span>
            </div>
            <div className="p-6 space-y-4">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={40} className="mx-auto text-slate-200 mb-3" />
                  <p>All critical actions have been authorized.</p>
                </div>
              ) : (
                pendingApprovals.map(approval => (
                  <div key={approval._id} className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:border-indigo-300 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-lg">{approval.workflowName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            approval.priority === 'Critical' ? 'bg-red-600 text-white animate-pulse' :
                            approval.priority === 'High' ? 'bg-orange-500 text-white' :
                            'bg-slate-800 text-white'
                          }`}>
                            {approval.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">ID: {approval._id.slice(-8)} | Trigger: {approval.trigger}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Hallucination Risk</span>
                        <span className={`text-xs font-bold ${
                          approval.metadata?.hallucinationRisk === 'High' ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {approval.metadata?.hallucinationRisk || 'None'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-4 mb-4 border-l-4 border-indigo-400">
                      <p className="text-sm text-slate-700 italic">
                        "{approval.metadata?.query || 'Automated operational safety check required.'}"
                      </p>
                      {approval.metadata?.riskClass && (
                        <div className="mt-3 flex gap-2">
                           <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">{approval.metadata.riskClass}</span>
                           <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">{approval.metadata.sourceLanguage || 'EN'}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleApproval(approval._id, 'approve')}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={18} />
                        Approve & Execute
                      </button>
                      <button 
                        onClick={() => handleApproval(approval._id, 'reject')}
                        className="px-6 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-2.5 rounded-lg text-sm transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Workflow Timeline Filtered History */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History size={20} className="text-indigo-600" />
                Workflow Audit Timeline
              </h2>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-xs font-bold text-slate-600 bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                  <option value="All">All Events</option>
                  <option value="Critical">Critical Priority</option>
                  <option value="Pending">Waiting Approval</option>
                  <option value="Escalated">Escalations Only</option>
                  <option value="Completed">Successful</option>
                </select>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-400">No events match the selected filter.</div>
              ) : (
                filteredHistory.map(h => (
                  <div key={h._id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 p-1.5 rounded-full ${
                          h.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                          h.status === 'active' ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {h.status === 'completed' ? <CheckCircle size={14} /> : <Workflow size={14} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{h.workflowName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-slate-400">{new Date(h.createdAt).toLocaleTimeString()}</span>
                            <span className={`text-[10px] px-1.5 rounded font-bold uppercase ${
                              h.priority === 'Critical' ? 'text-red-600' : 'text-slate-500'
                            }`}>{h.priority}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          h.status === 'active' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>{h.status}</span>
                        {h.escalationEvents?.length > 0 && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Escalated</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Intelligence */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl shadow-indigo-100 border border-slate-800">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-indigo-400" />
              Operational Health
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400 font-bold uppercase">Workflow Throughput</span>
                  <span className="text-indigo-400 font-bold italic">Stable</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[85%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Human-In-Loop</span>
                  <span className="text-xl font-bold text-white">99.8%</span>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Safety Blocks</span>
                  <span className="text-xl font-bold text-emerald-400">04</span>
                </div>
              </div>

              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-lg p-4">
                <p className="text-xs text-indigo-300 leading-relaxed italic">
                  "System is prioritizing <b>{stats.pending}</b> tasks requiring human verification. Automated reorder suggested for dead-stock items."
                </p>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full text-left p-3 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center justify-between group transition-all">
                Run Adherence Scan
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center justify-between group transition-all">
                Validate Expiry Queue
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center justify-between group transition-all">
                Clear Completed Logs
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowCenter;
