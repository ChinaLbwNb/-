import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Shield,
  History,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Key,
  BarChart3,
  FileText,
  LogOut,
  Menu,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import type { User, LoginLog } from '@/types';
import { PromptManager } from './PromptManager';
import { AdminRechargePanel } from './AdminRechargePanel';

interface AdminPanelProps {
  user: User;
  onLogout: () => void;
  onBack: () => void;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  adminCount: number;
  todayLogins: number;
}

interface UserWithDetails extends User {
  login_fail_count?: number;
  locked_until?: string;
}

type AdminTab = 'dashboard' | 'users' | 'logs' | 'prompts' | 'recharge';

export function AdminPanel({ user, onLogout, onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User management state
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);

  const [editForm, setEditForm] = useState({ email: '', role: 'user', status: 'active' });
  const [createForm, setCreateForm] = useState({ username: '', password: '', email: '', role: 'user' });
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/auth/admin/users?page=${currentPage}&search=${encodeURIComponent(searchTerm)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      setError('加载用户列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/login-logs`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs);
      }
    } catch {
      setError('加载日志失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/stats`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'dashboard') {
      loadUsers();
      loadStats();
    }
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, loadUsers, loadLogs, loadStats]);

  const handleCreateUser = async () => {
    setError(null);
    if (!createForm.username || !createForm.password) {
      setError('用户名和密码不能为空');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.ok) {
        setCreateDialogOpen(false);
        setCreateForm({ username: '', password: '', email: '', role: 'user' });
        loadUsers();
      } else {
        setError(data.message);
      }
    } catch {
      setError('创建用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setError(null);

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.ok) {
        setEditDialogOpen(false);
        loadUsers();
      } else {
        setError(data.message);
      }
    } catch {
      setError('更新用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可恢复。')) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        loadUsers();
      } else {
        setError(data.message);
      }
    } catch {
      setError('删除用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users/${userId}/lock`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        loadUsers();
      } else {
        setError(data.message);
      }
    } catch {
      setError('锁定用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users/${userId}/unlock`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        loadUsers();
      } else {
        setError(data.message);
      }
    } catch {
      setError('解锁用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    setError(null);

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setResetPasswordDialogOpen(false);
        setNewPassword('');
      } else {
        setError(data.message);
      }
    } catch {
      setError('重置密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (u: UserWithDetails) => {
    setSelectedUser(u);
    setEditForm({
      email: u.email || '',
      role: u.role,
      status: u.status,
    });
    setEditDialogOpen(true);
  };

  const openResetPasswordDialog = (u: UserWithDetails) => {
    setSelectedUser(u);
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const navItems = [
    { id: 'dashboard' as AdminTab, label: '概览', icon: BarChart3 },
    { id: 'users' as AdminTab, label: '用户管理', icon: Users },
    { id: 'logs' as AdminTab, label: '登录日志', icon: History },
    { id: 'prompts' as AdminTab, label: 'Prompt 管理', icon: FileText },
    { id: 'recharge' as AdminTab, label: '充值管理', icon: CreditCard },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">管理概览</h2>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-400 text-sm">总用户</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{stats.totalUsers}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-400" />
                      <span className="text-slate-400 text-sm">活跃用户</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{stats.activeUsers}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-red-400" />
                      <span className="text-slate-400 text-sm">锁定用户</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{stats.lockedUsers}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-400" />
                      <span className="text-slate-400 text-sm">管理员</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{stats.adminCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-yellow-400" />
                      <span className="text-slate-400 text-sm">今日登录</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-2">{stats.todayLogins}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        );

      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">用户管理</h2>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-blue-500 to-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                添加用户
              </Button>
            </div>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">用户列表</CardTitle>
                    <CardDescription>管理系统用户</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="搜索用户..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 w-64 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium">
                                {u.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{u.username}</span>
                                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                                  {u.role === 'admin' ? '管理员' : '用户'}
                                </Badge>
                                <Badge
                                  variant={u.status === 'active' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {u.status === 'active' ? '正常' : u.status === 'locked' ? '锁定' : '注销'}
                                </Badge>
                              </div>
                              <p className="text-slate-500 text-sm">{u.email || '未绑定邮箱'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(u)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetPasswordDialog(u)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Key className="w-4 h-4" />
                            </Button>
                            {u.status === 'active' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLockUser(u.id)}
                                className="text-slate-400 hover:text-red-400"
                                disabled={u.role === 'admin'}
                              >
                                <Lock className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlockUser(u.id)}
                                className="text-slate-400 hover:text-green-400"
                              >
                                <Unlock className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-slate-400 hover:text-red-400"
                              disabled={u.role === 'admin'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="border-slate-600 text-slate-300"
                    >
                      上一页
                    </Button>
                    <span className="text-slate-400 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="border-slate-600 text-slate-300"
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'logs':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">登录日志</h2>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">登录记录</CardTitle>
                <CardDescription>查看所有用户的登录记录</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div>
                              <p className="text-white text-sm">{log.username || '未知用户'}</p>
                              <p className="text-slate-500 text-xs">{log.ip}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={log.success ? 'default' : 'destructive'} className="text-xs">
                              {log.success ? '成功' : '失败'}
                            </Badge>
                            <p className="text-slate-500 text-xs mt-1">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'prompts':
        return <PromptManager onError={setError} />;

      case 'recharge':
        return <AdminRechargePanel />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900/80 border-r border-slate-700 transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold">管理后台</h1>
                <p className="text-slate-400 text-xs">{user.username}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <Button
            variant="ghost"
            className="w-full flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
            {sidebarOpen && <span>返回应用</span>}
          </Button>
          <Button
            variant="ghost"
            className="w-full flex items-center gap-3 text-slate-400 hover:text-red-400 hover:bg-red-900/20"
            onClick={onLogout}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>退出登录</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {error && (
          <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderContent()}
      </div>

      {/* Dialogs */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">添加用户</DialogTitle>
            <DialogDescription>创建新用户账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">用户名 *</Label>
              <Input
                value={createForm.username}
                onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="3-20位字母、数字或下划线"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">密码 *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="至少8位，包含字母和数字"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">邮箱</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">角色</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm(prev => ({ ...prev, role: v }))}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-slate-600 text-slate-300">
              取消
            </Button>
            <Button onClick={handleCreateUser} disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">编辑用户</DialogTitle>
            <DialogDescription>修改用户信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">邮箱</Label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">角色</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm(prev => ({ ...prev, role: v }))}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">状态</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="locked">锁定</SelectItem>
                  <SelectItem value="deleted">注销</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-slate-600 text-slate-300">
              取消
            </Button>
            <Button onClick={handleUpdateUser} disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">重置密码</DialogTitle>
            <DialogDescription>
              为用户 {selectedUser?.username} 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="至少8位，包含字母和数字"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)} className="border-slate-600 text-slate-300">
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
