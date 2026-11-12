import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  CheckCircle2,
  Plus,
  Mail,
  Trash2,
  PlayCircle,
  Pill,
  Sparkles,
  AlertCircle,
  X
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';

const SmartReminders: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    medicineName: '',
    dosage: '1 Tablet after food',
    reminderTime: '08:00 AM',
    frequency: 'daily',
    email: user?.email || 'patient@test.com'
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
    if (!formData.medicineName.trim()) {
      toast.error('Please enter medicine name');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/reminders/create', {
        ...formData,
        email: formData.email || user?.email || 'patient@test.com'
      });
      toast.success('Dose reminder scheduled successfully!');
      setShowAddModal(false);
      setFormData({
        medicineName: '',
        dosage: '1 Tablet after food',
        reminderTime: '08:00 AM',
        frequency: 'daily',
        email: user?.email || 'patient@test.com'
      });
      fetchReminders();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to create reminder';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await apiClient.put(`/reminders/${id}`, { status: newStatus });
      toast.success(newStatus === 'taken' ? 'Dose marked as taken! Stay healthy.' : 'Status updated.');
      fetchReminders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/reminders/${id}`);
      toast.success('Reminder removed');
      fetchReminders();
    } catch (error) {
      toast.error('Failed to delete reminder');
    }
  };

  const handleSendTestEmail = async (reminder: any) => {
    try {
      toast.loading('Simulating dose alert notification...', { id: 'test-email' });
      await apiClient.post('/reminders/send-test', {
        medicineName: reminder.medicineName,
        dosage: reminder.dosage,
        email: reminder.email || user?.email || 'patient@test.com'
      });
      toast.success(`Dose alert notification triggered for ${reminder.medicineName}!`, { id: 'test-email' });
    } catch (error) {
      toast.error('Failed to send notification.', { id: 'test-email' });
    }
  };

  const activeReminders = reminders.filter(r => r.status === 'active');

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6 font-sans bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            <span>Medication Adherence Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Smart Medication Reminders
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated dosing schedule with SMS/Email notifications to ensure zero skipped prescriptions.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(prev => ({ ...prev, email: user?.email || 'patient@test.com' }));
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Dose Schedule
        </button>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Scheduled</span>
            <div className="text-xl font-black text-slate-900">{reminders.length} Meds</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Doses</span>
            <div className="text-xl font-black text-amber-600">{activeReminders.length} Remaining</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Adherence Score</span>
            <div className="text-xl font-black text-emerald-600">
              {reminders.length > 0 ? `${Math.round(((reminders.length - activeReminders.length) / reminders.length) * 100)}%` : '100%'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Reminders List */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Today's Medication Timeline</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">{reminders.length} active courses</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading your schedule...</div>
        ) : reminders.length === 0 ? (
          <div className="p-14 text-center text-slate-500 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No active medication reminders</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Keep your treatment on track by adding your prescribed medicines and preferred alert times.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
            >
              Add First Reminder
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reminders.map((reminder) => {
              const isTaken = reminder.status === 'taken';
              return (
                <div
                  key={reminder._id}
                  className={`p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                    isTaken ? 'bg-slate-50/70' : 'hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => handleStatusUpdate(reminder._id, isTaken ? 'active' : 'taken')}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                        isTaken
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 hover:border-blue-500 text-transparent'
                      }`}
                      title={isTaken ? 'Mark as Pending' : 'Mark as Taken'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div>
                      <h4 className={`text-base font-bold ${isTaken ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {reminder.medicineName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">{reminder.dosage}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono font-medium text-blue-600">
                          <Clock className="w-3 h-3" /> {reminder.reminderTime}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{reminder.frequency}</span>
                        <span>•</span>
                        <span className="text-slate-400">{reminder.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleSendTestEmail(reminder)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-all flex items-center gap-1"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Test Alert
                    </button>
                    <button
                      onClick={() => handleDelete(reminder._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete Reminder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Smart Reminder */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Schedule Medication Reminder"
        description="Set up automatic dose notifications for your prescription schedule."
        maxWidth="md"
      >
        <form onSubmit={handleCreateReminder} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Medicine Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Augmentin 625 Duo, Dolo 650mg"
              value={formData.medicineName}
              onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Dosage & Meal Instructions
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1 Tablet after breakfast"
              value={formData.dosage}
              onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Scheduled Dose Time
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {['08:00 AM', '01:30 PM', '08:30 PM'].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setFormData({ ...formData, reminderTime: slot })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                    formData.reminderTime === slot
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              placeholder="e.g. 09:00 PM"
              value={formData.reminderTime}
              onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">As needed (PRN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Notification Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Save & Activate Reminder'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SmartReminders;
