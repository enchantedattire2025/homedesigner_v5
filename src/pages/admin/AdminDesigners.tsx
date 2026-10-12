import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

const AdminDesigners: React.FC = () => {
  const [designers, setDesigners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'inactive'>('all');

  const fetchDesigners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('designers')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setDesigners(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load designers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDesigners(); }, [fetchDesigners]);

  const handleVerify = async (id: string, status: 'verified' | 'rejected', reason?: string) => {
    const updateData: any = { verification_status: status, is_verified: status === 'verified' };
    if (status === 'verified') { updateData.verified_at = new Date().toISOString(); updateData.rejected_reason = null; }
    else if (status === 'rejected' && reason) { updateData.rejected_reason = reason; }

    const { error: err } = await supabase.from('designers').update(updateData).eq('id', id);
    if (err) { alert('Failed to update: ' + err.message); return; }

    await supabase.from('audit_logs').insert({
      action: status === 'verified' ? 'designer_verified' : 'designer_rejected',
      target_type: 'designer', target_id: id,
      details: { reason: reason || null },
    });

    fetchDesigners();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error: err } = await supabase.from('designers').update({ is_active: !current }).eq('id', id);
    if (err) { alert('Failed to update: ' + err.message); return; }
    await supabase.from('audit_logs').insert({
      action: 'designer_toggled', target_type: 'designer', target_id: id,
      details: { is_active: !current },
    });
    fetchDesigners();
  };

  const filtered = designers.filter(d => {
    const matchesSearch = !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.verification_status === statusFilter ||
      (statusFilter === 'inactive' && !d.is_active);
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load designers</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchDesigners} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Designers</h1>
        <p className="text-gray-500 text-sm mt-1">Manage designer profiles, verification, and status</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or specialization…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'verified', 'pending', 'rejected', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
                statusFilter === s ? 'bg-sky-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No designers found matching your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Specialization</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Location</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{d.name}</div>
                      <div className="text-xs text-gray-500">{d.email}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{d.specialization}</td>
                    <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{d.location}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                          d.verification_status === 'verified' ? 'bg-green-50 text-green-600' :
                          d.verification_status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {d.verification_status === 'verified' ? <CheckCircle className="w-3 h-3" /> :
                           d.verification_status === 'pending' ? <Clock className="w-3 h-3" /> :
                           <XCircle className="w-3 h-3" />}
                          {d.verification_status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                          d.is_active ? 'bg-sky-50 text-sky-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {d.verification_status !== 'verified' && (
                          <button onClick={() => handleVerify(d.id, 'verified')}
                            className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700">
                            Approve
                          </button>
                        )}
                        {d.verification_status !== 'rejected' && (
                          <button onClick={() => {
                            const reason = prompt('Reason for rejection:');
                            if (reason?.trim()) handleVerify(d.id, 'rejected', reason.trim());
                          }}
                            className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100">
                            Reject
                          </button>
                        )}
                        <button onClick={() => toggleActive(d.id, d.is_active)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                            d.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                          }`}>
                          {d.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDesigners;
