import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Headphones,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AudioSetupStepProps {
  audioInputDevice: string;
  audioOutputDevice: string;
  isAudioTested: boolean;
  onSetAudioDevices: (input: string, output: string) => void;
  onMarkAudioTested: (tested: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AudioSetupStep({
  audioInputDevice,
  audioOutputDevice,
  isAudioTested,
  onSetAudioDevices,
  onMarkAudioTested,
  onNext,
  onBack,
}: AudioSetupStepProps) {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(80);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'recording' | 'recorded' | 'playing'>('idle');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);

        // Get device list
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        
        setInputDevices(inputs);
        setOutputDevices(outputs);

        // Set defaults if not already set
        if (!audioInputDevice && inputs.length > 0) {
          onSetAudioDevices(inputs[0].deviceId, audioOutputDevice || outputs[0]?.deviceId || '');
        }
      } catch (err) {
        console.error('Error accessing audio devices:', err);
        setHasPermission(false);
      }
    };

    getDevices();
  }, []);

  // Monitor input volume
  useEffect(() => {
    if (!isRecording) return;

    const monitorVolume = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: audioInputDevice || undefined }
        });
        streamRef.current = stream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setInputVolume(Math.min(average * 2, 100));
          requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
      } catch (err) {
        console.error('Error monitoring volume:', err);
      }
    };

    monitorVolume();

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
    };
  }, [isRecording, audioInputDevice]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: audioInputDevice || undefined }
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(blob);
        setTestStatus('recorded');
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setTestStatus('recording');
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  }, [audioInputDevice]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const playTestAudio = useCallback(() => {
    if (!recordedAudio) return;
    
    const url = URL.createObjectURL(recordedAudio);
    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onended = () => {
      setIsPlaying(false);
      setTestStatus('recorded');
    };
    
    audio.play();
    setIsPlaying(true);
    setTestStatus('playing');
  }, [recordedAudio]);

  const stopTestAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
    setTestStatus('recorded');
  }, []);

  const completeTest = useCallback(() => {
    onMarkAudioTested(true);
  }, [onMarkAudioTested]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h2 className="text-3xl font-bold text-white mb-2">音源设置</h2>
          <p className="text-slate-400">配置音频设备并测试麦克风</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-slate-400">上传资料</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              2
            </div>
            <span className="text-white font-medium">音源设置</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 text-sm font-medium">
              3
            </div>
            <span className="text-slate-400">开始面试</span>
          </div>
        </div>

        {/* Permission Warning */}
        {hasPermission === false && (
          <Card className="bg-red-500/10 border-red-500/30 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-white font-medium">需要麦克风权限</p>
                <p className="text-slate-400 text-sm">请在浏览器设置中允许访问麦克风</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Input Device Selection */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Mic className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">输入设备</h3>
                <p className="text-slate-400 text-sm">选择麦克风设备</p>
              </div>
            </div>

            <Select
              value={audioInputDevice}
              onValueChange={(value) => onSetAudioDevices(value, audioOutputDevice)}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="选择麦克风" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {inputDevices.map((device) => (
                  <SelectItem
                    key={device.deviceId}
                    value={device.deviceId}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    {device.label || `麦克风 ${device.deviceId.slice(0, 8)}...`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Volume Meter */}
            {isRecording && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">输入音量</span>
                  <span className="text-white text-sm">{Math.round(inputVolume)}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-100"
                    style={{ width: `${inputVolume}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Device Selection */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Headphones className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">输出设备</h3>
                <p className="text-slate-400 text-sm">选择扬声器或耳机</p>
              </div>
            </div>

            <Select
              value={audioOutputDevice}
              onValueChange={(value) => onSetAudioDevices(audioInputDevice, value)}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="选择输出设备" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {outputDevices.map((device) => (
                  <SelectItem
                    key={device.deviceId}
                    value={device.deviceId}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    {device.label || `扬声器 ${device.deviceId.slice(0, 8)}...`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Output Volume */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">输出音量</span>
                <span className="text-white text-sm">{outputVolume}%</span>
              </div>
              <Slider
                value={[outputVolume]}
                onValueChange={([value]) => setOutputVolume(value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Microphone Test */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">麦克风测试</h3>
                <p className="text-slate-400 text-sm">录制一段音频并回放测试</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  disabled={hasPermission === false}
                  variant="outline"
                  className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  开始录制
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                >
                  <Square className="w-4 h-4 mr-2" />
                  停止录制
                </Button>
              )}

              {testStatus === 'recorded' && (
                <>
                  <Button
                    onClick={playTestAudio}
                    variant="outline"
                    className="border-green-500 text-green-400 hover:bg-green-500/10"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    播放测试
                  </Button>
                  <Button
                    onClick={completeTest}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    测试通过
                  </Button>
                </>
              )}

              {isPlaying && (
                <Button
                  onClick={stopTestAudio}
                  variant="outline"
                  className="border-slate-500 text-slate-400"
                >
                  <VolumeX className="w-4 h-4 mr-2" />
                  停止播放
                </Button>
              )}
            </div>

            {isAudioTested && (
              <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">音频测试已完成</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={onNext}
            disabled={!isAudioTested}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始面试
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
