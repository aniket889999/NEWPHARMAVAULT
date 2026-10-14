import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { AlertTriangle, Clock, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ExpiryRisk: React.FC = () => {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const { data } = await apiClient.get('/pharmacy/expiry-risk');
        setRisks(data);
      } catch (error) {
        toast.error("Failed to fetch expiry risk data");
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, []);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Expired': return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded flex items-center"><Trash2 size={12} className="mr-1"/> Expired</span>;
      case 'High Risk': return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded flex items-center"><AlertTriangle size={12} className="mr-1"/> High Risk</span>;
      case 'Watch': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded flex items-center"><Clock size={12} className="mr-1"/> Watch</span>;
      default: return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded flex items-center"><ShieldCheck size={12} className="mr-1"/> Safe</span>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Expiry Risk Intelligence</h1>
      <p className="text-gray-500 mb-8">AI-driven predictive analysis of inventory expiration dates.</p>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Scanning inventory...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold text-gray-600 text-sm">Medicine Name</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Batch No</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Days Left</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Risk Level</th>
                <th className="p-4 font-bold text-gray-600 text-sm">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {risks.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{item.name}</td>
                  <td className="p-4 text-gray-500 text-sm font-mono">{item.batchNumber}</td>
                  <td className="p-4 font-bold text-gray-700">
                    {item.daysRemaining < 0 ? 'Passed' : item.daysRemaining}
                  </td>
                  <td className="p-4">{getRiskBadge(item.riskLevel)}</td>
                  <td className="p-4 text-sm text-indigo-600 font-medium">{item.suggestedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpiryRisk;
