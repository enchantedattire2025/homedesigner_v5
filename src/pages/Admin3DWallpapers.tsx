import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Eye, EyeOff, Plus, X, Loader2, Image as ImageIcon, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Wallpaper {
  id: string;
  image_url: string;
  second_image_url: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  "Geometric",
  "Nature",
  "Luxury",
  "Modern",
  "Floral",
  "Industrial",
  "Texture",
  "Abstract",
  "Wood",
  "Zen",
  "Space",
  "Urban"
];

export default function Admin3DWallpapers() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWallpaper, setEditingWallpaper] = useState<Wallpaper | null>(null);
  const [uploading, setUploading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('Geometric');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [useUrlInput, setUseUrlInput] = useState(false);
  const [imageUrls, setImageUrls] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Second image ("Wallpaper on Wall") state — create modal
  const [secondImageFile, setSecondImageFile] = useState<File | null>(null);
  const [secondImagePreview, setSecondImagePreview] = useState<string | null>(null);

  // Second image state — edit modal
  const [editSecondImageFile, setEditSecondImageFile] = useState<File | null>(null);
  const [editSecondImagePreview, setEditSecondImagePreview] = useState<string | null>(null);

  useEffect(() => {
    console.log('Admin3DWallpapers - Auth check:', {
      authLoading,
      hasUser: !!user,
      isAdmin,
      userId: user?.id
    });

    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }

    if (!user || !isAdmin) {
      console.log('Not authorized, redirecting to admin login');
      navigate('/admin-login');
      return;
    }

    console.log('Admin authorized, fetching wallpapers');
    fetchWallpapers();
  }, [authLoading, user, isAdmin, navigate]);

  const fetchWallpapers = async () => {
    try {
      setLoading(true);
      console.log('Fetching wallpapers...');

      const { data, error } = await supabase
        .from('wallpapers_3d')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Wallpapers fetched:', data);
      setWallpapers(data || []);
    } catch (error: any) {
      console.error('Error fetching wallpapers:', error);
      alert(`Failed to load wallpapers: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setImageFiles(prev => [...prev, ...newFiles]);

      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSecondImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSecondImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSecondImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSecondImage = () => {
    setSecondImageFile(null);
    setSecondImagePreview(null);
  };

  const handleEditSecondImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditSecondImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditSecondImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeEditSecondImage = () => {
    setEditSecondImageFile(null);
    setEditSecondImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    console.log('Uploading image:', { fileName, fileSize: file.size });

    const { error: uploadError } = await supabase.storage
      .from('wallpaper-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('wallpaper-images')
      .getPublicUrl(filePath);

    console.log('Image uploaded successfully:', publicUrl);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageFiles.length === 0 && !imageUrls.trim()) {
      alert('Please select at least one image or provide image URLs');
      return;
    }

    try {
      setUploading(true);
      console.log('Submitting wallpapers...');

      let secondImageUrl: string | null = null;

      // Upload the optional "Wallpaper on Wall" image if one was selected
      if (secondImageFile) {
        secondImageUrl = await uploadImage(secondImageFile);
      }

      const wallpapersToInsert: any[] = [];

      // Handle file uploads
      if (!useUrlInput && imageFiles.length > 0) {
        for (const file of imageFiles) {
          const imageUrl = await uploadImage(file);
          wallpapersToInsert.push({
            image_url: imageUrl,
            second_image_url: secondImageUrl,
            category: selectedCategory,
            is_active: isActive,
            created_by: user?.id
          });
        }
      }

      // Handle URL inputs
      if (useUrlInput && imageUrls.trim()) {
        const urls = imageUrls.split('\n').filter(url => url.trim());
        for (const url of urls) {
          wallpapersToInsert.push({
            image_url: url.trim(),
            second_image_url: secondImageUrl,
            category: selectedCategory,
            is_active: isActive,
            created_by: user?.id
          });
        }
      }

      console.log('Saving wallpapers:', wallpapersToInsert);

      const { error } = await supabase
        .from('wallpapers_3d')
        .insert(wallpapersToInsert);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      alert(`Successfully added ${wallpapersToInsert.length} wallpaper(s)!`);
      closeModal();
      fetchWallpapers();
    } catch (error: any) {
      console.error('Error saving wallpapers:', error);
      alert(`Failed to save wallpapers: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (wallpaper: Wallpaper) => {
    setEditingWallpaper(wallpaper);
    setEditSecondImageFile(null);
    setEditSecondImagePreview(wallpaper.second_image_url || null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingWallpaper) return;

    try {
      setUploading(true);

      const updates: { second_image_url?: string | null } = {};

      if (editSecondImageFile) {
        // Upload the new "Wallpaper on Wall" image
        const newUrl = await uploadImage(editSecondImageFile);
        updates.second_image_url = newUrl;
      } else if (editSecondImagePreview === null && editingWallpaper.second_image_url) {
        // Admin removed the existing second image
        updates.second_image_url = null;
      }

      // Only update if there's something to change
      if (Object.keys(updates).length === 0) {
        setShowEditModal(false);
        return;
      }

      const { error } = await supabase
        .from('wallpapers_3d')
        .update(updates)
        .eq('id', editingWallpaper.id);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      alert('Wallpaper updated successfully!');
      setShowEditModal(false);
      setEditingWallpaper(null);
      setEditSecondImageFile(null);
      setEditSecondImagePreview(null);
      fetchWallpapers();
    } catch (error: any) {
      console.error('Error updating wallpaper:', error);
      alert(`Failed to update wallpaper: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingWallpaper(null);
    setEditSecondImageFile(null);
    setEditSecondImagePreview(null);
  };

  const handleDelete = async (id: string, imageUrl: string, secondImageUrl: string | null) => {
    if (!confirm('Are you sure you want to delete this wallpaper?')) return;

    try {
      const { error } = await supabase
        .from('wallpapers_3d')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const imagePath = imageUrl.split('/').pop();
      if (imagePath && imageUrl.includes('wallpaper-images')) {
        await supabase.storage
          .from('wallpaper-images')
          .remove([imagePath]);
      }

      if (secondImageUrl) {
        const secondPath = secondImageUrl.split('/').pop();
        if (secondPath && secondImageUrl.includes('wallpaper-images')) {
          await supabase.storage
            .from('wallpaper-images')
            .remove([secondPath]);
        }
      }

      alert('Wallpaper deleted successfully!');
      fetchWallpapers();
    } catch (error) {
      console.error('Error deleting wallpaper:', error);
      alert('Failed to delete wallpaper');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('wallpapers_3d')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchWallpapers();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to update status');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCategory('Geometric');
    setImageFiles([]);
    setImagePreviews([]);
    setImageUrls('');
    setUseUrlInput(false);
    setIsActive(true);
    setSecondImageFile(null);
    setSecondImagePreview(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">{authLoading ? 'Checking authorization...' : 'Loading wallpapers...'}</p>
        </div>
      </div>
    );
  }

  // Group wallpapers by category
  const wallpapersByCategory = wallpapers.reduce((acc, wallpaper) => {
    if (!acc[wallpaper.category]) {
      acc[wallpaper.category] = [];
    }
    acc[wallpaper.category].push(wallpaper);
    return acc;
  }, {} as Record<string, Wallpaper[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">3D Wallpaper Management</h1>
            <p className="text-gray-600 mt-2">Upload multiple wallpapers per category</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Wallpapers
          </button>
        </div>

        {/* Display by Category */}
        <div className="space-y-8">
          {CATEGORIES.map(category => {
            const categoryWallpapers = wallpapersByCategory[category] || [];

            return (
              <div key={category} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {categoryWallpapers.length} wallpapers
                  </span>
                </div>

                {categoryWallpapers.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {categoryWallpapers.map((wallpaper) => (
                      <div key={wallpaper.id} className="group relative">
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                          <img
                            src={wallpaper.image_url}
                            alt={`${category} wallpaper`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleActive(wallpaper.id, wallpaper.is_active)}
                              className={`p-2 rounded-full ${
                                wallpaper.is_active ? 'bg-green-500' : 'bg-gray-500'
                              } text-white hover:scale-110 transition-transform`}
                              title={wallpaper.is_active ? 'Active' : 'Inactive'}
                            >
                              {wallpaper.is_active ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(wallpaper)}
                              className="p-2 rounded-full bg-blue-500 text-white hover:scale-110 transition-transform"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(wallpaper.id, wallpaper.image_url, wallpaper.second_image_url)}
                              className="p-2 rounded-full bg-red-500 text-white hover:scale-110 transition-transform"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {wallpaper.second_image_url && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <ImageIcon className="w-3 h-3" />
                            <span>Has "on wall" image</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No wallpapers in this category yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add Wallpapers</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Method *
                  </label>

                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setUseUrlInput(false);
                        setImageUrls('');
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                        !useUrlInput
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Upload Images
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseUrlInput(true);
                        setImageFiles([]);
                        setImagePreviews([]);
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                        useUrlInput
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Use Image URLs
                    </button>
                  </div>

                  {useUrlInput ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 text-sm mb-2">How to add multiple image URLs:</h4>
                        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Enter one image URL per line</li>
                          <li>Works with Pinterest, Unsplash, Pexels, or any direct image URL</li>
                          <li>All images will be added to the selected category</li>
                        </ol>
                      </div>

                      <div>
                        <textarea
                          value={imageUrls}
                          onChange={(e) => setImageUrls(e.target.value)}
                          placeholder="https://i.pinimg.com/image1.jpg&#10;https://i.pinimg.com/image2.jpg&#10;https://i.pinimg.com/image3.jpg"
                          rows={8}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {imageUrls.split('\n').filter(url => url.trim()).length} URLs entered
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <label className="cursor-pointer">
                          <span className="text-blue-600 hover:text-blue-800 font-medium">
                            Select multiple images
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 10MB each</p>
                      </div>

                      {imagePreviews.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Selected Images ({imagePreviews.length})
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                            {imagePreviews.map((preview, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full aspect-[3/4] object-cover rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional "Wallpaper on Wall" image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallpaper on Wall (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Shows the wallpaper applied to a wall. Displayed as a second image in the gallery carousel.
                  </p>
                  {secondImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={secondImagePreview}
                        alt="Wallpaper on wall preview"
                        className="w-48 aspect-[3/4] object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={removeSecondImage}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <label className="cursor-pointer">
                        <span className="text-blue-600 hover:text-blue-800 font-medium">
                          Select an image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSecondImageChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Active (visible in gallery)
                  </label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>Add Wallpapers</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — update the optional "Wallpaper on Wall" image */}
      {showEditModal && editingWallpaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Wallpaper</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <img
                    src={editingWallpaper.image_url}
                    alt="Wallpaper design"
                    className="w-24 aspect-[3/4] object-cover rounded-lg border border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{editingWallpaper.category}</p>
                    <p className="text-xs text-gray-500 mt-1">The main wallpaper design image cannot be changed here.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallpaper on Wall (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Shows the wallpaper applied to a wall. Displayed as a second image in the gallery carousel.
                  </p>
                  {editSecondImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={editSecondImagePreview}
                        alt="Wallpaper on wall preview"
                        className="w-48 aspect-[3/4] object-cover rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={removeEditSecondImage}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <label className="cursor-pointer">
                        <span className="text-blue-600 hover:text-blue-800 font-medium">
                          Select an image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditSecondImageChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
