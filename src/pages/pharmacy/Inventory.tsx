import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle, 
  Search, 
  Filter, 
  QrCode, 
  Clock, 
  ShieldCheck, 
  Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Inventory: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);
  const navigate = useNavigate();
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Antibiotics & Antimicrobials');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/medicines');
      if (Array.isArray(data) && data.length > 0) {
        setMedicines(data);
      } else {
        // Fallback demo data
        setMedicines(fallbackMedicines);
      }
    } catch (err) {
      console.error(err);
      setMedicines(fallbackMedicines);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchMedicines(); 
  }, []);

  const openModal = (med: any = null) => {
    setEditingMed(med);
    if (med) {
      setName(med.name); 
      setCategory(med.category); 
      setDescription(med.description || '');
      setPrice(med.price?.toString() || ''); 
      setStock(med.stock?.toString() || ''); 
      setManufacturer(med.manufacturer || '');
      setBatchNumber(med.batchNumber || '');
      setExpiryDate(med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '');
      setPrescriptionRequired(med.prescriptionRequired || false);
    } else {
      setName(''); 
      setCategory('Antibiotics & Antimicrobials'); 
      setDescription(''); 
      setPrice(''); 
      setStock('');
      setManufacturer(''); 
      setBatchNumber(`B-${Math.random().toString(36).substring(2, 7).toUpperCase()}`); 
      setExpiryDate(''); 
      setPrescriptionRequired(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      name, 
      category, 
      description, 
      price: parseFloat(price) || 0, 
      stock: parseInt(stock, 10) || 0, 
      manufacturer, 
      batchNumber, 
      expiryDate, 
      prescriptionRequired 
    };
    try {
      if (editingMed) {
        await apiClient.put(`/medicines/${editingMed._id || editingMed.id}`, payload);
        toast.success('Formulary item updated');
      } else {
        await apiClient.post('/medicines', payload);
        toast.success('New medicine added to dispensary stock');
      }
      setIsModalOpen(false);
      fetchMedicines();
    } catch (err) {
      toast.error('Failed to save medicine record');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Confirm removal of this medicine from inventory?')) {
      try {
        await apiClient.delete(`/medicines/${id}`);
        toast.success('Medicine removed');
        fetchMedicines();
      } catch (err) {
        toast.error('Failed to delete medicine');
      }
    }
  };

  // Filtered List
  const filteredMedicines = medicines.filter(m => {
    const matchesSearch = 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...Array.from(new Set(medicines.map(m => m.category).filter(Boolean)))];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">
              Dispensary Stock & Formulary
            </span>
            <span className="text-xs text-slate-400 font-mono">CDSCO Traceable</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Dispensary Inventory Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage pharmaceutical stock counts, batch numbers, manufacturer licenses, and prescription rules.
          </p>
        </div>

        <button 
          onClick={() => openModal()} 
          className="flex items-center justify-center bg-blue-700 text-white px-4 py-2.5 rounded-xl hover:bg-blue-800 transition-colors font-medium text-xs shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add New Medicine</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine, batch, or manufacturer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat === 'ALL' ? 'All Therapeutic Classes' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading pharmaceutical catalog...</div>
        ) : filteredMedicines.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No medicines match filter</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting search keywords or category filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5 pl-5">Medicine & Classification</th>
                  <th className="p-3.5">Batch & Manufacturer</th>
                  <th className="p-3.5">Expiry Horizon</th>
                  <th className="p-3.5">Unit Price</th>
                  <th className="p-3.5">Current Stock</th>
                  <th className="p-3.5 text-right pr-5">Dispensary Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicines.map((med, idx) => {
                  const isCriticalStock = med.stock <= 10;
                  const isLowStock = med.stock <= 25 && med.stock > 10;
                  const isExpiringSoon = med.expiryDate && new Date(med.expiryDate) < new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <tr key={med._id || med.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{med.name}</span>
                          {med.prescriptionRequired ? (
                            <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                              Rx Required
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                              OTC
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{med.category}</p>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {med.batchNumber || 'B-UNKNOWN'}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">{med.manufacturer}</p>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center text-[11px] font-medium ${
                          isExpiringSoon ? 'text-rose-600 font-bold' : 'text-slate-600'
                        }`}>
                          {isExpiringSoon ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500" />
                              {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'N/A'} (Urgent)
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'Active'}
                            </>
                          )}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-900 font-mono">
                        ₹{(med.price || 0).toFixed(2)}
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isCriticalStock 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : isLowStock 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {med.stock} units
                        </span>
                      </td>

                      <td className="p-3.5 text-right pr-5 space-x-1">
                        <button 
                          onClick={() => navigate(`/patient/authenticity?batch=${med.batchNumber || 'B-DLO-650'}`)}
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Verify Batch Ledger"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openModal(med)} 
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Formulary Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(med._id || med.id)} 
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Medicine"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  {editingMed ? 'Edit Formulary Item' : 'Register New Medicine Formulation'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Brand Name & Strength</label>
                  <input 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Dolo 650mg Tablet"
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Therapeutic Class</label>
                  <input 
                    required 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    placeholder="e.g. Analgesics & Antipyretics"
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Clinical Indication & Directions</label>
                <textarea 
                  required 
                  rows={2}
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Primary therapeutic usage and safety precautions..."
                  className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Price (₹)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Stock Units</label>
                  <input 
                    required 
                    type="number" 
                    value={stock} 
                    onChange={e => setStock(e.target.value)} 
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Batch Number</label>
                  <input 
                    required 
                    value={batchNumber} 
                    onChange={e => setBatchNumber(e.target.value)} 
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600 font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Manufacturer Name</label>
                  <input 
                    required 
                    value={manufacturer} 
                    onChange={e => setManufacturer(e.target.value)} 
                    placeholder="e.g. Micro Labs / Cipla"
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expiry Date</label>
                  <input 
                    required 
                    type="date" 
                    value={expiryDate} 
                    onChange={e => setExpiryDate(e.target.value)} 
                    className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="rx" 
                  checked={prescriptionRequired} 
                  onChange={e => setPrescriptionRequired(e.target.checked)} 
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" 
                />
                <label htmlFor="rx" className="text-xs font-semibold text-slate-700">
                  Prescription Mandatory (Schedule H / H1 / X Drug)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-blue-700 text-white font-bold px-5 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-xs"
                >
                  Save Formulary Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const fallbackMedicines = [
  {
    _id: 'med_1',
    name: 'Dolo 650mg Tablet',
    category: 'Analgesics & Antipyretics',
    description: 'First line paracetamol formulation for acute fever, viral headaches.',
    price: 30.50,
    stock: 450,
    manufacturer: 'Micro Labs Limited',
    prescriptionRequired: false,
    batchNumber: 'B-DLO-650',
    expiryDate: new Date('2028-05-10').toISOString()
  },
  {
    _id: 'med_2',
    name: 'Azithromycin 500mg (Azee 500)',
    category: 'Antibiotics & Antimicrobials',
    description: 'Broad-spectrum macrolide antibiotic for upper and lower respiratory infections.',
    price: 119.00,
    stock: 120,
    manufacturer: 'Cipla Limited',
    prescriptionRequired: true,
    batchNumber: 'B-AZE-500',
    expiryDate: new Date('2027-11-17').toISOString()
  },
  {
    _id: 'med_3',
    name: 'Amoxicillin + Clavulanic Acid 625mg (Augmentin)',
    category: 'Antibiotics & Antimicrobials',
    description: 'Potentiated penicillin antibiotic effective against beta-lactamase producing strains.',
    price: 185.00,
    stock: 18,
    manufacturer: 'GlaxoSmithKline (GSK)',
    prescriptionRequired: true,
    batchNumber: 'B-AUG-625',
    expiryDate: new Date('2027-07-15').toISOString()
  },
  {
    _id: 'med_4',
    name: 'Benadryl Cough Relief Syrup (100ml)',
    category: 'Respiratory & Cold',
    description: 'Diphenhydramine formulation for dry cough relief.',
    price: 125.00,
    stock: 22,
    manufacturer: 'Johnson & Johnson Ltd',
    prescriptionRequired: false,
    batchNumber: 'B-BND-110',
    expiryDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
  }
];

export default Inventory;
