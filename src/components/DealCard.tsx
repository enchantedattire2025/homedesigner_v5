import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Gift, UserRound } from 'lucide-react';

type DealCardProps = {
  deal: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    original_price: number;
    deal_price: number;
    deal_type: string;
    valid_until: string;
    image_url?: string | null;
    designers?: { id?: string; name: string; profile_image?: string | null } | null;
  };
  compact?: boolean;
};

export default function DealCard({ deal, compact = false }: DealCardProps) {
  const endDate = new Date(deal.valid_until).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <article className={`group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${compact ? '' : 'md:grid md:grid-cols-[0.9fr_1.1fr]'}`}>
      <div className={`relative overflow-hidden bg-stone-100 ${compact ? 'aspect-[1.35]' : 'min-h-56'}`}>
        {deal.image_url ? <img src={deal.image_url} alt={deal.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full min-h-56 items-center justify-center bg-gradient-to-br from-primary-50 to-stone-100 text-primary-600"><Gift className="h-14 w-14" aria-hidden="true" /></div>}
        <span className="absolute left-4 top-4 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">{deal.discount_percentage}% OFF</span>
      </div>
      <div className="flex flex-col p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold capitalize text-primary-800">{deal.deal_type}</span>
          <span className="flex items-center gap-1 text-xs text-stone-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Until {endDate}</span>
        </div>
        <h3 className="mt-4 text-xl font-semibold leading-tight text-secondary-800">{deal.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{deal.description}</p>
        {deal.designers && <div className="mt-4 flex items-center gap-2 text-sm text-stone-600"><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-stone-100">{deal.designers.profile_image ? <img src={deal.designers.profile_image} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}</div><span>By <span className="font-semibold text-secondary-800">{deal.designers.name}</span></span></div>}
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div><span className="text-2xl font-bold text-secondary-800">₹{Number(deal.deal_price).toLocaleString('en-IN')}</span> <span className="text-sm text-stone-400 line-through">₹{Number(deal.original_price).toLocaleString('en-IN')}</span></div>
          <Link to={`/deals/${deal.id}`} className="inline-flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-600 hover:text-white">View Offer <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}
