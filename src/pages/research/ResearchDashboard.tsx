import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Activity, BarChart3, BrainCircuit, ShieldAlert, BookOpen, Fingerprint, Database, CheckCircle2, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ResearchDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/evaluation/results`);
        setData(response.data);
      } catch (err) {
        console.error("Failed to load evaluation data", err);
        toast.error("Failed to load evaluation metrics.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const handleExportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PharmaVaultX_Research_Report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-10 flex justify-center items-center h-screen"><div className="animate-spin text-primary-500"><Activity size={48} /></div></div>;
  if (!data) return <div className="p-10 text-center text-red-500 font-bold">Error loading metrics.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10 px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center">
            <BrainCircuit className="text-primary-600 mr-2" size={28} />
            PharmaVault X <span className="ml-2 font-medium text-slate-400">| AI Research Lab</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Experimental Validation & Benchmarking Dashboard</p>
        </div>
        <button 
          onClick={handleExportJSON}
          className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg font-bold shadow-md shadow-primary-500/20 transition-all flex items-center gap-2 text-sm"
        >
          <Download size={16} /> Export JSON Report
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        
        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><BookOpen size={14} className="mr-1" /> Multi-Agent Accuracy</h3>
            <p className="text-3xl font-black text-slate-800">{(data.multiAgentBenchmark.overallIntentAccuracy * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><Database size={14} className="mr-1" /> Graph Grounding</h3>
            <p className="text-3xl font-black text-slate-800">{(data.graphRAGBenchmark.overallGroundingScore * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center"><Fingerprint size={14} className="mr-1" /> Explainability Score</h3>
            <p className="text-3xl font-black text-slate-800">{(data.explainabilityBenchmark.overallExplainabilityScore * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-2xl shadow-lg border border-indigo-500 text-white">
            <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1 flex items-center"><ShieldAlert size={14} className="mr-1" /> Safety Interception</h3>
            <p className="text-3xl font-black">{(data.safetyBenchmark.emergencyInterceptionAccuracy * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Comparison Table */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><BarChart3 size={20} className="text-primary-500" /> IEEE Benchmark Comparison</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">System Architecture</th>
                  <th className="px-6 py-4 text-center">Precision</th>
                  <th className="px-6 py-4 text-center">Recall</th>
                  <th className="px-6 py-4 text-center">F1-Score</th>
                  <th className="px-6 py-4 text-center">Grounding</th>
                  <th className="px-6 py-4 text-center">Hallucination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.comparisonTable.map((row: any, idx: number) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.system.includes('Current') ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                      {row.system.includes('Current') && <CheckCircle2 size={16} className="text-indigo-500" />}
                      {row.system}
                    </td>
                    <td className="px-6 py-4 text-center">{(row.precision * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-center">{(row.recall * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-center">{(row.f1Score * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-center">{(row.groundingScore * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-center text-red-500">{(row.hallucinationScore * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed Metrics Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* GraphRAG Metrics */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">GraphRAG Performance</h3>
            <div className="space-y-4">
              {data.graphRAGBenchmark.testCases.map((tc: any, i: number) => (
                <div key={i} className="flex flex-col gap-1 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>"{tc.query}"</span>
                    <span className={tc.hallucinationRisk === 'Low Risk' ? 'text-green-600' : 'text-red-500'}>{tc.hallucinationRisk}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-bold w-24">Grounding:</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5"><div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${tc.groundingScore * 100}%` }}></div></div>
                    <span className="text-xs font-mono font-bold text-slate-600 w-8 text-right">{(tc.groundingScore * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Explainability Metrics */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Explainability & Validation</h3>
            <div className="space-y-5 mt-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 uppercase mb-1">
                  <span>Evidence Coverage</span>
                  <span>{(data.explainabilityBenchmark.evidenceCoverage * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${data.explainabilityBenchmark.evidenceCoverage * 100}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 uppercase mb-1">
                  <span>Reasoning Completeness</span>
                  <span>{(data.explainabilityBenchmark.reasoningCompleteness * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${data.explainabilityBenchmark.reasoningCompleteness * 100}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 uppercase mb-1">
                  <span>Confidence Consistency</span>
                  <span>{(data.explainabilityBenchmark.confidenceConsistency * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${data.explainabilityBenchmark.confidenceConsistency * 100}%` }}></div></div>
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium text-slate-600 bg-orange-50 text-orange-800 p-3 rounded border border-orange-100">
                  <span className="font-bold">Unsupported Reasoning Count:</span> {data.explainabilityBenchmark.unsupportedReasoningCount}
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ResearchDashboard;
