import React, { useState } from 'react';
import { Search, MapPin, Phone, Navigation, Clock, Check, X, AlertCircle } from 'lucide-react';

interface PharmacyAvailability {
  id: string;
  pharmacyName: string;
  address: string;
  distance: number;
  phone: string;
  available: boolean;
  quantity: number;
  price: number;
  openNow: boolean;
  openingHours: string;
}

const MedicineAvailability: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PharmacyAvailability[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const mockPharmacies: PharmacyAvailability[] = [
    {
      id: '1',
      pharmacyName: 'MedPlus Pharmacy',
      address: 'Shop 12, Downtown Plaza, Main Street',
      distance: 0.5,
      phone: '+91 9876543210',
      available: true,
      quantity: 150,
      price: 25.50,
      openNow: true,
      openingHours: '8:00 AM - 10:00 PM'
    },
    {
      id: '2',
      pharmacyName: 'Apollo Pharmacy',
      address: '45, City Center Mall, 2nd Floor',
      distance: 1.2,
      phone: '+91 9876543211',
      available: true,
      quantity: 200,
      price: 24.00,
      openNow: true,
      openingHours: '7:00 AM - 11:00 PM'
    },
    {
      id: '3',
      pharmacyName: 'HealthCare Pharmacy',
      address: '78, Green Park Road, Near Bus Stand',
      distance: 2.1,
      phone: '+91 9876543212',
      available: false,
      quantity: 0,
      price: 0,
      openNow: true,
      openingHours: '9:00 AM - 9:00 PM'
    },
    {
      id: '4',
      pharmacyName: 'Wellness Pharmacy',
      address: '234, Lakeview Street, Sector 5',
      distance: 3.5,
      phone: '+91 9876543213',
      available: true,
      quantity: 50,
      price: 26.00,
      openNow: false,
      openingHours: '8:00 AM - 8:00 PM'
    }
  ];

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSelectedMedicine(searchQuery);

    setTimeout(() => {
      setSearchResults(mockPharmacies);
      setIsSearching(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Medicine Availability</h1>
        <p className="text-gray-600 mt-1">
          Check medicine availability across nearby pharmacies in real-time
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for a medicine (e.g., Paracetamol, Amoxicillin)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>Showing results within 5 km of your location</span>
        </div>
      </div>

      {selectedMedicine && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">
                Searching for: {selectedMedicine}
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                Found {searchResults.filter(p => p.available).length} pharmacies with this medicine in stock
              </p>
            </div>
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Available at {searchResults.filter(p => p.available).length} Locations
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Sort by:</span>
              <select className="border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>Distance</option>
                <option>Price (Low to High)</option>
                <option>Price (High to Low)</option>
                <option>Availability</option>
              </select>
            </div>
          </div>

          {searchResults.map((pharmacy) => (
            <div
              key={pharmacy.id}
              className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                pharmacy.available ? 'border-green-200' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{pharmacy.pharmacyName}</h3>
                      {pharmacy.available ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>In Stock</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center space-x-1">
                          <X className="w-3 h-3" />
                          <span>Out of Stock</span>
                        </span>
                      )}
                      {pharmacy.openNow ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          Open Now
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                          Closed
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{pharmacy.address}</span>
                        <span className="text-blue-600 font-medium">({pharmacy.distance} km away)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{pharmacy.openingHours}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{pharmacy.phone}</span>
                      </div>
                    </div>
                  </div>

                  {pharmacy.available && (
                    <div className="text-right ml-6">
                      <p className="text-3xl font-bold text-gray-900">₹{pharmacy.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600 mt-1">{pharmacy.quantity} units available</p>
                    </div>
                  )}
                </div>

                {pharmacy.available && (
                  <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                    <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      <span>Reserve Now</span>
                    </button>
                    <button className="flex items-center justify-center space-x-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      <Navigation className="w-4 h-4" />
                      <span>Get Directions</span>
                    </button>
                    <button className="flex items-center justify-center space-x-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      <Phone className="w-4 h-4" />
                      <span>Call</span>
                    </button>
                  </div>
                )}

                {!pharmacy.available && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">
                      This medicine is currently out of stock at this location. Would you like to:
                    </p>
                    <div className="flex items-center space-x-3">
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm">
                        Get Notified When Available
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm">
                        Find Alternative Medicine
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && !selectedMedicine && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Search for Medicine Availability
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Enter a medicine name in the search box above to check real-time availability
            across nearby pharmacies in your area.
          </p>
        </div>
      )}
    </div>
  );
};

export default MedicineAvailability;
