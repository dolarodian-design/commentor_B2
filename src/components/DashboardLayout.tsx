import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  LayoutDashboard,
  FolderOpen,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Share2,
  Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function DashboardLayout() {
  const { signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace, loading } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentWorkspace && workspaces.length === 0) {
    navigate('/onboarding', { replace: true });
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Apps', href: '/dashboard/apps', icon: FolderOpen },
    { name: 'Shared With Me', href: '/dashboard/shared', icon: Share2 },
    { name: 'Workspace', href: '/dashboard/workspace', icon: Building2 },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-slate-900">CommentSync</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {currentWorkspace && (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">{currentWorkspace.name}</p>
                      <p className="text-xs text-slate-500">Workspace</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {showWorkspaceMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowWorkspaceMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                        {workspaces.map((workspace) => (
                          <button
                            key={workspace.id}
                            onClick={() => {
                              setCurrentWorkspace(workspace);
                              setShowWorkspaceMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                              workspace.id === currentWorkspace.id
                                ? 'text-blue-600 font-medium'
                                : 'text-slate-700'
                            }`}
                          >
                            {workspace.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>

              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              >
                {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {showMobileMenu && (
          <div className="md:hidden border-t border-slate-200">
            <div className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
