import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Activity, AlertOctagon, TrendingUp, PackageX, Truck, 
  CloudRainWind, Map, Pill, ShieldAlert, ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const OperationsIntelligence: React.FC = () => {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [deadStock, setDeadStock] = useState<any[]>([]);
  const [reorders, setReorders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [seasonals, setSeasonals] = useState<any[]>([]);
  const [substituteSearch, setSubstituteSearch] = useState("Dolo 650");
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const [fRes, dsRes, rRes, supRes, seaRes] = await Promise.all([
          apiClient.get('/pharmacy-intelligence/forecast'),
          apiClient.get('/pharmacy-intelligence/dead-stock'),
          apiClient.get('/pharmacy-intelligence/reorder'),
          apiClient.get('/pharmacy-intelligence/suppliers'),
          apiClient.get('/pharmacy-intelligence/seasonal')
        ]);

        setForecasts(fRes.data);
        setDeadStock(dsRes.data);
        setReorders(rRes.data);
        setSuppliers(supRes.data);
        setSeasonals(seaRes.data);
        fetchSubstitutes("Dolo 650"); // initial load
      } catch (err) {
        console.error("Ops Intelligence load error:", err);
        toast.error("Failed to load operations intelligence.");
      } finally {
        setLoading(false);
      }
    };
    fetchIntelligence();
  }, []);

  const fetchSubstitutes = async (medName: string) => {
    if (!medName) return;
    try {
      const res = await apiClient.get(`/pharmacy-intelligence/substitutes/${encodeURIComponent(medName)}`);
      setSubstitutes(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load substitutes.");
    }
  };

  if (loading) return <div className="p-10 flex justify-center items-center h-full"><div className="animate-spin text-primary-500"><Activity size={48} /></div></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
        <div>
          <h1 className="text-2xl font-black flex items-center">
            <Activity className="text-emerald-400 mr-3" size={28} />
            Operations Intelligence
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">AI-Powered Predictive Pharmacy Operations</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <p className="text-sm font-black text-emerald-400 flex items-center justify-center"><ShieldAlert size={14} className="mr-1" /> Active</p>
          </div>
        </div>
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Smart Reorder Engine */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
              <TrendingUp size={18} className="text-indigo-500 mr-2" /> 
              Smart Reorder Engine
            </h3>
            <div className="space-y-3">
              {reorders.map((r, i) => (
                <div key={i} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 w-1 h-full ${r.priority === 'Critical' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                  <div className="flex items-center ml-2">
                    <Pill size={18} className="text-slate-400 mr-3" />
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{r.medicine}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Shortage expected: {r.expectedShortageDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                      Reorder: {r.suggestedQuantity} units
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase flex items-center justify-end">
                      Urgency: {r.reorderUrgency}% 
                      <ArrowUpRight size={10} className="text-red-400 ml-1" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Demand Forecasting & Seasonal Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Forecasts */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
                <Activity size={18} className="text-emerald-500 mr-2" /> 
                Demand Forecasts
              </h3>
              <div className="space-y-4">
                {forecasts.map((f, i) => (
                  <div key={i} className="pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm text-slate-700">{f.medicine}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${f.shortageRisk === 'Critical' ? 'bg-red-100 text-red-700' : f.shortageRisk === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {f.shortageRisk} Risk
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{f.reason}</div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                      <span>Predicted/Wk: {f.predictedWeeklyDemand}</span>
                      <span className="flex items-center text-indigo-500">
                        Trend {f.demandTrend} {f.demandTrend === 'up' ? <ArrowUpRight size={12} className="ml-0.5" /> : null}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Trends */}
            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100">
              <h3 className="text-sm font-black text-indigo-900 mb-4 flex items-center">
                <CloudRainWind size={18} className="text-indigo-500 mr-2" /> 
                Seasonal Intelligence
              </h3>
              <div className="space-y-4">
                {seasonals.map((s, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-black text-indigo-800 uppercase">{s.season}</span>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{s.probability}% Prob</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">{s.predictedSpike}</p>
                    <p className="text-xs text-slate-500 flex items-start">
                      <AlertTriangle size={12} className="text-amber-500 mr-1 mt-0.5 shrink-0" />
                      {s.alert}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Supplier Reliability */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
              <Truck size={18} className="text-primary-500 mr-2" /> 
              Supplier Reliability Intelligence
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-3 font-bold text-xs uppercase tracking-wider">Supplier</th>
                    <th className="pb-3 font-bold text-xs uppercase tracking-wider text-center">Trust Score</th>
                    <th className="pb-3 font-bold text-xs uppercase tracking-wider">Reliability</th>
                    <th className="pb-3 font-bold text-xs uppercase tracking-wider">Risk Level</th>
                    <th className="pb-3 font-bold text-xs uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                  {suppliers.map((sup, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-slate-700">{sup.name}</div>
                        {sup.warning && <div className="text-[10px] text-red-500 mt-0.5">{sup.warning}</div>}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`font-black ${sup.trustScore > 80 ? 'text-emerald-500' : 'text-orange-500'}`}>{sup.trustScore}</span>
                      </td>
                      <td className="py-3 text-xs">{sup.deliveryReliability}</td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${sup.counterfeitRisk === 'Very Low' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                          {sup.counterfeitRisk}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {sup.recommended ? (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Recommended</span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded uppercase tracking-wider">Caution</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          
          {/* Dead Stock Detection */}
          <div className="bg-red-50 border border-red-100 p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-black text-red-800 mb-4 flex items-center">
              <PackageX size={18} className="text-red-500 mr-2" /> 
              Dead Stock Alerts
            </h3>
            <div className="space-y-3">
              {deadStock.map((ds, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-red-50 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-red-100 text-red-700 text-[10px] font-black px-2 py-1 rounded-bl-lg">
                    {ds.daysInactive} Days Idle
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm mb-1 pr-16">{ds.medicine}</h4>
                  <p className="text-xs text-red-600 font-bold mb-2">₹{ds.capitalBlocked.toLocaleString()} Blocked</p>
                  <p className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded">Action: {ds.suggestedAction}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Substitute Ranking */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
              <AlertOctagon size={18} className="text-emerald-500 mr-2" /> 
              Substitute Intelligence
            </h3>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={substituteSearch}
                onChange={(e) => setSubstituteSearch(e.target.value)}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                placeholder="Search medicine..."
              />
              <button 
                onClick={() => fetchSubstitutes(substituteSearch)}
                className="bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-600 transition-colors"
              >
                Analyze
              </button>
            </div>
            
            {substitutes.length > 0 ? (
              <div className="space-y-3">
                {substitutes.map((sub, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${sub.matchScore > 98 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700 text-sm">{sub.name}</span>
                      <span className="text-[10px] font-black bg-white px-1.5 py-0.5 rounded shadow-sm text-slate-600">Match: {sub.matchScore}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                      <span>Stock: <span className={`font-bold ${sub.stock === 0 ? 'text-red-500' : ''}`}>{sub.stock}</span></span>
                      <span>₹{sub.price}</span>
                    </div>
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{sub.rankReason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-slate-400 italic">No substitutes ranked for this item.</div>
            )}
          </div>

          {/* Inventory Heatmap Minimap Placeholder */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800">
            <h3 className="text-sm font-black text-slate-200 mb-4 flex items-center">
              <Map size={18} className="text-indigo-400 mr-2" /> 
              Store Heatmap
            </h3>
            <div className="aspect-square bg-slate-800 rounded-xl border border-slate-700 flex flex-col justify-between p-4 opacity-80">
              <div className="flex justify-between gap-4">
                <div className="flex-1 h-12 bg-red-500/20 border border-red-500/50 rounded flex items-center justify-center text-[10px] font-bold text-red-300">A1 (High Demand)</div>
                <div className="flex-1 h-12 bg-emerald-500/20 border border-emerald-500/50 rounded flex items-center justify-center text-[10px] font-bold text-emerald-300">B1</div>
              </div>
              <div className="flex justify-between gap-4">
                <div className="flex-1 h-12 bg-slate-700 rounded flex items-center justify-center text-[10px] font-bold text-slate-400">A2</div>
                <div className="flex-1 h-12 bg-blue-500/20 border border-blue-500/50 rounded flex items-center justify-center text-[10px] font-bold text-blue-300">Cold Chain</div>
              </div>
              <div className="text-center mt-2 text-[10px] font-medium text-slate-500 italic">Movement density visualization</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OperationsIntelligence;
