import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  RotateCcw,
  Download,
  Star,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react';
import type { InterviewMessage, JobPosition } from '@/types';

interface EndStepProps {
  interviewHistory: InterviewMessage[];
  selectedJob: JobPosition | null;
  startTime: Date | null;
  endTime: Date | null;
  onRestart: () => void;
}

export function EndStep({
  interviewHistory,
  selectedJob,
  startTime,
  endTime,
  onRestart,
}: EndStepProps) {
  const questionCount = interviewHistory.filter(m => m.type === 'question').length;
  const answerCount = interviewHistory.filter(m => m.type === 'answer' && !m.isGenerating).length;
  
  const duration = startTime && endTime 
    ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  // Mock analysis data
  const analysis = {
    overall: 85,
    communication: 88,
    technical: 82,
    logic: 86,
    attitude: 90,
    strengths: [
      '回答结构清晰，逻辑性强',
      '技术基础扎实，项目经验丰富',
      '表达流畅，沟通能力强',
    ],
    improvements: [
      '可以更多地结合具体数据',
      '部分回答可以更加简洁',
      '建议增加对行业趋势的了解',
    ],
  };

  const exportReport = () => {
    const report = {
      job: selectedJob,
      duration: formatDuration(duration),
      questions: questionCount,
      answers: answerCount,
      history: interviewHistory.map(m => ({
        type: m.type,
        content: m.content,
        time: m.timestamp.toISOString(),
      })),
      analysis,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `面试报告_${selectedJob?.title}_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-6 shadow-lg shadow-green-500/25">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">面试完成</h1>
          <p className="text-slate-400">感谢使用 AI 面试助手，以下是本次面试的总结</p>
        </div>

        {/* Job Info */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">面试岗位</p>
                <h2 className="text-2xl font-bold text-white">{selectedJob?.title}</h2>
                <p className="text-slate-400">{selectedJob?.department}</p>
              </div>
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                已完成
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">面试时长</p>
              <p className="text-white text-xl font-bold">{formatDuration(duration)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">问题数量</p>
              <p className="text-white text-xl font-bold">{questionCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">已回答</p>
              <p className="text-white text-xl font-bold">{answerCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">综合评分</p>
              <p className="text-white text-xl font-bold">{analysis.overall}</p>
            </CardContent>
          </Card>
        </div>

        {/* Analysis */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              能力分析
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 text-sm">沟通表达</span>
                  <span className="text-white text-sm font-medium">{analysis.communication}%</span>
                </div>
                <Progress value={analysis.communication} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 text-sm">技术能力</span>
                  <span className="text-white text-sm font-medium">{analysis.technical}%</span>
                </div>
                <Progress value={analysis.technical} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 text-sm">逻辑思维</span>
                  <span className="text-white text-sm font-medium">{analysis.logic}%</span>
                </div>
                <Progress value={analysis.logic} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 text-sm">求职态度</span>
                  <span className="text-white text-sm font-medium">{analysis.attitude}%</span>
                </div>
                <Progress value={analysis.attitude} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-green-400" />
                优势亮点
              </h3>
              <ul className="space-y-3">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                改进建议
              </h3>
              <ul className="space-y-3">
                {analysis.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full border border-orange-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <span className="text-orange-400 text-xs">!</span>
                    </div>
                    <span className="text-slate-300 text-sm">{improvement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Interview History Preview */}
        {interviewHistory.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4">面试问答回顾</h3>
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {interviewHistory.filter(m => m.type === 'question').map((question, index) => {
                  const answer = interviewHistory.find(
                    m => m.type === 'answer' && m.timestamp > question.timestamp
                  );
                  return (
                    <div key={question.id} className="border-b border-slate-700 pb-4 last:border-0">
                      <p className="text-slate-400 text-sm mb-1">Q{index + 1}</p>
                      <p className="text-white font-medium mb-2">{question.content}</p>
                      {answer && (
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <p className="text-blue-400 text-xs mb-1">AI 回答</p>
                          <p className="text-slate-300 text-sm line-clamp-2">{answer.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onRestart}
            variant="outline"
            size="lg"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            开始新面试
          </Button>

          <Button
            onClick={exportReport}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>
    </div>
  );
}
