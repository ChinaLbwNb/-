import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CreditCard, CheckCircle2, History } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  duration: number;
  price: number;
  description?: string;
}

interface RechargeRecord {
  id: string;
  plan_name?: string;
  plan_duration?: number;
  amount: number;
  status: string;
  created_at: string;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

export function RechargeStep({ onBack }: { onBack: () => void }) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recharge/plans`);
      const data = await res.json();
      if (data.ok) {
        setPlans(data.plans);
      }
    } catch (e) {
      console.error('获取套餐失败:', e);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recharge/balance`);
      const data = await res.json();
      if (data.ok) {
        setBalance(data.balance);
      }
    } catch (e) {
      console.error('获取余额失败:', e);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/recharge/records`);
      const data = await res.json();
      if (data.ok) {
        setRecords(data.records);
      }
    } catch (e) {
      console.error('获取充值记录失败:', e);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;

    try {
      const res = await fetch(`${API_BASE}/api/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan_id: selectedPlan.id,
          payment_method: 'alipay'
        }),
      });
      const data = await res.json();
      if (data.ok && data.payment_url) {
        setSelectedPlan(null);
        window.open(data.payment_url, '_blank');
      } else {
        alert(data.error || '创建支付订单失败');
      }
    } catch (e) {
      console.error('创建支付订单失败:', e);
      alert('创建支付订单失败，请重试');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPlans(), fetchBalance(), fetchRecords()]);
      setLoading(false);
    };
    loadData();
  }, []);

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
    const statusMap: Record<string, { text: string; variant: string }> = {
      pending: { text: '待支付', variant: 'secondary' },
      completed: { text: '已完成', variant: 'default' },
      failed: { text: '失败', variant: 'destructive' },
    };
    const config = statusMap[status] || { text: status, variant: 'secondary' };
    return <Badge variant={config.variant as any}>{config.text}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="text-slate-300 hover:text-white">
            ← 返回
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard className="w-5 h-5" />
              <span className="text-sm">余额:</span>
              <span className="text-lg font-semibold text-white">{formatDuration(balance)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">选择充值套餐</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-slate-400">加载中...</div>
                ) : plans.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">暂无可用套餐</div>
                ) : (
                  <div className="space-y-3">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedPlan?.id === plan.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-blue-400'
                        }`}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                          <span className="text-2xl font-bold text-blue-400">¥{plan.price}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(plan.duration)}</span>
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

            {selectedPlan && (
              <Card className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{selectedPlan.name}</h3>
                        <p className="text-slate-400">充值时长：{formatDuration(selectedPlan.duration)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-white">¥{selectedPlan.price}</div>
                      </div>
                    </div>
                    <Button
                      onClick={handlePayment}
                      disabled={!selectedPlan}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                      size="lg"
                    >
                      {selectedPlan ? '立即支付' : '请选择套餐'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                充值记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
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
                              <div className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-semibold">+{formatDuration(record.plan_duration || record.amount)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {record.plan_name && (
                          <div className="text-sm text-slate-400">
                            套餐：{record.plan_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}