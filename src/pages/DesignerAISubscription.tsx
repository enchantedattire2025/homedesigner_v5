import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Zap, Crown, AlertCircle, Loader2, CreditCard, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AIPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_period: string;
  monthly_credits: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface AISubscription {
  id: string;
  status: string;
  ai_plan_id: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  auto_renew: boolean;
}

interface CreditPeriod {
  id: string;
  credits_granted: number;
  credits_reserved: number;
  credits_consumed: number;
  credits_refunded: number;
  period_start: string;
  period_end: string;
}

interface StandardSub {
  status: string;
  subscription_end_date: string | null;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const planIcons: Record<string, typeof Sparkles> = { 'AI Starter': Sparkles, 'AI Professional': Zap, 'AI Business': Crown };

const DesignerAISubscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AIPlan[]>([]);
  const [aiSubscription, setAISubscription] = useState<AISubscription | null>(null);
  const [creditPeriod, setCreditPeriod] = useState<CreditPeriod | null>(null);
  const [standardSub, setStandardSub] = useState<StandardSub | null>(null);
  const [designerId, setDesignerId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AIPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: designer, error: designerError } = await supabase
        .from('designers').select('id').eq('user_id', user.id).maybeSingle();
      if (designerError) throw designerError;
      if (!designer) { navigate('/designer-registration'); return; }
      setDesignerId(designer.id);

      const [plansRes, stdRes, aiRes] = await Promise.all([
        supabase.from('ai_subscription_plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('designer_subscriptions').select('status, subscription_end_date').eq('designer_id', designer.id).maybeSingle(),
        supabase.from('designer_ai_subscriptions').select('*').eq('designer_id', designer.id).maybeSingle(),
      ]);

      if (plansRes.error) throw plansRes.error;
      setPlans((plansRes.data || []) as AIPlan[]);

      if (stdRes.error) throw stdRes.error;
      setStandardSub(stdRes.data as StandardSub | null);

      if (aiRes.error) throw aiRes.error;
      setAISubscription(aiRes.data as AISubscription | null);

      if (aiRes.data) {
        const { data: periodData } = await supabase
          .from('ai_credit_periods')
          .select('*')
          .eq('designer_id', designer.id)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle();
        setCreditPeriod(periodData as CreditPeriod | null);
      }
    } catch (err) {
      console.error('Error loading AI subscription data:', err);
      setError('Could not load AI subscription information.');
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => { void loadData(); }, [loadData]);

  const standardActive = standardSub?.status === 'active' || standardSub?.status === 'trial';
  const aiActive = aiSubscription?.status === 'active' || aiSubscription?.status === 'trial';
  const remainingCredits = creditPeriod
    ? creditPeriod.credits_granted - creditPeriod.credits_reserved - creditPeriod.credits_consumed + creditPeriod.credits_refunded
    : 0;

