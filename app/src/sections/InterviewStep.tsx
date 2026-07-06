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
  MonitorUp,
  Bug,
  CreditCard,
} from 'lucide-react';
import type { InterviewMessage, JobPosition } from '@/types';

interface InterviewStepProps {
  selectedJob: JobPosition | null;
  interviewHistory: InterviewMessage[];
  onAddMessage: (message: InterviewMessage) => void;
  onUpdateMessage: (id: string, updates: Partial<InterviewMessage>) => void;
  onEnd: () => void;
}

type AsrServerMessage =
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: string; text?: string };

// 将 Float32 PCM 下采样到 16k 并转为 Int16
function downsampleTo16k(buffer: Float32Array, inputSampleRate: number): Int16Array {
  const outputSampleRate = 16000;
  if (outputSampleRate === inputSampleRate) {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s * 0x7fff;
    }
    return result;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    const value = count > 0 ? accum / count : 0;
    const s = Math.max(-1, Math.min(1, value));
    result[offsetResult] = s * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

// 讯飞语音听写（流式版）要求：PCM 16k 16bit 单声道，按「流」发送
// 文档：建议每次发送间隔 40ms，每帧 1280 字节（40ms × 16k × 2byte）
const XFYUN_FRAME_BYTES = 1280;
const XFYUN_FRAME_INTERVAL_MS = 40;

// 后端 API 地址：
// - 支持通过 VITE_API_BASE 指定（可为绝对/相对 URL）
// - 开发：默认走本机 8000
// - 生产（花生壳 https 等）：默认同源（当前域名）
const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

function getWsUrl(wsPath: string): string {
  const u = new URL(API_BASE, window.location.origin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
  u.search = '';
  u.hash = '';
  return u.toString();
}

type AnswerResult = { answer: string; debug?: Record<string, unknown> };

type PromptResult = { system_prompt: string; enable_debug?: boolean };

async function fetchSystemPrompt(): Promise<PromptResult> {
  const res = await fetch(`${API_BASE}/api/prompt`);
  const data = (await res.json()) as { system_prompt?: string; enable_debug?: boolean };
  return { system_prompt: data.system_prompt ?? '', enable_debug: data.enable_debug };
}

async function fetchAIAnswer(
  question: string,
  history: InterviewMessage[],
  promptOverride?: string,
): Promise<AnswerResult> {
  const historyForApi = history.slice(-10).map((m) => ({
    type: m.type,
    content: m.content,
  }));
  const res = await fetch(`${API_BASE}/api/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history: historyForApi,
      docs: [],
      session_id: '',
      ...(promptOverride && promptOverride.trim() ? { prompt_override: promptOverride.trim() } : {}),
    }),
  });
  let data: { answer?: string; error?: string; debug?: Record<string, unknown> };
  try {
    data = await res.json();
  } catch {
    throw new Error(`请求失败 ${res.status}，请确认后端已启动 (${API_BASE})`);
  }
  if (!res.ok) {
    const err = new Error(data.error || `请求失败: ${res.status}`) as Error & { debug?: Record<string, unknown> };
    err.debug = data.debug;
    throw err;
  }
  return { answer: data.answer ?? '', debug: data.debug };
}

function formatDebugBlock(debug: Record<string, unknown> | undefined): string {
  if (!debug || Object.keys(debug).length === 0) return '';
  const lines = ['--- 调试信息 ---'];
  for (const [k, v] of Object.entries(debug)) {
    lines.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  return lines.join('\n');
}

export function InterviewStep({
  selectedJob,
  interviewHistory,
  onAddMessage,
  onUpdateMessage,
  onEnd,
}: InterviewStepProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [manualQuestion, setManualQuestion] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [interviewSessionId, setInterviewSessionId] = useState<string | null>(null);

  // 调试麦克风（临时）：麦克风音源 + 音量条 + 讯飞 ASR 识别结果
  const [debugMicOn, setDebugMicOn] = useState(false);
  const [debugTranscript, setDebugTranscript] = useState('');
  const [debugVolume, setDebugVolume] = useState(0);
  const [debugConnectionStatus, setDebugConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const debugWsRef = useRef<WebSocket | null>(null);
  const debugAudioContextRef = useRef<AudioContext | null>(null);
  const debugStreamRef = useRef<MediaStream | null>(null);
  const debugWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const debugAnalyserRef = useRef<AnalyserNode | null>(null);
  const debugPcmBufferRef = useRef<Uint8Array>(new Uint8Array(0));
  const debugLastSendTimeRef = useRef<number>(0);
  const debugVolumeAnimationRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  /** 讯飞要求每帧 1280 字节流式发送；缓冲不足时累积，满一帧再发 */
  const pcmBufferRef = useRef<Uint8Array>(new Uint8Array(0));
  /** 上一帧发送时间，用于控制发送间隔 ≥40ms，避免引擎识别异常 */
  const lastSendTimeRef = useRef<number>(0);
  /** ASR 识别到完整句子后自动发给大模型，用 ref 保证回调里拿到最新 handleQuestion */
  const handleQuestionRef = useRef<(q: string) => void>(() => {});
  /** 静默检测：用于判断问题结束并发送给大模型 */
  const SILENCE_THRESHOLD_MS = 1000;
  const lastAsrTextRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionSentRef = useRef(false);

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

  // Balance update timer (every 10 seconds)
  useEffect(() => {
    if (!interviewSessionId) return;
    
    const balanceInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/recharge/balance`);
        const data = await res.json();
        if (data.ok) {
          setUserBalance(data.balance);
        }
      } catch (e) {
        console.error('获取余额失败:', e);
      }
    }, 10000);

    return () => {
      clearInterval(balanceInterval);
    };
  }, [interviewSessionId]);

  const cleanupAudio = useCallback(() => {
    workletNodeRef.current?.disconnect();
    audioContextRef.current?.close();
    captureStreamRef.current?.getTracks().forEach(track => track.stop());

    workletNodeRef.current = null;
    audioContextRef.current = null;
    captureStreamRef.current = null;
  }, []);

  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
      cleanupWebSocket();
    };
  }, [cleanupAudio, cleanupWebSocket]);

  useEffect(() => {
    let mounted = true;
    fetchSystemPrompt()
      .then((r) => {
        if (mounted) setSystemPrompt(r.system_prompt || '');
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stopListening = useCallback(async () => {
    if (!isListening) return;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (interviewSessionId) {
      try {
        const res = await fetch(`${API_BASE}/api/interview/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: interviewSessionId }),
        });
        const data = await res.json();
        if (data.ok) {
          setUserBalance(data.balance);
          setInterviewSessionId(null);
        } else {
          console.error('结束面试会话失败:', data.error);
        }
      } catch (e) {
        console.error('结束面试会话失败:', e);
      }
    }
    
    setTranscript('');
    setManualQuestion('');
    if (pcmBufferRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const remainder = new Uint8Array(pcmBufferRef.current);
      wsRef.current.send(remainder.buffer);
      pcmBufferRef.current = new Uint8Array(0);
    }
    cleanupAudio();
    cleanupWebSocket();
    setIsListening(false);
  }, [cleanupAudio, cleanupWebSocket, isListening, interviewSessionId]);

  const stopDebugMic = useCallback(() => {
    if (debugVolumeAnimationRef.current != null) {
      cancelAnimationFrame(debugVolumeAnimationRef.current);
      debugVolumeAnimationRef.current = null;
    }
    debugWorkletNodeRef.current?.disconnect();
    debugAudioContextRef.current?.close();
    debugStreamRef.current?.getTracks().forEach(track => track.stop());
    debugWorkletNodeRef.current = null;
    debugAudioContextRef.current = null;
    debugStreamRef.current = null;
    debugAnalyserRef.current = null;
    if (debugWsRef.current && debugWsRef.current.readyState === WebSocket.OPEN) {
      if (debugPcmBufferRef.current.length > 0) {
        const remainder = new Uint8Array(debugPcmBufferRef.current);
        debugWsRef.current.send(remainder.buffer);
      }
      debugWsRef.current.close();
    }
    debugWsRef.current = null;
    debugPcmBufferRef.current = new Uint8Array(0);
    setDebugConnectionStatus('disconnected');
    setDebugMicOn(false);
    setDebugVolume(0);
    setDebugTranscript('');
  }, []);

  const startDebugMic = useCallback(async () => {
    if (debugMicOn) {
      stopDebugMic();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('当前浏览器不支持麦克风，请使用 HTTPS 或 localhost。');
      return;
    }
    if (isListening) {
      stopListening();
    }
    setDebugMicOn(true);
    setDebugTranscript('');
    setDebugVolume(0);
    setDebugConnectionStatus('connecting');

    const wsUrl = getWsUrl('/ws/asr');
    const ws = new WebSocket(wsUrl);
    debugWsRef.current = ws;

    ws.onopen = () => setDebugConnectionStatus('connected');
    ws.onerror = () => setDebugConnectionStatus('error');
    ws.onclose = () => {
      stopDebugMic();
    };
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as AsrServerMessage;
        if (data?.text) setDebugTranscript(data.text);
      } catch {
        setDebugTranscript(String(event.data));
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      debugStreamRef.current = stream;

      const ctx = new AudioContext();
      debugAudioContextRef.current = ctx;

      const workletUrl = `${window.location.origin}/pcm-processor.worklet.js`;
      await ctx.audioWorklet.addModule(workletUrl);

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      debugAnalyserRef.current = analyser;

      const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
      debugWorkletNodeRef.current = workletNode;

      analyser.connect(workletNode);
      workletNode.connect(ctx.destination);

      debugPcmBufferRef.current = new Uint8Array(0);
      debugLastSendTimeRef.current = 0;

      workletNode.port.onmessage = (event: MessageEvent<{ pcm: Float32Array }>) => {
        if (!debugWsRef.current || debugWsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = event.data.pcm;
        if (!float32?.length) return;
        const int16 = downsampleTo16k(float32, ctx.sampleRate);
        const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
        const prev = debugPcmBufferRef.current;
        const next = new Uint8Array(prev.length + bytes.length);
        next.set(prev);
        next.set(bytes, prev.length);
        debugPcmBufferRef.current = next;
        const now = Date.now();
        while (debugPcmBufferRef.current.length >= XFYUN_FRAME_BYTES) {
          if (debugLastSendTimeRef.current > 0 && now - debugLastSendTimeRef.current < XFYUN_FRAME_INTERVAL_MS) break;
          const toSend = debugPcmBufferRef.current.slice(0, XFYUN_FRAME_BYTES);
          debugWsRef.current.send(new Uint8Array(toSend).buffer);
          debugPcmBufferRef.current = debugPcmBufferRef.current.slice(XFYUN_FRAME_BYTES);
          debugLastSendTimeRef.current = Date.now();
        }
      };

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!debugAnalyserRef.current || !debugMicOn) return;
        debugAnalyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += (dataArray[i] - 128) * (dataArray[i] - 128);
        const rms = Math.sqrt(sum / dataArray.length) / 128;
        setDebugVolume(Math.min(100, Math.round(rms * 100)));
        debugVolumeAnimationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err) {
      console.error('调试麦克风启动失败:', err);
      alert('无法打开麦克风，请允许使用麦克风后重试。');
      stopDebugMic();
    }
  }, [debugMicOn, stopListening, stopDebugMic]);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('当前浏览器不支持屏幕及系统音频捕获，请使用最新版 Chrome/Edge。');
      return;
    }
    if (isListening) return;
    if (debugMicOn) stopDebugMic();

    // 先清理旧的连接和状态
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    pcmBufferRef.current = new Uint8Array(0);
    lastSendTimeRef.current = 0;
    lastAsrTextRef.current = '';
    questionSentRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      setIsListening(true);
      setConnectionStatus('connecting');
      setTranscript('');

      const wsUrl = getWsUrl('/ws/asr');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnectionStatus('connected');
        
        try {
          const res = await fetch(`${API_BASE}/api/interview/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_position: selectedJob?.title }),
          });
          const data = await res.json();
          if (data.ok) {
            setInterviewSessionId(data.session_id);
            setUserBalance(data.balance);
          } else {
            alert(data.error || '开始面试失败，请检查余额');
            stopListening();
          }
        } catch (e) {
          console.error('开始面试会话失败:', e);
          alert('开始面试会话失败');
          stopListening();
        }
      };
      
      ws.onerror = () => setConnectionStatus('error');
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setIsListening(false);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as AsrServerMessage | string;
          const fullText = typeof data === 'string' ? data : data?.text;
          if (fullText === undefined) return;
          if (typeof data !== 'string' && data?.type === 'error') {
            setTranscript(fullText);
            return;
          }
          setTranscript(fullText);
          setManualQuestion(fullText);
          
          const trimmedText = fullText.trim();
          
          if (trimmedText && trimmedText !== lastAsrTextRef.current) {
            lastAsrTextRef.current = trimmedText;
            questionSentRef.current = false;
            
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            
            silenceTimerRef.current = setTimeout(() => {
              if (trimmedText && trimmedText === lastAsrTextRef.current && !questionSentRef.current) {
                handleQuestionRef.current(trimmedText);
                questionSentRef.current = true;
              }
            }, SILENCE_THRESHOLD_MS);
          }
        } catch {
          setTranscript(String(event.data));
        }
      };

      pcmBufferRef.current = new Uint8Array(0);
      lastSendTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      captureStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const workletUrl = `${window.location.origin}/pcm-processor.worklet.js`;
      await audioContext.audioWorklet.addModule(workletUrl);

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent<{ pcm: Float32Array }>) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const float32 = event.data.pcm;
        if (!float32?.length) return;
        const int16 = downsampleTo16k(float32, audioContext.sampleRate);
        const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
        const prev = pcmBufferRef.current;
        const next = new Uint8Array(prev.length + bytes.length);
        next.set(prev);
        next.set(bytes, prev.length);
        pcmBufferRef.current = next;
        const now = Date.now();
        while (pcmBufferRef.current.length >= XFYUN_FRAME_BYTES) {
          if (lastSendTimeRef.current > 0 && now - lastSendTimeRef.current < XFYUN_FRAME_INTERVAL_MS) break;
          const toSend = pcmBufferRef.current.slice(0, XFYUN_FRAME_BYTES);
          wsRef.current.send(new Uint8Array(toSend).buffer);
          pcmBufferRef.current = pcmBufferRef.current.slice(XFYUN_FRAME_BYTES);
          lastSendTimeRef.current = Date.now();
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } catch (err) {
      console.error('Error starting system audio capture:', err);
      alert('启动系统音频捕获失败，请确认已允许屏幕共享及系统音频。');
      cleanupAudio();
      cleanupWebSocket();
      setIsListening(false);
    }
  }, [cleanupAudio, cleanupWebSocket, isListening, debugMicOn, stopDebugMic]);

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
      const { answer, debug } = await fetchAIAnswer(
        question,
        interviewHistory,
        promptOverride ?? undefined,
      );
      const debugBlock = formatDebugBlock(debug);
      onUpdateMessage(answerId, {
        content: debugBlock ? `${answer}\n\n${debugBlock}` : answer,
        isGenerating: false,
      });
    } catch (error) {
      const err = error as Error & { debug?: Record<string, unknown> };
      const msg = err.message || String(error);
      const debugBlock = formatDebugBlock(err.debug);
      onUpdateMessage(answerId, {
        content: `请求失败：${msg}${debugBlock ? `\n\n${debugBlock}` : ''}\n\n请确认后端已启动且 llm_config.json 中 api_key 正确。`,
        isGenerating: false,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [interviewHistory, onAddMessage, onUpdateMessage, promptOverride]);

  useEffect(() => {
    handleQuestionRef.current = handleQuestion;
  }, [handleQuestion]);

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

  const isUsingOverride = !!(promptOverride && promptOverride.trim());

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
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">余额:</span>
              <span className="text-lg font-semibold text-white">{formatDuration(userBalance)}</span>
            </div>
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
                      onClick={isListening ? stopListening : startListening}
                      variant={isListening ? 'destructive' : 'default'}
                      className={isListening ? '' : 'bg-gradient-to-r from-blue-500 to-purple-600'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* System Audio / ASR Status */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MonitorUp className="w-4 h-4" />
                    <span>
                      音源：屏幕共享 + 系统音频（请在浏览器弹窗中勾选“共享系统音频”）
                    </span>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      <span className="text-blue-400 text-sm font-medium">
                        {isListening
                          ? '正在捕获系统音频并发送到 ASR 服务...'
                          : '点击麦克风开始从系统音频识别问题'}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {connectionStatus === 'connected' && 'ASR 已连接'}
                        {connectionStatus === 'connecting' && '正在连接 ASR...'}
                        {connectionStatus === 'error' && 'ASR 连接异常'}
                        {connectionStatus === 'disconnected' && !isListening && 'ASR 未连接'}
                      </span>
                    </div>
                    {transcript && (
                      <p className="text-white text-sm whitespace-pre-wrap">
                        {transcript}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-80 space-y-4">
          {/* 当前 Prompt */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">当前 Prompt（本页临时覆盖）</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(systemPrompt, 'system-prompt')}
                    disabled={!systemPrompt.trim()}
                    className="text-slate-300 hover:text-white hover:bg-white/10"
                  >
                    {copiedId === 'system-prompt' ? (
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!systemPrompt.trim()}
                    onClick={() => {
                      setPromptOverride(systemPrompt.trim());
                    }}
                    className="border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    应用本页 Prompt
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                {isUsingOverride ? '当前使用：本页临时 Prompt（不会修改服务器配置文件）' : '当前使用：服务器固定 Prompt（可在服务器配置中修改）'}
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="在此编辑当前使用的系统 Prompt..."
                className="bg-slate-900/40 border-slate-600 text-slate-100 placeholder:text-slate-500 resize-none"
                rows={6}
              />
            </CardContent>
          </Card>

          {/* 调试麦克风（临时）：麦克风音源 + 音量条 + 讯飞 ASR */}
          <Card className="bg-amber-950/30 border-amber-700/50">
            <CardContent className="p-4">
              <h3 className="text-amber-200 font-semibold mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                调试麦克风（临时）
              </h3>
              <p className="text-slate-400 text-xs mb-3">
                识别麦克风声音并送讯飞 ASR，用于确认是否有声音、是否出字。
              </p>
              <Button
                variant={debugMicOn ? 'destructive' : 'outline'}
                className="w-full border-amber-600/50 text-amber-200 hover:bg-amber-900/30"
                onClick={startDebugMic}
              >
                {debugMicOn ? (
                  <>关闭麦克风</>
                ) : (
                  <>打开麦克风</>
                )}
              </Button>
              {debugMicOn && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>音量</span>
                    <span>{debugConnectionStatus === 'connected' ? 'ASR 已连接' : debugConnectionStatus === 'connecting' ? '连接中…' : debugConnectionStatus === 'error' ? '连接异常' : '未连接'}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-75"
                      style={{ width: `${debugVolume}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    识别结果：
                  </div>
                  <div className="p-2 bg-slate-800/80 rounded border border-slate-600 min-h-[4rem] text-sm text-white whitespace-pre-wrap">
                    {debugTranscript || '（对着麦克风说话，此处会显示讯飞识别文字）'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
