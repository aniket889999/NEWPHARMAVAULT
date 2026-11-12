import React, { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Sparkles,
  ArrowRight,
  ShoppingBag,
  MapPin,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const PatientOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrderingDemo, setIsOrderingDemo] = useState(false);
  const { user } = useAuth();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/orders/myorders');
      setOrders(data);
    } catch (error) {
      toast.error('Failed to load past orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCreateStarterOrder = async () => {
    try {
      setIsOrderingDemo(true);
      const demoPayload = {
        orderItems: [
          { name: 'Augmentin 625 Duo', qty: 1, price: 195.0 },
          { name: 'Dolo 650 (Paracetamol)', qty: 2, price: 32.5 }
        ],
        shippingAddress: {
          address: '42, Health Street, Indiranagar',
          city: 'Bengaluru',
          postalCode: '560038',
          country: 'India'
        },
        paymentMethod: 'UPI / Digital Health Card',
        totalPrice: 260.0
      };

      await apiClient.post('/orders', demoPayload);
      toast.success('Prescription order placed successfully!');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place test order');
    } finally {
      setIsOrderingDemo(false);
    }
  };

  const getStepProgress = (status: string) => {
    switch (status) {
      case 'Pending':
        return 1;
      case 'Processing':
        return 2;
      case 'Ready':
        return 3;
      case 'Delivered':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Prescription Orders</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Active Deliveries
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track pharmacy verification, dispensing progress, and doorstep medical courier delivery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/patient/medicines"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Order Medicines</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400 shadow-xs">
          Loading your medical orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No active orders yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Browse our licensed pharmacy catalogue or place an instant starter sample order to track delivery.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleCreateStarterOrder}
              disabled={isOrderingDemo}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isOrderingDemo ? 'Placing Order...' : '⚡ Order Starter Pack (Augmentin + Dolo)'}</span>
            </button>
            <Link
              to="/patient/medicines"
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              Browse Pharmacy
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const step = getStepProgress(order.status);

            return (
              <div
                key={order._id}
                className="bg-white rounded-3xl shadow-xs border border-slate-200/90 overflow-hidden"
              >
                {/* Order Top Bar */}
                <div className="bg-gradient-to-r from-blue-50/50 via-white to-slate-50 px-6 py-4 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Order Placed
                    </span>
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Order ID
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                      #{order._id.substring(order._id.length - 8).toUpperCase()}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Total Billed
                    </span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      ₹{Number(order.totalPrice).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${
                        order.status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : order.status === 'Processing'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Stepper Progress */}
                <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 ${
                          step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        ✓
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">Placed</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 ${
                          step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step >= 2 ? '✓' : '2'}
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">Pharmacist Checked</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 ${
                          step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step >= 3 ? '✓' : '3'}
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">Dispatched</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 ${
                          step >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step >= 4 ? '✓' : '4'}
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">Delivered</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-6">
                  <div className="space-y-3">
                    {order.orderItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center">
                            {item.qty}x
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                            <p className="text-[11px] text-slate-400">Prescription verified batch</p>
                          </div>
                        </div>
                        <span className="font-black text-slate-900 text-sm">
                          ₹{(item.price * item.qty).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientOrders;
