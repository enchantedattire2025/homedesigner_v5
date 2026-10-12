import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Search, FileText, Eye, X } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-sky-50 text-sky-600',
  accepted: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600',
  expired: 'bg-amber-50 text-amber-600',
};

const AdminQuotations: React.FC = () => {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('designer_quotes')
        .select(`
          *,
          designers(name, email)
        `)
        .order('created_at', { ascending: false });
      if (err) throw err;

      // Fetch customer/project names separately since project_id references customers
      const quotesWithProjects = await Promise.all((data || []).map(async (q) => {
        if (!q.project_id) return { ...q, customers: null };
        const { data: customer } = await supabase
          .from('customers')
          .select('project_name, name, email')
          .eq('id', q.project_id)
          .maybeSingle();
        return { ...q, customers: customer };
      }));

      setQuotes(quotesWithProjects);
    } catch (e: any) {
      setError(e.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const statuses = ['all', ...new Set(quotes.map(q => q.status).filter(Boolean))];

  const filtered = quotes.filter(q => {
    const matchesSearch = !search ||
      q.title?.toLowerCase().includes(search.toLowerCase()) ||
      q.designers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      q.customers?.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load quotations</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchQuotes} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quotations — Monitoring</h1>
        <p className="text-gray-500 text-sm mt-1">Read-only view of all quotation records and statuses</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: quotes.length },
          { label: 'Drafts', value: quotes.filter(q => q.status === 'draft').length },
          { label: 'Sent', value: quotes.filter(q => q.status === 'sent').length },
          { label: 'Accepted', value: quotes.filter(q => q.status === 'accepted').length },
          { label: 'Rejected', value: quotes.filter(q => q.status === 'rejected').length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by quote title, designer, or project…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No quotations found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Quote</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Designer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Project</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Value</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{q.title || 'Untitled Quote'}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{q.designers?.name || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{q.customers?.project_name || '—'}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {q.total_amount ? `₹${Number(q.total_amount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                        {q.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">
                      {q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => setSelectedQuote(q)}
                        className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedQuote(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Quotation Details</h3>
              <button onClick={() => setSelectedQuote(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                ['Title', selectedQuote.title],
                ['Designer', selectedQuote.designers?.name],
                ['Designer Email', selectedQuote.designers?.email],
                ['Project', selectedQuote.customers?.project_name],
                ['Homeowner', selectedQuote.customers?.name],
                ['Status', selectedQuote.status],
                ['Total Amount', selectedQuote.total_amount ? `₹${Number(selectedQuote.total_amount).toLocaleString('en-IN')}` : null],
                ['Tax', selectedQuote.tax_amount ? `₹${Number(selectedQuote.tax_amount).toLocaleString('en-IN')}` : null],
                ['Discount', selectedQuote.discount_amount ? `₹${Number(selectedQuote.discount_amount).toLocaleString('en-IN')}` : null],
                ['Created', selectedQuote.created_at ? new Date(selectedQuote.created_at).toLocaleString('en-IN') : null],
                ['Updated', selectedQuote.updated_at ? new Date(selectedQuote.updated_at).toLocaleString('en-IN') : null],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-900 text-right">{value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-amber-50/50">
              <p className="text-xs text-amber-700">Read-only view. Admins cannot create, edit, send, or accept quotations.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuotations;
