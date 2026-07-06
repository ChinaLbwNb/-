import { useState, useEffect, useCallback } from 'react';
import { useInterviewStore } from '@/hooks/useInterviewStore';
import { WelcomeStep } from '@/sections/WelcomeStep';
import { UploadStep } from '@/sections/UploadStep';
import { AudioSetupStep } from '@/sections/AudioSetupStep';
import { InterviewStep } from '@/sections/InterviewStep';
import { EndStep } from '@/sections/EndStep';
import { LoginPage } from '@/sections/LoginPage';
import { UserSettings } from '@/sections/UserSettings';
import { AdminPanel } from '@/sections/AdminPanel';
import { RechargeStep } from '@/sections/RechargeStep';
import { AdminRechargePanel } from '@/sections/AdminRechargePanel';
import { Loader2, Settings, Shield, LogOut, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { User } from '@/types';
import './App.css';

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

type AppView = 'interview' | 'settings' | 'admin' | 'recharge' | 'admin-recharge';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<AppView>('interview');

  const {
    currentStep,
    resume,
    projectDocs,
    selectedJob,
    audioInputDevice,
    audioOutputDevice,
    isAudioTested,
    interviewHistory,
    startTime,
    endTime,
    goToStep,
    addResume,
    removeResume,
    addProjectDoc,
    removeProjectDoc,
    selectJob,
    setAudioDevices,
    markAudioTested,
    addInterviewMessage,
    updateMessage,
    resetInterview,
  } = useInterviewStore();

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setUser(null);
    setView('interview');
  }, []);

  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
  }, []);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (view === 'settings') {
    return (
      <UserSettings
        user={user}
        onUserUpdate={handleUserUpdate}
        onLogout={handleLogout}
        onBack={() => setView('interview')}
      />
    );
  }

  if (view === 'recharge') {
    return <RechargeStep onBack={() => setView('interview')} />;
  }

  if (view === 'admin-recharge' && user.role === 'admin') {
    return <AdminRechargePanel />;
  }

  if (view === 'admin' && user.role === 'admin') {
    return <AdminPanel user={user} onLogout={handleLogout} onBack={() => setView('interview')} />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onStart={() => goToStep('upload')} />;

      case 'upload':
        return (
          <UploadStep
            resume={resume}
            projectDocs={projectDocs}
            selectedJob={selectedJob}
            onAddResume={addResume}
            onRemoveResume={removeResume}
            onAddProjectDoc={addProjectDoc}
            onRemoveProjectDoc={removeProjectDoc}
            onSelectJob={selectJob}
            onNext={() => goToStep('audio-setup')}
            onBack={() => goToStep('welcome')}
          />
        );

      case 'audio-setup':
        return (
          <AudioSetupStep
            audioInputDevice={audioInputDevice}
            audioOutputDevice={audioOutputDevice}
            isAudioTested={isAudioTested}
            onSetAudioDevices={setAudioDevices}
            onMarkAudioTested={markAudioTested}
            onNext={() => goToStep('interview')}
            onBack={() => goToStep('upload')}
          />
        );

      case 'interview':
        return (
          <InterviewStep
            selectedJob={selectedJob}
            interviewHistory={interviewHistory}
            onAddMessage={addInterviewMessage}
            onUpdateMessage={updateMessage}
            onEnd={() => goToStep('end')}
          />
        );

      case 'end':
        return (
          <EndStep
            interviewHistory={interviewHistory}
            selectedJob={selectedJob}
            startTime={startTime}
            endTime={endTime}
            onRestart={resetInterview}
          />
        );

      default:
        return <WelcomeStep onStart={() => goToStep('upload')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="fixed top-4 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="border-slate-600 text-slate-300 bg-slate-800/80 backdrop-blur-sm">
              <span className="mr-2">{user.username}</span>
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
            <DropdownMenuItem onClick={() => setView('recharge')} className="text-slate-300 focus:bg-slate-700">
              <CreditCard className="w-4 h-4 mr-2" />
              充值中心
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView('settings')} className="text-slate-300 focus:bg-slate-700">
              <Settings className="w-4 h-4 mr-2" />
              个人设置
            </DropdownMenuItem>
            {user.role === 'admin' && (
              <DropdownMenuItem onClick={() => setView('admin')} className="text-slate-300 focus:bg-slate-700">
                <Shield className="w-4 h-4 mr-2" />
                管理员后台
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:bg-slate-700">
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {renderStep()}
    </div>
  );
}

export default App;
