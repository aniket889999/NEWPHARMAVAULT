import React, { useState } from 'react';
import { Search, Filter, ShieldCheck } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { searchMedicines } from '../data/medicines';
import MedicineList from '../components/medicine/MedicineList';

const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const { 
    selectedMedicine,
    selectMedicine
  } = useChatStore();

  const allFilteredMedicines = searchMedicines(searchQuery).filter(med => 
    filterCategory === 'All' ? true : med.category === filterCategory
  );

  const categories = [
    'All',
    'Antibiotic',
    'Analgesic',
    'Antidiabetic',
    'Gastrointestinal',
    'Statin',
    'Respiratory'
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 font-sans">
      {/* Top Header Card */}
      <div className="p-6 bg-white border-b border-slate-200 shadow-2xs z-10 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
                CDSCO Verified Catalogue
              </span>
              <span className="text-xs text-slate-400">Authentic Formulations Only</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medicine Directory & Formulary</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse approved medications, check chemical salt formulations, and verify packaging authenticity.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Active Catalogue: <strong>Reference Standard 2026.1</strong></span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand name, salt composition (e.g. Paracetamol, Cipla, Dolo)..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-8 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white font-medium text-slate-700"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Therapeutic Classes' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Scrollable Medicines Catalogue List */}
      <div className="flex-1 overflow-y-auto">
        <MedicineList 
          medicines={allFilteredMedicines} 
          selectedMedicine={selectedMedicine}
          onSelectMedicine={selectMedicine}
          isGrid={true}
        />
      </div>
    </div>
  );
};

export default HomePage;
