import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  User as UserIcon,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Mic,
  Brain,
  MessageSquare,
  Target,
  CheckCircle2,
  ArrowRight,
  Play,
  Quote,
  Briefcase,
  Code,
  Lightbulb,
  Star,
} from 'lucide-react';
import type { User } from '@/types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

const features = [
  {
    icon: Mic,
    title: '实时语音识别',
    description: '捕获系统音频，实时转写面试官的问题',
    color: 'from-blue-400 to-cyan-400',
  },
  {
    icon: Brain,
    title: 'AI 智能回答',
    description: '基于大模型生成专业、精准的面试回答',
    color: 'from-purple-400 to-pink-400',
  },
  {
    icon: MessageSquare,
    title: '对话历史',
    description: '完整记录面试对话，随时回顾和复盘',
    color: 'from-green-400 to-emerald-400',
  },
  {
    icon: Target,
    title: '多岗位支持',
    description: '支持多种岗位类型，针对性优化回答策略',
    color: 'from-orange-400 to-yellow-400',
  },
];

const stats = [
  { value: '10K+', label: '用户信赖' },
  { value: '50K+', label: '面试辅助' },
  { value: '98%', label: '满意度' },
];

const useCases = [
  {
    icon: Code,
    title: '技术面试',
    scenario: '算法、系统设计、项目经验',
    example: '面试官问："请介绍一下你做过最复杂的项目"',
    solution: 'AI助手会结合你的简历，生成结构化的项目介绍，突出技术难点和解决方案',
  },
  {
    icon: Briefcase,
    title: '产品面试',
    scenario: '需求分析、用户调研、竞品分析',
    example: '面试官问："如何提升产品的日活用户？"',
    solution: 'AI助手会从用户增长、留存策略、功能优化等维度给出完整回答框架',
  },
  {
    icon: Lightbulb,
    title: '行为面试',
    scenario: '团队协作、冲突处理、职业规划',
    example: '面试官问："描述一次你解决团队冲突的经历"',
    solution: 'AI助手会使用STAR法则，帮你组织一个有说服力的故事',
  },
];

const testimonials = [
  {
    name: '张明',
    role: '前端工程师',
    company: '字节跳动',
    avatar: 'Z',
    content: '用这个工具准备了3天，成功拿到了字节跳动的offer！AI生成的回答非常专业，帮我理清了思路。',
    rating: 5,
  },
  {
    name: '李雪',
    role: '产品经理',
    company: '阿里巴巴',
    avatar: 'L',
    content: '语音识别很准确，实时转写让我能专注于听问题，AI的回答建议给了我很多启发。',
    rating: 5,
  },
  {
    name: '王浩',
    role: '后端工程师',
    company: '腾讯',
    avatar: 'W',
    content: '系统设计的回答框架特别棒，帮我在面试中展现出了架构思维，强烈推荐！',
    rating: 5,
  },
];

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password,
          rememberMe: loginForm.rememberMe,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || '登录失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (registerForm.password.length < 8) {
      setError('密码长度至少8位');
      return;
    }

    if (!/[a-zA-Z]/.test(registerForm.password)) {
      setError('密码必须包含字母');
      return;
    }

    if (!/[0-9]/.test(registerForm.password)) {
      setError('密码必须包含数字');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: registerForm.username,
          password: registerForm.password,
          email: registerForm.email || undefined,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('注册成功，请登录');
        setActiveTab('login');
        setLoginForm(prev => ({ ...prev, username: registerForm.username }));
        setRegisterForm({
          username: '',
          password: '',
          confirmPassword: '',
          email: '',
        });
      } else {
        setError(data.message || '注册失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl animate-bounce" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-6 animate-bounce shadow-lg shadow-blue-500/30">
            <Sparkles className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-5xl font-bold text-white mb-4">
            AI 面试助手
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            智能语音识别 + AI 回答，助你轻松应对面试
          </p>

          <div className="flex justify-center gap-8 mb-10">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="text-xl px-12 py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 animate-fade-in animation-delay-200"
            onClick={() => setShowAuthDialog(true)}
          >
            <Play className="w-6 h-6 mr-3" />
            立即体验
            <ArrowRight className="w-5 h-5 ml-3" />
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16 animate-fade-in animation-delay-300">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 transition-all duration-300 group hover:scale-105"
            >
              <div className={`p-4 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Use Cases */}
        <div className="mb-16 animate-fade-in animation-delay-400">
          <h2 className="text-3xl font-bold text-white text-center mb-8">使用场景</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-slate-500 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                    <useCase.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{useCase.title}</h3>
                    <p className="text-slate-400 text-sm">{useCase.scenario}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-slate-300 text-sm">
                      <span className="text-blue-400 font-medium">面试官：</span>
                      {useCase.example}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50">
                    <p className="text-slate-300 text-sm">
                      <span className="text-green-400 font-medium">AI助手：</span>
                      {useCase.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16 animate-fade-in animation-delay-500">
          <h2 className="text-3xl font-bold text-white text-center mb-8">用户评价</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-slate-500 transition-all duration-300"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <Quote className="w-6 h-6 text-blue-400 flex-shrink-0" />
                  <p className="text-slate-300 text-sm leading-relaxed">{testimonial.content}</p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-medium">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{testimonial.name}</p>
                    <p className="text-slate-400 text-sm">{testimonial.role} @ {testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Features */}
        <div className="flex flex-wrap justify-center items-center gap-6 text-slate-400 animate-fade-in animation-delay-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span>免费使用</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span>支持屏幕共享捕获系统音频</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span>多平台支持</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span>数据安全加密</span>
          </div>
        </div>
      </div>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white text-center text-xl">欢迎使用 AI 面试助手</DialogTitle>
            <DialogDescription className="text-slate-400 text-center">
              登录或注册账号以开始使用
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as 'login' | 'register');
            setError(null);
            setSuccess(null);
          }}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mt-4">
              <TabsTrigger value="login" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600">
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600">
                注册
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {error && (
                <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mb-4 bg-green-900/20 border-green-800 text-green-400">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-slate-300">用户名</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="login-username"
                        type="text"
                        placeholder="请输入用户名"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-300">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="请输入密码"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me"
                      checked={loginForm.rememberMe}
                      onCheckedChange={(checked) => setLoginForm(prev => ({ ...prev, rememberMe: checked as boolean }))}
                    />
                    <Label htmlFor="remember-me" className="text-sm text-slate-400 cursor-pointer">
                      记住我（7天内免登录）
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      <>
                        登录
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-slate-300">用户名 *</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="3-20位字母、数字或下划线"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-slate-300">邮箱（选填）</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="用于找回密码"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-slate-300">密码 *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="至少8位，包含字母和数字"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password" className="text-slate-300">确认密码 *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        id="register-confirm-password"
                        type="password"
                        placeholder="再次输入密码"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        注册中...
                      </>
                    ) : (
                      <>
                        注册
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </div>
          </Tabs>

          <div className="mt-4 text-center">
            <p className="text-slate-500 text-xs">
              默认管理员账号：<code className="text-slate-400">admin</code> / <code className="text-slate-400">Admin@123456</code>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
