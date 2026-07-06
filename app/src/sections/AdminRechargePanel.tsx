import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  duration: number;
  price: number;
  description?: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

interface RechargeRecord {
  id: string;
  plan_name?: string;
  plan_duration?: number;
  amount: number;
  status: string;
  username?: string;
  created_at: string;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

export function AdminRechargePanel() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    price: '',
    description: '',
    sort_order: '0',
    is_active: true
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/recharge/plans`);
      const data = await res.json();
      if (data.ok) {
        setPlans(data.plans);
      }
    } catch (e) {
      console.error('获取套餐失败:', e);
    }
  };

  const fetchRecords = async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/recharge/recharge-records?page=${page}&limit=20`);
      const data = await res.json();
      if (data.ok) {
        setRecords(data.records);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      }
    } catch (e) {
      console.error('获取充值记录失败:', e);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/recharge/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          duration: parseInt(formData.duration),
          price: parseInt(formData.price),
          description: formData.description,
          sort_order: parseInt(formData.sort_order)
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateDialog(false);
        resetForm();
        fetchPlans();
      } else {
        alert(data.error || '创建套餐失败');
      }
    } catch (e) {
      console.error('创建套餐失败:', e);
      alert('创建套餐失败，请重试');
    }
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/recharge/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          duration: parseInt(formData.duration),
          price: parseInt(formData.price),
          description: formData.description,
          sort_order: parseInt(formData.sort_order),
          is_active: formData.is_active
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowEditDialog(false);
        setEditingPlan(null);
        resetForm();
        fetchPlans();
      } else {
        alert(data.error || '更新套餐失败');
      }
    } catch (e) {
      console.error('更新套餐失败:', e);
      alert('更新套餐失败，请重试');
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('确定要删除这个套餐吗？')) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/recharge/plans/${planId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        fetchPlans();
      } else {
        alert(data.error || '删除套餐失败');
      }
    } catch (e) {
      console.error('删除套餐失败:', e);
      alert('删除套餐失败，请重试');
    }
  };

  const openEditDialog = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      duration: plan.duration.toString(),
      price: plan.price.toString(),
      description: plan.description || '',
      sort_order: plan.sort_order.toString(),
      is_active: plan.is_active === 1
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      duration: '',
      price: '',
      description: '',
      sort_order: '0',
      is_active: true
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
    }
    return `${minutes}分钟`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; variant: string; icon: any }> = {
      pending: { text: '待支付', variant: 'secondary', icon: Clock },
      completed: { text: '已完成', variant: 'default', icon: CheckCircle2 },
      failed: { text: '失败', variant: 'destructive', icon: XCircle },
    };
    const config = statusMap[status] || { text: status, variant: 'secondary', icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPlans(), fetchRecords()]);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">充值套餐管理</CardTitle>
            <Button
              onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建套餐
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">加载中...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-slate-400">暂无套餐</div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border-2 ${
                    plan.is_active
                      ? 'border-slate-600'
                      : 'border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                        {plan.is_active ? '启用' : '禁用'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(plan)}
                        className="text-slate-300 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(plan.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>时长：{formatDuration(plan.duration)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <DollarSign className="w-4 h-4" />
                      <span>价格：¥{plan.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-sm">排序：{plan.sort_order}</span>
                    </div>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-slate-400">{plan.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">充值记录</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="text-center py-8 text-slate-400">加载中...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-slate-400">暂无充值记录</div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(record.status)}
                        <span className="text-sm text-slate-400">{formatDate(record.created_at)}</span>
                      </div>
                      <div className="text-right">
                        {record.status === 'completed' && (
                          <div className="text-green-400 font-semibold">
                            +{formatDuration(record.plan_duration || record.amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
                      <div>用户：{record.username || '未知'}</div>
                      <div>套餐：{record.plan_name || '自定义'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => fetchRecords(currentPage - 1)}
                disabled={currentPage === 1}
                className="border-slate-600 text-slate-300"
              >
                上一页
              </Button>
              <span className="text-slate-400">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => fetchRecords(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="border-slate-600 text-slate-300"
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-white">新建充值套餐</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">套餐名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：体验套餐"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">时长（秒） *</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="例如：3600（1小时）"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">价格（元） *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="例如：9.9"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="套餐描述信息"
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-slate-300">排序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  placeholder="数字越小排序越靠前"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  创建
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showEditDialog && editingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-white">编辑充值套餐</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">套餐名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">时长（秒） *</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">价格（元） *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-slate-300">排序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active" className="text-slate-300">
                  启用套餐
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdate}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  更新
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}