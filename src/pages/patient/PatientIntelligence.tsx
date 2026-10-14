import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Activity, AlertTriangle, Clock, Pill, CalendarCheck, ShieldAlert,
  LineChart, BrainCircuit, ActivitySquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const PatientIntelligence: React.FC = () => {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
  const [refillRisks, setRefillRisks] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const [tRes, aRes, rRes, iRes, gRes] = await Promise.all([
          apiClient.get('/intelligence/timeline'),
          apiClient.get('/intelligence/adherence'),
          apiClient.get('/intelligence/refill-risk'),
          apiClient.get('/intelligence/insights'),
          apiClient.get('/intelligence/patient-graph')
        ]);

        setTimeline(tRes.data);
        setAdherence(aRes.data);
        setRefillRisks(rRes.data);
        setInsights(iRes.data);
        setGraphData(gRes.data);
      } catch (err) {
        console.error("Intelligence load error:", err);
        toast.error("Failed to load patient intelligence dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchIntelligence();
  }, []);

  if (loading) return <div className="p-10 flex justify-center items-center h-full"><div className="animate-spin text-primary-500"><Activity size={48} /></div></div>;
  if (!adherence) return <div className="p-10 text-center text-red-500 font-bold">Error loading dashboard.</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center">
            <BrainCircuit className="text-primary-500 mr-2" size={28} />
            Patient Intelligence
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Longitudinal Behavioral Analytics & AI Insights</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <ActivitySquare className="text-emerald-500" size={20} />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health Status</p>
            <p className="text-sm font-black text-slate-700">Monitoring Active</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Adherence & Risk Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Medication Adherence</h3>
              <div className="text-5xl font-black mb-1 flex items-baseline">
                <span className={adherence.currentScore > 80 ? 'text-emerald-600' : 'text-orange-500'}>
                  {adherence.currentScore}
                </span>
                <span className="text-2xl text-slate-300 ml-1">/100</span>
              </div>
              <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 mt-2">
                Trend: {adherence.trend.toUpperCase()}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                <ShieldAlert size={14} className="mr-1.5" /> Active Risk Flags
              </h3>
              <div className="space-y-2">
                {insights?.riskFlags && insights.riskFlags.length > 0 ? (
                  insights.riskFlags.map((risk: string, i: number) => (
                    <div key={i} className="flex items-center text-xs font-bold text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                      <AlertTriangle size={14} className="mr-2" />
                      {risk}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 italic">No critical risks detected.</div>
                )}
              </div>
            </div>
          </div>

          {/* AI Insights Engine */}
          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100">
            <h3 className="text-sm font-black text-indigo-900 mb-4 flex items-center">
              <BrainCircuit size={18} className="text-indigo-500 mr-2" /> 
              Personalized AI Insights
            </h3>
            <ul className="space-y-3">
              {insights?.insights.map((insight: string, i: number) => (
                <li key={i} className="flex items-start text-sm font-medium text-slate-700 bg-white p-3 rounded-xl border border-indigo-50 shadow-sm">
                  <span className="text-indigo-400 mr-3 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Refill Predictions */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
              <CalendarCheck size={18} className="text-primary-500 mr-2" /> 
              Refill Predictions
            </h3>
            <div className="space-y-3">
              {refillRisks.map((risk: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center">
                    <Pill size={18} className="text-slate-400 mr-3" />
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{risk.medicine}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{risk.message}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black px-2 py-1 rounded-md uppercase tracking-wider ${risk.riskLevel === 'High' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {risk.riskLevel} Risk
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Exhausts: {risk.exhaustionDate}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Longitudinal Timeline */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[450px] overflow-y-auto">
            <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center sticky top-0 bg-white pb-2 z-10">
              <Clock size={18} className="text-primary-500 mr-2" /> 
              Behavioral Timeline
            </h3>
            <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 pb-4">
              {timeline.map((event: any, i: number) => (
                <div key={event.id} className="relative pl-6">
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                    event.type.includes('missed') ? 'bg-red-400' : 
                    event.type.includes('completed') ? 'bg-emerald-400' : 
                    'bg-indigo-400'
                  }`}></div>
                  <p className="text-[10px] font-bold text-slate-400 mb-1">{new Date(event.timestamp).toLocaleDateString()} • {event.source}</p>
                  <p className="text-sm font-bold text-slate-700">{event.type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-xs font-medium text-slate-500 mt-1"><span className="text-slate-700 font-bold">{event.medicine}</span> - {event.details}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Health Graph (Lightweight Text Map) */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
            <h3 className="text-sm font-black text-slate-200 mb-4 flex items-center">
              <LineChart size={18} className="text-indigo-400 mr-2" /> 
              Patient Health Graph
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="text-indigo-300 font-bold mb-2">Patient Profile</div>
              {graphData?.edges.map((edge: any, i: number) => {
                const target = graphData.nodes.find((n: any) => n.id === edge.target)?.label;
                const source = graphData.nodes.find((n: any) => n.id === edge.source)?.label;
                return (
                  <div key={i} className="flex items-center text-slate-400">
                    <span className="text-slate-500 mr-2">└─</span>
                    <span className="text-emerald-400 mr-2">[{edge.label}]</span>
                    <span className="text-slate-300 font-medium">→ {target}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PatientIntelligence;
