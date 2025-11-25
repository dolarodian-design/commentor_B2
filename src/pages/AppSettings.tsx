import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Globe, FileText, Clock, Power, Calendar } from 'lucide-react';
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
    active_duration_type: 'permanent' as 'permanent' | 'temporary' | 'inactive',
    active_until: '',
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
          active_duration_type: (data.active_duration_type as any) || 'permanent',
          active_until: data.active_until ? new Date(data.active_until).toISOString().slice(0, 16) : '',
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
      const updateData: any = {
        name: formData.name.trim(),
        base_url: formData.base_url.trim(),
        description: formData.description.trim() || null,
        active_duration_type: formData.active_duration_type,
        updated_at: new Date().toISOString(),
      };

      if (formData.active_duration_type === 'temporary') {
        if (!formData.active_until) {
          alert('Please set an expiry date for temporary activation');
          setSaving(false);
          return;
        }
        updateData.active_until = new Date(formData.active_until).toISOString();
        updateData.deactivated_at = null;
      } else if (formData.active_duration_type === 'inactive') {
        updateData.active_until = null;
        updateData.deactivated_at = new Date().toISOString();
      } else {
        updateData.active_until = null;
        updateData.deactivated_at = null;
      }

      const { error } = await supabase
        .from('apps')
        .update(updateData)
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

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Power className="w-5 h-5" />
              Activation Controls
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-3">
                  Activation Type
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="activation"
                      value="permanent"
                      checked={formData.active_duration_type === 'permanent'}
                      onChange={(e) => setFormData({ ...formData, active_duration_type: e.target.value as any })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-slate-900">Permanent</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        App stays active indefinitely until manually deactivated
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="activation"
                      value="temporary"
                      checked={formData.active_duration_type === 'temporary'}
                      onChange={(e) => setFormData({ ...formData, active_duration_type: e.target.value as any })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-slate-900">Temporary</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        App is active for a specific time period
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="activation"
                      value="inactive"
                      checked={formData.active_duration_type === 'inactive'}
                      onChange={(e) => setFormData({ ...formData, active_duration_type: e.target.value as any })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Power className="w-4 h-4 text-red-600" />
                        <span className="font-medium text-slate-900">Inactive</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        App is deactivated and cannot receive comments
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.active_duration_type === 'temporary' && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Active Until *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.active_until}
                    onChange={(e) => setFormData({ ...formData, active_until: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    The app will automatically deactivate after this date and time
                  </p>
                </div>
              )}
            </div>
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
