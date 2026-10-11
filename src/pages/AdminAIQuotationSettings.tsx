import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Save, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

type AIPlan = { id: string; name: string; description: string; price: number; monthly_credits: number; is_active: boolean; sort_order: number };
type AIConfig = { id: boolean; vision_model: string; text_model: string; transcription_model: string; routing_rules: Record<string, unknown>; is_enabled: boolean };

const AdminAIQuotationSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [plans, setPlans] = useState<AIPlan[]>([]);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/admin-login'); return; }
    void load();
  }, [authLoading, user]);

  const load = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    const { data: admin } = await supabase.from('admin_users').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (!admin) { navigate('/admin-login'); return; }
    setAuthorized(true);
    const [{ data: planData, error: planError }, { data: configData, error: configError }] = await Promise.all([
      supabase.from('ai_subscription_plans').select('id, name, description, price, monthly_credits, is_active, sort_order').order('sort_order'),
      supabase.from('ai_configuration').select('id, vision_model, text_model, transcription_model, routing_rules, is_enabled').eq('id', true).maybeSingle(),
    ]);
    if (planError || configError) setError('AI settings could not be loaded.');
    setPlans((planData || []) as AIPlan[]); setConfig(configData as AIConfig | null); setLoading(false);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      for (const plan of plans) {
        const { error: planError } = await supabase.from('ai_subscription_plans').update({ price: Number(plan.price), monthly_credits: Number(plan.monthly_credits), is_active: plan.is_active, description: plan.description }).eq('id', plan.id);
        if (planError) throw planError;
      }
      const { error: configError } = await supabase.from('ai_configuration').update({ vision_model: config.vision_model.trim(), text_model: config.text_model.trim(), transcription_model: config.transcription_model.trim(), is_enabled: config.is_enabled, updated_by: user?.id }).eq('id', true);
      if (configError) throw configError;
      setMessage('AI settings saved.');
    } catch (saveError) { console.error('AI settings save failed', saveError); setError('AI settings could not be saved.'); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading AI settings…</div>;
  if (!authorized) return null;

  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><button type="button" onClick={() => navigate('/admin')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to admin dashboard</button><div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-600">AI add-on controls</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Quotation assistant settings</h1><p className="mt-2 text-slate-600">Manage plan allowances and server-side model routing. API keys are never displayed here.</p></div><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save settings'}</button></div>{message && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle className="h-4 w-4" />{message}</div>}{error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">AI monthly plans</h2><p className="mt-1 text-sm text-slate-500">These plans are separate from the ₹2,000 Standard subscription.</p><div className="mt-5 space-y-4">{plans.map(plan => <div key={plan.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">{plan.name}</h3><p className="text-xs text-slate-500">{plan.description}</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={plan.is_active} onChange={event => setPlans(previous => previous.map(entry => entry.id === plan.id ? { ...entry, is_active: event.target.checked } : entry))} /> Active</label></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-700">Monthly price<input type="number" min="0" value={plan.price} onChange={event => setPlans(previous => previous.map(entry => entry.id === plan.id ? { ...entry, price: Number(event.target.value) || 0 } : entry))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Monthly credits<input type="number" min="1" value={plan.monthly_credits} onChange={event => setPlans(previous => previous.map(entry => entry.id === plan.id ? { ...entry, monthly_credits: Number(event.target.value) || 1 } : entry))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Provider configuration</h2><div className="mt-4 space-y-4">{config && <><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={config.is_enabled} onChange={event => setConfig({ ...config, is_enabled: event.target.checked })} /> Enable AI quotation generation</label><label className="block text-sm font-semibold text-slate-700">Vision model ID<input value={config.vision_model} onChange={event => setConfig({ ...config, vision_model: event.target.value })} placeholder="Configured server-side model ID" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-semibold text-slate-700">Text model ID<input value={config.text_model} onChange={event => setConfig({ ...config, text_model: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="block text-sm font-semibold text-slate-700">Transcription model ID<input value={config.transcription_model} onChange={event => setConfig({ ...config, transcription_model: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></>}</div><div className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>Enabling this switch does not create provider access. Generation remains unavailable until a valid server-side provider secret and supported model configuration are present.</p></div></section></div></div></div>;
};

export default AdminAIQuotationSettings;
