import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  Store,
  Package,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Eye,
  X,
  Truck,
  ArrowRight,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const PharmacyOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const { user } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/orders');
      setOrders(data);
    } catch (error) {
      toast.error('Failed to retrieve pharmacy orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      toast.loading(`Updating order status to ${newStatus}...`, { id: 'status-update' });
      await apiClient.put(`/orders/${id}/status`, { status: newStatus });
      toast.success(`Order status updated to ${newStatus}!`, { id: 'status-update' });
      fetchOrders();
      if (selectedOrder && selectedOrder._id === id) {
        setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      toast.error('Failed to update status', { id: 'status-update' });
    }
  };

  // Demo Order Seed
  const handleCreateDemoOrder = () => {
    const demoOrder = {
      _id: 'ord_' + Math.random().toString(36).substring(2, 9),
      user: { name: 'Rahul Sharma', email: 'rahul.patient@gmail.com' },
      orderItems: [
        { name: 'Augmentin 625 Duo', qty: 2, price: 195.0 },
        { name: 'Dolo 650 (Paracetamol)', qty: 1, price: 32.5 }
      ],
      shippingAddress: {
        address: 'B-402, Green Glen Heights, Outer Ring Road',
        city: 'Bengaluru',
        postalCode: '560103'
      },
      paymentMethod: 'UPI / Digital Health Card',
      totalPrice: 422.5,
      isPaid: true,
      paidAt: new Date().toISOString(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setOrders(prev => [demoOrder, ...prev]);
    toast.success('Sample prescription order staged into fulfillment queue!');
  };

  const filteredOrders = orders.filter(order => {
    const q = searchQuery.toLowerCase();
    const idMatch = (order._id || '').toLowerCase().includes(q);
    const customerMatch = (order.user?.name || '').toLowerCase().includes(q);
    const statusMatch = statusFilter === 'All' || order.status === statusFilter;
    return (idMatch || customerMatch) && statusMatch;
  });

  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const processingCount = orders.filter(o => o.status === 'Processing').length;
  const readyCount = orders.filter(o => o.status === 'Ready').length;
  const deliveredCount = orders.filter(o => o.status === 'Delivered').length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Fulfillment Queue</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Live Dispensing
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review prescriptions, package medicine lots, and dispatch orders to patients.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateDemoOrder}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>⚡ Stage Sample Order</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
            <Store className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{orders.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">All customer orders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{pendingCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Awaiting pharmacist verification</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Packaging</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">{processingCount + readyCount}</div>
          <p className="text-[11px] text-blue-500/80 mt-0.5">Being prepped for dispatch</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{deliveredCount}</div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Completed fulfillments</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by order ID or customer name..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['All', 'Pending', 'Processing', 'Ready', 'Delivered'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Loading order fulfillment records...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No orders in this view</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Stage a sample order to test the dispensing and status progression workflow.
            </p>
            <button
              onClick={handleCreateDemoOrder}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
            >
              ⚡ Stage Sample Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">Order ID & Date</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Medicines & Qty</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Status & Progression</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => {
                  const statusColors: Record<string, string> = {
                    Pending: 'bg-amber-50 text-amber-800 border-amber-300',
                    Processing: 'bg-blue-50 text-blue-800 border-blue-300',
                    Ready: 'bg-indigo-50 text-indigo-800 border-indigo-300',
                    Delivered: 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  };

                  return (
                    <tr key={order._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 pl-6">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-blue-700">
                          #{order._id.substring(order._id.length - 8).toUpperCase()}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-slate-900">{order.user?.name || 'Authorized Patient'}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{order.user?.email || 'patient@test.com'}</p>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5">
                          {order.orderItems?.slice(0, 2).map((item: any, idx: number) => (
                            <span key={idx} className="block text-slate-700 font-medium">
                              {item.qty}x {item.name}
                            </span>
                          ))}
                          {(order.orderItems?.length || 0) > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              +{(order.orderItems?.length || 0) - 2} more items
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-black text-slate-900 text-sm">
                        ₹{Number(order.totalPrice || 0).toFixed(2)}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase ${
                              statusColors[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {order.status}
                          </span>
                          <select
                            value={order.status}
                            onChange={e => handleStatusChange(order._id, e.target.value)}
                            className="border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Ready">Ready</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </div>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1 border border-blue-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Order #{selectedOrder._id.substring(selectedOrder._id.length - 8).toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900">{selectedOrder.user?.name || 'Patient'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className="font-bold text-blue-700">{selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Payment:</span>
                <span className="font-bold text-emerald-700">Paid via Digital Health UPI</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Prescribed Items</h4>
              <div className="space-y-2">
                {selectedOrder.orderItems?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-400">Quantity: {item.qty} units</p>
                    </div>
                    <span className="font-black text-slate-900">₹{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700">Total Invoice Amount:</span>
              <span className="font-black text-slate-900 text-base">₹{Number(selectedOrder.totalPrice).toFixed(2)}</span>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Close Order Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyOrders;
