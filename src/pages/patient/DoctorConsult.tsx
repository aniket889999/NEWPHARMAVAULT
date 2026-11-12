import React, { useState } from 'react';
import {
  UserPlus,
  Calendar,
  Clock,
  Video,
  ShieldCheck,
  MapPin,
  Star,
  Award,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  MessageSquare,
  FileText,
  Search,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const DOCTORS = [
  {
    id: 1,
    name: 'Dr. Ramesh Kumar',
    spec: 'General Physician & Diabetologist',
    exp: '14 years',
    rating: 4.9,
    reviews: 218,
    fee: 500,
    regNo: 'MCI-88291',
    available: 'Next slot in 15 mins',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=256&h=256',
    about: 'Specializes in chronic disease management, diabetes care, and evidence-grounded prescription reviews.'
  },
  {
    id: 2,
    name: 'Dr. Sunita Sharma',
    spec: 'Cardiologist & Hypertension Specialist',
    exp: '16 years',
    rating: 4.95,
    reviews: 340,
    fee: 800,
    regNo: 'MCI-44120',
    available: 'Available Today',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256&h=256',
    about: 'Expert in cardiovascular risk assessment, lipid management, and clinical medication reconciliation.'
  },
  {
    id: 3,
    name: 'Dr. Aravind Menon',
    spec: 'Consultant Dermatologist',
    exp: '9 years',
    rating: 4.8,
    reviews: 145,
    fee: 600,
    regNo: 'MCI-99031',
    available: 'Next slot at 4:30 PM',
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=256&h=256',
    about: 'Clinical dermatology and allergy management with verified pharmaceutical treatment pathways.'
  }
];

const DoctorConsult: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<any>(DOCTORS[0]);
  const [showConsult, setShowConsult] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('2026-11-13');
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM');
  const [reason, setReason] = useState('Medication review and prescription refill approval');
  const [searchSpec, setSearchSpec] = useState('');

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Connected to encrypted video room with ${selectedDoc.name}!`);
    setShowConsult(true);
  };

  const filteredDoctors = DOCTORS.filter(d =>
    d.name.toLowerCase().includes(searchSpec.toLowerCase()) ||
    d.spec.toLowerCase().includes(searchSpec.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-7 font-sans bg-slate-50 min-h-full">
      {!showConsult ? (
        <>
          {/* Top Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Verified Teleconsultation Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Consult Certified Specialists
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Schedule secure video appointments for prescription validation, dosage adjustment, and medical opinions.
              </p>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search specialty or doctor..."
                value={searchSpec}
                onChange={(e) => setSearchSpec(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Doctors List */}
            <div className="lg:col-span-7 space-y-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Available Physicians ({filteredDoctors.length})
              </span>

              {filteredDoctors.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-5 rounded-2xl bg-white border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      <img
                        src={doc.image}
                        alt={doc.name}
                        className="w-16 h-16 rounded-2xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                              <span>{doc.name}</span>
                              <Award className="w-4 h-4 text-blue-600 shrink-0" />
                            </h3>
                            <p className="text-blue-600 font-semibold text-xs mt-0.5">{doc.spec}</p>
                          </div>
                          <div className="flex items-center text-xs font-bold text-slate-900 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200">
                            <Star size={13} className="text-amber-500 mr-1 fill-amber-500" />
                            <span>{doc.rating}</span>
                            <span className="text-slate-400 font-normal ml-1">({doc.reviews})</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {doc.about}
                        </p>

                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 items-center justify-between">
                          <div className="flex gap-3">
                            <span className="flex items-center font-medium"><Clock size={13} className="mr-1 text-slate-400" /> {doc.exp}</span>
                            <span className="flex items-center font-medium text-emerald-600"><CheckCircle2 size={13} className="mr-1" /> {doc.available}</span>
                          </div>
                          <span className="font-black text-slate-900 text-sm">₹{doc.fee} <span className="text-[10px] text-slate-400 font-normal">/ session</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Booking & Consultation Sidebar */}
            <div className="lg:col-span-5">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/90 sticky top-6 space-y-5">
                {selectedDoc ? (
                  <form onSubmit={handleBook} className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Specialist</span>
                        <h3 className="font-bold text-base text-slate-900">{selectedDoc.name}</h3>
                        <p className="text-xs text-blue-600 font-medium">{selectedDoc.spec}</p>
                      </div>
                      <span className="text-xs font-mono px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold">
                        {selectedDoc.regNo}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Select Consultation Date
                      </label>
                      <input
                        type="date"
                        required
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Available Time Slot
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['10:00 AM', '02:30 PM', '05:00 PM'].map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setAppointmentTime(slot)}
                            className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                              appointmentTime === slot
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Reason for Visit / Symptoms
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="Briefly describe what you'd like to discuss..."
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">Session Fee:</span>
                      <span className="font-black text-base text-blue-900">₹{selectedDoc.fee}</span>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 text-xs"
                    >
                      <Video size={16} /> Start Encrypted Teleconsultation
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <UserPlus size={44} className="mx-auto mb-3 opacity-40 text-blue-500" />
                    <p className="text-xs">Choose a doctor from the list to book an appointment.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Live Teleconsultation Room */
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 text-white">
          {/* Call Header */}
          <div className="p-4 bg-slate-950 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Encrypted Clinical Room</span>
                <span className="text-[10px] text-slate-400">Session ID: #TC-2026-9041 • HIPAA & DISHA Compliant</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-rose-400 uppercase">Live 03:24</span>
            </div>
          </div>

          {/* Main Video Stage */}
          <div className="relative aspect-video max-h-[500px] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Remote Doctor Feed */}
            <img
              src={selectedDoc.image}
              alt="Doctor Stream"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />

            {/* Doctor Info Pill */}
            <div className="absolute bottom-6 left-6 bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                Dr
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{selectedDoc.name}</h3>
                <p className="text-[11px] text-slate-400">{selectedDoc.spec}</p>
              </div>
            </div>

            {/* Self Video PIP */}
            <div className="absolute top-6 right-6 w-44 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl flex items-center justify-center">
              {isVideoOff ? (
                <div className="text-center p-2 text-slate-500 text-xs flex flex-col items-center gap-1">
                  <VideoOff className="w-5 h-5" /> Camera Off
                </div>
              ) : (
                <div className="relative w-full h-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                  <span>Patient (You)</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Call Controls Bar */}
          <div className="p-5 bg-slate-950 flex items-center justify-center gap-4 border-t border-slate-800">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={isVideoOff ? 'Start Video' : 'Stop Video'}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            <button
              onClick={() => {
                setShowConsult(false);
                toast('Consultation session concluded.', { icon: '👋' });
              }}
              className="px-6 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2"
            >
              <PhoneOff size={18} /> End Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorConsult;
