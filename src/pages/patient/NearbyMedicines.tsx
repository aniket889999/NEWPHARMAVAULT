import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { MapPin, Navigation, Clock, Store, IndianRupee, ArrowLeft, Star, ShoppingBag, Info } from 'lucide-react';
import toast from 'react-hot-toast';

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pharmacyIconInStock = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pharmacyIconOutOfStock = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to dynamically pan map to selected location
function MapRecenter({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 14, { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface Pharmacy {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating: number;
  openStatus: boolean;
  nabhCertified: boolean;
  distance: number;
  estimatedTime: number;
  medicineStock: number;
  medicinePrice: number;
  searchedMedicine: string;
}

const NearbyMedicines: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const medicineName = searchParams.get('medicine') || 'Medicine';
  
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'nearest' | 'cheapest' | 'instock'>('nearest');
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  
  // Default to Pune if location fails
  const DEFAULT_LAT = 18.5204;
  const DEFAULT_LNG = 73.8567;
  
  const [userLocation, setUserLocation] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          fetchNearbyPharmacies(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Location access denied or failed", error);
          setLocationError(true);
          fetchNearbyPharmacies(DEFAULT_LAT, DEFAULT_LNG);
        }
      );
    } else {
      fetchNearbyPharmacies(DEFAULT_LAT, DEFAULT_LNG);
    }
  }, [medicineName]);

  const fetchNearbyPharmacies = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/pharmacies/nearby?medicine=${encodeURIComponent(medicineName)}&lat=${lat}&lng=${lng}`);
      setPharmacies(data.data);
      if (data.data.length > 0) setSelectedPharmacy(data.data[0]);
    } catch (error) {
      console.error('Failed to fetch nearby pharmacies', error);
      toast.error('Failed to fetch nearby pharmacies');
    } finally {
      setLoading(false);
    }
  };

  const sortedPharmacies = [...pharmacies].sort((a, b) => {
    if (filter === 'cheapest') return a.medicinePrice - b.medicinePrice;
    if (filter === 'instock') return b.medicineStock - a.medicineStock;
    return a.distance - b.distance; // nearest default
  });

  const handleReserve = (pharm: Pharmacy) => {
    toast.success(`Reserved ${medicineName} at ${pharm.name}! Check your SMS for details.`, {
      icon: '✅',
      duration: 4000
    });
  };

  const handleGetDirections = (pharm: Pharmacy) => {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${pharm.lat},${pharm.lng}&travelmode=driving`, '_blank');
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center">
              <MapPin className="text-primary-600 mr-2" size={24}/> Nearby Availability
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Searching for: <span className="font-bold text-slate-700">{medicineName}</span></p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setFilter('nearest')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'nearest' ? 'bg-white shadow text-primary-700' : 'text-slate-600 hover:text-slate-900'}`}>Nearest</button>
          <button onClick={() => setFilter('cheapest')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'cheapest' ? 'bg-white shadow text-primary-700' : 'text-slate-600 hover:text-slate-900'}`}>Cheapest</button>
          <button onClick={() => setFilter('instock')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'instock' ? 'bg-white shadow text-primary-700' : 'text-slate-600 hover:text-slate-900'}`}>In Stock</button>
        </div>
      </div>

      {locationError && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center text-yellow-800 text-sm shrink-0">
          <Info size={16} className="mr-2 text-yellow-600"/> Location access denied. Showing default region (Pune). Please enable location services for accurate distances.
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar List */}
        <div className="w-full md:w-[400px] lg:w-[450px] bg-white border-r border-slate-200 flex flex-col overflow-y-auto custom-scrollbar z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
              <p>Scanning nearby pharmacies...</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {sortedPharmacies.map((pharm, idx) => {
                const isSelected = selectedPharmacy?.id === pharm.id;
                const inStock = pharm.medicineStock > 0;
                
                return (
                  <div 
                    key={pharm.id} 
                    onClick={() => setSelectedPharmacy(pharm)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-50/30 shadow-md transform scale-[1.02]' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center">
                          {pharm.name} 
                          {pharm.nabhCertified && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold" title="NABH Certified">NABH</span>}
                        </h3>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Star size={12} className="text-yellow-400 fill-current mr-1"/> {pharm.rating}
                          <span className="mx-2">•</span>
                          <span className={pharm.openStatus ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {pharm.openStatus ? 'Open Now' : 'Closed'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Price Badge */}
                      <div className="text-right">
                        <div className="font-black text-lg text-slate-900 flex items-center justify-end">
                          <IndianRupee size={16}/>{pharm.medicinePrice}
                        </div>
                        {filter === 'cheapest' && idx === 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Best Price</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                      <div className="flex items-center"><Navigation size={14} className="mr-1.5 text-slate-400"/> {pharm.distance.toFixed(1)} km</div>
                      <div className="flex items-center"><Clock size={14} className="mr-1.5 text-slate-400"/> ~{pharm.estimatedTime} mins</div>
                    </div>

                    {/* Stock Status Box */}
                    <div className={`p-3 rounded-lg border flex items-center justify-between mb-4 ${
                      inStock ? (pharm.medicineStock > 10 ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100') : 'bg-red-50 border-red-100'
                    }`}>
                      <div className="flex items-center">
                        <Store size={18} className={`mr-2 ${inStock ? (pharm.medicineStock > 10 ? 'text-green-600' : 'text-orange-600') : 'text-red-600'}`}/>
                        <div>
                          <p className={`text-xs font-bold ${inStock ? (pharm.medicineStock > 10 ? 'text-green-800' : 'text-orange-800') : 'text-red-800'}`}>
                            {inStock ? (pharm.medicineStock > 10 ? 'In Stock' : 'Limited Stock') : 'Out of Stock'}
                          </p>
                          <p className={`text-[10px] ${inStock ? 'text-green-600' : 'text-red-600'}`}>
                            {pharm.medicineStock} units available
                          </p>
                        </div>
                      </div>
                      {filter === 'nearest' && idx === 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Nearest</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReserve(pharm); }}
                        disabled={!inStock || !pharm.openStatus}
                        className="flex-1 bg-primary-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-700 disabled:bg-slate-300 transition-colors flex items-center justify-center shadow-sm"
                      >
                        <ShoppingBag size={16} className="mr-2"/> Reserve
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleGetDirections(pharm); }}
                        className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm"
                      >
                        <Navigation size={16} className="mr-2 text-primary-600"/> Directions
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leaflet Map Area */}
        <div className="hidden md:block flex-1 relative bg-slate-100 z-0">
          <MapContainer 
            center={[userLocation.lat, userLocation.lng]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            
            {/* Auto-pan to selected pharmacy */}
            {selectedPharmacy && <MapRecenter lat={selectedPharmacy.lat} lng={selectedPharmacy.lng} />}
            
            {/* User Marker */}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <div className="font-bold text-slate-900">You are here</div>
              </Popup>
            </Marker>

            {/* Pharmacy Markers */}
            {pharmacies.map((pharm) => {
              const inStock = pharm.medicineStock > 0;
              return (
                <Marker 
                  key={pharm.id}
                  position={[pharm.lat, pharm.lng]}
                  icon={inStock ? pharmacyIconInStock : pharmacyIconOutOfStock}
                  eventHandlers={{
                    click: () => setSelectedPharmacy(pharm),
                  }}
                >
                  <Popup>
                    <div className="min-w-[150px]">
                      <h3 className="font-bold text-sm mb-1">{pharm.name}</h3>
                      <p className="text-xs text-slate-600 mb-2">{pharm.distance.toFixed(1)} km away</p>
                      
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">₹{pharm.medicinePrice}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleReserve(pharm)}
                        disabled={!inStock || !pharm.openStatus}
                        className="w-full bg-primary-600 text-white text-xs font-bold py-1.5 rounded hover:bg-primary-700 disabled:bg-slate-300"
                      >
                        Reserve Now
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default NearbyMedicines;
