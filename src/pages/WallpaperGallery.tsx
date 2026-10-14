import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, LogIn, Loader2, Search, Sparkles, Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/AuthModal';
import { supabase } from '../lib/supabase';

interface Wallpaper {
  id: string;
  image_url: string;
  second_image_url: string | null;
  category: string;
}

const CATEGORIES = ["All", "Geometric", "Nature", "Luxury", "Modern", "Floral", "Industrial", "Texture", "Abstract", "Wood", "Zen", "Space", "Urban"];

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f3f4f6"/><text x="150" y="200" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9ca3af">Image unavailable</text></svg>'
);

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  user: ReturnType<typeof useAuth>['user'];
  onOrder: (wallpaper: Wallpaper) => void;
}

const WallpaperCard: React.FC<WallpaperCardProps> = ({ wallpaper, user, onOrder }) => {
  const images = [wallpaper.image_url, wallpaper.second_image_url].filter(
    (url): url is string => !!url && url.trim() !== ''
  );
  const hasMultiple = images.length > 1;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const visibleImages = images.map((url, idx) =>
    imgErrors.has(idx) ? PLACEHOLDER_SVG : url
  );

  const goToSlide = useCallback((index: number) => {
    if (!hasMultiple) return;
    setCurrentIndex((index + images.length) % images.length);
  }, [hasMultiple, images.length]);

  const goPrev = useCallback(() => goToSlide(currentIndex - 1), [currentIndex, goToSlide]);
  const goNext = useCallback(() => goToSlide(currentIndex + 1), [currentIndex, goToSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  const handleImgError = (idx: number) => {
    setImgErrors((prev) => new Set(prev).add(idx));
  };

  return (
    <div
      className="group bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div
        className="relative aspect-[3/4] overflow-hidden"
        onTouchStart={hasMultiple ? handleTouchStart : undefined}
        onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
      >
        <img
          src={visibleImages[currentIndex]}
          alt={`${wallpaper.category} wallpaper${hasMultiple ? (currentIndex === 0 ? ' – design' : ' – on wall') : ''}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={() => handleImgError(currentIndex)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Show previous wallpaper image"
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105 hover:!bg-slate-950/90 hover:!scale-110 active:scale-95 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Show next wallpaper image"
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105 hover:!bg-slate-950/90 hover:!scale-110 active:scale-95 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
              <span className="rounded-full border border-white/20 bg-slate-950/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow-md backdrop-blur-md">
                {currentIndex === 0 ? 'Design' : 'On Wall'}
              </span>
              <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
                {images.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    aria-label={dotIdx === 0 ? 'Show wallpaper design' : 'Show wallpaper on wall'}
                    aria-current={currentIndex === dotIdx}
                    onClick={() => goToSlide(dotIdx)}
                    className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${
                      currentIndex === dotIdx
                        ? 'w-6 bg-white shadow-sm'
                        : 'w-2 bg-white/60 hover:bg-white/90 hover:scale-125'
                    }`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-800 rounded-full">
            {wallpaper.category}
          </span>
        </div>
      </div>

      <div className="p-5">
        <button
          onClick={() => onOrder(wallpaper)}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 ${
            user
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg'
              : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {user ? (
            <>
              <ShoppingCart className="w-4 h-4" />
              Order Now
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Please Login
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default function WallpaperGallery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingWallpaper, setPendingWallpaper] = useState<Wallpaper | null>(null);
  const [pendingCustomOrder, setPendingCustomOrder] = useState(false);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallpapers();
  }, []);

  const fetchWallpapers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallpapers_3d')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWallpapers(data || []);
    } catch (error) {
      console.error('Error fetching wallpapers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWallpapers = wallpapers.filter(wallpaper => {
    const matchesCategory = selectedCategory === 'All' || wallpaper.category === selectedCategory;
    return matchesCategory;
  });

  const handleOrderClick = (wallpaper: Wallpaper) => {
    if (!user) {
      setPendingWallpaper(wallpaper);
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    navigate('/wallpaper-order', {
      state: {
        selectedWallpaper: wallpaper
      }
    });
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);

    if (pendingCustomOrder) {
      navigate('/wallpaper-order', { state: { isCustomOrder: true } });
      setPendingCustomOrder(false);
      return;
    }

    if (pendingWallpaper) {
      navigate('/wallpaper-order', {
        state: {
          selectedWallpaper: pendingWallpaper
        }
      });
      setPendingWallpaper(null);
    }
  };

  const handleCustomOrderClick = () => {
    if (!user) {
      setPendingCustomOrder(true);
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    navigate('/wallpaper-order', { state: { isCustomOrder: true } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading wallpapers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            3D Wallpaper Collection
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your space with our premium 3D wallpapers. Browse our curated collection and order your favorite designs.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2.5 rounded-full font-medium transition-all transform hover:scale-105 ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 text-center">
          <p className="text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredWallpapers.length}</span> wallpapers
          </p>
        </div>

        {/* Custom Design CTA */}
        <div className="mb-10 rounded-2xl overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6 p-8">
            <div className="flex-shrink-0 w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-white mb-1">
                Don't see what you're looking for?
              </h2>
              <p className="text-slate-300 text-sm max-w-xl">
                Describe your dream wallpaper and we'll create a completely custom 3D design just for your space — any style, any color, any pattern.
              </p>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={handleCustomOrderClick}
                className="inline-flex items-center gap-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-7 py-3.5 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-amber-400/30 whitespace-nowrap"
              >
                <Palette className="w-5 h-5" />
                Request Custom Design
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredWallpapers.map((wallpaper) => (
            <WallpaperCard
              key={wallpaper.id}
              wallpaper={wallpaper}
              user={user}
              onOrder={handleOrderClick}
            />
          ))}
        </div>

        {filteredWallpapers.length === 0 && (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">No wallpapers found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingWallpaper(null);
          setPendingCustomOrder(false);
        }}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
