import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { User, Building2, Plug, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';
import { JiraService, createOrUpdateJiraConfig, getJiraConfig } from '../lib/jira';

export function Settings() {
  const { } = useAuth();
  const { } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'integrations'>('profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account and workspace settings</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('workspace')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'workspace'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Workspace</span>
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'integrations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plug className="w-4 h-4" />
          <span>Integrations</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {activeTab === 'profile' && <ProfileSettings />}
        {activeTab === 'workspace' && <WorkspaceSettings />}
        {activeTab === 'integrations' && <IntegrationSettings />}
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id);

    if (!error) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Your full name"
            />
          </div>

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Profile updated successfully
            </div>
          )}

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSettings() {
  const { currentWorkspace, currentMembership } = useWorkspace();

  if (!currentWorkspace) return null;

  const isAdmin = currentMembership?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Workspace Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Name</label>
            <input
              type="text"
              value={currentWorkspace.name}
              disabled={!isAdmin}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
            {!isAdmin && (
              <p className="mt-1 text-xs text-slate-500">Only admins can update workspace settings</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Workspace URL</label>
            <input
              type="text"
              value={currentWorkspace.slug}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">Workspace URL cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Role</label>
            <input
              type="text"
              value={currentMembership?.role || 'Unknown'}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 capitalize"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationSettings() {
  const { currentWorkspace } = useWorkspace();
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadExistingConfig();
    }
  }, [currentWorkspace?.id]);

  const loadExistingConfig = async () => {
    if (!currentWorkspace?.id) return;

    const config = await getJiraConfig(currentWorkspace.id);
    if (config) {
      setJiraDomain(config.jira_domain || '');
      setJiraEmail(config.jira_email || '');
      setJiraProjectKey(config.jira_project_key || '');
      setAutoSync(config.auto_sync_enabled || false);
      setIsConfigured(true);
      setConnectionStatus('success');
    }
  };

  const handleTestConnection = async () => {
    if (!jiraDomain || !jiraEmail || !jiraApiToken) {
      setErrorMessage('Please fill in all required fields');
      setConnectionStatus('error');
      return;
    }

    setIsTestingConnection(true);
    setErrorMessage('');
    setConnectionStatus('idle');

    try {
      const jiraService = new JiraService({
        domain: jiraDomain,
        email: jiraEmail,
        apiToken: jiraApiToken,
        projectKey: jiraProjectKey
      });

      const isConnected = await jiraService.testConnection();

      if (isConnected) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setErrorMessage('Unable to connect. Please check your credentials.');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkspace?.id) return;

    if (!jiraDomain || !jiraEmail || !jiraApiToken || !jiraProjectKey) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await createOrUpdateJiraConfig(
        currentWorkspace.id,
        {
          domain: jiraDomain,
          email: jiraEmail,
          apiToken: jiraApiToken,
          projectKey: jiraProjectKey
        },
        autoSync
      );

      setIsConfigured(true);
      alert('Jira integration configured successfully!');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Jira Integration</h2>
        <p className="text-slate-600 mb-6">
          Connect to your Jira instance to sync feedback directly to your project management workflow.
          <a
            href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 ml-1 inline-flex items-center gap-1"
          >
            Learn how to create an API token
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>

        {isConfigured && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm w-fit">
            <CheckCircle className="w-4 h-4" />
            <span>Jira integration is configured and active</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="jiraDomain" className="block text-sm font-medium text-slate-700 mb-1">
              Jira Domain *
            </label>
            <input
              type="text"
              id="jiraDomain"
              value={jiraDomain}
              onChange={(e) => setJiraDomain(e.target.value)}
              placeholder="yourcompany.atlassian.net"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Your Jira instance domain without https://
            </p>
          </div>

          <div>
            <label htmlFor="jiraEmail" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="jiraEmail"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              placeholder="your.email@company.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Your Atlassian account email
            </p>
          </div>

          <div>
            <label htmlFor="jiraApiToken" className="block text-sm font-medium text-slate-700 mb-1">
              API Token *
            </label>
            <input
              type="password"
              id="jiraApiToken"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
              placeholder="Your Jira API token"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Create an API token from your Atlassian account settings
            </p>
          </div>

          <div>
            <label htmlFor="jiraProjectKey" className="block text-sm font-medium text-slate-700 mb-1">
              Default Project Key *
            </label>
            <input
              type="text"
              id="jiraProjectKey"
              value={jiraProjectKey}
              onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
              placeholder="PROJ"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              The project key where issues will be created (e.g., PROJ, DEMO)
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isTestingConnection ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>

          {connectionStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">Connection successful</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="text-sm">Connection failed</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Sync Options</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-slate-900">Auto-sync threads to Jira</div>
              <p className="text-sm text-slate-600 mt-1">
                Automatically create Jira issues when new comment threads are created. You can also manually sync individual threads.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || connectionStatus !== 'success'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
