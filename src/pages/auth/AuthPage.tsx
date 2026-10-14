import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role') || 'patient';
  
  const { login, signup } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(email, password, role);
        toast.success(`Welcome back to ${isPharmacy ? 'Pharmacy' : 'Patient'} Portal!`);
      } else {
        await signup(name, email, password, role);
        toast.success('Account created successfully!');
      }
      if (role === 'claims_reviewer' || role === 'pharmacist') {
        navigate('/review-queue');
      } else if (role === 'patient') {
        navigate('/patient/dashboard');
      } else {
        navigate('/pharmacy/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please check your credentials.';
      setError(msg);
      toast.error(msg);
    }
  };

  const isPharmacy = role === 'pharmacy';
  const isReviewer = role === 'claims_reviewer' || role === 'pharmacist';

  const portalTitle = isReviewer ? 'Reviewer Portal' : isPharmacy ? 'Pharmacy Portal' : 'Patient Portal';
  const portalColor = isReviewer ? 'text-indigo-600' : isPharmacy ? 'text-green-600' : 'text-primary-600';
  const btnColor = isReviewer
    ? 'bg-indigo-600 hover:bg-indigo-700'
    : isPharmacy
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-primary-600 hover:bg-primary-700';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-bold ${portalColor}`}>
            {portalTitle}
          </h2>
          <p className="text-gray-500 mt-2">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name / Organization Name</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <button 
            type="submit" 
            className={`w-full py-2 px-4 text-white font-bold rounded-lg transition-colors ${btnColor}`}
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400 mb-3 uppercase tracking-wider font-bold">Hackathon Demo Access</p>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(false);
              setEmail(isReviewer ? 'reviewer@test.com' : isPharmacy ? 'pharmacy@test.com' : 'patient@test.com');
              setPassword('password123');
              setName(isReviewer ? 'Demo Claims Reviewer' : isPharmacy ? 'Demo Pharmacy Hub' : 'Demo Patient');
              toast('Demo credentials auto-filled. Please click Sign Up if this is your first time, or toggle to Sign In.', { icon: '✨' });
            }}
            className={`w-full py-2 px-4 border font-bold rounded-lg transition-colors flex justify-center items-center ${
              isReviewer
                ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                : isPharmacy
                ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                : 'border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100'
            }`}
          >
            Fill Demo {isReviewer ? 'Reviewer' : isPharmacy ? 'Pharmacy' : 'Patient'} Credentials
          </button>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className={`font-medium ${isPharmacy ? 'text-green-600' : 'text-primary-600'}`}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <button onClick={() => navigate('/auth')} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to Role Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
