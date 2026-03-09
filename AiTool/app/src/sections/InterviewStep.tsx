import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  MicOff,
  Square,
  Copy,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Send,
} from 'lucide-react';
import type { InterviewMessage, JobPosition } from '@/types';

interface InterviewStepProps {
  selectedJob: JobPosition | null;
  interviewHistory: InterviewMessage[];
  onAddMessage: (message: InterviewMessage) => void;
  onUpdateMessage: (id: string, updates: Partial<InterviewMessage>) => void;
  onEnd: () => void;
}

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface;
    webkitSpeechRecognition: new () => SpeechRecognitionInterface;
  }
}

// Mock AI response generator
const generateAIResponse = async (_question: string, jobTitle: string): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const responses: Record<string, string[]> = {
    '前端开发工程师': [
      '在我的前端开发经验中，我深入研究了React的虚拟DOM机制和性能优化策略。我曾主导过一个大型电商平台的重构项目，通过组件懒加载、代码分割和缓存策略，将首屏加载时间减少了60%。',
      '关于前端工程化，我熟悉Webpack、Vite等构建工具的配置和优化。我建立了完整的CI/CD流程，包括自动化测试、代码质量检查和性能监控，显著提升了团队的开发效率。',
      '在性能优化方面，我关注Core Web Vitals指标，通过Lighthouse进行性能分析，实施了图片懒加载、资源预加载、服务端渲染等优化手段。',
    ],
    '后端开发工程师': [
      '我在后端开发中有丰富的微服务架构经验。设计并实现了一个高并发的订单处理系统，采用分布式锁、消息队列和缓存策略，支撑了日均百万级的订单量。',
      '关于数据库优化，我擅长SQL调优、索引设计和分库分表策略。我曾将一个慢查询从10秒优化到100毫秒，显著提升了系统响应速度。',
      '在系统架构方面，我熟悉分布式系统的设计原则，包括CAP理论、一致性算法和容错机制。我设计的系统实现了99.99%的可用性。',
    ],
    '产品经理': [
      '作为产品经理，我注重数据驱动的产品决策。通过用户行为分析和A/B测试，我主导的产品迭代使核心转化率提升了35%。',
      '我擅长跨部门协作，建立了产品、设计、开发之间的高效沟通机制。我推动的敏捷开发流程使产品交付周期缩短了40%。',
      '在需求管理方面，我使用OKR和KPI来量化产品目标，确保团队聚焦于高价值功能的交付。',
    ],
    'UI/UX设计师': [
      '我在设计系统中有着丰富的实践经验。我主导构建的设计系统包含200+组件，覆盖了整个产品线，确保了设计一致性和开发效率。',
      '关于用户体验，我擅长用户研究和可用性测试。通过深度访谈和数据分析，我优化了核心用户流程，将任务完成率提升了50%。',
      '我熟悉Figma的高级功能，包括自动布局、变体和原型交互。我建立的设计流程使设计交付效率提升了30%。',
    ],
    '数据分析师': [
      '我在数据分析领域有深厚的统计学基础。熟练使用Python、SQL进行数据处理和建模，曾构建的用户流失预测模型准确率达到85%。',
      '关于数据可视化，我擅长使用Tableau、PowerBI等工具创建交互式报表。我设计的管理层驾驶舱获得了高管的一致好评。',
      '我建立了完整的数据指标体系，从业务目标拆解到核心指标监控，为产品决策提供了有力的数据支撑。',
    ],
    '算法工程师': [
      '我在机器学习领域有扎实的理论基础和项目经验。主导开发的推荐系统采用深度学习模型，使点击率提升了25%。',
      '关于模型优化，我熟悉模型压缩、量化和蒸馏技术。我将一个NLP模型从2GB压缩到200MB，推理速度提升了10倍。',
      '我持续关注学术前沿，将Transformer、BERT等最新技术应用到实际业务中，取得了显著的效果提升。',
    ],
  };

  const defaultResponses = [
    '感谢您的问题。基于我的专业背景和经验，我认为这是一个非常有价值的话题。',
    '在我的职业生涯中，我积累了丰富的相关经验，能够很好地应对这个挑战。',
    '我对这个领域有深入的研究和实践，相信能为团队带来价值。',
  ];

  const jobResponses = responses[jobTitle] || defaultResponses;
  return jobResponses[Math.floor(Math.random() * jobResponses.length)];
};

