import React, { useState } from 'react';
import { Activity, Heart, Thermometer, Upload, FileText, Download, Calendar, Plus } from 'lucide-react';

const mockReports = [
  { id: 1, name: 'Blood Test Results', date: '2025-10-15', type: 'PDF' },
  { id: 2, name: 'Annual Physical Scan', date: '2025-08-22', type: 'PDF' },
  { id: 3, name: 'Vitamin D Assessment', date: '2025-06-10', type: 'JPG' }
];

const mockVitals = [
  { label: 'Heart Rate', value: '72 bpm', status: 'Normal', icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
  { label: 'Blood Pressure', value: '118/76', status: 'Optimal', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Body Temp', value: '98.6°F', status: 'Normal', icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50' }
];

const PersonalHealthTracker: React.FC = () => {
  const [reports, setReports] = useState(mockReports);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Personal Health Tracker</h1>
        <p className="text-gray-600">Monitor your vitals, track your history, and manage medical reports.</p>
      </div>

      {/* Vitals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockVitals.map((vital, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{vital.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{vital.value}</h3>
              <p className="text-sm text-green-600 font-medium mt-1">{vital.status}</p>
            </div>
            <div className={`p-4 rounded-full ${vital.bg}`}>
              <vital.icon className={`h-8 w-8 ${vital.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports Section */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-600" />
              Recent Medical Reports
            </h2>
            <button className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="h-4 w-4 mr-1.5" />
              Upload Report
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {reports.map((report) => (
              <div key={report.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs mr-4">
                    {report.type}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-500 flex items-center mt-0.5">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      {report.date}
                    </p>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Health Summary */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl shadow-sm border border-indigo-100 p-6">
          <h2 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-indigo-600" />
            AI Health Insights
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-indigo-800 leading-relaxed">
              Based on your recent <strong>Vitamin D Assessment</strong> and reported symptoms of fatigue, your Vitamin D levels are slightly below optimal.
            </p>
            <div className="bg-white p-4 rounded-lg bg-opacity-60 border border-indigo-100">
              <h4 className="text-sm font-bold text-gray-900 mb-2">Recommendations:</h4>
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                <li>Increase sun exposure by 15 mins/day</li>
                <li>Consider asking your doctor about a 1000 IU Vitamin D3 supplement</li>
                <li>Consume more fortified dairy or fish</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalHealthTracker;
