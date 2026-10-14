import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { AlertTriangle, TrendingDown, CheckCircle, PackageSearch, Shuffle, BrainCircuit } from 'lucide-react';
import toast from 'react-hot-toast';

const StockRisk: React.FC = () => {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [substitutes, setSubstitutes] = useState<any>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const { data } = await apiClient.get('/pharmacy/stock-risk');
        setRisks(data);
      } catch (error) {
        toast.error("Failed to fetch stock risk data");
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, []);

  const fetchSubstitutes = async (medicineName: string) => {
    try {
      toast.loading("Finding AI substitutes...", { id: 'subs' });
      const { data } = await apiClient.get(`/pharmacy/substitutes/${medicineName}`);
      setSubstitutes(data);
      setSubModalOpen(true);
      toast.dismiss('subs');
    } catch (err) {
      toast.error("Failed to fetch substitutes", { id: 'subs' });
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Out of Stock': return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded flex items-center w-max"><AlertTriangle size={12} className="mr-1"/> Out of Stock</span>;
      case 'Low': return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded flex items-center w-max"><TrendingDown size={12} className="mr-1"/> Low Stock</span>;
      case 'Watch': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded flex items-center w-max"><PackageSearch size={12} className="mr-1"/> Watch</span>;
      default: return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded flex items-center w-max"><CheckCircle size={12} className="mr-1"/> Good</span>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Supply Shortage Predictor</h1>
      <p className="text-gray-500 mb-8">AI-driven low stock alerts and smart substitute recommendations.</p>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Scanning inventory...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold text-gray-600 text-sm">Medicine Name</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Current Stock</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Risk Level</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Restock Size</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {risks.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{item.name}</td>
                  <td className="p-4 font-bold text-gray-700">{item.stock}</td>
                  <td className="p-4">{getRiskBadge(item.riskLevel)}</td>
                  <td className="p-4 text-sm font-medium text-indigo-600">
                    {item.suggestedReorder > 0 ? `+${item.suggestedReorder} units` : '-'}
                  </td>
                  <td className="p-4">
                    {(item.riskLevel === 'Out of Stock' || item.riskLevel === 'Low') && (
                      <button 
                        onClick={() => fetchSubstitutes(item.name)}
                        className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded flex items-center hover:bg-indigo-100 transition-colors"
                      >
                        <Shuffle size={14} className="mr-1" /> Find Substitutes
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Substitute Modal */}
      {subModalOpen && substitutes && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center mb-4">
              <BrainCircuit className="text-indigo-600 mr-2" /> AI Substitute Analysis
            </h2>
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 text-sm text-indigo-900">
              <p><strong>Original Request:</strong> {substitutes.original}</p>
              {substitutes.genericClass && <p><strong>Generic Class:</strong> {substitutes.genericClass}</p>}
            </div>

            <h3 className="font-bold text-gray-700 mb-3">Available In-Stock Alternatives:</h3>
            {substitutes.inventoryAlternatives && substitutes.inventoryAlternatives.length > 0 ? (
              <ul className="space-y-3">
                {substitutes.inventoryAlternatives.map((alt: any) => (
                  <li key={alt._id} className="border p-3 rounded-lg flex justify-between items-center bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-900">{alt.name}</p>
                      <p className="text-xs text-gray-500">Stock: {alt.stock} | Price: ₹{alt.price}</p>
                    </div>
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">Available</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-red-500 font-bold p-4 bg-red-50 rounded-lg">No suitable substitutes available in current inventory.</p>
            )}

            <div className="mt-6 text-right">
              <button 
                onClick={() => setSubModalOpen(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockRisk;
