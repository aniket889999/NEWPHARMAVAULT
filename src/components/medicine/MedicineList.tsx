import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { Medicine } from '../../types';
import { AlertCircle, ShieldCheck, QrCode, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import toast from 'react-hot-toast';

interface MedicineListProps {
  medicines?: Medicine[];
  selectedMedicine?: Medicine | null;
  onSelectMedicine?: (medicine: Medicine) => void;
  isGrid?: boolean;
}

const MedicineList: React.FC<MedicineListProps> = ({ 
  selectedMedicine,
  onSelectMedicine,
  isGrid = true
}) => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const addItem = useCartStore(state => state.addItem);

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/medicines');
        if (response.data && response.data.length > 0) {
          const mapped = response.data.map((med: any) => ({
            ...med,
            id: med._id,
            inStock: med.stock > 0,
            imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
          }));
          setMedicines(mapped);
        } else {
          setMedicines(sampleCatalogue);
        }
      } catch (err: any) {
        setMedicines(sampleCatalogue);
      } finally {
        setLoading(false);
      }
    };

    fetchMedicines();
  }, []);

  const handleAddToCart = (med: any) => {
    addItem({ id: med.id, name: med.name, price: med.price });
    toast.success(`${med.name} added to cart`);
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading medicine catalogue...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 font-sans">
      {medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-white rounded-xl shadow-xs border border-slate-200">
          <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-800">No medicines found</p>
          <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search criteria or category filter.</p>
        </div>
      ) : (
        <div className={isGrid ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-3"}>
          {medicines.map(medicine => (
            <div 
              key={medicine.id}
              onClick={() => onSelectMedicine?.(medicine)}
              className={`bg-white rounded-xl shadow-2xs border transition-all duration-200 hover:shadow-md hover:border-teal-300 overflow-hidden flex flex-col justify-between cursor-pointer ${
                selectedMedicine?.id === medicine.id ? 'ring-1 ring-teal-600 border-teal-500' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Image & Status Overlay */}
                <div className="w-full h-36 relative bg-slate-100 flex-shrink-0 overflow-hidden">
                  <img 
                    src={medicine.imageUrl} 
                    alt={medicine.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                    {medicine.prescriptionRequired ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                        Rx Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white shadow-2xs">
                        OTC General
                      </span>
                    )}
                  </div>

                  <div className="absolute top-2.5 left-2.5">
                    <span className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-teal-800 shadow-2xs flex items-center">
                      <ShieldCheck className="w-3 h-3 mr-1 text-teal-600" /> Authentic
                    </span>
                  </div>
                </div>
                
                {/* Card Content */}
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{medicine.name}</h3>
                      <p className="text-xs text-teal-700 font-medium">{medicine.category}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      ₹{medicine.price?.toFixed(2)}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {medicine.description}
                  </p>
                  
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-medium truncate max-w-[130px]">{medicine.manufacturer}</span>
                    <span className="inline-flex items-center text-emerald-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                      In Stock ({medicine.stock || 500})
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button 
                  onClick={() => navigate(`/patient/authenticity?batch=${medicine.batchNumber || 'B-DLO-650'}`)}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
                  title="Verify Batch"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1 text-teal-600" />
                  <span>Verify</span>
                </button>

                <button 
                  onClick={() => handleAddToCart(medicine)}
                  className="flex-1 py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-2xs"
                  title="Add to Cart"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const sampleCatalogue = [
  {
    id: 'med_crocin_500',
    name: 'Paracetamol 500mg (Crocin)',
    category: 'Analgesic',
    description: 'Antipyretic and analgesic for fever and mild to moderate bodily discomfort.',
    price: 15.00,
    stock: 500,
    manufacturer: 'GSK Pharmaceuticals',
    prescriptionRequired: false,
    batchNumber: 'B-CRO-101',
    imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
  },
  {
    id: 'med_dolo_650',
    name: 'Dolo 650mg',
    category: 'Analgesic',
    description: 'First line antipyretic for high fever, viral infections, and muscle aches.',
    price: 30.50,
    stock: 800,
    manufacturer: 'Micro Labs',
    prescriptionRequired: false,
    batchNumber: 'B-DLO-650',
    imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
  },
  {
    id: 'med_azee_500',
    name: 'Azithromycin 500mg (Azee)',
    category: 'Antibiotic',
    description: 'Macrolide antibiotic prescribed for bacterial respiratory and throat infections.',
    price: 119.00,
    stock: 120,
    manufacturer: 'Cipla',
    prescriptionRequired: true,
    batchNumber: 'B-AZE-500',
    imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
  },
  {
    id: 'med_pan_40',
    name: 'Pantoprazole 40mg (Pan 40)',
    category: 'Gastrointestinal',
    description: 'Proton pump inhibitor used to treat gastric acid reflux and prevent ulcers.',
    price: 155.00,
    stock: 200,
    manufacturer: 'Alkem Laboratories',
    prescriptionRequired: true,
    batchNumber: 'B-PAN-040',
    imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
  }
];

export default MedicineList;
