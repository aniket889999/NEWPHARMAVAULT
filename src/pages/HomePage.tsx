import React, { useState } from 'react';
import { Search, Filter, Pill, ShieldCheck } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import MedicineList from '../components/medicine/MedicineList';

const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const { selectedMedicine, selectMedicine } = useChatStore();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 font-sans">
      {/* Top Search & Filter Bar */}
      <div className="p-6 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-1">
              <Pill className="w-3.5 h-3.5 text-blue-600" />
              <span>Verified Medicine Catalogue</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pharmaceutical Catalogue</h2>
            <p className="text-xs text-slate-500 mt-0.5">Browse authentic medications, check live stock, and order direct.</p>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Authentic Batches
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand name, generic formulation, or active ingredient..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-2xs"
            />
          </div>

          <div className="relative">
            <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 appearance-none shadow-2xs cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Antibiotic">Antibiotic</option>
              <option value="Analgesic">Pain Relief (Analgesic)</option>
              <option value="Antidiabetic">Antidiabetic</option>
              <option value="Gastrointestinal">Gastrointestinal</option>
              <option value="Antihistamine">Antihistamine</option>
              <option value="Respiratory">Respiratory</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Medicines Grid */}
      <div className="flex-1 overflow-y-auto">
        <MedicineList 
          selectedMedicine={selectedMedicine}
          onSelectMedicine={selectMedicine}
          isGrid={true}
          searchQuery={searchQuery}
          filterCategory={filterCategory}
        />
      </div>
    </div>
  );
};

export default HomePage;
