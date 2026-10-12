import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Search, CheckCircle, XCircle, Clock, UserCheck, Briefcase, Home } from 'lucide-react';

const AdminUsersVerification: React.FC = () => {
  const [pendingDesigners, setPendingDesigners] = useState<any[]>([]);
  const [recentDesigners, setRecentDesigners] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, cRes] = await Promise.all([
        supabase.from('designers').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      if (dRes.error) throw dRes.error;
      if (cRes.error) throw cRes.error;

      const designers = dRes.data || [];
      setPendingDesigners(designers.filter(d => d.verification_status === 'pending'));
      setRecentDesigners(designers.slice(0, 10));
      setRecentCustomers(cRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async (id: string, status: 'verified' | 'rejected', reason?: string) => {
    const updateData: any = { verification_status: status, is_verified: status === 'verified' };
    if (status === 'verified') { updateData.verified_at = new Date().toISOString(); updateData.rejected_reason = null; }
    else if (status === 'rejected' && reason) { updateData.rejected_reason = reason; }

    const { error: err } = await supabase.from('designers').update(updateData).eq('id', id);
    if (err) { alert('Failed: ' + err.message); return; }
    await supabase.from('audit_logs').insert({
      action: status === 'verified' ? 'designer_verified' : 'designer_rejected',
      target_type: 'designer', target_id: id, details: { reason: reason || null },
    });
    fetchData();
  };

  const filteredPending = pendingDesigners.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load data</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchData} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users & Verification</h1>
        <p className="text-gray-500 text-sm mt-1">Review pending verifications and recent user registrations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-4.5 h-4.5" /></div>
            <span className="text-sm text-gray-500">Pending Verifications</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingDesigners.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><Briefcase className="w-4.5 h-4.5" /></div>
            <span className="text-sm text-gray-500">Total Designers</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{recentDesigners.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Home className="w-4.5 h-4.5" /></div>
            <span className="text-sm text-gray-500">Recent Homeowners</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{recentCustomers.length}</p>
        </div>
      </div>

      {/* Pending verifications */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-500" />
            Pending Designer Verifications
          </h3>
        </div>
        <div className="p-5">
          {filteredPending.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No pending verifications</p>
          ) : (
            <div className="space-y-3">
              {filteredPending.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.email} · {d.specialization}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleVerify(d.id, 'verified')}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => {
                      const r = prompt('Rejection reason:');
                      if (r?.trim()) handleVerify(d.id, 'rejected', r.trim());
                    }}
                      className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Designers</h3>
          </div>
          <div className="p-5">
            {recentDesigners.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No designers yet</p>
            ) : (
              <div className="space-y-3">
                {recentDesigners.map(d => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                      <p className="text-xs text-gray-500 truncate">{d.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      d.verification_status === 'verified' ? 'bg-green-50 text-green-600' :
                      d.verification_status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>{d.verification_status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Homeowners</h3>
          </div>
          <div className="p-5">
            {recentCustomers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No homeowners yet</p>
            ) : (
              <div className="space-y-3">
                {recentCustomers.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(c.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersVerification;
