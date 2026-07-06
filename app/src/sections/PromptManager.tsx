import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertCircle,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Star,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface Prompt {
  id: string;
  name: string;
  content: string;
  description: string | null;
  is_system_prompt: number;
  is_active: number;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

interface PromptManagerProps {
  onError?: (error: string) => void;
}

export function PromptManager({ onError }: PromptManagerProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    description: '',
  });

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/prompts`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setPrompts(data.prompts);
      } else {
        setError(data.message);
        onError?.(data.message);
      }
    } catch {
      const msg = '加载 Prompt 列表失败';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.name.trim() || !formData.content.trim()) {
      setError('名称和内容不能为空');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Prompt 创建成功');
        setCreateDialogOpen(false);
        setFormData({ name: '', content: '', description: '' });
        loadPrompts();
      } else {
        setError(data.message);
      }
    } catch {
      setError('创建失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPrompt) return;
    setError(null);
    setSuccess(null);

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/prompts/${selectedPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Prompt 更新成功');
        setEditDialogOpen(false);
        loadPrompts();
      } else {
        setError(data.message);
      }
    } catch {
      setError('更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此 Prompt 吗？')) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/prompts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Prompt 已删除');
        loadPrompts();
      } else {
        setError(data.message);
      }
    } catch {
      setError('删除失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetSystem = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/prompts/${id}/set-system`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('已设置为系统 Prompt');
        loadPrompts();
      } else {
        setError(data.message);
      }
    } catch {
      setError('设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormData({ name: '', content: '', description: '' });
    setError(null);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      content: prompt.content,
      description: prompt.description || '',
    });
    setError(null);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-900/20 border-green-800 text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Prompt 管理</h2>
        <Button onClick={openCreateDialog} className="bg-gradient-to-r from-blue-500 to-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          新建 Prompt
        </Button>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Prompt 列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && prompts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              暂无 Prompt，点击上方按钮创建
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      prompt.is_system_prompt
                        ? 'bg-blue-900/20 border-blue-700'
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-white font-semibold">{prompt.name}</h3>
                          {prompt.is_system_prompt === 1 && (
                            <Badge className="bg-blue-500">
                              <Star className="w-3 h-3 mr-1" />
                              系统 Prompt
                            </Badge>
                          )}
                          {prompt.is_active === 0 && (
                            <Badge variant="secondary">已禁用</Badge>
                          )}
                        </div>
                        {prompt.description && (
                          <p className="text-slate-400 text-sm mb-2">{prompt.description}</p>
                        )}
                        <div className="text-slate-500 text-xs">
                          创建者: {prompt.created_by_username || '未知'} | 
                          更新时间: {new Date(prompt.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {prompt.is_system_prompt !== 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetSystem(prompt.id)}
                            className="border-blue-600 text-blue-400 hover:bg-blue-900/30"
                            disabled={isLoading}
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(prompt)}
                          className="text-slate-400 hover:text-white"
                          disabled={isLoading}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(prompt.id)}
                          className="text-slate-400 hover:text-red-400"
                          disabled={isLoading || prompt.is_system_prompt === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">新建 Prompt</DialogTitle>
            <DialogDescription>创建一个新的 Prompt 模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="例如：技术面试助手"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
                placeholder="简要描述这个 Prompt 的用途"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white min-h-[200px]"
                placeholder="输入 Prompt 内容..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-slate-600 text-slate-300">
              取消
            </Button>
            <Button onClick={handleCreate} disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">编辑 Prompt</DialogTitle>
            <DialogDescription>修改 Prompt 内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="bg-slate-900/50 border-slate-600 text-white min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-slate-600 text-slate-300">
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-purple-600">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
