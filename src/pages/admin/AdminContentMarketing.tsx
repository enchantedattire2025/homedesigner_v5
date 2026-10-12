import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Video, MessageSquare, ShoppingBag, ArrowRight, FileImage } from 'lucide-react';

const AdminContentMarketing: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    { title: 'Deals Management', desc: 'Create and manage promotional deals for designers', icon: Tag, path: '/admin/deals', color: 'sky' },
    { title: 'Video Settings', desc: 'Configure homepage intro video', icon: Video, path: '/admin/video', color: 'blue' },
    { title: 'WhatsApp Settings', desc: 'Configure WhatsApp notification provider', icon: MessageSquare, path: '/admin/whatsapp', color: 'green' },
    { title: '3D Wallpaper Orders', desc: 'Manage and track 3D wallpaper orders', icon: ShoppingBag, path: '/admin/wallpaper-orders', color: 'amber' },
    { title: '3D Wallpaper Catalog', desc: 'Manage 3D wallpaper product catalog', icon: FileImage, path: '/admin/3d-wallpapers', color: 'violet' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content & Marketing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage deals, videos, WhatsApp notifications, and wallpaper content</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.path} onClick={() => navigate(s.path)}
              className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all group flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${s.color}-50 text-${s.color}-600`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-sky-500 transition-colors shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminContentMarketing;
