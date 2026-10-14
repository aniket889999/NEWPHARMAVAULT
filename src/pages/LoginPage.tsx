import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Pill, Stethoscope, User, MailIcon, KeyIcon, UserCircle } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const LoginPage: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient' as const,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (role: 'patient' | 'pharmacist' | 'doctor') => {
    setFormData(prev => ({ ...prev, role }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let success;
      
      if (isSignup) {
        const { name, email, password, role } = formData;
        if (!name.trim()) {
          throw new Error('Name is required');
        }
        success = await signup(name, email, password, role);
      } else {
        const { email, password } = formData;
        success = await login(email, password);
      }

      if (success) {
        navigate('/home');
      } else {
        throw new Error(isSignup ? 'Signup failed' : 'Invalid email or password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animated background element
  const AnimatedBackground = () => (
    <div className="absolute inset-0 overflow-hidden -z-10">
      <div className="absolute -top-16 -left-16 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow"></div>
      <div className="absolute top-32 -right-16 w-96 h-96 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow"></div>
      <div className="absolute -bottom-16 left-1/3 w-80 h-80 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow"></div>
    </div>
  );

  const RoleOption = ({ 
    role, 
    icon: Icon, 
    label 
  }: { 
    role: 'patient' | 'pharmacist' | 'doctor'; 
    icon: typeof User; 
    label: string; 
  }) => (
    <div 
      className={`flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all
        ${formData.role === role 
          ? 'bg-primary-100 border-2 border-primary-500 text-primary-800' 
          : 'bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700'
        }`}
      onClick={() => handleRoleChange(role)}
    >
      <Icon 
        size={24} 
        className={formData.role === role ? 'text-primary-600' : 'text-gray-500'} 
      />
      <span className="mt-2 text-sm font-medium">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AnimatedBackground />
      
      {/* Left panel - Welcome */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 text-white p-8 md:p-12 flex items-center justify-center">
        <div className="max-w-md">
          <div className="flex items-center mb-8">
            <Pill size={40} className="mr-3" />
            <h1 className="text-3xl font-bold">PharmaVault</h1>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Smart Medicine Database System
          </h2>
          
          <p className="text-primary-100 mb-6">
            Your trusted platform for verified medicine data, safe alternatives, and 
            personalized recommendations.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <Stethoscope size={18} />
              </div>
              <div>
                <h3 className="font-medium">Medicine Verification</h3>
                <p className="text-primary-100 text-sm">Verify the authenticity of your medications</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <Pill size={18} />
              </div>
              <div>
                <h3 className="font-medium">Alternative Suggestions</h3>
                <p className="text-primary-100 text-sm">Find equivalent or generic alternatives</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <User size={18} />
              </div>
              <div>
                <h3 className="font-medium">Personalized Recommendations</h3>
                <p className="text-primary-100 text-sm">Get dosage suggestions based on your profile</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right panel - Login/Signup form */}
      <div className="w-full md:w-1/2 p-8 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {isSignup ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isSignup 
                ? 'Join PharmaVault today to access verified medicine data' 
                : 'Log in to access your PharmaVault account'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserCircle size={18} className="text-gray-400" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    I am a:
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <RoleOption role="patient" icon={User} label="Patient" />
                    <RoleOption role="pharmacist" icon={Pill} label="Pharmacist" />
                    <RoleOption role="doctor" icon={Stethoscope} label="Doctor" />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MailIcon size={18} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyIcon size={18} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                  minLength={6}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isSignup ? 'Password must be at least 6 characters' : ''}
              </p>
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center disabled:bg-primary-400"
            >
              {isSubmitting ? (
                <LoadingSpinner size="small" color="white" />
              ) : (
                isSignup ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-primary-600 hover:text-primary-800 font-medium"
            >
              {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;