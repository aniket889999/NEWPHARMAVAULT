import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Store } from 'lucide-react';

const PharmacyOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await apiClient.get('/orders');
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.put(`/orders/${id}/status`, { status: newStatus });
      fetchOrders();
    } catch (error) {
      console.error('Update failed', error);
      alert('Failed to update status');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Process and fulfill patient orders.</p>
        </div>
      </div>
      
      {orders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <Store className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No orders to fulfill</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-700 text-sm">Order ID</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Customer</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Items</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Total</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Status Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm font-mono text-slate-500">{order._id.substring(18)}</td>
                  <td className="p-4 font-medium text-slate-900">{order.user?.name || 'Unknown'}</td>
                  <td className="p-4 text-sm text-slate-600">{order.orderItems.length} items</td>
                  <td className="p-4 font-bold text-slate-900">₹{order.totalPrice.toFixed(2)}</td>
                  <td className="p-4">
                    <select 
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PharmacyOrders;
