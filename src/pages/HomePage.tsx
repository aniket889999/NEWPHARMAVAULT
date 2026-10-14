import React, { useEffect, useState } from 'react';
import { Search, ArrowLeft, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

  return (
    <div className="flex h-full flex-col overflow-hidden relative">
      <div className="flex flex-col h-full bg-gray-50 w-full shadow-inner">
        
        <div className="p-6 bg-white border-b border-gray-200 z-10 shadow-sm relative">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Medicine Directory</h2>
              <p className="text-sm text-gray-500 mt-1">Browse, search and verify authentic medications.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, brand, or ingredients (NLP ready)..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow shadow-sm"
              />
            </div>
            
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none appearance-none bg-white shadow-sm font-medium text-gray-700"
              >
                <option value="All">All Categories</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Analgesic">Pain Relief</option>
                <option value="Antidiabetic">Diabetes</option>
                <option value="Statin">Heart/Statin</option>
                <option value="ACE Inhibitor">Blood Pressure</option>
                <option value="Respiratory">Respiratory</option>
                <option value="Mental Health">Mental Health</option>
                <option value="Gastrointestinal">Gastrointestinal</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <MedicineList 
            medicines={allFilteredMedicines} 
            selectedMedicine={selectedMedicine}
            onSelectMedicine={selectMedicine}
            isGrid={true}
          />
        </div>
      </div>
    </div>
  );
};

export default HomePage;