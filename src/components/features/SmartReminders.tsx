import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, CheckCircle2, AlertCircle, Plus, Mail, Trash2, Edit2, PlayCircle } from 'lucide-react';
import apiClient from '../../api/apiClient';
import toast from 'react-hot-toast';

const SmartReminders: React.FC = () => {
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
      setReminders(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load reminders');
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
      await apiClient.post('/reminders/create', formData);
      toast.success('Reminder created and confirmation email sent!');
      setShowAddModal(false);
      setFormData({ medicineName: '', dosage: '', reminderTime: '', frequency: 'daily', email: '' });
      fetchReminders();
    } catch (error) {
      toast.error('Failed to create reminder');
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await apiClient.put(`/reminders/${id}`, { status: newStatus });
      fetchReminders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await apiClient.delete(`/reminders/${id}`);
      toast.success('Reminder deleted');
      fetchReminders();
    } catch (error) {
      toast.error('Failed to delete reminder');
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
      toast.error('Failed to send email. Check backend logs.', { id: 'test-email' });
    }
  };

  const pendingCount = reminders.filter(r => r.status === 'active').length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start shadow-sm">
        <Info className="mr-3 flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-bold">Demo Email System Active</p>
          <p className="text-sm">This is a demo reminder system. Actual scheduled cron jobs are simulated by clicking "Send Test Email". Please follow your doctor’s actual prescription.</p>
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Reminders</h1>
          <p className="text-gray-600">Never miss a dose. Get email alerts automatically.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5 mr-1.5" />
          Add Reminder
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-yellow-500 mr-3" />
            <div>
              <h3 className="text-yellow-800 font-medium">You have {pendingCount} active reminder(s).</h3>
              <p className="text-sm text-yellow-700 mt-0.5">Please mark as taken once you consume your medicine.</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading reminders...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="h-5 w-5 mr-2 text-indigo-600" />
              Your Schedule
            </h2>
          </div>
          
          <div className="divide-y divide-gray-100">
            {reminders.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <Bell className="h-10 w-10 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-700">No active reminders</p>
                <p className="text-sm mt-1">Click the "Add Reminder" button above to schedule your first dose.</p>
              </div>
            ) : reminders.map((reminder) => (
              <div key={reminder._id} className={`p-5 flex flex-col md:flex-row items-start md:items-center justify-between transition-colors ${reminder.status === 'taken' ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center mb-4 md:mb-0">
                  <button 
                    onClick={() => handleStatusUpdate(reminder._id, reminder.status === 'taken' ? 'active' : 'taken')}
                    className={`flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                      reminder.status === 'taken' 
                        ? 'border-green-500 bg-green-500 text-white' 
                        : 'border-gray-300 hover:border-indigo-500'
                    }`}
                  >
                    {reminder.status === 'taken' && <CheckCircle2 className="h-5 w-5" />}
                  </button>
                  
                  <div>
                    <h3 className={`font-semibold text-lg ${reminder.status === 'taken' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {reminder.medicineName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">Dosage: {reminder.dosage}</span>
                      <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1" />{reminder.reminderTime}</span>
                      <span className="flex items-center capitalize"><Calendar className="h-3.5 w-3.5 mr-1" />{reminder.frequency}</span>
                      <span className="flex items-center"><Mail className="h-3.5 w-3.5 mr-1" />{reminder.email}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto pl-12 md:pl-0">
                  <button 
                    onClick={() => handleSendTestEmail(reminder)}
                    className="flex-1 md:flex-none text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center"
                    title="Send Email Now"
                  >
                    <PlayCircle size={16} className="mr-1"/> Test Email
                  </button>
                  <button 
                    onClick={() => handleDelete(reminder._id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-indigo-50 text-indigo-900">
              <h2 className="font-bold flex items-center"><Bell className="mr-2" /> Add Smart Reminder</h2>
              <button onClick={() => setShowAddModal(false)} className="hover:bg-indigo-100 p-1 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateReminder} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                <input required value={formData.medicineName} onChange={e=>setFormData({...formData, medicineName: e.target.value})} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Paracetamol" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage / Instructions</label>
                <input required value={formData.dosage} onChange={e=>setFormData({...formData, dosage: e.target.value})} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 1 pill after meal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input required value={formData.reminderTime} onChange={e=>setFormData({...formData, reminderTime: e.target.value})} type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={formData.frequency} onChange={e=>setFormData({...formData, frequency: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email for Alerts</label>
                <input required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="your@email.com" />
              </div>
              <button type="submit" className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                Save & Enable Alerts
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Info icon polyfill
function Info(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
}

function X(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
}

export default SmartReminders;
