import React, { useEffect, useState } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { 
  Trash2, 
  ShieldCheck, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';

const Cart: React.FC = () => {
  const { items, updateQty, removeItem, clearCart, totalPrice } = useCartStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [prescriptionId, setPrescriptionId] = useState('');

  useEffect(() => {
    apiClient.get('/prescriptions/my-prescriptions')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setPrescriptions(list);
        if (list[0]?._id) setPrescriptionId(list[0]._id);
      })
      .catch(() => setPrescriptions([]));
  }, []);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);
    try {
      // Prices and stock are checked by the server; one order is created per pharmacy.
      const orderItems = items.map(i => ({ medicine: i.id, qty: i.qty }));
      const { data } = await apiClient.post('/orders', { orderItems, prescriptionId: prescriptionId || undefined });
      const count = data?.orders?.length || 1;
      clearCart();
      toast.success(count > 1 ? `${count} orders placed (one per pharmacy).` : 'Order placed with the pharmacy.');
      navigate('/patient/orders');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'The order could not be placed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rawTotal = totalPrice();
  const netTotal = rawTotal;

  if (items.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto my-12 text-center font-sans">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Your Dispensary Cart is Empty</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
            Scan a doctor's prescription or browse our verified pharmaceutical formulary to add medicines.
          </p>
          <div className="flex gap-3">
            <Link
              to="/patient/medicines"
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              Browse Medicine Directory
            </Link>
            <Link
              to="/patient/prescriptions"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Upload Prescription
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
              Dispensary Fulfillment
            </span>
            <span className="text-xs text-slate-400">Licensed Pharmacy Partner</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescription Order & Dispensary Cart</h1>
          <p className="text-xs text-slate-500 mt-0.5">Review items and quantities, then place your order with the pharmacy.</p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Batch Security: <strong>100% Genuine</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Prescribed Medications ({items.length})
              </h2>
              <button 
                onClick={clearCart}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear All
              </button>
            </div>

            <ul className="divide-y divide-slate-100">
              {items.map(item => (
                <li key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{item.name}</span>
                      <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                        Verified Formulation
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Unit Price: ₹{(item.price || 30.50).toFixed(2)}</p>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => updateQty(item.id, Math.max(1, item.qty - 1))}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 py-1 font-mono font-bold text-xs text-slate-800">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Total Item Price */}
                    <div className="text-right w-20">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        ₹{(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>

                    {/* Delete Item */}
                    <button 
                      onClick={() => removeItem(item.id)} 
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Order Summary & Insurance Adjudication */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm pb-3 border-b border-slate-100">
              Dispensary Summary
            </h3>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal Items</span>
                <span className="font-mono font-semibold text-slate-800">₹{rawTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pharmacy Dispensing Fee</span>
                <span className="font-mono text-emerald-700 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span className="font-mono text-slate-600">Included</span>
              </div>

            </div>

            {/* Prescription for prescription-only medicines */}
            <div className="pt-2 space-y-1.5">
              <label htmlFor="cart-prescription" className="block text-[11px] font-semibold text-slate-700">Prescription (needed for prescription-only medicines)</label>
              {prescriptions.length ? (
                <select id="cart-prescription" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  {prescriptions.map((p: any) => <option key={p._id} value={p._id}>{p.doctorName || 'Prescription'} · {p.prescriptionDate || new Date(p.createdAt).toLocaleDateString('en-IN')}</option>)}
                  <option value="">No prescription</option>
                </select>
              ) : (
                <p className="text-[11px] text-slate-500">No saved prescription. <Link to="/patient/prescriptions" className="text-teal-700 underline">Upload one</Link> if your cart has prescription-only medicines.</p>
              )}
              <p className="text-[11px] text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Pay at the pharmacy on pickup. The pharmacist checks the prescription before dispensing.</p>
            </div>

            {/* Final Total */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total Payable</span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{netTotal.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-colors shadow-2xs"
            >
              <Package className="w-4 h-4" />
              <span>{isSubmitting ? 'Confirming with Dispensary...' : 'Confirm & Place Order'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] space-y-1">
            <p className="font-semibold text-slate-700">Dispensary Fulfillment Guarantee:</p>
            <p>All items checked for batch authenticity, expiration horizon &gt; 6 months, and registered tamper seals.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
