import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Package,
  Search,
  Filter,
  CheckCircle2,
  TrendingDown,
  Clock,
  Sparkles,
  ArrowUpDown,
  Building2,
  QrCode
} from 'lucide-react';
import toast from 'react-hot-toast';

const Inventory: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low' | 'Adequate'>('All');

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Antibiotic');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/medicines');
      setMedicines(data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (med: any = null) => {
    setEditingMed(med);
    if (med) {
      setName(med.name);
      setCategory(med.category || 'Antibiotic');
      setDescription(med.description || '');
      setPrice(med.price ? med.price.toString() : '');
      setStock(med.stock ? med.stock.toString() : '');
      setManufacturer(med.manufacturer || '');
      setBatchNumber(med.batchNumber || '');
      setExpiryDate(med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '');
      setPrescriptionRequired(med.prescriptionRequired || false);
    } else {
      setName('');
      setCategory('Antibiotic');
      setDescription('');
      setPrice('');
      setStock('');
      setManufacturer('');
      setBatchNumber('B-' + Math.random().toString(36).substring(2, 7).toUpperCase());
      setExpiryDate('2026-12-31');
      setPrescriptionRequired(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      category,
      description,
      price: Number(price),
      stock: Number(stock),
      manufacturer,
      batchNumber,
      expiryDate,
      prescriptionRequired
    };

    try {
      if (editingMed) {
        await apiClient.put(`/medicines/${editingMed._id}`, payload);
        toast.success(`Updated ${name} inventory records!`);
      } else {
        await apiClient.post('/medicines', payload);
        toast.success(`Registered new medicine ${name} into stock!`);
      }
      setIsModalOpen(false);
      fetchMedicines();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save medicine');
    }
  };

  const handleQuickRestock = async (med: any, addUnits: number = 50) => {
    try {
      const newStock = (med.stock || 0) + addUnits;
      await apiClient.put(`/medicines/${med._id}`, { ...med, stock: newStock });
      toast.success(`+${addUnits} units added to ${med.name}!`);
      fetchMedicines();
    } catch (err) {
      toast.error('Failed to restock units');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/medicines/${id}`);
      toast.success('Medicine removed from inventory');
      setDeleteConfirmId(null);
      fetchMedicines();
    } catch (err) {
      toast.error('Failed to delete medicine');
    }
  };

  // Categories list
  const categories = ['All', ...Array.from(new Set(medicines.map(m => m.category).filter(Boolean)))];

  // Filtered medicines
  const filteredMedicines = medicines.filter(med => {
    const matchesSearch =
      med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
    const matchesStock =
      stockFilter === 'All' ||
      (stockFilter === 'Low' && (med.stock || 0) <= 25) ||
      (stockFilter === 'Adequate' && (med.stock || 0) > 25);
    return matchesSearch && matchesCategory && matchesStock;
  });

  // KPI Calculations
  const totalSKUs = medicines.length;
  const totalUnits = medicines.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
  const lowStockCount = medicines.filter(m => (m.stock || 0) <= 25).length;
  const expiringSoonCount = medicines.filter(
    m => m.expiryDate && new Date(m.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  ).length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pharmacy Inventory</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Active Dispensing
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time stock ledger, batch verification, low-stock alerts, and fast restock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-bold text-xs shadow-xs"
          >
            <Plus size={16} /> Add New Medicine
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total SKUs</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalSKUs}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Formulations tracked</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Total Units</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{totalUnits.toLocaleString()}</div>
          <p className="text-[11px] text-blue-500/80 mt-0.5">Physical packages available</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Low Stock Watch</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{lowStockCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">SKUs below 25 threshold</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Expiring in 90 Days</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{expiringSoonCount}</div>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Requires FEFO rotation</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by drug name, batch number, or manufacturer..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStockFilter('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                stockFilter === 'All'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Levels
            </button>
            <button
              onClick={() => setStockFilter('Low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                stockFilter === 'Low'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Low Stock (&le;25)
            </button>
            <button
              onClick={() => setStockFilter('Adequate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                stockFilter === 'Adequate'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Adequate Stock
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-semibold shrink-0">Category:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Medicine Inventory Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Loading medicine stock records...
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No medicines match current filters</h3>
            <p className="text-xs text-slate-500 mt-1">Adjust search terms or clear categories.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">Medicine & Batch</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Manufacturer</th>
                  <th className="p-4">Expiry Date</th>
                  <th className="p-4">Price (₹)</th>
                  <th className="p-4">Stock Level</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicines.map(med => {
                  const isLowStock = (med.stock || 0) <= 25;
                  const isExpiring =
                    med.expiryDate &&
                    new Date(med.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={med._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 group-hover:text-blue-700">
                            {med.name}
                          </p>
                          {med.prescriptionRequired && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase border border-blue-200">
                              Rx
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Batch: {med.batchNumber || 'N/A'}
                        </p>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {med.category || 'General'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{med.manufacturer || 'Cipla / Sun Pharma'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                            isExpiring
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'N/A'}
                          {isExpiring && <AlertTriangle size={13} className="text-rose-500" />}
                        </span>
                      </td>

                      <td className="p-4 font-black text-slate-900 text-sm">
                        ₹{Number(med.price || 0).toFixed(2)}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isLowStock
                                ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {med.stock || 0} units
                          </span>
                          {isLowStock && (
                            <button
                              onClick={() => handleQuickRestock(med, 50)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors"
                              title="1-Click add 50 units"
                            >
                              +50 Restock
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal(med)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Medicine"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(med._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Medicine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingMed ? `Edit: ${editingMed.name}` : 'Register New Medicine to Inventory'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Medicine Name & Formulation</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Augmentin 625 Duo"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <input
                    required
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="e.g. Antibiotic, Analgesic"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Description & Indications</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Clinical usage, active salts, and therapeutic indications..."
                  className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹ INR)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="195.00"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stock Quantity (Units)</label>
                  <input
                    required
                    type="number"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    placeholder="150"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number</label>
                  <input
                    required
                    value={batchNumber}
                    onChange={e => setBatchNumber(e.target.value)}
                    placeholder="B-AUG-625"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    required
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="Cipla / GlaxoSmithKline"
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    required
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full border border-slate-200 px-3.5 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="rx"
                  checked={prescriptionRequired}
                  onChange={e => setPrescriptionRequired(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="rx" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Prescription Required (Schedule H / H1 Drug)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
                >
                  {editingMed ? 'Save Changes' : 'Register Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to remove this SKU from inventory? This action cannot be reversed.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
