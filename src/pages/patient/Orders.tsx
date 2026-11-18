import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { Package, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await apiClient.get('/orders/myorders');
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        setOrders([]);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescription & Medicine Orders</h1>
          <p className="text-xs text-slate-500 mt-1">Verified dispensary orders fulfilled with blockchain batch traceability</p>
        </div>
        <Link
          to="/patient/medicines"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs transition-colors"
        >
          <Package className="w-4 h-4" />
          <span>New Order</span>
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map(order => (
          <div key={order._id} className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4 text-xs">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Order ID</p>
                  <p className="font-mono font-bold text-slate-800">{order._id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Order Placed</p>
                  <p className="font-medium text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Amount</p>
                  <p className="font-bold text-slate-900">₹{order.totalPrice.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  order.status === 'Delivered' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {order.status}
                </span>

                <div className="flex items-center text-teal-700 text-[11px] font-semibold bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  <span>Verified Authentic</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <ul className="divide-y divide-slate-100">
                {order.orderItems.map((item: any, idx: number) => (
                  <li key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700 font-mono text-xs">
                        {item.qty}x
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        {item.batch && (
                          <p className="text-[10px] text-slate-400 font-mono">Batch: {item.batch}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-medium text-slate-800">
                      ₹{(item.price * item.qty).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientOrders;
