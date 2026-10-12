import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, ScrollText, Search } from 'lucide-react';

const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) throw err;
      setLogs(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actions = ['all', ...new Set(logs.map(l => l.action).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchesSearch = !search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.target_type?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load audit logs</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchLogs} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-500 text-sm mt-1">Record of authorized administrative actions and interventions</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by action or target…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm">
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No audit log entries found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Action</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Target</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Details</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Timestamp</th>
            </tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{l.action?.replace(/_/g, ' ') || '—'}</span></td>
                  <td className="px-5 py-3 text-gray-600">{l.target_type || '—'}{l.target_id ? ` · ${l.target_id.slice(0, 8)}` : ''}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell text-xs font-mono max-w-xs truncate">{l.details ? JSON.stringify(l.details) : '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
