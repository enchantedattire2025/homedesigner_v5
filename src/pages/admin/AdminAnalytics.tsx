import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, BarChart3, TrendingUp, Users, DollarSign, FileText, Sparkles } from 'lucide-react';

const AdminAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, cRes, qRes, pRes, sRes, jRes, eRes] = await Promise.all([
        supabase.from('designers').select('created_at, verification_status, is_active'),
        supabase.from('customers').select('created_at, status'),
        supabase.from('designer_quotes').select('created_at, status, total_amount'),
        supabase.from('design_projects').select('created_at, status'),
        supabase.from('designer_subscriptions').select('status, created_at'),
        supabase.from('ai_quotation_jobs').select('created_at, status'),
        supabase.from('designer_projects_earnings').select('project_value, designer_earnings, platform_commission, completed_at'),
      ]);

      const designers = dRes.data || [];
      const customers = cRes.data || [];
      const quotes = qRes.data || [];
      const projects = pRes.data || [];
      const subs = sRes.data || [];
      const jobs = jRes.data || [];
      const earnings = eRes.data || [];

      // Monthly aggregation for last 6 months
      const months: { label: string; key: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), key });
      }

      const monthlyData = months.map(m => ({
        label: m.label,
        designers: designers.filter(d => d.created_at?.startsWith(m.key)).length,
        customers: customers.filter(c => c.created_at?.startsWith(m.key)).length,
        quotes: quotes.filter(q => q.created_at?.startsWith(m.key)).length,
        projects: projects.filter(p => p.created_at?.startsWith(m.key)).length,
        aiJobs: jobs.filter(j => j.created_at?.startsWith(m.key)).length,
      }));

      const totalRevenue = earnings.reduce((sum, e) => sum + Number(e.project_value || 0), 0);
      const totalCommission = earnings.reduce((sum, e) => sum + Number(e.platform_commission || 0), 0);
      const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
      const quoteConversion = quotes.length > 0 ? Math.round((acceptedQuotes / quotes.length) * 100) : 0;

      setStats({ monthlyData, totalRevenue, totalCommission, acceptedQuotes, quoteConversion, totalDesigners: designers.length, totalCustomers: customers.length, totalQuotes: quotes.length, totalProjects: projects.length, activeSubs: subs.filter(s => s.status === 'active').length, aiJobs: jobs.length });
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load analytics</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchStats} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  const maxVal = Math.max(...stats.monthlyData?.map((m: any) => Math.max(m.designers, m.customers, m.quotes, m.projects, m.aiJobs)) || [1], 1);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide trends and performance metrics</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `₹${stats.totalRevenue?.toLocaleString('en-IN') || 0}`, icon: DollarSign, color: 'emerald' },
          { label: 'Platform Commission', value: `₹${stats.totalCommission?.toLocaleString('en-IN') || 0}`, icon: TrendingUp, color: 'sky' },
          { label: 'Quote Conversion', value: `${stats.quoteConversion || 0}%`, icon: FileText, color: 'indigo' },
          { label: 'Active Subscriptions', value: stats.activeSubs || 0, icon: Users, color: 'violet' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-${s.color}-50 text-${s.color}-600`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Monthly trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-5 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gray-600" /> Monthly Activity (Last 6 Months)</h3>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-4 min-w-[500px] h-48">
            {stats.monthlyData?.map((m: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-40">
                  {[
                    { val: m.designers, color: 'bg-sky-400' },
                    { val: m.customers, color: 'bg-emerald-400' },
                    { val: m.quotes, color: 'bg-indigo-400' },
                    { val: m.projects, color: 'bg-blue-400' },
                    { val: m.aiJobs, color: 'bg-violet-400' },
                  ].map((bar, bi) => (
                    <div key={bi} className={`flex-1 ${bar.color} rounded-t transition-all hover:opacity-80`} style={{ height: `${(bar.val / maxVal) * 100}%`, minHeight: bar.val > 0 ? '4px' : '0' }} title={bar.val} />
                  ))}
                </div>
                <span className="text-xs text-gray-500 font-medium">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
          {[
            { label: 'Designers', color: 'bg-sky-400' },
            { label: 'Homeowners', color: 'bg-emerald-400' },
            { label: 'Quotes', color: 'bg-indigo-400' },
            { label: 'Projects', color: 'bg-blue-400' },
            { label: 'AI Jobs', color: 'bg-violet-400' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2"><div className={`w-3 h-3 rounded ${l.color}`} /><span className="text-xs text-gray-600">{l.label}</span></div>
          ))}
        </div>
      </div>

      {/* AI usage summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> AI Usage Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div><p className="text-gray-500 text-xs">Total AI Generations</p><p className="font-bold text-gray-900 text-lg">{stats.aiJobs || 0}</p></div>
          <div><p className="text-gray-500 text-xs">Total Quotes</p><p className="font-bold text-gray-900 text-lg">{stats.totalQuotes || 0}</p></div>
          <div><p className="text-gray-500 text-xs">Accepted Quotes</p><p className="font-bold text-gray-900 text-lg">{stats.acceptedQuotes || 0}</p></div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
