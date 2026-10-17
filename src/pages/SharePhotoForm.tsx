import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// NEW: Imported Package and X icons for the materials input field
import { ArrowLeft, Upload, Image, Tag, MapPin, FileText, CheckCircle, AlertCircle, Loader2, Package, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { supabase } from '../lib/supabase';
import ImageUploader from '../components/ImageUploader';

const SharePhotoForm = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { designer, isDesigner, loading: designerLoading, error: designerError } = useDesignerProfile();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // NEW: Added 'materials' to the formData state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    image_url: '',
    materials: [] as string[] // To hold the list of materials
  });

  // NEW: State to manage the current material being typed
  const [currentMaterial, setCurrentMaterial] = useState('');

  const categories = [
    'Living Room', 'Kitchen', 'Bedroom', 'Dining Room', 'Bathroom', 
    'Office', 'Entryway', 'Pooja Room', 'Kids Room', 'Other'
  ];
  const locations = [
    'Pune',
    'Mumbai'
  ];

  useEffect(() => {
    if (authLoading || designerLoading) {
      return;
    }
    const verifyTimeout = setTimeout(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (!designer) {
      navigate('/social-wall');
      return;
    }
     if (!formData.location && designer.location) {
      setFormData(prev => ({
        ...prev,
        location: designer.location
      }));
    } 
	}, 1000); 
    return () => clearTimeout(verifyTimeout);
  }, [user, authLoading, designerLoading, navigate, designer, isDesigner, formData.location]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleImageUploaded = (url: string) => {
    setFormData(prev => ({ ...prev, image_url: url }));
    if (error) setError(null);
  };

  // NEW: Handler to add a material to the list
  const handleAddMaterial = () => {
    if (currentMaterial.trim() && !formData.materials.includes(currentMaterial.trim())) {
      setFormData(prev => ({
        ...prev,
        materials: [...prev.materials, currentMaterial.trim()]
      }));
      setCurrentMaterial(''); // Clear the input field
    }
  };

  // NEW: Handler to remove a material from the list
  const handleRemoveMaterial = (materialToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter(material => material !== materialToRemove)
    }));
  };

  const checkExistingPhoto = async (category: string, designerId: string) => {
    try {
      const { data, error } = await supabase
        .from('shared_gallery_items')
        .select('id')
        .eq('designer_id', designerId)
        .eq('category', category)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking existing photo:', error);
      return false;
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (!formData.category) {
      setError('Category is required');
      return false;
    }
    if (!formData.location) {
      setError('Location is required');
      return false;
    }
    if (!formData.image_url) {
      setError('An image is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !designer) return;

    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const hasExistingPhoto = await checkExistingPhoto(formData.category, designer.id);

      if (hasExistingPhoto) {
        setError(`You have already uploaded a photo in the "${formData.category}" category. Each designer can upload only one photo per category.`);
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('shared_gallery_items')
        .insert({
          designer_id: designer.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          category: formData.category,
          location: formData.location,
          image_url: formData.image_url,
          materials: formData.materials,
          is_approved: false
        });

      if (error) throw error;

      setSuccess('Photo shared successfully! It will appear in the gallery after review.');
      setFormData({
        title: '',
        description: '',
        category: '',
        location: '',
        image_url: '',
        materials: []
      });
      setTimeout(() => {
        navigate('/social-wall');
      }, 2000);
    } catch (error: any) {
      console.error('Error sharing photo:', error);
      setError(error.message || 'Failed to share photo');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user data and designer profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be signed in to share photos.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!designer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be a registered designer to share photos.</p>
          <button onClick={() => navigate('/register-designer')} className="btn-primary">
            Register as Designer
          </button>
          <button onClick={() => navigate('/social-wall')} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors mt-4">
            Back to Gallery
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <button
              onClick={() => navigate('/social-wall')}
              className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gallery
            </button>
            <h1 className="text-3xl font-bold text-secondary-800 mb-4">
              Share Your Design Photo
            </h1>
            <p className="text-lg text-gray-600">
              Showcase your amazing work to our community and inspire others!
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-secondary-800 mb-4">Upload Your Photo *</h2>
              <ImageUploader
                onImageUploaded={handleImageUploaded}
                existingImageUrl={formData.image_url}
                label="Design Project Photo"
                helpText="Upload a high-quality image of your completed design project."
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-secondary-800 mb-4">Photo Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <div className="relative">
                    <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="e.g., Modern Living Room" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select name="category" value={formData.category} onChange={handleInputChange} className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent" required>
                      <option value="">Select Category</option>
                      {categories.map(category => (<option key={category} value={category}>{category}</option>))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Briefly describe your design, materials used, and inspiration." />
                  </div>
                </div>

                {/* NEW: Materials Used Input Section */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Materials Used</label>
                  <div className="relative flex items-center">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={currentMaterial}
                      onChange={(e) => setCurrentMaterial(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMaterial(); } }}
                      className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Teak Wood, Italian Marble"
                    />
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="ml-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.materials.map((material, index) => (
                      <span key={index} className="bg-accent-100 text-accent-800 px-3 py-1 rounded-full text-sm flex items-center">
                        {material}
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(material)}
                          className="ml-2 text-accent-600 hover:text-accent-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select name="location" value={formData.location} onChange={handleInputChange} className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent" required>
                      <option value="">Select Location</option>
                      {locations.map(location => (<option key={location} value={location}>{location}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button type="submit" disabled={loading} className="btn-primary px-12 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sharing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Share Photo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SharePhotoForm;