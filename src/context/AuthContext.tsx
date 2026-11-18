import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { useChatStore } from '../stores/chatStore';
import { clearLegacySessionCache, parseSessionProfile, SESSION_EXPIRED_EVENT } from '../features/navigation/sessionProfile';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'patient' | 'pharmacy' | 'pharmacist' | 'claims_reviewer' | 'org_admin' | 'super_admin' | 'doctor' | 'admin' | string;
  organizationId?: string;
  branchId?: string;
  mfaEnabled?: boolean;
  /** Server says MFA must be turned on before anything else (MFA_REQUIRED_FOR_STAFF). */
  mfaSetupRequired?: boolean;
}

/** Thrown by login() when the account has MFA and needs (or rejected) a code. */
export class MfaRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MfaRequiredError';
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role: string, otp?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signup: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const epoch = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    clearLegacySessionCache();
    let active = true;
    const restore = async () => {
      const current = ++epoch.current;
      setIsLoading(true);
      try {
        const { data } = await apiClient.get('/users/profile');
        if (active && current === epoch.current) setUser(parseSessionProfile(data));
      } catch {
        if (active && current === epoch.current) setUser(null);
      } finally {
        if (active && current === epoch.current) setIsLoading(false);
      }
    };
    const expire = () => {
      ++epoch.current;
      useChatStore.getState().resetChat();
      setUser(null); setIsLoading(false);
      setNotice('Your session expired or was revoked. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    const mfaRequired = () => { setUser((u) => (u ? { ...u, mfaSetupRequired: true } : u)); };
    window.addEventListener('pharmavault:mfa-setup-required', mfaRequired);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('pharmavault-session-v1');
      channel.current.onmessage = () => {
        // No identity/token/message content is shared between tabs.
        useChatStore.getState().resetChat(); setUser(null); void restore();
      };
    }
    void restore();
    const invalidatePendingSession = () => { active = false; ++epoch.current; };
    return () => { invalidatePendingSession(); window.removeEventListener(SESSION_EXPIRED_EVENT, expire); window.removeEventListener('pharmavault:mfa-setup-required', mfaRequired); channel.current?.close(); channel.current = null; };
  }, []);

  const login = async (email: string, password: string, role: string, otp?: string): Promise<void> => {
    const current = ++epoch.current;
    setIsLoading(true);
    try {
      let data: unknown;
      try {
        ({ data } = await apiClient.post('/users/login', { email, password, role, ...(otp ? { otp } : {}) }));
      } catch (error) {
        const body = (error as { response?: { data?: { mfaRequired?: boolean; message?: string } } }).response?.data;
        if (body?.mfaRequired) throw new MfaRequiredError(body.message || 'Enter your authenticator code.');
        throw error;
      }
      const identity = parseSessionProfile(data);
      if (!identity) throw new Error('Sign-in response was not valid.');
      if (current !== epoch.current) return;
      useChatStore.getState().resetChat(); setNotice(''); setUser(identity);
      channel.current?.postMessage('SESSION_CHANGED');
    } finally {
      if (current === epoch.current) setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string, role: string): Promise<void> => {
    const current = ++epoch.current;
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/users/register', { name, email, password, role });
      const identity = parseSessionProfile(data);
      if (!identity) throw new Error('Sign-up response was not valid.');
      if (current !== epoch.current) return;
      useChatStore.getState().resetChat(); setNotice(''); setUser(identity);
      channel.current?.postMessage('SESSION_CHANGED');
    } finally {
      if (current === epoch.current) setIsLoading(false);
    }
  };

  const logout = async () => {
    const current = ++epoch.current;
    useChatStore.getState().resetChat();
    setUser(null); setIsLoading(true); clearLegacySessionCache();
    try {
      await apiClient.post('/users/logout', {});
      if (current === epoch.current) setNotice('Signed out. Earlier sessions on all devices have been revoked.');
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (current === epoch.current) setNotice(status === 401 ? 'Your session is no longer valid.' : 'This page is signed out, but server-side sign-out could not be confirmed. Do not leave a shared device unattended; reconnect and sign out again.');
    } finally {
      channel.current?.postMessage('SESSION_CHANGED');
      if (current === epoch.current) setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const { data } = await apiClient.get('/users/profile');
      setUser(parseSessionProfile(data));
    } catch {
      /* keep the current identity; the 401 interceptor handles expiry */
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout, refreshProfile }}>
      {children}
      {notice && <div role="status" className="fixed bottom-4 right-4 z-[100] max-w-md rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-800 shadow-lg">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss session notice" className="ml-3 underline">Dismiss</button></div>}
    </AuthContext.Provider>
  );
};
