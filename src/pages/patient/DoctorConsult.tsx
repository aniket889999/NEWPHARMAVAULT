import React, { useState } from 'react';
import { 
  Clock, 
  Video, 
  ShieldCheck, 
  Star, 
  User, 
  FileText, 
  Award,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const CLINICAL_DOCTORS = [
  { 
    id: 1, 
    name: 'Dr. Ramesh Kumar, MD', 
    spec: 'General Physician & Internal Medicine', 
    exp: '14 years', 
    regNo: 'MCI-98421',
    rating: 4.9, 
    fee: 500, 
    availableSlots: ['Today 04:00 PM', 'Today 06:30 PM', 'Tomorrow 10:00 AM'],
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=256&h=256' 
  },
  { 
    id: 2, 
    name: 'Dr. Sunita Sharma, DM', 
    spec: 'Consultant Cardiologist', 
    exp: '16 years', 
    regNo: 'MCI-87234',
    rating: 4.9, 
    fee: 800, 
    availableSlots: ['Today 05:00 PM', 'Tomorrow 11:30 AM'],
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256&h=256' 
  },
  { 
    id: 3, 
    name: 'Dr. Aravind Menon, MD', 
    spec: 'Dermatologist & Allergist', 
    exp: '10 years', 
    regNo: 'MCI-76512',
    rating: 4.8, 
    fee: 600, 
    availableSlots: ['Today 07:00 PM', 'Tomorrow 02:00 PM'],
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=256&h=256' 
  }
];

const DoctorConsult: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<any>(CLINICAL_DOCTORS[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>(CLINICAL_DOCTORS[0].availableSlots[0]);
  const [showConsult, setShowConsult] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [symptoms, setSymptoms] = useState('Mild fever and dry cough since yesterday.');

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConsult(true);
    toast.success('Connected to encrypted medical video room');
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">
              Licensed Telehealth Network
            </span>
            <span className="text-xs text-slate-400">HIPAA & Telemedicine Practice Guidelines</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Doctor Teleconsultation</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Connect with board-certified physicians for digital prescription reviews, follow-up assessments, and clinical guidance over end-to-end encrypted video.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Encrypted Video • <strong>No Recording Stored</strong></span>
        </div>
      </div>

      {!showConsult ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Doctors List Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Available Practitioners
              </h2>
              <span className="text-xs text-slate-400">{CLINICAL_DOCTORS.length} Specialists Online</span>
            </div>

            <div className="space-y-3">
              {CLINICAL_DOCTORS.map(doc => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setSelectedSlot(doc.availableSlots[0]);
                    }}
                    className={`p-5 rounded-xl border transition-all cursor-pointer bg-white ${
                      isSelected 
                        ? 'border-blue-600 ring-1 ring-blue-600 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      <img 
                        src={doc.image} 
                        alt={doc.name} 
                        className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">{doc.name}</h3>
                          <div className="flex items-center space-x-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{doc.rating}</span>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-blue-700 mt-0.5">{doc.spec}</p>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" />
                            {doc.exp} Clinical Practice
                          </span>
                          <span className="flex items-center">
                            <Award className="w-3 h-3 mr-1 text-emerald-600" />
                            {doc.regNo}
                          </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Consultation Fee: <strong className="text-slate-900">₹{doc.fee}</strong></span>
                          <span className="text-blue-700 font-semibold">{isSelected ? 'Selected' : 'Select'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Booking / Appointment Column */}
          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs sticky top-4">
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
                Book Consultation Session
              </h3>

              <form onSubmit={handleBook} className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">Selected Physician</span>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-3">
                    <User className="w-4 h-4 text-blue-700" />
                    <div>
                      <p className="font-bold text-slate-900">{selectedDoc?.name}</p>
                      <p className="text-[11px] text-slate-500">{selectedDoc?.spec}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Available Slot</label>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedDoc?.availableSlots.map((slot: string, idx: number) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-3 rounded-lg border text-left font-medium transition-colors ${
                          selectedSlot === slot 
                            ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold' 
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chief Complaints & Symptoms</label>
                  <textarea
                    rows={2}
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    placeholder="Describe your current symptoms or reason for consult..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                  ></textarea>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Standard Consultation Fee:</span>
                  <span className="text-base font-bold text-slate-900 font-mono">₹{selectedDoc?.fee}</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-colors shadow-2xs"
                >
                  <Video className="w-4 h-4" />
                  <span>Start Live Video Consultation</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Clinical Consultation Room */
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
          {/* Top Session Bar */}
          <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center text-white text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">{selectedDoc?.name} • Room ID: PV-VID-{selectedDoc?.id}88</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono text-[11px] text-emerald-400">ENCRYPTED LIVE SESSION</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Video Main Area */}
            <div className="lg:col-span-8 relative bg-slate-950 flex items-center justify-center p-4">
              <img 
                src={selectedDoc?.image} 
                alt="Doctor Live" 
                className={`max-h-[420px] w-full object-cover rounded-xl opacity-90 transition-opacity ${isVideoOff ? 'hidden' : 'block'}`}
              />
              {isVideoOff && (
                <div className="text-center text-slate-500 space-y-2">
                  <VideoOff className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-xs">Video paused by participant</p>
                </div>
              )}

              {/* Patient Self PiP */}
              <div className="absolute top-6 right-6 w-36 h-24 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md flex items-center justify-center">
                <span className="text-[11px] text-slate-400">Patient Camera (Active)</span>
              </div>

              {/* Status overlay */}
              <div className="absolute bottom-6 left-6 text-white text-xs bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700">
                <p className="font-bold">{selectedDoc?.name}</p>
                <p className="text-[11px] text-slate-300">{selectedDoc?.spec}</p>
              </div>
            </div>

            {/* Live Clinical Prescription Notepad on Right */}
            <div className="lg:col-span-4 bg-slate-800/50 border-l border-slate-700 p-5 flex flex-col justify-between text-xs text-slate-300">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-white border-b border-slate-700 pb-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="font-bold">Live Clinical Notes & Prescription</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Reported Symptoms:</span>
                    <p className="text-slate-200 mt-0.5">{symptoms}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-slate-400 block mb-1">Doctor's Prescribed Formulation:</span>
                    <div className="p-2.5 rounded bg-slate-900/60 border border-slate-700 space-y-1">
                      <p className="font-semibold text-white">1. Paracetamol 650mg (Dolo)</p>
                      <p className="text-slate-400 text-[10px]">1 tablet after meals (SOS for body ache)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic">
                * Digital prescription token will automatically synchronize with your Health Records upon call completion.
              </div>
            </div>
          </div>

          {/* Call Controls Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center items-center gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full text-white transition-colors ${isMuted ? 'bg-rose-600' : 'bg-slate-800 hover:bg-slate-700'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 rounded-full text-white transition-colors ${isVideoOff ? 'bg-rose-600' : 'bg-slate-800 hover:bg-slate-700'}`}
              title={isVideoOff ? 'Start Video' : 'Stop Video'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setShowConsult(false)}
              className="py-2.5 px-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center space-x-2 transition-colors shadow-md"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Complete Consultation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorConsult;
