import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { Medicine } from '../../types';
import { AlertCircle, ShieldCheck, QrCode, ArrowRight, ShoppingCart, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';



interface MedicineListProps {
  medicines?: Medicine[]; // Optional as we now fetch data internally
  selectedMedicine: Medicine | null;
  onSelectMedicine: (medicine: Medicine) => void;
  isGrid?: boolean;
}

const MedicineList: React.FC<MedicineListProps> = ({ 
  selectedMedicine,
  onSelectMedicine,
  isGrid = false
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
        // Map backend data to match frontend ui structure
        const mapped = response.data.map((med: any) => ({
          ...med,
          id: med._id,
          inStock: med.stock > 0,
          imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
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

  if (loading) return <div className="p-4 text-gray-500">Loading medicines...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
      {medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
          <AlertCircle size={48} className="text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-900">No medicines found</p>
          <p className="text-sm">Try tweaking your search terms or filters.</p>
        </div>
      ) : (
        <div className={isGrid ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
          {medicines.map(medicine => (
            <div 
              key={medicine.id}
              className={`bg-white rounded-xl shadow-sm border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden flex ${
                isGrid ? 'flex-col' : 'flex-row items-center'
              } ${
                selectedMedicine?.id === medicine.id
                  ? 'ring-2 ring-primary-500 border-primary-200'
                  : 'border-gray-200'
              }`}
            >
              <div className={`${isGrid ? 'w-full h-48' : 'w-24 h-24 p-2'} relative bg-gray-100 flex-shrink-0`}>
                <img 
                  src={medicine.imageUrl} 
                  alt={medicine.name}
                  className={`w-full h-full object-cover ${isGrid ? '' : 'rounded-lg'}`}
                />
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  {medicine.inStock ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-green-500 text-white shadow-sm uppercase tracking-wider">
                      In Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-red-500 text-white shadow-sm uppercase tracking-wider">
                      Out of Stock
                    </span>
                  )}
                  {medicine.prescriptionRequired && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-blue-600 text-white shadow-sm uppercase tracking-wider justify-center">
                      Rx Only
                    </span>
                  )}
                </div>
                {/* Verified Badge */}
                <div className="absolute top-3 left-3">
                   <div className="bg-white/90 backdrop-blur pointer-events-none px-2 py-1 rounded text-xs font-bold text-blue-700 shadow-sm flex items-center">
                     <ShieldCheck size={14} className="mr-1" /> Verified
                   </div>
                </div>
              </div>
              
              <div className={`flex flex-col flex-1 ${isGrid ? 'p-5' : 'p-4'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{medicine.name}</h3>
                    <p className="text-sm text-primary-600 font-medium">{medicine.category}</p>
                  </div>
                  <span className="font-bold text-gray-900 border-b-2 border-primary-500 pb-0.5">₹{medicine.price?.toFixed(2)}</span>
                </div>
                
                <p className="text-sm text-gray-500 mb-4 line-clamp-2 mt-2 flex-grow">
                  {medicine.description}
                </p>
                
                <div className="flex justify-between items-center text-sm text-gray-500 border-t border-gray-100 pt-3 mt-auto">
                  <span className="font-medium truncate pr-2 max-w-[120px]">{medicine.manufacturer}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => onSelectMedicine(medicine)}
                    className="flex-1 bg-gray-50 hover:bg-primary-50 text-primary-700 font-medium py-2 rounded-lg transition-colors border border-gray-200 hover:border-primary-200 flex justify-center items-center text-sm"
                  >
                    View Details
                  </button>
                  <button 
                    title="Check Nearby Availability"
                    onClick={() => navigate(`/patient/nearby-medicines?medicine=${encodeURIComponent(medicine.name)}`)}
                    className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors border border-gray-200 flex justify-center items-center text-sm"
                  >
                    <MapPin size={16} className="mr-1 text-red-500" /> Nearby
                  </button>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button 
                    title="Verify QR Authenticity"
                    onClick={() => window.location.href = '/patient/authenticity'}
                    className="bg-gray-50 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors border border-gray-200 flex justify-center items-center flex-1"
                  >
                    <QrCode size={18} className="mr-1" /> Verify
                  </button>
                  <button 
                    title="Add to Cart"
                    onClick={() => {
                      addItem({ id: medicine.id, name: medicine.name, price: medicine.price });
                      alert(`${medicine.name} added to cart!`);
                    }}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg transition-colors flex justify-center items-center flex-1"
                  >
                    <ShoppingCart size={18} className="mr-1" /> Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default MedicineList;