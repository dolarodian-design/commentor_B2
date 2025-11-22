import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Globe, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Database } from '../lib/database.types';

type App = Database['public']['Tables']['apps']['Row'];

export function AppSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    description: '',
  });

  useEffect(() => {
    if (id) {
      fetchApp();
    }
  }, [id]);

  const fetchApp = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setApp(data);
        setFormData({
          name: data.name,
          base_url: data.base_url,
          description: data.description || '',
        });
      }
    } catch (error) {
      console.error('Error fetching app:', error);
      alert('Failed to load app settings');
      navigate('/dashboard/apps');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.base_url.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('apps')
        .update({
          name: formData.name.trim(),
          base_url: formData.base_url.trim(),
          description: formData.description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      navigate(`/dashboard/apps/${id}`);
    } catch (error) {
      console.error('Error updating app:', error);
      alert('Failed to update app settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/dashboard/apps/${id}`)}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">App Settings</h1>
          <p className="text-slate-600 mt-1">Update your app configuration</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              App Name *
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome App"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              A descriptive name for your application
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Base URL *
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="url"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder="https://myapp.com"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The URL where your app is hosted (e.g., https://yourapp.com)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of your app (optional)"
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional description to help identify this app
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/apps/${id}`)}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
