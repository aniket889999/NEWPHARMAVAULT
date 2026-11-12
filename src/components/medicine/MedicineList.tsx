import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { Medicine } from '../../types';
import { AlertCircle, ShieldCheck, QrCode, ShoppingCart, MapPin, Pill, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import toast from 'react-hot-toast';

interface MedicineListProps {
  medicines?: Medicine[];
  selectedMedicine: Medicine | null;
  onSelectMedicine: (medicine: Medicine) => void;
  isGrid?: boolean;
  searchQuery?: string;
  filterCategory?: string;
}

const MedicineList: React.FC<MedicineListProps> = ({ 
  selectedMedicine,
  onSelectMedicine,
  isGrid = true,
  searchQuery = '',
  filterCategory = 'All'
}) => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const addItem = useCartStore(state => state.addItem);

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/medicines');
        const mapped = response.data.map((med: any) => ({
          ...med,
          id: med._id,
          inStock: (med.stock || 0) > 0,
        }));
        setMedicines(mapped);
        setLoading(false);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch medicines');
        setLoading(false);
      }
    };

    fetchMedicines();
  }, []);

  const filtered = medicines.filter((med) => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (med.category && med.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (med.description && med.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === 'All' || med.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading medicine catalogue...</div>;
  if (error) return <div className="p-8 text-center text-xs text-rose-500">Error: {error}</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 font-sans">
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-3xl shadow-xs border border-slate-200">
          <AlertCircle size={44} className="text-slate-300 mb-3" />
          <p className="text-base font-bold text-slate-900">No medicines matched</p>
          <p className="text-xs text-slate-400 mt-0.5">Try searching for Paracetamol, Dolo, Augmentin, or Azithromycin.</p>
        </div>
      ) : (
        <div className={isGrid ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-4"}>
          {filtered.map(medicine => (
            <div 
              key={medicine.id}
              className="bg-white rounded-2xl shadow-xs border border-slate-200/90 hover:border-blue-400 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden flex flex-col justify-between p-5"
            >
              <div>
                {/* Header Pills */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                    {medicine.category || 'Pharmaceutical'}
                  </span>
                  <div className="flex gap-1.5">
                    {medicine.inStock ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        In Stock ({medicine.stock})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Out of Stock
                      </span>
                    )}
                    {medicine.prescriptionRequired && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Rx
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{medicine.name}</h3>
                  <span className="font-black text-slate-900 text-base shrink-0">₹{medicine.price?.toFixed(2)}</span>
                </div>

                <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                  {medicine.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mb-4">
                  <span className="font-medium truncate">{medicine.manufacturer}</span>
                  <span className="font-mono text-emerald-600 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Authentic
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/patient/authenticity')}
                  className="py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1"
                >
                  <QrCode size={14} className="text-slate-500" /> Verify
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    addItem({ id: medicine.id, name: medicine.name, price: medicine.price });
                    toast.success(`${medicine.name} added to cart!`);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1"
                >
                  <ShoppingCart size={14} /> Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicineList;
