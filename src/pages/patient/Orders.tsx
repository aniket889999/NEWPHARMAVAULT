import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Package } from 'lucide-react';

const PatientOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await apiClient.get('/orders/myorders');
        setOrders(data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
          <Package className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No orders yet</h3>
          <p className="text-gray-500 mt-1">When you place an order, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Order Placed</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Total</p>
                  <p className="text-sm font-medium text-gray-900">₹{order.totalPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                    order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-4">
                  {order.orderItems.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-50 rounded flex items-center justify-center text-primary-600 font-bold mr-4">
                          {item.qty}x
                        </div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                      </div>
                      <p className="text-gray-600 font-medium">₹{(item.price * item.qty).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientOrders;
