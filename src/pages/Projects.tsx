import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, User, Filter, Tag, Search } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Projects = () => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const categories = ['Residential', 'Commercial', 'Office', 'Retail'];
  const budgetRanges = ['Under ₹5L', '₹5L - ₹10L', '₹10L - ₹20L', 'Above ₹20L'];

  useEffect(() => {
    fetchCompletedProjects();
  }, []);

  const fetchCompletedProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, try to get completed projects using the public view or RPC function
      // If that fails, we'll create mock data for demonstration
      let projectsData = null;
      let projectsError = null;

      try {
        // Try to fetch from the database first with project_images
        const { data, error } = await supabase
          .from('customers')
          .select(`
            *,
            assigned_designer:designers(id, name, email, specialization, rating, total_reviews, experience, profile_image),
            project_images(id, image_url, caption, is_primary, display_order)
          `)
          .eq('assignment_status', 'completed')
          .order('updated_at', { ascending: false });

        projectsData = data;
        projectsError = error;
      } catch (dbError) {
        console.log('Database access restricted for anonymous users, using demo data');
        projectsError = dbError;
      }

      // If database access fails (likely due to RLS for anonymous users), show demo projects
      if (projectsError || !projectsData) {
        console.log('Using demo completed projects for public viewing');
        projectsData = generateDemoCompletedProjects();
      }

      if (!projectsData || projectsData.length === 0) {
        setProjects([]);
        return;
      }

      // Keep only the most recently completed project per designer.
      // The query is already ordered by updated_at DESC, so the first
      // occurrence of each designer ID is the latest one.
      const seenDesigners = new Set<string>();
      projectsData = projectsData.filter((project: any) => {
        const designerId = project.assigned_designer?.id;
        if (!designerId || seenDesigners.has(designerId)) return false;
        seenDesigners.add(designerId);
        return true;
      });

      // Fetch accepted quotes for these projects
      let quotesData = null;
      
      // Only try to fetch quotes if we have real project data
      if (projectsData[0]?.id && typeof projectsData[0].id === 'string' && projectsData[0].id.includes('-')) {
        try {
          const projectIds = projectsData.map(p => p.id);
          const { data, error: quotesError } = await supabase
            .from('designer_quotes')
            .select('*')
            .in('project_id', projectIds)
            .eq('customer_accepted', true)
            .eq('status', 'accepted');
          
          if (!quotesError) {
            quotesData = data;
          }
        } catch (quotesError) {
          console.log('Could not fetch quotes, using demo data');
        }
      }


      // Create a map of project_id to quote
      const quotesMap: Record<string, any> = {};
      if (quotesData) {
        quotesData.forEach(quote => {
          quotesMap[quote.project_id] = quote;
        });
      }

      // Transform the data to match the existing component structure
      const transformedProjects = projectsData.map(project => {
        const quote = quotesMap[project.id];
        const duration = calculateProjectDuration(project.created_at, project.updated_at);
        
        return {
          id: project.id,
          title: project.project_name,
          designer: project.assigned_designer?.name || 'Unknown Designer',
          designerId: project.assigned_designer?.id || '',
          category: 'Residential', // Default category
          location: project.location,
          budget: quote ? `₹${quote.total_amount.toLocaleString()}` : project.budget_range,
          duration: duration,
          completedDate: new Date(project.updated_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          area: project.project_area || 'Not specified',
          image: getProjectImage(project),
          description: project.requirements,
          materials: generateMaterialsFromProject(project, quote),
          tags: generateProjectTags(project),
          designerRating: project.assigned_designer?.rating || 0,
          designerExperience: project.assigned_designer?.experience || 0
        };
      });

      setProjects(transformedProjects);
    } catch (error: any) {
      console.error('Error fetching completed projects:', error);
      // If there's an error, show demo projects instead of an error
      console.log('Falling back to demo projects due to error:', error.message);
      const demoProjects = generateDemoCompletedProjects();
      // Keep only one project per designer in demo data too
      const seenDemoDesigners = new Set<string>();
      const dedupedDemoProjects = demoProjects.filter((project: any) => {
        const designerId = project.assigned_designer?.id;
        if (!designerId || seenDemoDesigners.has(designerId)) return false;
        seenDemoDesigners.add(designerId);
        return true;
      });
      const transformedProjects = dedupedDemoProjects.map(project => {
        const duration = calculateProjectDuration(project.created_at, project.updated_at);
        
        return {
          id: project.id,
          title: project.project_name,
          designer: project.assigned_designer?.name || 'Unknown Designer',
          designerId: project.assigned_designer?.id || '',
          category: 'Residential',
          location: project.location,
          budget: project.budget_range,
          duration: duration,
          completedDate: new Date(project.updated_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          area: project.project_area || 'Not specified',
          image: getProjectImage(project),
          description: project.requirements,
          materials: generateMaterialsFromProject(project, null),
          tags: generateProjectTags(project),
          designerRating: project.assigned_designer?.rating || 0,
          designerExperience: project.assigned_designer?.experience || 0
        };
      });
      setProjects(transformedProjects);
    } finally {
      setLoading(false);
    }
  };

  const generateDemoCompletedProjects = () => {
    return [
      {
        id: 'demo-1',
        project_name: 'Modern Luxury Apartment',
        location: 'Mumbai',
        budget_range: '₹15-20 Lakhs',
        property_type: '3 BHK Apartment',
        project_area: '1200 sq ft',
        requirements: 'Contemporary design with modern amenities, open kitchen concept, and premium finishes throughout the apartment.',
        room_types: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom'],
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-04-20T00:00:00Z',
        assigned_designer: {
          id: 'designer-1',
          name: 'Priya Sharma',
          email: 'priya@example.com',
          specialization: 'Modern & Contemporary',
          rating: 4.9,
          total_reviews: 127,
          experience: 8,
          profile_image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      },
      {
        id: 'demo-2',
        project_name: 'Traditional Family Home',
        location: 'Delhi',
        budget_range: '₹25-30 Lakhs',
        property_type: 'Villa/Independent House',
        project_area: '2500 sq ft',
        requirements: 'Traditional Indian design with modern functionality, incorporating cultural elements and family-friendly spaces.',
        room_types: ['Living Room', 'Kitchen', 'Bedroom', 'Dining Room', 'Pooja Room'],
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-06-15T00:00:00Z',
        assigned_designer: {
          id: 'designer-2',
          name: 'Rajesh Kumar',
          email: 'rajesh@example.com',
          specialization: 'Traditional Indian',
          rating: 4.8,
          total_reviews: 98,
          experience: 12,
          profile_image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      },
      {
        id: 'demo-3',
        project_name: 'Minimalist Studio Design',
        location: 'Bangalore',
        budget_range: '₹8-12 Lakhs',
        property_type: 'Studio Apartment',
        project_area: '600 sq ft',
        requirements: 'Clean, minimalist design maximizing space efficiency with smart storage solutions and natural lighting.',
        room_types: ['Living Room', 'Kitchen', 'Bedroom'],
        created_at: '2024-03-10T00:00:00Z',
        updated_at: '2024-05-25T00:00:00Z',
        assigned_designer: {
          id: 'designer-3',
          name: 'Anita Desai',
          email: 'anita@example.com',
          specialization: 'Minimalist Design',
          rating: 4.9,
          total_reviews: 85,
          experience: 6,
          profile_image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      },
      {
        id: 'demo-4',
        project_name: 'Luxury Penthouse Renovation',
        location: 'Gurgaon',
        budget_range: 'Above ₹50 Lakhs',
        property_type: 'Penthouse',
        project_area: '3500 sq ft',
        requirements: 'High-end luxury renovation with premium materials, smart home integration, and panoramic city views.',
        room_types: ['Living Room', 'Kitchen', 'Bedroom', 'Dining Room', 'Study Room', 'Balcony'],
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-07-30T00:00:00Z',
        assigned_designer: {
          id: 'designer-4',
          name: 'Vikram Singh',
          email: 'vikram@example.com',
          specialization: 'Luxury & High-End',
          rating: 4.7,
          total_reviews: 89,
          experience: 15,
          profile_image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      },
      {
        id: 'demo-5',
        project_name: 'Eco-Friendly Home Design',
        location: 'Hyderabad',
        budget_range: '₹18-25 Lakhs',
        property_type: '2 BHK Apartment',
        project_area: '1100 sq ft',
        requirements: 'Sustainable design using eco-friendly materials, energy-efficient solutions, and natural ventilation systems.',
        room_types: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom'],
        created_at: '2024-02-15T00:00:00Z',
        updated_at: '2024-05-10T00:00:00Z',
        assigned_designer: {
          id: 'designer-5',
          name: 'Meera Reddy',
          email: 'meera@example.com',
          specialization: 'Eco-Friendly Design',
          rating: 4.8,
          total_reviews: 28,
          experience: 7,
          profile_image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      },
      {
        id: 'demo-6',
        project_name: 'Corporate Office Redesign',
        location: 'Pune',
        budget_range: '₹35-40 Lakhs',
        property_type: 'Commercial Space',
        project_area: '4000 sq ft',
        requirements: 'Modern office space design promoting productivity, collaboration, and employee well-being with ergonomic furniture.',
        room_types: ['Office', 'Meeting Room', 'Reception'],
        created_at: '2024-01-05T00:00:00Z',
        updated_at: '2024-04-15T00:00:00Z',
        assigned_designer: {
          id: 'designer-6',
          name: 'Arjun Patel',
          email: 'arjun@example.com',
          specialization: 'Commercial Design',
          rating: 4.6,
          total_reviews: 45,
          experience: 10,
          profile_image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400'
        }
      }
    ];
  };
  const calculateProjectDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} year${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''}`;
    }
  };

  const getProjectImage = (project: any) => {
    // First priority: Use uploaded project_images (primary image or first image)
    if (project.project_images && project.project_images.length > 0) {
      const primaryImage = project.project_images.find((img: any) => img.is_primary);
      if (primaryImage) {
        return primaryImage.image_url;
      }
      // If no primary image, use the first image
      return project.project_images[0].image_url;
    }

    // Second priority: Use layout image if available
    if (project.layout_image_url) {
      return project.layout_image_url;
    }

    // Default images based on property type
    const imageMap: Record<string, string> = {
      '1 BHK Apartment': 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
      '2 BHK Apartment': 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
      '3 BHK Apartment': 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
      '4+ BHK Apartment': 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800',
      'Villa/Independent House': 'https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800',
      'Penthouse': 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800',
      'Commercial Space': 'https://images.pexels.com/photos/1599791/pexels-photo-1599791.jpeg?auto=compress&cs=tinysrgb&w=800',
      'Office': 'https://images.pexels.com/photos/1599791/pexels-photo-1599791.jpeg?auto=compress&cs=tinysrgb&w=800'
    };

    return imageMap[project.property_type] || 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800';
  };

  const generateMaterialsFromProject = (project: any, quote: any) => {
    const materials = [];
    
    // Add materials based on room types
    if (project.room_types && project.room_types.length > 0) {
      if (project.room_types.includes('Kitchen')) {
        materials.push('Granite Counters', 'Modular Cabinets');
      }
      if (project.room_types.includes('Living Room')) {
        materials.push('Italian Marble', 'LED Lighting');
      }
      if (project.room_types.includes('Bedroom')) {
        materials.push('Teak Wood', 'Linen Fabrics');
      }
      if (project.room_types.includes('Bathroom')) {
        materials.push('Ceramic Tiles', 'Brass Fixtures');
      }
    }
    
    // Add materials based on budget range
    if (project.budget_range) {
      if (project.budget_range.includes('Above ₹20L') || project.budget_range.includes('Above ₹50L')) {
        materials.push('Premium Finishes', 'Designer Furniture');
      } else if (project.budget_range.includes('₹10L - ₹20L')) {
        materials.push('Quality Materials', 'Modern Fixtures');
      }
    }
    
    // Add default materials if we have less than 4
    const defaultMaterials = ['Quality Finishes', 'Modern Lighting', 'Premium Paint', 'Designer Hardware'];
    defaultMaterials.forEach(material => {
      if (materials.length < 4 && !materials.includes(material)) {
        materials.push(material);
      }
    });
    
    return materials.slice(0, 4);
  };

  const generateProjectTags = (project: any) => {
    const tags = [];
    
    // Add property type as tag
    if (project.property_type) {
      if (project.property_type.includes('BHK')) {
        tags.push(project.property_type.split(' ')[0] + ' ' + project.property_type.split(' ')[1]);
      } else {
        tags.push(project.property_type.split(' ')[0]);
      }
    }
    
    // Add room types as tags
    if (project.room_types && project.room_types.length > 0) {
      project.room_types.slice(0, 2).forEach((room: string) => {
        tags.push(room.replace(' Room', ''));
      });
    }
    
    // Add style tags based on requirements
    const requirements = project.requirements?.toLowerCase() || '';
    if (requirements.includes('modern')) tags.push('Modern');
    if (requirements.includes('traditional')) tags.push('Traditional');
    if (requirements.includes('minimal')) tags.push('Minimalist');
    if (requirements.includes('luxury')) tags.push('Luxury');
    if (requirements.includes('contemporary')) tags.push('Contemporary');
    
    // Add budget-based tag
    if (project.budget_range) {
      if (project.budget_range.includes('Above ₹50')) {
        tags.push('Luxury');
      } else if (project.budget_range.includes('₹20-50') || project.budget_range.includes('Above ₹20L')) {
        tags.push('Premium');
      }
    }
    
    return tags.slice(0, 5);
  };
  const filteredProjects = projects.filter(project => {
    const matchesCategory = !selectedCategory || project.category === selectedCategory;
    const matchesBudget = !selectedBudget || (() => {
      const budgetStr = project.budget || '';
      // Try to extract numeric value - handle both "₹13,004.78" and "₹15-20 Lakhs" formats
      let budgetValue = 0;
      if (budgetStr.toLowerCase().includes('lakh') || budgetStr.toLowerCase().includes('l')) {
        // Handle lakh-based strings like "₹15-20 Lakhs", "₹8-12 Lakhs", "Above ₹50 Lakhs"
        const nums = budgetStr.match(/[\d.]+/g);
        if (nums && nums.length > 0) {
          // Use the average of range, or single value
          const avg = nums.length > 1
            ? (parseFloat(nums[0]) + parseFloat(nums[1])) / 2
            : parseFloat(nums[0]);
          budgetValue = avg * 100000; // Convert lakhs to rupees
        }
      } else {
        // Handle plain rupee values like "₹13,004.78"
        budgetValue = parseFloat(budgetStr.replace(/[₹,\s]/g, '')) || 0;
      }

      switch (selectedBudget) {
        case 'Under ₹5L':
          return budgetValue < 500000;
        case '₹5L - ₹10L':
          return budgetValue >= 500000 && budgetValue <= 1000000;
        case '₹10L - ₹20L':
          return budgetValue > 1000000 && budgetValue <= 2000000;
        case 'Above ₹20L':
          return budgetValue > 2000000;
        default:
          return true;
      }
    })();

    const matchesSearch = !searchQuery || (
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.designer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      project.materials.some((material: string) => material.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return matchesCategory && matchesBudget && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading completed projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-4">
            <p className="font-medium">Error loading projects</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={fetchCompletedProjects}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-secondary-800 mb-4">
            Project Portfolio
          </h1>
          <p className="text-lg text-gray-600">
            Explore stunning interior design projects completed by our expert designers across India.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-secondary-800">Filter Projects</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
              <select
                value={selectedBudget}
                onChange={(e) => setSelectedBudget(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Budgets</option>
                {budgetRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  setSelectedBudget('');
                }}
                className="w-full text-primary-600 hover:text-primary-700 font-medium py-2"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Tag className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">No Completed Projects Yet</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Completed projects will appear here once designers finish their work and mark projects as completed.
              </p>
              <button
                onClick={fetchCompletedProjects}
                className="btn-primary"
              >
                Refresh Projects
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="card overflow-hidden group">
                <div className="relative">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {project.category}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="bg-white/90 text-secondary-800 px-3 py-1 rounded-full text-sm font-medium">
                      {project.budget}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Completed
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-semibold text-secondary-800 mb-2 group-hover:text-primary-600 transition-colors">
                    {project.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {project.description}
                  </p>

                  <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <Link 
                      to={`/designers/${project.designerId}`}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {project.designer}
                    </Link>
                    {project.designerRating > 0 && (
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-xs">{project.designerRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{project.completedDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600">{project.area}</span>
                    <span className="text-sm text-gray-600">{project.duration}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {project.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="bg-accent-100 text-accent-800 px-2 py-1 rounded-md text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {projects.length === 0 
                ? "No completed projects available yet."
                : "No projects found matching your criteria. Try adjusting your filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;