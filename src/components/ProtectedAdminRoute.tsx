import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, Loader2 } from 'lucide-react';

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/admin-login');
      return;
    }
    if (!isAdmin) {
      setChecking(false);
      return;
    }
    setChecking(false);
  }, [user, authLoading, isAdmin, navigate]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm mb-6">
            This area is restricted to platform administrators.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-sky-600 text-white px-6 py-2.5 rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
