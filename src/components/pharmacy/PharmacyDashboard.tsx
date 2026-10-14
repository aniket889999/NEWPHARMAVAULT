import React, { useState } from 'react';
import {
  Store,
  Package,
  TrendingDown,
  AlertTriangle,
  Trash2,
  Plus,
  Search,
  Filter,
  Calendar,
  BarChart3
} from 'lucide-react';

interface InventoryItem {
  id: string;
  medicineName: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  reorderLevel: number;
  price: number;
}

interface ShortageAlert {
  id: string;
  medicineName: string;
  currentStock: number;
  predictedShortageDate: string;
  averageDailyUsage: number;
  recommendedReorder: number;
}

interface DisposalRequest {
  id: string;
  medicineName: string;
  quantity: number;
  expiryDate: string;
  status: 'pending' | 'scheduled' | 'completed';
  scheduledDate?: string;
}

const PharmacyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'shortages' | 'disposal'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');

  const mockInventory: InventoryItem[] = [
    {
      id: '1',
      medicineName: 'Paracetamol 500mg',
      quantity: 150,
      batchNumber: 'PAR2024001',
      expiryDate: '2025-12-31',
      reorderLevel: 50,
      price: 25.50
    },
    {
      id: '2',
      medicineName: 'Amoxicillin 250mg',
      quantity: 30,
      batchNumber: 'AMX2024002',
      expiryDate: '2024-08-15',
      reorderLevel: 40,
      price: 149.99
    },
    {
      id: '3',
      medicineName: 'Metformin 500mg',
      quantity: 5,
      batchNumber: 'MET2024004',
      expiryDate: '2025-01-15',
      reorderLevel: 30,
      price: 199.99
    }
  ];

  const mockShortages: ShortageAlert[] = [
    {
      id: '1',
      medicineName: 'Metformin 500mg',
      currentStock: 5,
      predictedShortageDate: '2024-02-05',
      averageDailyUsage: 2.5,
      recommendedReorder: 100
    },
    {
      id: '2',
      medicineName: 'Amoxicillin 250mg',
      currentStock: 30,
      predictedShortageDate: '2024-02-15',
      averageDailyUsage: 4.2,
      recommendedReorder: 150
    }
  ];

  const mockDisposals: DisposalRequest[] = [
    {
      id: '1',
      medicineName: 'Aspirin 75mg',
      quantity: 50,
      expiryDate: '2024-01-20',
      status: 'pending'
    },
    {
      id: '2',
      medicineName: 'Cough Syrup',
      quantity: 25,
      expiryDate: '2024-01-15',
      status: 'scheduled',
      scheduledDate: '2024-02-01'
    },
    {
      id: '3',
      medicineName: 'Vitamin C 500mg',
      quantity: 100,
      expiryDate: '2023-12-31',
      status: 'completed'
    }
  ];

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (quantity <= reorderLevel) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pharmacy Management</h1>
          <p className="text-gray-600 mt-1">Real-time inventory tracking and analytics</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          <span>Add Medicine</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">245</p>
          <p className="text-sm text-gray-600">Total Items in Stock</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">12</p>
          <p className="text-sm text-gray-600">Low Stock Alerts</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">5</p>
          <p className="text-sm text-gray-600">Predicted Shortages</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">8</p>
          <p className="text-sm text-gray-600">Pending Disposals</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'inventory'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Inventory Management</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('shortages')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'shortages'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Shortage Predictions</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('disposal')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'disposal'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5" />
                <span>Disposal Management</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700">Filters</span>
            </button>
          </div>

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {mockInventory.map((item) => {
                const status = getStockStatus(item.quantity, item.reorderLevel);
                const daysUntilExpiry = getDaysUntilExpiry(item.expiryDate);

                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{item.medicineName}</h3>
                        <div className="grid grid-cols-5 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-gray-600">Quantity</p>
                            <p className="font-medium text-gray-900">{item.quantity} units</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Batch Number</p>
                            <p className="font-medium text-gray-900">{item.batchNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Expiry Date</p>
                            <p className={`font-medium ${daysUntilExpiry < 90 ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.expiryDate}
                              {daysUntilExpiry < 90 && (
                                <span className="text-xs block text-red-600">
                                  ({daysUntilExpiry} days left)
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Reorder Level</p>
                            <p className="font-medium text-gray-900">{item.reorderLevel} units</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Price</p>
                            <p className="font-medium text-gray-900">₹{item.price.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {item.quantity <= item.reorderLevel && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          Reorder Now →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'shortages' && (
            <div className="space-y-4">
              {mockShortages.map((alert) => (
                <div
                  key={alert.id}
                  className="border-l-4 border-yellow-500 bg-yellow-50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{alert.medicineName}</h3>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Current Stock</p>
                          <p className="font-medium text-gray-900">{alert.currentStock} units</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Predicted Shortage</p>
                          <p className="font-medium text-red-600">{alert.predictedShortageDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Daily Usage</p>
                          <p className="font-medium text-gray-900">{alert.averageDailyUsage} units/day</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Recommended Reorder</p>
                          <p className="font-medium text-green-600">{alert.recommendedReorder} units</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-yellow-200">
                    <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium">
                      Place Reorder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'disposal' && (
            <div className="space-y-4">
              {mockDisposals.map((disposal) => (
                <div
                  key={disposal.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{disposal.medicineName}</h3>
                      <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-gray-600">Quantity</p>
                          <p className="font-medium text-gray-900">{disposal.quantity} units</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Expiry Date</p>
                          <p className="font-medium text-red-600">{disposal.expiryDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Status</p>
                          <p className="font-medium text-gray-900 capitalize">{disposal.status}</p>
                        </div>
                        {disposal.scheduledDate && (
                          <div>
                            <p className="text-gray-600">Scheduled Date</p>
                            <p className="font-medium text-gray-900">{disposal.scheduledDate}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        disposal.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : disposal.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {disposal.status}
                    </span>
                  </div>
                  {disposal.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex space-x-3">
                      <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <Calendar className="w-4 h-4" />
                        <span>Schedule Disposal</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
