import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  ShieldAlert, CheckCircle, AlertOctagon,
  AlertTriangle, Shield, Activity, Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const AISafetyDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSafetyData = async () => {
      try {
        const [sumRes, logRes] = await Promise.all([
          apiClient.get('/safety/audit-summary'),
          apiClient.get('/safety/audit-logs')
        ]);

        setSummary(sumRes.data);
        setLogs(logRes.data);
      } catch (err) {
        console.error("Safety Audit load error:", err);
        toast.error("Failed to load safety audit data.");
      } finally {
        setLoading(false);
      }
    };
    fetchSafetyData();
  }, []);

  if (loading) return <div className="p-10 flex justify-center items-center h-full"><div className="animate-spin text-red-500"><ShieldAlert size={48} /></div></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
        <div>
          <h1 className="text-2xl font-black flex items-center">
            <Shield className="text-red-400 mr-3" size={28} />
            AI Safety & Governance
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Enterprise Hallucination & Risk Audit Dashboard</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Policy Engine</p>
            <p className="text-sm font-black text-emerald-400 flex items-center justify-center"><CheckCircle size={14} className="mr-1" /> Active</p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Audits</h3>
            <p className="text-2xl font-black text-slate-700">{summary.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">High Risk Classes</h3>
            <p className="text-2xl font-black text-orange-600">{summary.highRisk}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hallucinations</h3>
            <p className="text-2xl font-black text-red-600">{summary.hallucinations}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contradictions</h3>
            <p className="text-2xl font-black text-red-600">{summary.contradictions}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200 text-center">
            <h3 className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Review Required</h3>
            <p className="text-2xl font-black text-red-700">{summary.reviewRequired}</p>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-800 flex items-center">
            <Activity size={18} className="text-indigo-500 mr-2" /> 
            Recent Audit Logs
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search queries..." className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">Query Context</th>
                <th className="px-6 py-4 font-bold">Risk Class</th>
                <th className="px-6 py-4 font-bold text-center">Confidence</th>
                <th className="px-6 py-4 font-bold">Safety Flags</th>
                <th className="px-6 py-4 font-bold text-right">Review Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 mb-1 max-w-xs truncate" title={log.query}>"{log.query}"</div>
                    <div className="text-[10px] text-slate-400">Role: {log.userRole} | {new Date(log.createdAt).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                      log.riskLevel === 'Emergency Risk' ? 'bg-red-50 border-red-200 text-red-700' :
                      log.riskLevel === 'General Info' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      'bg-orange-50 border-orange-200 text-orange-700'
                    }`}>
                      {log.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-black ${log.confidence < 50 ? 'text-red-500' : log.confidence < 80 ? 'text-orange-500' : 'text-emerald-500'}`}>
                      {log.confidence}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {log.hallucinationRisk === 'High' && (
                        <div className="text-[10px] text-red-600 font-bold flex items-center"><AlertOctagon size={10} className="mr-1" /> High Hallucination Risk</div>
                      )}
                      {log.contradictionFlags.length > 0 && (
                        <div className="text-[10px] text-red-600 font-bold flex items-center"><AlertTriangle size={10} className="mr-1" /> {log.contradictionFlags.length} Contradictions</div>
                      )}
                      {log.unsupportedClaims.length > 0 && (
                        <div className="text-[10px] text-orange-600 font-bold flex items-center"><Activity size={10} className="mr-1" /> {log.unsupportedClaims.length} Unsupported Claims</div>
                      )}
                      {log.hallucinationRisk !== 'High' && log.contradictionFlags.length === 0 && log.unsupportedClaims.length === 0 && (
                        <div className="text-[10px] text-emerald-600 font-bold flex items-center"><CheckCircle size={10} className="mr-1" /> Clean</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {log.reviewRequired ? (
                      <div>
                        <span className="text-[10px] font-black text-white bg-red-600 px-2 py-1 rounded uppercase tracking-wider">Review Required</span>
                        <p className="text-[9px] text-slate-500 mt-1 max-w-[150px] ml-auto truncate" title={log.reviewReason}>{log.reviewReason}</p>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passed</span>
                    )}
                  </td>
                </tr>
              ))}
              
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm font-medium">
                    No safety audit logs found. Interact with the AI assistant to generate audits.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AISafetyDashboard;
