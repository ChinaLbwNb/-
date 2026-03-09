import { useInterviewStore } from '@/hooks/useInterviewStore';
import { WelcomeStep } from '@/sections/WelcomeStep';
import { UploadStep } from '@/sections/UploadStep';
import { AudioSetupStep } from '@/sections/AudioSetupStep';
import { InterviewStep } from '@/sections/InterviewStep';
import { EndStep } from '@/sections/EndStep';
import './App.css';

function App() {
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
    canProceedToAudio,
  } = useInterviewStore();

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
            canProceed={canProceedToAudio}
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
      {renderStep()}
    </div>
  );
}

export default App;
