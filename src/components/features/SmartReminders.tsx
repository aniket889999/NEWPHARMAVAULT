import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, CheckCircle2, AlertCircle, Plus, Mail, Trash2, PlayCircle, Info } from 'lucide-react';
import apiClient from '../../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const SmartReminders: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    medicineName: '',
    dosage: '',
    reminderTime: '',
    frequency: 'daily',
    email: ''
  });

  const fetchReminders = async () => {
    try {
      const { data } = await apiClient.get('/reminders/my-reminders');
      setReminders(Array.isArray(data) ? data : []);
    } catch (error) {
      setReminders([]);
      toast.error('Could not load your reminders. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/reminders/create', { ...formData, email: formData.email || user?.email || '' });
      toast.success('Reminder created. You will get a notification at the set time.');
      setShowAddModal(false);
      setFormData({ medicineName: '', dosage: '', reminderTime: '', frequency: 'daily', email: '' });
      fetchReminders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'The reminder could not be saved.');
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await apiClient.put(`/reminders/${id}`, { status: newStatus });
      setReminders(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
    } catch (error) {
      toast.error('Could not update the reminder.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await apiClient.delete(`/reminders/${id}`);
      setReminders(prev => prev.filter(r => r._id !== id));
      toast.success('Reminder deleted');
    } catch (error) {
      toast.error('Could not delete the reminder.');
    }
  };

  const handleSendTestEmail = async (reminder: any) => {
    try {
      toast.loading('Sending test email...', { id: 'test-email' });
      await apiClient.post('/reminders/send-test', {
        medicineName: reminder.medicineName,
        dosage: reminder.dosage,
        email: reminder.email
      });
      toast.success('Reminder email sent successfully', { id: 'test-email' });
    } catch (error) {
      toast.error('Test email could not be sent (email is not configured on this server). In-app notifications still work.', { id: 'test-email' });
    }
  };

  const pendingCount = reminders.filter(r => r.status === 'active').length;

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6 font-sans">
      {/* Coming Soon Hero Banner */}
      <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-full tracking-wider">
                Live • In-app alerts
              </span>
              <span className="text-xs text-slate-400 font-mono">Checked every minute (IST)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Smart Medication Reminders & Adherence Hub
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Set a time for each dose. At that time you get a notification in the bell (and email or SMS when they are configured). A dose marked as taken comes back the next day.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Information Banner */}
      <div className="bg-teal-50 border border-teal-200 text-teal-900 p-4 rounded-xl flex items-start shadow-2xs">
        <Info className="mr-3 flex-shrink-0 mt-0.5 text-teal-700 w-5 h-5" />
        <div className="text-xs">
          <p className="font-bold">Automated Medication Adherence System</p>
          <p className="text-teal-700 mt-0.5">
            Reminders are sent by the server even when this page is closed. Times are India time (IST).
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Dose Schedule</h2>
          <p className="text-xs text-slate-500 mt-0.5">Prescription dosing schedule and automated patient adherence tracking</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Dose Reminder</span>
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-center">
          <AlertCircle className="w-4 h-4 text-amber-600 mr-2 flex-shrink-0" />
          <span>You have <strong>{pendingCount} active dose(s)</strong> due on your schedule. Mark as taken once consumed.</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading schedule...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
              <Bell className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              Active Medication Schedule
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">{reminders.length} Registered</span>
          </div>
          
          <div className="divide-y divide-slate-100">
            {reminders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Bell className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No dose reminders scheduled</p>
                <p className="text-xs text-slate-400 mt-1">Click "Add Dose Reminder" to set your first schedule.</p>
              </div>
            ) : reminders.map((reminder) => (
              <div 
                key={reminder._id} 
                className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between transition-colors ${
                  reminder.status === 'taken' ? 'bg-slate-50/70 opacity-75' : 'hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center mb-3 md:mb-0">
                  <button 
                    onClick={() => handleStatusUpdate(reminder._id, reminder.status === 'taken' ? 'active' : 'taken')}
                    className={`flex-shrink-0 w-6 h-6 rounded-md border flex items-center justify-center mr-3.5 transition-colors ${
                      reminder.status === 'taken' 
                        ? 'border-emerald-500 bg-emerald-500 text-white' 
                        : 'border-slate-300 hover:border-teal-500'
                    }`}
                    title={reminder.status === 'taken' ? 'Mark as active' : 'Mark as taken'}
                  >
                    {reminder.status === 'taken' && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  
                  <div>
                    <h3 className={`font-semibold text-sm ${reminder.status === 'taken' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {reminder.medicineName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">Dose: {reminder.dosage}</span>
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1 text-slate-400" />{reminder.reminderTime}</span>
                      <span className="flex items-center capitalize"><Calendar className="w-3 h-3 mr-1 text-slate-400" />{reminder.frequency}</span>
                      {reminder.email && (
                        <span className="flex items-center"><Mail className="w-3 h-3 mr-1 text-slate-400" />{reminder.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto pl-9 md:pl-0">
                  <button 
                    onClick={() => handleSendTestEmail(reminder)}
                    className="px-2.5 py-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 flex items-center transition-colors"
                  >
                    <PlayCircle className="w-3 h-3 mr-1" />
                    <span>Send Test Email</span>
                  </button>
                  
                  <button 
                    onClick={() => handleDelete(reminder._id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Add New Dose Reminder</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateReminder} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Dolo 650mg"
                  value={formData.medicineName}
                  onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dosage Instructions</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 1 Tablet after food"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dose Time</label>
                  <input 
                    type="time" 
                    required
                    value={formData.reminderTime}
                    onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                  <select 
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="twice_daily">Twice Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="as_needed">As Needed (SOS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notification Email</label>
                <input 
                  type="email" 
                  placeholder="patient@test.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartReminders;
