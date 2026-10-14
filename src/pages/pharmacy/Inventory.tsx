import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';

const Inventory: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Antibiotics');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);

  useEffect(() => { fetchMedicines(); }, []);

  const fetchMedicines = async () => {
    try {
      const { data } = await apiClient.get('/medicines');
      setMedicines(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (med: any = null) => {
    setEditingMed(med);
    if (med) {
      setName(med.name); setCategory(med.category); setDescription(med.description);
      setPrice(med.price); setStock(med.stock); setManufacturer(med.manufacturer);
      setBatchNumber(med.batchNumber || '');
      setExpiryDate(med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '');
      setPrescriptionRequired(med.prescriptionRequired || false);
    } else {
      setName(''); setCategory('Antibiotics'); setDescription(''); setPrice(''); setStock('');
      setManufacturer(''); setBatchNumber(''); setExpiryDate(''); setPrescriptionRequired(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, category, description, price, stock, manufacturer, batchNumber, expiryDate, prescriptionRequired };
    try {
      if (editingMed) {
        await apiClient.put(`/medicines/${editingMed._id}`, payload);
      } else {
        await apiClient.post('/medicines', payload);
      }
      setIsModalOpen(false);
      fetchMedicines();
    } catch (err) {
      alert('Failed to save medicine');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this?')) {
      try {
        await apiClient.delete(`/medicines/${id}`);
        fetchMedicines();
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Manage stock, batches, and expiries.</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium">
          <Plus size={18} className="mr-2" /> Add Medicine
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-700 text-sm">Medicine & Batch</th>
              <th className="p-4 font-semibold text-slate-700 text-sm">Expiry</th>
              <th className="p-4 font-semibold text-slate-700 text-sm">Price</th>
              <th className="p-4 font-semibold text-slate-700 text-sm">Stock Level</th>
              <th className="p-4 font-semibold text-slate-700 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {medicines.map(med => {
              const isLowStock = med.stock <= 10;
              const isExpiring = med.expiryDate && new Date(med.expiryDate) < new Date(new Date().setMonth(new Date().getMonth() + 3));
              return (
                <tr key={med._id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{med.name}</p>
                      {med.prescriptionRequired && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Rx</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Batch: {med.batchNumber || 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <span className={`text-sm font-medium ${isExpiring ? 'text-red-600 flex items-center gap-1' : 'text-slate-600'}`}>
                      {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'N/A'}
                      {isExpiring && <AlertTriangle size={14} />}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-900">₹{med.price}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {med.stock} units
                    </span>
                  </td>
                  <td className="p-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(med)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(med._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingMed ? 'Edit Medicine' : 'Add New Medicine'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input required value={name} onChange={e=>setName(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input required value={category} onChange={e=>setCategory(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea required value={description} onChange={e=>setDescription(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
                  <input required type="number" value={price} onChange={e=>setPrice(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Qty</label>
                  <input required type="number" value={stock} onChange={e=>setStock(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                  <input required value={batchNumber} onChange={e=>setBatchNumber(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input required value={manufacturer} onChange={e=>setManufacturer(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input required type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} className="w-full border px-3 py-2 rounded-lg outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="rx" checked={prescriptionRequired} onChange={e=>setPrescriptionRequired(e.target.checked)} className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900" />
                <label htmlFor="rx" className="text-sm font-medium text-slate-700">Requires Prescription</label>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg mt-6 hover:bg-slate-800">
                Save Medicine
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
