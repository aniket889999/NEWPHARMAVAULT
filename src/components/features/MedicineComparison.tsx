import React, { useState } from 'react';
import { GitCompare, Plus, X, TrendingUp, DollarSign, AlertTriangle, Package } from 'lucide-react';
import { ComparisonService } from '../../services/comparisonService';
import { ComparisonResult, ComparisonCriteria, Medicine } from '../../types';
import { enhancedMedicines } from '../../data/enhancedMedicines';
import LoadingSpinner from '../ui/LoadingSpinner';

const MedicineComparison: React.FC = () => {
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
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

  const handleCompare = async () => {
    if (selectedMedicines.length < 2) {
      setError('Please select at least 2 medicines to compare');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const comparisonResult = await comparisonService.compareMedicines(selectedMedicines, criteria);
      setResult(comparisonResult);
    } catch (err) {
      setError('Failed to compare medicines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <GitCompare className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Medicine Comparison</h1>
        </div>
        <p className="text-gray-600">
          Compare medicines side-by-side to make informed decisions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Medicine Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Medicines</h2>
            
            {/* Selected Medicines */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Selected ({selectedMedicines.length}/4)
              </p>
              <div className="space-y-2">
                {selectedMedicines.map(medicineId => {
                  const medicine = enhancedMedicines.find(m => m.id === medicineId);
                  return medicine ? (
                    <div key={medicineId} className="flex items-center justify-between p-2 bg-primary-50 rounded-lg">
                      <span className="text-sm font-medium text-primary-900">{medicine.name}</span>
                      <button
                        onClick={() => handleMedicineSelect(medicineId)}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Available Medicines */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Available Medicines</p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {enhancedMedicines.map(medicine => (
                  <button
                    key={medicine.id}
                    onClick={() => handleMedicineSelect(medicine.id)}
                    disabled={selectedMedicines.includes(medicine.id) || selectedMedicines.length >= 4}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedMedicines.includes(medicine.id)
                        ? 'bg-primary-100 border-primary-300 text-primary-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="font-medium">{medicine.name}</div>
                    <div className="text-sm text-gray-500">{medicine.category}</div>
                    <div className="text-sm font-medium text-gray-900">₹{medicine.price}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison Criteria */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Comparison Criteria</p>
              <div className="space-y-2">
                {Object.entries(criteria).map(([key, value]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => handleCriteriaChange(key as keyof ComparisonCriteria)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleCompare}
              disabled={selectedMedicines.length < 2 || loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:bg-primary-400 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" color="white" />
                  <span className="ml-2">Comparing...</span>
                </>
              ) : (
                <>
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Medicines
                </>
              )}
            </button>
          </div>
        </div>

        {/* Comparison Results */}
        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
              <GitCompare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Compare</h3>
              <p className="text-gray-500">
                Select at least 2 medicines and click compare to see detailed analysis
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
              <LoadingSpinner size="large" />
              <p className="text-gray-500 mt-4">Analyzing medicines...</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Comparison Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900">Comparison Results</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medicine
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Overall Score
                        </th>
                        {criteria.price && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                        )}
                        {criteria.effectiveness && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Effectiveness
                          </th>
                        )}
                        {criteria.sideEffects && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Side Effects
                          </th>
                        )}
                        {criteria.availability && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Availability
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.results
                        .sort((a, b) => b.scores.overall - a.scores.overall)
                        .map((metric, index) => {
                          const medicine = result.medicines.find(m => m.id === metric.medicineId)!;
                          return (
                            <tr key={metric.medicineId} className={index === 0 ? 'bg-green-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {index === 0 && (
                                    <div className="mr-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Best
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{medicine.name}</div>
                                    <div className="text-sm text-gray-500">{medicine.category}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(metric.scores.overall)}`}>
                                  {Math.round(metric.scores.overall)}%
                                </div>
                              </td>
                              {criteria.price && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">₹{medicine.price}</div>
                                  <div className={`text-xs ${getScoreColor(metric.scores.price).split(' ')[0]}`}>
                                    Score: {Math.round(metric.scores.price)}%
                                  </div>
                                </td>
                              )}
                              {criteria.effectiveness && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(metric.scores.effectiveness)}`}>
                                    {Math.round(metric.scores.effectiveness)}%
                                  </div>
                                </td>
                              )}
                              {criteria.sideEffects && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{medicine.sideEffects.length} effects</div>
                                  <div className={`text-xs ${getScoreColor(metric.scores.sideEffects).split(' ')[0]}`}>
                                    Score: {Math.round(metric.scores.sideEffects)}%
                                  </div>
                                </td>
                              )}
                              {criteria.availability && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    medicine.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {medicine.inStock ? 'In Stock' : 'Out of Stock'}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.results.map(metric => {
                  const medicine = result.medicines.find(m => m.id === metric.medicineId)!;
                  return (
                    <div key={metric.medicineId} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">{medicine.name}</h4>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(metric.scores.overall)}`}>
                          {Math.round(metric.scores.overall)}%
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Generic:</span> {medicine.genericName}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Manufacturer:</span> {medicine.manufacturer}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Price:</span> ₹{medicine.price}
                        </div>
                      </div>

                      {metric.pros.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-green-800 mb-2">Advantages:</h5>
                          <ul className="text-sm text-green-700 space-y-1">
                            {metric.pros.map((pro, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-2">•</span>
                                {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {metric.cons.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-red-800 mb-2">Disadvantages:</h5>
                          <ul className="text-sm text-red-700 space-y-1">
                            {metric.cons.map((con, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Recommendation:</span> {metric.recommendation}
                        </p>
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