import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Mic, FileText, Brain } from 'lucide-react';

interface WelcomeStepProps {
  onStart: () => void;
}

export function WelcomeStep({ onStart }: WelcomeStepProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-lg shadow-blue-500/25">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AI 面试助手
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            智能辅助面试，实时语音识别，AI生成专业回答，助你轻松应对每一场面试
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">简历智能分析</h3>
              <p className="text-slate-400 text-sm">
                上传简历和项目文档，AI自动提取关键信息
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">实时语音识别</h3>
              <p className="text-slate-400 text-sm">
                精准识别面试官问题，无需手动输入
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Brain className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">AI智能回答</h3>
              <p className="text-slate-400 text-sm">
                基于简历内容生成个性化专业回答
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-12 py-6 text-lg rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
          >
            开始面试准备
          </Button>
          <p className="text-slate-500 text-sm mt-4">
            支持前后端分离架构，数据安全本地处理
          </p>
        </div>
      </div>
    </div>
  );
}
