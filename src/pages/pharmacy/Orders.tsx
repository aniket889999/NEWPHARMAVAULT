import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { 
  Store, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Package, 
  Search, 
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

const PharmacyOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
      toast.error('Could not load orders. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      toast.loading(`Updating order status to ${newStatus}...`, { id: 'status' });
      await apiClient.put(`/orders/${id}/status`, { status: newStatus });
      toast.success(`Order marked as ${newStatus}`, { id: 'status' });
      fetchOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'The order could not be updated.', { id: 'status' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            Pending Review
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Package className="w-3 h-3 mr-1 text-blue-600" />
            Packaging
          </span>
        );
      case 'Ready':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-indigo-600" />
            Ready for Pickup
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Truck className="w-3 h-3 mr-1 text-emerald-600" />
            Delivered
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesSearch = 
      (o._id || o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.orderItems?.some((item: any) => item.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">
              Fulfillment Pipeline
            </span>
            <span className="text-xs text-slate-400 font-mono">Dispensary Counter</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Patient Dispensary Orders</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track, verify prescription compliance, pack formulations, and dispatch medication orders.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
            Active Orders: <strong className="text-slate-900">{orders.length}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search order ID, patient, or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex flex-wrap gap-1">
            {['ALL', 'Pending', 'Awaiting Pharmacist', 'Approved', 'Processing', 'Ready', 'Delivered', 'Needs Clarification', 'Rejected'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === status 
                    ? 'bg-blue-700 text-white shadow-2xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading dispensary order queue...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No matching orders in queue</h3>
            <p className="text-xs text-slate-400 mt-1">All patient orders for this filter have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5 pl-5">Order Reference</th>
                  <th className="p-3.5">Patient Details</th>
                  <th className="p-3.5">Medications & Units</th>
                  <th className="p-3.5">Total (₹)</th>
                  <th className="p-3.5">Workflow Status</th>
                  <th className="p-3.5 text-right pr-5">Dispensary Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => {
                  const orderId = order._id || order.id || 'PV-ORD-01';
                  const shortId = orderId.length > 10 ? orderId.substring(orderId.length - 8).toUpperCase() : orderId;

                  return (
                    <tr key={orderId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 pl-5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          #{shortId}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Today'}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{order.user?.name || 'Rahul Sharma'}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {order.user?.email || 'patient@test.com'}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          {order.orderItems?.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                              <span className="font-medium text-slate-800">{item.name}</span>
                              <span className="text-slate-400 font-mono text-[11px]">× {item.qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3.5 font-bold text-slate-900 font-mono text-sm">
                        ₹{(order.totalPrice || 0).toFixed(2)}
                      </td>

                      <td className="p-3.5">
                        {getStatusBadge(order.status)}
                      </td>

                      <td className="p-3.5 text-right pr-5">
                        <select 
                          value={order.status}
                          onChange={(e) => handleStatusChange(orderId, e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-600"
                        >
                          {!['Approved', 'Processing', 'Ready', 'Delivered', 'Cancelled'].includes(order.status) && <option value={order.status} disabled>{order.status}</option>}
                          <option value="Approved">Mark Approved</option>
                          <option value="Processing">Mark Processing</option>
                          <option value="Ready">Mark Ready</option>
                          <option value="Delivered">Mark Delivered</option>
                          <option value="Cancelled">Cancel (returns stock)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


export default PharmacyOrders;
