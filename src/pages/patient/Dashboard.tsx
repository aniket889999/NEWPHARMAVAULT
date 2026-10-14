import React from 'react';
import { Activity, ShieldCheck, Clock, PlusCircle, Bot, Video, FileText, ChevronRight, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientDashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 h-full overflow-y-auto">
      
      {/* Welcome Banner / Guided Walkthrough */}
      <div className="bg-gradient-to-r from-primary-900 to-primary-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-primary-400 opacity-20 rounded-full translate-y-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">Welcome to PharmaVault! 🚀</h1>
            <p className="text-primary-100 text-lg mb-6 leading-relaxed">
              Your AI-powered personal healthcare companion. For this hackathon demo, try interacting with our AI Health Assistant, scanning a Medicine QR for Blockchain verification, or booking a mock teleconsultation!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/patient/health-assistant" className="bg-white text-primary-900 px-5 py-2.5 rounded-full font-bold shadow-sm hover:shadow-md hover:bg-gray-50 transition-all flex items-center">
                <Bot className="mr-2" size={18} /> Ask AI Assistant
              </Link>
              <Link to="/patient/authenticity" className="bg-primary-800 text-white px-5 py-2.5 rounded-full font-bold shadow-sm hover:bg-primary-900 border border-primary-600 transition-all flex items-center">
                <ShieldCheck className="mr-2" size={18} /> Verify Medicine
              </Link>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mt-6 md:mt-0">
            <HeartPulse size={48} className="text-red-400 animate-pulse mb-2" />
            <span className="font-bold tracking-wide uppercase text-xs text-primary-100">Health Status</span>
            <span className="text-2xl font-black text-white">OPTIMAL</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Explore Features</h2>
        <span className="text-sm font-medium text-gray-500">6 Modules Active</span>
      </div>
      
      {/* Premium Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Link to="/patient/doctor-consult" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 group-hover:bg-blue-100 transition-colors"></div>
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Video className="text-blue-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Teleconsultation</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">Book a secure, end-to-end encrypted video call with certified demo doctors.</p>
          <div className="flex items-center text-blue-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>

        <Link to="/patient/authenticity" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -z-10 group-hover:bg-green-100 transition-colors"></div>
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <ShieldCheck className="text-green-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Blockchain Verifier</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">Scan QR codes to mathematically prove medicine authenticity via our immutable ledger.</p>
          <div className="flex items-center text-green-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>

        <Link to="/patient/prescriptions" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-10 group-hover:bg-purple-100 transition-colors"></div>
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <FileText className="text-purple-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">AI OCR Analyzer</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">Upload handwritten prescriptions for instant AI extraction, safety analysis, and cart addition.</p>
          <div className="flex items-center text-purple-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>

        <Link to="/patient/health-assistant" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 group-hover:bg-indigo-100 transition-colors"></div>
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Bot className="text-indigo-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Gemini Assistant</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">Chat with our context-aware medical AI for safe alternative suggestions and symptom guidance.</p>
          <div className="flex items-center text-indigo-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>

        <Link to="/patient/reminders" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-10 group-hover:bg-orange-100 transition-colors"></div>
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Clock className="text-orange-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Reminders</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">AI-driven medication schedules with SMS/Email notifications to ensure you never miss a dose.</p>
          <div className="flex items-center text-orange-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>

        <Link to="/patient/health-tracker" className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10 group-hover:bg-rose-100 transition-colors"></div>
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Activity className="text-rose-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Health Tracker</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">Log your daily vitals and view beautiful charts to monitor your long-term health trajectory.</p>
          <div className="flex items-center text-rose-600 font-bold text-sm">Launch <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" /></div>
        </Link>
        
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Recent Orders</h2>
          <button className="text-primary-600 text-sm font-medium hover:underline">View All</button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <PackageIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p>No recent orders found. Visit the medicines tab to start shopping.</p>
        </div>
      </div>
    </div>
  );
};

// Quick mock icon
const PackageIcon = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

export default PatientDashboard;
