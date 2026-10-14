import React, { useState } from 'react';
import axios from 'axios';
import { 
  Network, Search, ArrowRight, ShieldCheck, 
  Activity, Database, BrainCircuit, Users, Building
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const KnowledgeGraphExplorer: React.FC = () => {
  const [query, setQuery] = useState('Dolo 650');
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const exploreMedicineNode = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const res = await axios.get(`${baseUrl}/graph/medicine/${encodeURIComponent(query)}`);
      setGraphData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Node not found in Knowledge Graph.");
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  };

  const traverseSymptom = async (symptom: string) => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const res = await axios.post(`${baseUrl}/graph/traverse`, { symptom });
      toast.success(`Found ${res.data.treats.length} medicines for ${symptom}`);
      // Hacky display update
      setGraphData({
        data: {
          node: `Symptom: ${symptom}`,
          source: "InMemoryGraph",
          paths: res.data.treats.map((m: string) => `${symptom} ← TREATS ← ${m}`)
        },
        explanation: {
          readableExplanations: [`Traversed graph from symptom "${symptom}" to find connected medicines.`],
          confidence: 100
        }
      });
    } catch (err) {
      toast.error("Traversal failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
        <div>
          <h1 className="text-2xl font-black flex items-center">
            <Network className="text-indigo-400 mr-3" size={28} />
            Enterprise Knowledge Graph
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Multi-Hop Traversal & Ontology Mapping</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 flex items-center">
            <Database size={16} className="text-indigo-400 mr-2" />
            <span className="text-sm font-bold text-slate-200">Neo4j Ready</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Controls */}
        <div className="space-y-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center">
              <Search size={18} className="text-primary-500 mr-2" /> 
              Graph Traversal Query
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Search Medicine Node</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                    placeholder="e.g. Dolo 650, Metformin"
                  />
                  <button 
                    onClick={exploreMedicineNode}
                    className="bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-600 transition-colors"
                  >
                    Query
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Quick Ontology Tests</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => traverseSymptom('Fever')} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-100 font-medium">Symptom: Fever</button>
                  <button onClick={() => traverseSymptom('stomach pain')} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-100 font-medium">Symptom: Stomach Pain</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h3 className="text-sm font-black text-indigo-900 mb-3 flex items-center">
              <BrainCircuit size={18} className="text-indigo-500 mr-2" /> 
              Ontology Mapper Active
            </h3>
            <p className="text-xs text-indigo-700 leading-relaxed">
              The graph intercepts colloquial queries (e.g. "sugar medicine", "amox") and strictly normalizes them into standard Graph Nodes before executing multi-hop paths.
            </p>
          </div>

        </div>

        {/* Right Column - Graph Visualization */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[500px]">
            {loading ? (
               <div className="flex justify-center items-center h-full"><Activity size={32} className="text-indigo-500 animate-spin" /></div>
            ) : graphData ? (
              <div className="space-y-6 animate-fade-in">
                
                {/* Node Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Root Node Extracted</span>
                    <h2 className="text-2xl font-black text-slate-800">{graphData.data.node}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded uppercase tracking-wider">
                      Source: {graphData.data.source}
                    </span>
                    <p className="text-xs font-bold text-slate-400 mt-2 flex items-center justify-end">
                      <ShieldCheck size={14} className="text-emerald-500 mr-1" /> Confidence {graphData.explanation?.confidence || 0}%
                    </p>
                  </div>
                </div>

                {/* Explainability Log */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Graph Explainability Layer</h4>
                  {graphData.explanation?.readableExplanations.map((exp: string, i: number) => (
                    <p key={i} className="text-sm font-medium text-slate-700">{exp}</p>
                  ))}
                </div>

                {/* Multi-Hop Paths */}
                <div>
                  <h4 className="text-xs font-black text-slate-700 mb-3 uppercase tracking-wider flex items-center">
                    <Network size={14} className="text-indigo-500 mr-2" /> 
                    Extracted Relationship Paths
                  </h4>
                  <div className="space-y-3">
                    {graphData.data.paths.map((path: string, i: number) => {
                      const segments = path.split(' → ');
                      return (
                        <div key={i} className="flex flex-wrap items-center text-[11px] font-medium gap-2">
                          {segments.map((seg, idx) => (
                            <React.Fragment key={idx}>
                              <span className={`px-2 py-1 rounded shadow-sm border ${
                                seg === 'HAS_GENERIC' || seg === 'TREATS' || seg === 'ALTERNATIVE_TO' || seg === 'MAY_CAUSE' || seg === 'CAUTION_WITH' 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100 font-black tracking-wider' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {seg}
                              </span>
                              {idx < segments.length - 1 && <ArrowRight size={14} className="text-slate-300" />}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-full text-slate-400 text-center">
                <Network size={48} className="text-slate-200 mb-4" />
                <p className="text-sm font-medium">Enter a medicine or symptom to visualize its Knowledge Graph.</p>
              </div>
            )}
          </div>

          {/* Connected Enterprise Graphs */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center">
               <Users size={24} className="text-emerald-500 mr-3" />
               <div>
                 <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">Patient Graph</h4>
                 <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Connected (Phase 8)</p>
               </div>
             </div>
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center">
               <Building size={24} className="text-orange-500 mr-3" />
               <div>
                 <h4 className="text-xs font-black text-orange-800 uppercase tracking-wider">Pharmacy Graph</h4>
                 <p className="text-[10px] text-orange-600 font-medium mt-0.5">Connected (Phase 9)</p>
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphExplorer;
