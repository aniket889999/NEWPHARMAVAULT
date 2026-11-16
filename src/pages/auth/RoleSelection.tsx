import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Store, ShieldCheck } from 'lucide-react';
import { STAFF_PORTALS } from '../../features/navigation/portalPolicy';

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const [staffRole, setStaffRole] = useState<string>('claims_reviewer');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-primary-600 mb-2">PharmaVault</h1>
        <p className="text-gray-500">Please select your portal to continue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <div
          onClick={() => navigate('/login?role=patient')}
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-500 transition-all cursor-pointer flex flex-col items-center text-center group"
        >
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-primary-50 transition-colors">
            <User size={40} className="text-primary-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Portal</h2>
          <p className="text-gray-500">Order medicines, track health, upload prescriptions, and view verification cases.</p>
        </div>

        <div
          onClick={() => navigate('/login?role=pharmacy')}
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-green-500 transition-all cursor-pointer flex flex-col items-center text-center group"
        >
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-100 transition-colors">
            <Store size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pharmacy Portal</h2>
          <p className="text-gray-500">Manage inventory, fulfill orders, review prescriptions, and manage branch operations.</p>
        </div>

        <div
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-500 transition-all cursor-pointer flex flex-col items-center text-center group"
        >
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-indigo-100 transition-colors">
            <ShieldCheck size={40} className="text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reviewer Portal</h2>
          <p className="text-gray-500">TrustRAG verification queue, cross-document discrepancies, evidence lineage, and HITL adjudication.</p>
          <label htmlFor="staff-role" className="mt-5 text-sm text-slate-600">Existing staff account role</label>
          <select id="staff-role" value={staffRole} onChange={event => setStaffRole(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {STAFF_PORTALS.map(option => <option key={option.role} value={option.role}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => navigate('/login?role=' + staffRole)} className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">Continue to staff sign-in</button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
