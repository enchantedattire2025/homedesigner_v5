import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Search, Wrench } from 'lucide-react';

const AdminCatalogue: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [designerPrices, setDesignerPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, pRes] = await Promise.all([
        supabase.from('material_pricing_master').select('*').order('category, name'),
        supabase.from('designer_material_prices').select('*, designers(name), material_pricing_master(name, category)').order('created_at', { ascending: false }).limit(100),
      ]);
      if (mRes.error) throw mRes.error;
      if (pRes.error) throw pRes.error;
      setMaterials(mRes.data || []);
      setDesignerPrices(pRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load catalogue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load catalogue</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchAll} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  const categories = [...new Set(materials.map(m => m.category).filter(Boolean))];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalogue & Pricing</h1>
        <p className="text-gray-500 text-sm mt-1">View material pricing master and designer-specific pricing overrides</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material pricing master */}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Wrench className="w-4 h-4 text-gray-600" /> Material Pricing Master</h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          {categories.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><p className="text-gray-400 text-sm">No master materials configured.</p></div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {categories.map(cat => (
                <div key={cat} className="bg-white rounded-xl border border-gray-200">
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50"><p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{cat}</p></div>
                  <div className="divide-y divide-gray-50">
                    {materials.filter(m => m.category === cat && (!search || m.name?.toLowerCase().includes(search.toLowerCase()))).map(m => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-gray-700">{m.name}</span>
                        <span className="text-gray-500 text-xs">{m.unit || ''} {m.default_price ? `· ₹${Number(m.default_price).toLocaleString('en-IN')}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Designer-specific pricing */}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Designer Pricing Overrides</h3>
          {designerPrices.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><p className="text-gray-400 text-sm">No designer-specific pricing found.</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Designer</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Material</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Price</th>
                </tr></thead>
                <tbody>
                  {designerPrices.map(p => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{p.designers?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.material_pricing_master?.name || p.material_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.price ? `₹${Number(p.price).toLocaleString('en-IN')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCatalogue;
