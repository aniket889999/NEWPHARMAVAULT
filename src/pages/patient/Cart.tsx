import React, { useState } from 'react';
import { useCartStore } from '../../stores/cartStore';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Trash2, ShieldCheck, AlertCircle, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

const Cart: React.FC = () => {
  const { items, updateQty, removeItem, clearCart, totalPrice } = useCartStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyingInsurance, setApplyingInsurance] = useState(false);
  const [insuranceData, setInsuranceData] = useState<any>(null);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);
    try {
      const orderItems = items.map(i => ({ name: i.name, qty: i.qty, price: i.price, medicine: i.id }));
      const finalPrice = insuranceData ? totalPrice() - insuranceData.totalDiscountAmount : totalPrice();
      await apiClient.post('/orders', { orderItems, totalPrice: finalPrice });
      clearCart();
      toast.success('Order placed successfully!');
      navigate('/patient/orders');
    } catch (error) {
      console.error('Checkout failed', error);
      toast.error('Failed to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyInsurance = async () => {
    setApplyingInsurance(true);
    try {
      const payload = {
        providerName: 'HDFC Ergo Demo',
        policyNumber: 'POL-123456',
        medicines: items.map(i => ({ medicine: i.id, name: i.name, price: i.price, qty: i.qty }))
      };
      const { data } = await apiClient.post('/regulatory/insurance-check', payload);
      setInsuranceData(data);
      if (data.totalDiscountAmount > 0) {
        toast.success(`Insurance applied! Saved ₹${data.totalDiscountAmount.toFixed(2)}`);
      } else {
        toast('Insurance verified, but no items in cart are covered under your plan.', { icon: 'ℹ️' });
      }
    } catch(err) {
      toast.error('Failed to verify insurance.');
    } finally {
      setApplyingInsurance(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-12">
        <div className="flex flex-col items-center justify-center p-16 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="bg-gray-50 p-6 rounded-full mb-6 border border-gray-100">
            <ShoppingCart size={64} className="text-gray-300" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-8 max-w-md">Looks like you haven't added any medicines yet. Browse our directory to find what you need.</p>
          <button 
            onClick={() => navigate('/patient/medicines')} 
            className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-primary-700 transition-colors"
          >
            Browse Medicines
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Your Cart</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {items.map(item => (
            <li key={item.id} className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">₹{item.price} per unit</p>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-500">Qty:</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={item.qty} 
                    onChange={(e) => updateQty(item.id, Number(e.target.value))}
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="text-right w-24">
                  <p className="font-bold text-gray-900">₹{(item.price * item.qty).toFixed(2)}</p>
                  {insuranceData && insuranceData.coverageDetails.find((c:any) => c.medicineId === item.id)?.covered && (
                    <p className="text-[10px] font-bold text-green-600 bg-green-100 px-1 py-0.5 rounded mt-1 inline-block">Covered</p>
                  )}
                </div>
                <button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                  <Trash2 size={20}/>
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="p-6 bg-gray-50 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200">
          <div className="mb-4 sm:mb-0 w-full sm:w-auto">
            {!insuranceData ? (
              <button 
                onClick={handleApplyInsurance} 
                disabled={applyingInsurance}
                className="flex items-center text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto justify-center"
              >
                <ShieldCheck size={16} className="mr-2" /> 
                {applyingInsurance ? 'Checking Eligibility...' : 'Apply Health Insurance'}
              </button>
            ) : (
              <div className="flex items-center text-sm font-bold text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <ShieldCheck size={16} className="mr-2 text-green-600" /> 
                Insurance Applied (-₹{insuranceData.totalDiscountAmount.toFixed(2)})
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              {insuranceData && insuranceData.totalDiscountAmount > 0 && (
                <div className="text-sm text-gray-500 line-through">₹{totalPrice().toFixed(2)}</div>
              )}
              <span className="text-2xl font-bold text-gray-900">
                Total: ₹{(insuranceData ? totalPrice() - insuranceData.totalDiscountAmount : totalPrice()).toFixed(2)}
              </span>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={isSubmitting}
              className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-primary-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
            >
              {isSubmitting ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </div>
        
        <div className="bg-blue-50 p-3 text-center text-xs text-blue-800 italic">
          Note: This system simulates regulatory compliance (Insurance). In production, real APIs like IRDAI or TPA systems will be used.
        </div>
      </div>
    </div>
  );
};
export default Cart;