export function InterviewStep({
  selectedJob,
  interviewHistory,
  onAddMessage,
  onUpdateMessage,
  onEnd,
}: InterviewStepProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [manualQuestion, setManualQuestion] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interviewHistory]);

  // Duration timer
  useEffect(() => {
    durationIntervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
        setInterimTranscript(interim);
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current?.start();
        }
      };
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      // Process final transcript
      const finalText = transcript + interimTranscript;
      if (finalText.trim()) {
        handleQuestion(finalText.trim());
        setTranscript('');
        setInterimTranscript('');
      }
    } else {
      setTranscript('');
      setInterimTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, transcript, interimTranscript]);

  const handleQuestion = useCallback(async (question: string) => {
    // Add question
    const questionMsg: InterviewMessage = {
      id: Date.now().toString(),
      type: 'question',
      content: question,
      timestamp: new Date(),
    };
    onAddMessage(questionMsg);

    // Generate AI answer
    setIsGenerating(true);
    const answerId = (Date.now() + 1).toString();
    
    const answerMsg: InterviewMessage = {
      id: answerId,
      type: 'answer',
      content: '',
      timestamp: new Date(),
      isGenerating: true,
    };
    onAddMessage(answerMsg);

    try {
      const response = await generateAIResponse(question, selectedJob?.title || '');
      onUpdateMessage(answerId, {
        content: response,
        isGenerating: false,
      });
    } catch (error) {
      onUpdateMessage(answerId, {
        content: '抱歉，生成回答时出现错误，请重试。',
        isGenerating: false,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedJob, onAddMessage, onUpdateMessage]);

  const handleManualSubmit = useCallback(() => {
    if (manualQuestion.trim()) {
      handleQuestion(manualQuestion.trim());
      setManualQuestion('');
    }
  }, [manualQuestion, handleQuestion]);

  const copyToClipboard = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold">AI 面试助手</h1>
              <p className="text-slate-400 text-sm">{selectedJob?.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatDuration(duration)}</span>
            </div>
            <Button
              onClick={onEnd}
              variant="destructive"
              size="sm"
            >
              <Square className="w-4 h-4 mr-1" />
              结束面试
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 bg-slate-800/50 border-slate-700 flex flex-col">
            <CardContent className="flex-1 p-0 flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {interviewHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">面试即将开始</p>
                    <p className="text-sm">点击麦克风按钮或手动输入问题</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interviewHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.type === 'question' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-4 ${
                            msg.type === 'question'
                              ? 'bg-slate-700 text-white'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                msg.type === 'question'
                                  ? 'bg-slate-600 text-slate-200'
                                  : 'bg-white/20 text-white'
                              }`}
                            >
                              {msg.type === 'question' ? '面试官' : 'AI 回答'}
                            </Badge>
                            <span className="text-xs opacity-70">
                              {msg.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {msg.isGenerating ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100" />
                              <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200" />
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          )}

                          {msg.type === 'answer' && !msg.isGenerating && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                              className="mt-2 text-white/70 hover:text-white hover:bg-white/10"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  已复制
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 mr-1" />
                                  复制
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <Textarea
                    value={manualQuestion}
                    onChange={(e) => setManualQuestion(e.target.value)}
                    placeholder="输入面试官的问题..."
                    className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleManualSubmit();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleManualSubmit}
                      disabled={!manualQuestion.trim() || isGenerating}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={toggleListening}
                      variant={isListening ? 'destructive' : 'default'}
                      className={isListening ? '' : 'bg-gradient-to-r from-blue-500 to-purple-600'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Voice Status */}
                {isListening && (
                  <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-blue-400 text-sm font-medium">正在聆听...</span>
                    </div>
                    <p className="text-white text-sm">
                      {transcript}
                      <span className="text-slate-400">{interimTranscript}</span>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-80 space-y-4">
          {/* Quick Actions */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold mb-3">快捷操作</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => setManualQuestion('请介绍一下你自己')}
                >
                  自我介绍
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => setManualQuestion('你最大的优点和缺点是什么？')}
                >
                  优缺点
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => setManualQuestion('你为什么选择我们公司？')}
                >
                  求职动机
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => setManualQuestion('你对薪资有什么期望？')}
                >
                  薪资期望
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Interview Stats */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold mb-3">面试统计</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">问题数量</span>
                  <span className="text-white font-medium">
                    {interviewHistory.filter(m => m.type === 'question').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">已回答</span>
                  <span className="text-white font-medium">
                    {interviewHistory.filter(m => m.type === 'answer' && !m.isGenerating).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">进行中</span>
                  <span className="text-blue-400 font-medium">
                    {interviewHistory.filter(m => m.isGenerating).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold mb-3">面试技巧</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>保持语速适中，表达清晰</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>结合具体案例回答问题</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>展现对岗位的热情和了解</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>适当提问，展现主动性</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
