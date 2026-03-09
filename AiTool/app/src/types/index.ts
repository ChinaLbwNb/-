export type InterviewStep = 'welcome' | 'upload' | 'audio-setup' | 'interview' | 'end';

export interface ResumeFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface ProjectDoc {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface JobPosition {
  id: string;
  title: string;
  department: string;
  description: string;
}

export interface InterviewState {
  currentStep: InterviewStep;
  resume: ResumeFile | null;
  projectDocs: ProjectDoc[];
  selectedJob: JobPosition | null;
  audioInputDevice: string;
  audioOutputDevice: string;
  isAudioTested: boolean;
  interviewHistory: InterviewMessage[];
  startTime: Date | null;
  endTime: Date | null;
}

export interface InterviewMessage {
  id: string;
  type: 'question' | 'answer';
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
}

export const JOB_POSITIONS: JobPosition[] = [
  {
    id: '1',
    title: '前端开发工程师',
    department: '技术部',
    description: '负责Web应用前端开发，使用React、Vue等框架'
  },
  {
    id: '2',
    title: '后端开发工程师',
    department: '技术部',
    description: '负责服务端开发，使用Java、Python、Go等语言'
  },
  {
    id: '3',
    title: '产品经理',
    department: '产品部',
    description: '负责产品规划、需求分析和项目管理'
  },
  {
    id: '4',
    title: 'UI/UX设计师',
    department: '设计部',
    description: '负责用户界面设计和用户体验优化'
  },
  {
    id: '5',
    title: '数据分析师',
    department: '数据部',
    description: '负责数据挖掘、分析和可视化报告'
  },
  {
    id: '6',
    title: '算法工程师',
    department: 'AI部',
    description: '负责机器学习算法研发和优化'
  }
];
