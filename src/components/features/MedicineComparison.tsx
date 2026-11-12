import React, { useState } from 'react';
import {
  GitCompare,
  Plus,
  X,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Package,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { ComparisonService } from '../../services/comparisonService';
import { ComparisonResult, ComparisonCriteria, Medicine } from '../../types';
import { enhancedMedicines } from '../../data/enhancedMedicines';
import LoadingSpinner from '../ui/LoadingSpinner';

const MedicineComparison: React.FC = () => {
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>(['1', '2']);
  const [criteria, setCriteria] = useState<ComparisonCriteria>({
    price: true,
    effectiveness: true,
    sideEffects: true,
    availability: true,
    alternatives: false
  });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const comparisonService = ComparisonService.getInstance();

  const handleMedicineSelect = (medicineId: string) => {
    if (selectedMedicines.includes(medicineId)) {
      setSelectedMedicines(prev => prev.filter(id => id !== medicineId));
    } else if (selectedMedicines.length < 4) {
      setSelectedMedicines(prev => [...prev, medicineId]);
    }
  };

  const handleCriteriaChange = (criterion: keyof ComparisonCriteria) => {
    setCriteria(prev => ({ ...prev, [criterion]: !prev[criterion] }));
  };

  const handleCompare = async (medIds: string[] = selectedMedicines) => {
    if (medIds.length < 2) {
      setError('Please select at least 2 medicines to compare');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const comparisonResult = await comparisonService.compareMedicines(medIds, criteria);
      setResult(comparisonResult);
    } catch (err) {
      setError('Failed to compare medicines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (ids: string[]) => {
    setSelectedMedicines(ids);
    handleCompare(ids);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border border-amber-200';
    return 'text-rose-700 bg-rose-50 border border-rose-200';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <GitCompare className="h-7 w-7 text-blue-600" />
              Clinical Medicine Comparison
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Side-by-Side Efficacy & Bioequivalence
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Compare formulations, active salts, therapeutic scores, adverse profiles, and retail pricing.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">1-Click Presets:</span>
          <button
            onClick={() => loadPreset(['1', '2'])}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors"
          >
            ⚡ Paracetamol vs Dolo 650
          </button>
          <button
            onClick={() => loadPreset(['3', '4'])}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
          >
            ⚡ Amoxicillin vs Azithromycin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Medicine Selection Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200/90 space-y-6 sticky top-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Selected Medicines
                </h2>
                <span className="text-xs font-bold text-blue-600 font-mono">
                  {selectedMedicines.length}/4 Selected
                </span>
              </div>

              {/* Selected Pills */}
              <div className="space-y-2">
                {selectedMedicines.map(medicineId => {
                  const medicine = enhancedMedicines.find(m => m.id === medicineId);
                  return medicine ? (
                    <div
                      key={medicineId}
                      className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl"
                    >
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">{medicine.name}</span>
                        <span className="text-[10px] text-blue-600 font-medium">₹{medicine.price} • {medicine.category}</span>
                      </div>
                      <button
                        onClick={() => handleMedicineSelect(medicineId)}
                        className="text-blue-400 hover:text-blue-700 p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Available List */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Add More from Formulary
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {enhancedMedicines.map(medicine => {
                  const isSelected = selectedMedicines.includes(medicine.id);
                  return (
                    <button
                      key={medicine.id}
                      onClick={() => handleMedicineSelect(medicine.id)}
                      disabled={isSelected || selectedMedicines.length >= 4}
                      className={`w-full text-left p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-blue-50/50 border-blue-200 opacity-60 cursor-default'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{medicine.name}</span>
                        <span className="text-xs font-black text-slate-800">₹{medicine.price}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{medicine.category}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Criteria */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Comparison Metrics
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(criteria).map(([key, value]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer text-slate-700 font-medium"
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => handleCriteriaChange(key as keyof ComparisonCriteria)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              onClick={() => handleCompare()}
              disabled={selectedMedicines.length < 2 || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" color="white" />
                  <span>Computing Matrix...</span>
                </>
              ) : (
                <>
                  <GitCompare className="h-4 w-4" />
                  <span>Run Comparison Matrix</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Pane */}
        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white p-12 rounded-3xl shadow-xs border border-slate-200/90 text-center">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <GitCompare className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Select Medicines to Compare</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose 2 to 4 drugs or click any 1-click preset at the top to generate comprehensive clinical scorecards.
              </p>
              <button
                onClick={() => loadPreset(['1', '2'])}
                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                ⚡ Load Paracetamol vs Dolo 650
              </button>
            </div>
          )}

          {loading && (
            <div className="bg-white p-16 rounded-3xl shadow-xs border border-slate-200/90 text-center">
              <LoadingSpinner size="large" />
              <p className="text-xs font-bold text-slate-600 mt-4">
                Evaluating pharmacology, safety profile, and price ratios...
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              {/* Comparison Table */}
              <div className="bg-white rounded-3xl shadow-xs border border-slate-200/90 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900">Comparative Efficacy Matrix</h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Calculated Analysis
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-5 py-3">Medicine</th>
                        <th className="px-5 py-3">Overall Score</th>
                        {criteria.price && <th className="px-5 py-3">Price</th>}
                        {criteria.effectiveness && <th className="px-5 py-3">Effectiveness</th>}
                        {criteria.sideEffects && <th className="px-5 py-3">Side Effects</th>}
                        {criteria.availability && <th className="px-5 py-3">Stock Status</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.results
                        .sort((a, b) => b.scores.overall - a.scores.overall)
                        .map((metric, index) => {
                          const medicine = result.medicines.find(m => m.id === metric.medicineId)!;
                          return (
                            <tr key={metric.medicineId} className={index === 0 ? 'bg-blue-50/20' : ''}>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  {index === 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Best Choice
                                    </span>
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-900">{medicine.name}</div>
                                    <div className="text-[11px] text-slate-400">{medicine.category}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${getScoreColor(metric.scores.overall)}`}>
                                  {Math.round(metric.scores.overall)}%
                                </span>
                              </td>
                              {criteria.price && (
                                <td className="px-5 py-4 font-black text-slate-900">
                                  ₹{medicine.price}
                                </td>
                              )}
                              {criteria.effectiveness && (
                                <td className="px-5 py-4 font-bold text-slate-700">
                                  {Math.round(metric.scores.effectiveness)}%
                                </td>
                              )}
                              {criteria.sideEffects && (
                                <td className="px-5 py-4 text-slate-600">
                                  {medicine.sideEffects.length} reported
                                </td>
                              )}
                              {criteria.availability && (
                                <td className="px-5 py-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                      medicine.inStock
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {medicine.inStock ? 'In Stock' : 'Out of Stock'}
                                  </span>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cards Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.results.map(metric => {
                  const medicine = result.medicines.find(m => m.id === metric.medicineId)!;
                  return (
                    <div
                      key={metric.medicineId}
                      className="bg-white p-5 rounded-3xl shadow-xs border border-slate-200/90 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-sm text-slate-900">{medicine.name}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getScoreColor(metric.scores.overall)}`}>
                          Score: {Math.round(metric.scores.overall)}%
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <div>
                          <span className="font-bold text-slate-700">Generic:</span> {medicine.genericName}
                        </div>
                        <div>
                          <span className="font-bold text-slate-700">Manufacturer:</span> {medicine.manufacturer}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 text-xs">
                        <span className="font-bold text-blue-900 block mb-0.5">Clinical Evaluation:</span>
                        <p className="text-blue-800 leading-relaxed">{metric.recommendation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicineComparison;
