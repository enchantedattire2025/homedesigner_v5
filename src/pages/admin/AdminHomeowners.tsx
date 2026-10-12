import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Search, MapPin, Phone } from 'lucide-react';

const AdminHomeowners: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setCustomers(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load homeowners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.project_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load homeowners</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchCustomers} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Homeowners</h1>
        <p className="text-gray-500 text-sm mt-1">View homeowner registrations and project requests</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or project name…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No homeowners found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  c.status === 'completed' ? 'bg-green-50 text-green-600' :
                  c.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                  c.status === 'assigned' ? 'bg-sky-50 text-sky-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {c.status || 'new'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {c.location || 'Not specified'}</p>
                {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
                <p className="text-gray-600 font-medium pt-1">{c.project_name || 'No project name'}</p>
                {c.budget_range && <p>Budget: {c.budget_range}</p>}
                <p className="text-gray-400">Registered: {new Date(c.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHomeowners;