  const handleChoosePlan = (plan: AIPlan) => {
    if (!standardActive) return;
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate('/designer-dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to dashboard</button>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-600">AI add-on</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">AI Quotation Subscription</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Generate quotations from floor plans using AI. Each plan includes monthly credits — one credit equals one AI quotation generation.</p>
        </div>

        {error && <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {!standardActive && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-bold text-amber-900">Standard subscription required</h3>
              <p className="mt-1 text-sm text-amber-800">You need an active Standard subscription before you can purchase an AI add-on. Activate your Standard subscription first.</p>
              <button type="button" onClick={() => navigate('/designer-subscription')} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Go to Standard Subscription</button>
            </div>
          </div>
        )}

        {aiActive && aiSubscription && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Active AI Plan</h2>
                <p className="text-sm text-slate-600">{plans.find(p => p.id === aiSubscription.ai_plan_id)?.name || 'AI Plan'}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">{aiSubscription.status === 'trial' ? 'Trial' : 'Active'}</span>
            </div>
            {creditPeriod && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><TrendingUp className="h-4 w-4 text-primary-600" /> Credits this billing period</div>
                  <span className="text-lg font-bold text-primary-700">{remainingCredits} / {creditPeriod.credits_granted}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: `${creditPeriod.credits_granted > 0 ? Math.min((remainingCredits / creditPeriod.credits_granted) * 100, 100) : 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Period: {new Date(creditPeriod.period_start).toLocaleDateString()} — {new Date(creditPeriod.period_end).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = planIcons[plan.name] || Sparkles;
            const isCurrentPlan = aiSubscription?.ai_plan_id === plan.id;
            return (
              <div key={plan.id} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${isCurrentPlan ? 'border-primary-600 ring-2 ring-primary-100' : 'border-slate-200'}`}>
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="h-8 w-8 text-primary-600" />
                  {isCurrentPlan && <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">Current</span>}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(plan.price)}</span>
                  <span className="text-sm text-slate-500"> / {plan.billing_period}</span>
                </div>
                <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-center">
                  <span className="text-2xl font-bold text-primary-700">{plan.monthly_credits}</span>
                  <span className="text-sm text-primary-700"> credits/month</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  {(plan.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>1 credit = 1 AI quotation generation</span>
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isCurrentPlan || !standardActive}
                  className={`mt-6 w-full rounded-xl py-3 font-semibold transition-colors ${isCurrentPlan ? 'cursor-default bg-slate-100 text-slate-400' : !standardActive ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                >
                  {isCurrentPlan ? 'Current Plan' : !standardActive ? 'Standard Required' : 'Choose Plan'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-900">How AI credits work</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Each AI quotation generation uses one credit from your monthly balance.</li>
            <li>Credits reset at the start of each billing period and do not roll over.</li>
            <li>If generation fails due to a system error, your credit is automatically refunded.</li>
            <li>AI plans are billed separately from your Standard subscription.</li>
          </ul>
        </div>
      </div>

      {showPaymentModal && selectedPlan && (
        <AIPaymentModal
          plan={selectedPlan}
          designerId={designerId}
          existingSubscription={aiSubscription}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); void loadData(); }}
        />
      )}
    </div>
  );
};

interface AIPaymentModalProps {
  plan: AIPlan;
  designerId: string | null;
  existingSubscription: AISubscription | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AIPaymentModal = ({ plan, designerId, existingSubscription, onClose, onSuccess }: AIPaymentModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    if (!designerId) return;
    setProcessing(true);
    setError(null);
    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      if (existingSubscription) {
        const { error: updateError } = await supabase
          .from('designer_ai_subscriptions')
          .update({
            ai_plan_id: plan.id,
            status: 'active',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubscription.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('designer_ai_subscriptions')
          .insert({
            designer_id: designerId,
            ai_plan_id: plan.id,
            status: 'active',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            auto_renew: true,
            payment_provider: 'razorpay',
          });
        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err) {
      console.error('AI subscription payment error:', err);
      setError('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Complete Payment</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">{plan.name}</h3>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900">{formatCurrency(plan.price)}</span>
            <span className="text-slate-600">/{plan.billing_period}</span>
          </div>
          <p className="mt-2 text-sm text-primary-700">{plan.monthly_credits} AI credits per month</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">Payment Method</label>
          <div className="space-y-2">
            {[
              { value: 'card', label: 'Credit/Debit Card' },
              { value: 'upi', label: 'UPI' },
              { value: 'netbanking', label: 'Net Banking' },
              { value: 'wallet', label: 'Wallet' },
            ].map((method) => (
              <label key={method.value} className="flex cursor-pointer items-center rounded-lg border p-3 hover:bg-slate-50">
                <input type="radio" name="ai-payment-method" value={method.value} checked={paymentMethod === method.value} onChange={(e) => setPaymentMethod(e.target.value)} className="mr-3" />
                <span className="text-slate-900">{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={processing} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handlePayment} disabled={processing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-white hover:bg-primary-700 disabled:bg-slate-400">
            {processing ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</> : <><CreditCard className="h-5 w-5" /> Pay {formatCurrency(plan.price)}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignerAISubscription;
