import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  History,
  Shield,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import type { User as UserType, LoginLog } from '@/types';

interface UserSettingsProps {
  user: UserType;
  onUserUpdate: (user: UserType) => void;
  onLogout: () => void;
  onBack: () => void;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

export function UserSettings({ user, onUserUpdate, onLogout, onBack }: UserSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [emailForm, setEmailForm] = useState({
    email: user.email || '',
  });

  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('密码长度至少8位');
      return;
    }

    if (!/[a-zA-Z]/.test(passwordForm.newPassword)) {
      setError('密码必须包含字母');
      return;
    }

    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setError('密码必须包含数字');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('密码修改成功');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(data.message || '修改失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/update-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailForm.email }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('邮箱更新成功');
        onUserUpdate({ ...user, email: emailForm.email });
      } else {
        setError(data.message || '更新失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLoginLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login-logs`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setLoginLogs(data.logs);
      }
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.username}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? '管理员' : '普通用户'}
                </Badge>
                <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                  {user.status === 'active' ? '正常' : user.status === 'locked' ? '已锁定' : '已注销'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onBack} className="border-slate-600 text-slate-300">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <Button variant="outline" onClick={onLogout} className="border-slate-600 text-slate-300">
              退出登录
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-900/20 border-green-800 text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="security" className="space-y-4">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="security" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600">
              <Shield className="w-4 h-4 mr-2" />
              安全设置
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600" onClick={loadLoginLogs}>
              <History className="w-4 h-4 mr-2" />
              登录日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    修改密码
                  </CardTitle>
                  <CardDescription>定期修改密码可以提高账号安全性</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="old-password" className="text-slate-300">当前密码</Label>
                      <Input
                        id="old-password"
                        type="password"
                        value={passwordForm.oldPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                        className="bg-slate-900/50 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-slate-300">新密码</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="至少8位，包含字母和数字"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="bg-slate-900/50 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-slate-300">确认新密码</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="bg-slate-900/50 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-500 to-purple-600">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      修改密码
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    绑定邮箱
                  </CardTitle>
                  <CardDescription>绑定邮箱可用于找回密码</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateEmail} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-300">邮箱地址</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="请输入邮箱地址"
                        value={emailForm.email}
                        onChange={(e) => setEmailForm({ email: e.target.value })}
                        className="bg-slate-900/50 border-slate-600 text-white"
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-500 to-purple-600">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      更新邮箱
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">登录日志</CardTitle>
                <CardDescription>查看最近的登录记录</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : loginLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无登录记录
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {loginLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div>
                              <p className="text-white text-sm">{log.ip}</p>
                              <p className="text-slate-500 text-xs">{log.user_agent.slice(0, 50)}...</p>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
