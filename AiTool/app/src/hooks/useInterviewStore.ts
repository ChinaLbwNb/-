import { useState, useCallback } from 'react';
import type { InterviewStep, ResumeFile, ProjectDoc, JobPosition, InterviewMessage } from '@/types';

export function useInterviewStore() {
  const [currentStep, setCurrentStep] = useState<InterviewStep>('welcome');
  const [resume, setResume] = useState<ResumeFile | null>(null);
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
  const [audioInputDevice, setAudioInputDevice] = useState<string>('');
  const [audioOutputDevice, setAudioOutputDevice] = useState<string>('');
  const [isAudioTested, setIsAudioTested] = useState(false);
  const [interviewHistory, setInterviewHistory] = useState<InterviewMessage[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);

  const goToStep = useCallback((step: InterviewStep) => {
    setCurrentStep(step);
    if (step === 'interview' && !startTime) {
      setStartTime(new Date());
    }
    if (step === 'end' && !endTime) {
      setEndTime(new Date());
    }
  }, [startTime, endTime]);

  const addResume = useCallback((file: ResumeFile) => {
    setResume(file);
  }, []);

  const removeResume = useCallback(() => {
    setResume(null);
  }, []);

  const addProjectDoc = useCallback((file: ProjectDoc) => {
    setProjectDocs(prev => [...prev, file]);
  }, []);

  const removeProjectDoc = useCallback((id: string) => {
    setProjectDocs(prev => prev.filter(doc => doc.id !== id));
  }, []);

  const selectJob = useCallback((job: JobPosition) => {
    setSelectedJob(job);
  }, []);

  const setAudioDevices = useCallback((input: string, output: string) => {
    setAudioInputDevice(input);
    setAudioOutputDevice(output);
  }, []);

  const markAudioTested = useCallback((tested: boolean) => {
    setIsAudioTested(tested);
  }, []);

  const addInterviewMessage = useCallback((message: InterviewMessage) => {
    setInterviewHistory(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<InterviewMessage>) => {
    setInterviewHistory(prev => 
      prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    );
  }, []);

  const resetInterview = useCallback(() => {
    setCurrentStep('welcome');
    setResume(null);
    setProjectDocs([]);
    setSelectedJob(null);
    setAudioInputDevice('');
    setAudioOutputDevice('');
    setIsAudioTested(false);
    setInterviewHistory([]);
    setStartTime(null);
    setEndTime(null);
  }, []);

  const canProceedToAudio = !!resume && !!selectedJob;
  const canProceedToInterview = canProceedToAudio && isAudioTested;

  return {
    // State
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
    
    // Actions
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
    
    // Validation
    canProceedToAudio,
    canProceedToInterview,
  };
}
