import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileText,
  X,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { ResumeFile, ProjectDoc, JobPosition } from '@/types';
import { JOB_POSITIONS } from '@/types';

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

interface ParsedResumeInfo {
  name: string;
  education: string;
  skills: string[];
  workExperience: string[];
  internshipExperience: string[];
  projectExperience: string[];
  schoolExperience: string[];
}

interface UploadedResume {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  parsedInfo: ParsedResumeInfo | null;
  content?: string;
  createdAt: string;
}

interface UploadStepProps {
  resume: ResumeFile | null;
  projectDocs: ProjectDoc[];
  selectedJob: JobPosition | null;
  onAddResume: (file: ResumeFile) => void;
  onRemoveResume: () => void;
  onAddProjectDoc: (file: ProjectDoc) => void;
  onRemoveProjectDoc: (id: string) => void;
  onSelectJob: (job: JobPosition) => void;
  onNext: () => void;
  onBack: () => void;
}

export function UploadStep({
  resume,
  projectDocs,
  selectedJob,
  onAddResume,
  onRemoveResume,
  onAddProjectDoc,
  onRemoveProjectDoc,
  onSelectJob,
  onNext,
  onBack,
}: UploadStepProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedResume, setUploadedResume] = useState<UploadedResume | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExistingResume();
  }, []);

  const loadExistingResume = async () => {
    setIsLoadingResume(true);
    try {
      const res = await fetch(`${API_BASE}/api/upload/resume`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.resumes && data.resumes.length > 0) {
        const latestResume = data.resumes[0];
        setUploadedResume(latestResume);
        onAddResume({
          id: latestResume.id,
          name: latestResume.originalName,
          type: latestResume.mimeType,
          size: latestResume.fileSize,
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingResume(false);
    }
  };

  const handleResumeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        }
      };

      const response = await new Promise<{ ok: boolean; message?: string; resume?: UploadedResume }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        
        xhr.open('POST', `${API_BASE}/api/upload/resume`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      if (response.ok && response.resume) {
        setUploadedResume(response.resume);
        onAddResume({
          id: response.resume.id,
          name: response.resume.originalName,
          type: response.resume.mimeType,
          size: response.resume.fileSize,
        });
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } else {
        setError(response.message || '上传失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  }, [onAddResume]);

  const handleRemoveResume = useCallback(async () => {
    if (!uploadedResume?.id) {
      onRemoveResume();
      setUploadedResume(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/upload/resume/${uploadedResume.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        onRemoveResume();
        setUploadedResume(null);
      } else {
        setError(data.message || '删除失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    }
  }, [uploadedResume, onRemoveResume]);

  const simulateUpload = useCallback((id: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadProgress(prev => ({ ...prev, [id]: Math.min(progress, 100) }));
    }, 200);
  }, []);

  const handleProjectUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file, index) => {
        const newDoc: ProjectDoc = {
          id: `${Date.now()}-${index}`,
          name: file.name,
          type: file.type,
          size: file.size,
        };
        simulateUpload(newDoc.id);
        setTimeout(() => {
          onAddProjectDoc(newDoc);
        }, 800);
      });
    }
  }, [onAddProjectDoc, simulateUpload]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h2 className="text-3xl font-bold text-white mb-2">上传资料</h2>
          <p className="text-slate-400">上传你的简历和项目文档，选择目标岗位</p>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              1
            </div>
            <span className="text-white font-medium">上传资料</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 text-sm font-medium">
              2
            </div>
            <span className="text-slate-400">音源设置</span>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 text-sm font-medium">
              3
            </div>
            <span className="text-slate-400">开始面试</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">简历上传</h3>
                <p className="text-slate-400 text-sm">支持 PDF、Word 格式，最大 10MB</p>
              </div>
            </div>

            {isLoadingResume ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : !resume ? (
              <div
                onClick={() => !isUploading && resumeInputRef.current?.click()}
                className={`border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">点击上传简历</p>
                <p className="text-slate-500 text-sm">或将文件拖拽到此处</p>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </div>
            ) : (
              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-white font-medium">{resume.name}</p>
                      <p className="text-slate-400 text-sm">{formatFileSize(resume.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveResume}
                      className="text-slate-400 hover:text-red-400"
                      disabled={isUploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {isUploading && uploadProgress[resume.name] !== undefined && uploadProgress[resume.name] < 100 && (
                  <Progress value={uploadProgress[resume.name]} className="mt-3" />
                )}
                {uploadedResume?.parsedInfo && (
                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">解析结果：</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {uploadedResume.parsedInfo.name && (
                        <div className="text-slate-300">
                          <span className="text-slate-500">姓名：</span>
                          {uploadedResume.parsedInfo.name}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.education && (
                        <div className="text-slate-300">
                          <span className="text-slate-500">学历：</span>
                          {uploadedResume.parsedInfo.education}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.skills && uploadedResume.parsedInfo.skills.length > 0 && (
                        <div className="text-slate-300 col-span-2">
                          <span className="text-slate-500">技能：</span>
                          {uploadedResume.parsedInfo.skills.join('、')}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.workExperience && uploadedResume.parsedInfo.workExperience.length > 0 && (
                        <div className="text-slate-300 col-span-2">
                          <span className="text-slate-500">工作经历：</span>
                          {uploadedResume.parsedInfo.workExperience.join('；')}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.internshipExperience && uploadedResume.parsedInfo.internshipExperience.length > 0 && (
                        <div className="text-slate-300 col-span-2">
                          <span className="text-slate-500">实习经历：</span>
                          {uploadedResume.parsedInfo.internshipExperience.join('；')}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.projectExperience && uploadedResume.parsedInfo.projectExperience.length > 0 && (
                        <div className="text-slate-300 col-span-2">
                          <span className="text-slate-500">项目经历：</span>
                          {uploadedResume.parsedInfo.projectExperience.join('；')}
                        </div>
                      )}
                      {uploadedResume.parsedInfo.schoolExperience && uploadedResume.parsedInfo.schoolExperience.length > 0 && (
                        <div className="text-slate-300 col-span-2">
                          <span className="text-slate-500">校内经历：</span>
                          {uploadedResume.parsedInfo.schoolExperience.join('；')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">项目文档（可选）</h3>
                <p className="text-slate-400 text-sm">上传项目介绍、作品集等辅助材料</p>
              </div>
            </div>

            <div
              onClick={() => projectInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all mb-4"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-white font-medium text-sm">添加项目文档</p>
              <input
                ref={projectInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                multiple
                onChange={handleProjectUpload}
                className="hidden"
              />
            </div>

            {projectDocs.length > 0 && (
              <div className="space-y-2">
                {projectDocs.map((doc) => (
                  <div key={doc.id} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{doc.name}</p>
                        <p className="text-slate-400 text-xs">{formatFileSize(doc.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadProgress[doc.id] === 100 && (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveProjectDoc(doc.id)}
                        className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">选择岗位</h3>
                <p className="text-slate-400 text-sm">选择你要面试的目标岗位</p>
              </div>
            </div>

            <Select
              value={selectedJob?.id}
              onValueChange={(value) => {
                const job = JOB_POSITIONS.find(j => j.id === value);
                if (job) onSelectJob(job);
              }}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="请选择岗位" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {JOB_POSITIONS.map((job) => (
                  <SelectItem
                    key={job.id}
                    value={job.id}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{job.title}</span>
                      <span className="text-xs text-slate-400">{job.department} · {job.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedJob && (
              <div className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                    {selectedJob.department}
                  </Badge>
                </div>
                <p className="text-white font-medium text-lg">{selectedJob.title}</p>
                <p className="text-slate-400 text-sm mt-1">{selectedJob.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-slate-500 text-sm mb-3 text-right">简历与选岗为选填，可直接点击下一步</p>
        <div className="flex justify-end">
          <Button
            onClick={onNext}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8"
          >
            下一步：音源设置
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
