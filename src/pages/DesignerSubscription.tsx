import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, AlertCircle, CreditCard, Sparkles, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_period: string;
  features: string[];
  max_projects: number;
  max_quotes: number;
  priority_support: boolean;
  sort_order: number;
}

interface DesignerSubscriptionRow {
  id: string;
  status: string;
  trial_start_date: string;
  trial_end_date: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  auto_renew: boolean;
  subscription_plan: SubscriptionPlan;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const DesignerSubscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<DesignerSubscriptionRow | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [designerId, setDesignerId] = useState<string | null>(null);

  const loadSubscriptionData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: designerData, error: designerError } = await supabase
        .from('designers').select('id').eq('user_id', user.id).maybeSingle();
      if (designerError) throw designerError;
      if (!designerData) { navigate('/designer-registration'); return; }
      setDesignerId(designerData.id);

      const { data: subData, error: subError } = await supabase
        .from('designer_subscriptions')
        .select(`*, subscription_plan:subscription_plans(*)`)
        .eq('designer_id', designerData.id)
        .maybeSingle();
      if (subError) throw subError;
      if (subData) setSubscription(subData as DesignerSubscriptionRow);

      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (plansError) throw plansError;
      setPlans((plansData || []) as SubscriptionPlan[]);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => { void loadSubscriptionData(); }, [loadSubscriptionData]);

  const getRemainingTrialDays = () => {
    if (!subscription || subscription.status !== 'trial') return 0;
    const endDate = new Date(subscription.trial_end_date);
    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getRemainingSubscriptionDays = () => {
    if (!subscription || !subscription.subscription_end_date) return 0;
    const endDate = new Date(subscription.subscription_end_date);
    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleUpgrade = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      trial: { text: 'Free Trial', color: 'bg-blue-100 text-blue-800' },
      active: { text: 'Active', color: 'bg-emerald-100 text-emerald-800' },
      expired: { text: 'Expired', color: 'bg-red-100 text-red-800' },
      cancelled: { text: 'Cancelled', color: 'bg-slate-100 text-slate-800' },
    };
    const badge = badges[status] || badges.expired;
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.text}</span>;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate('/designer-dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to dashboard</button>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Subscription Management</h1>
          <p className="mt-2 text-slate-600">Choose the plan that fits your business needs</p>
        </div>

        {subscription && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Current Plan</h2>
                <p className="mt-1 text-slate-600">{subscription.subscription_plan?.name || 'Standard'}</p>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(subscription.status)}
                {subscription.status === 'trial' && (
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Trial ends in</p>
                    <p className="text-2xl font-bold text-blue-600">{getRemainingTrialDays()} days</p>
                  </div>
                )}
                {subscription.status === 'active' && (
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Renews in</p>
                    <p className="text-2xl font-bold text-emerald-600">{getRemainingSubscriptionDays()} days</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.subscription_plan?.id === plan.id;
            const Icon = plan.priority_support ? Zap : Sparkles;
            return (
              <div key={plan.id} className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${isCurrentPlan ? 'border-primary-600 ring-2 ring-primary-100' : 'border-slate-200'}`}>
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="h-8 w-8 text-primary-600" />
                  {isCurrentPlan && <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">Current</span>}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-4 mb-5">
                  <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(plan.price)}</span>
                  <span className="text-sm text-slate-500"> / {plan.billing_period}</span>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {(plan.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrentPlan}
                  className={`mt-6 w-full rounded-xl py-3 font-semibold transition-colors ${isCurrentPlan ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                >
                  {isCurrentPlan ? 'Current Plan' : 'Start Subscription'}
                </button>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No subscription plans are available yet. Please check back later.
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div>
              <h3 className="font-bold text-primary-900">Need AI-powered quotations?</h3>
              <p className="mt-1 text-sm text-primary-800">AI quotation generation is a separate add-on on top of your Standard subscription. Once your Standard subscription is active, visit the AI Subscription page to choose an AI plan.</p>
              <button type="button" onClick={() => navigate('/designer-ai-subscription')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                <Sparkles className="h-4 w-4" /> View AI Plans
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          subscription={subscription}
          designerId={designerId}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); void loadSubscriptionData(); }}
        />
      )}
    </div>
  );
};

interface PaymentModalProps {
  plan: SubscriptionPlan;
  subscription: DesignerSubscriptionRow | null;
  designerId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentModal = ({ plan, subscription, designerId, onClose, onSuccess }: PaymentModalProps) => {
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

      const paymentData = {
        designer_subscription_id: subscription?.id || null,
        amount: plan.price,
        currency: 'INR',
        payment_method: paymentMethod,
        payment_gateway: 'razorpay',
        transaction_id: `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        payment_status: 'completed',
        payment_date: new Date().toISOString(),
        billing_period_start: startDate.toISOString(),
        billing_period_end: endDate.toISOString(),
        metadata: { plan_name: plan.name, billing_period: plan.billing_period, amount: plan.price, payment_method: paymentMethod },
      };

      const { error: paymentError } = await supabase.from('subscription_payments').insert([paymentData]);
      if (paymentError) throw paymentError;

      if (subscription) {
        const { error: subError } = await supabase
          .from('designer_subscriptions')
          .update({
            subscription_plan_id: plan.id,
            status: 'active',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
        if (subError) throw subError;
      } else {
        const { error: insertError } = await supabase
          .from('designer_subscriptions')
          .insert({
            designer_id: designerId,
            subscription_plan_id: plan.id,
            status: 'active',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err) {
      console.error('Payment error:', err);
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
          <h3 className="font-semibold text-slate-900">{plan.name} Plan</h3>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900">{formatCurrency(plan.price)}</span>
            <span className="text-slate-600">/{plan.billing_period}</span>
          </div>
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
                <input type="radio" name="payment-method" value={method.value} checked={paymentMethod === method.value} onChange={(e) => setPaymentMethod(e.target.value)} className="mr-3" />
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

export default DesignerSubscription;
