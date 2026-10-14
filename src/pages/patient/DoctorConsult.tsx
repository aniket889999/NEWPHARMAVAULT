import React, { useState } from 'react';
import { UserPlus, Calendar, Clock, Video, AlertTriangle, ShieldCheck, MapPin, Star } from 'lucide-react';

const FAKE_DOCTORS = [
  { id: 1, name: 'Dr. Ramesh Kumar', spec: 'General Physician', exp: '12 years', rating: 4.8, fee: 500, image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=256&h=256' },
  { id: 2, name: 'Dr. Sunita Sharma', spec: 'Cardiologist', exp: '15 years', rating: 4.9, fee: 800, image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256&h=256' },
  { id: 3, name: 'Dr. Aravind Menon', spec: 'Dermatologist', exp: '8 years', rating: 4.7, fee: 600, image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=256&h=256' }
];

const DoctorConsult: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showConsult, setShowConsult] = useState(false);

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConsult(true);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
      {/* Demo Disclaimer */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-8 rounded-r-lg shadow-sm">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-yellow-800">Academic Project Disclaimer</h3>
            <p className="mt-1 text-sm text-yellow-700">
              This Doctor Consultation system is a <strong>DEMO ONLY</strong> for academic purposes. 
              These are not real doctors, and no real medical consultation will take place. Do not use this for actual medical emergencies.
            </p>
          </div>
        </div>
      </div>

      {!showConsult ? (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Video className="text-primary-600 mr-3 h-8 w-8" /> 
              Teleconsultation (Demo)
            </h1>
            <p className="text-gray-500 mt-2">Book a video consultation with our certified specialists.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Doctors List */}
            <div className="lg:col-span-2 space-y-4">
              {FAKE_DOCTORS.map(doc => (
                <div key={doc.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${selectedDoc?.id === doc.id ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'}`} onClick={() => setSelectedDoc(doc)}>
                  <div className="flex gap-4 items-center">
                    <img src={doc.image} alt={doc.name} className="w-20 h-20 rounded-xl object-cover bg-gray-100" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-900">{doc.name}</h3>
                        <div className="flex items-center text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded">
                          <Star size={14} className="text-yellow-500 mr-1 fill-current" /> {doc.rating}
                        </div>
                      </div>
                      <p className="text-primary-600 font-medium text-sm">{doc.spec}</p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center"><Clock size={14} className="mr-1" /> {doc.exp} exp</span>
                        <span className="flex items-center"><MapPin size={14} className="mr-1" /> Available Online</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Booking Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit sticky top-8">
              {selectedDoc ? (
                <form onSubmit={handleBook}>
                  <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-3">Book Appointment</h3>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Selected Doctor</p>
                    <p className="font-bold">{selectedDoc.name}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                      <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Time Slot</label>
                      <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none">
                        <option value="">Choose a slot...</option>
                        <option value="10:00 AM">10:00 AM - 10:30 AM</option>
                        <option value="2:00 PM">02:00 PM - 02:30 PM</option>
                        <option value="5:30 PM">05:30 PM - 06:00 PM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason for visit</label>
                      <textarea required rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Briefly describe your symptoms..."></textarea>
                    </div>
                  </div>

                  <div className="mt-6 border-t pt-4 flex justify-between items-center mb-6">
                    <span className="text-gray-500">Consultation Fee</span>
                    <span className="font-bold text-xl">₹{selectedDoc.fee}</span>
                  </div>

                  <button type="submit" className="w-full bg-primary-600 text-white font-bold py-3 rounded-lg hover:bg-primary-700 transition-colors flex justify-center items-center">
                    <Calendar className="mr-2" size={18} /> Book Demo Session
                  </button>
                </form>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a doctor from the list to view booking details.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Consultation Room Demo */
        <div className="bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
          <div className="p-4 bg-gray-800 flex justify-between items-center text-white">
            <div className="flex items-center">
              <ShieldCheck className="text-green-400 mr-2" />
              <span className="font-medium">Secure End-to-End Encrypted Call</span>
            </div>
            <div className="px-3 py-1 bg-red-500 rounded text-xs font-bold animate-pulse">
              LIVE DEMO
            </div>
          </div>
          
          <div className="relative aspect-video bg-gray-800">
            {/* Remote Video Mock */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img src={selectedDoc.image} alt="Doctor" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <h2 className="text-2xl font-bold">{selectedDoc.name}</h2>
                <p className="text-gray-300">{selectedDoc.spec}</p>
              </div>
            </div>
            
            {/* Self Video Mock */}
            <div className="absolute top-6 right-6 w-48 aspect-video bg-gray-700 rounded-xl overflow-hidden border-2 border-gray-600 shadow-lg flex items-center justify-center">
              <span className="text-gray-400 text-sm">Camera Off</span>
            </div>
          </div>

          <div className="p-6 bg-gray-900 flex justify-center gap-6">
            <button className="w-14 h-14 rounded-full bg-gray-700 text-white flex justify-center items-center hover:bg-gray-600"><Video /></button>
            <button className="w-14 h-14 rounded-full bg-gray-700 text-white flex justify-center items-center hover:bg-gray-600"><MicOff /></button>
            <button onClick={() => setShowConsult(false)} className="px-8 h-14 rounded-full bg-red-600 text-white font-bold flex justify-center items-center hover:bg-red-700">End Call</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Fake mic icon since it might not be imported
const MicOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);

export default DoctorConsult;
