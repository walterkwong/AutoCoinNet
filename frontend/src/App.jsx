import {useEffect} from 'react';
import Welcome from './components/Welcome.jsx';
import Landing from './components/Landing.jsx';
import Workspace from './components/Workspace.jsx';
import HelpButton from './components/HelpButton.jsx';
import {usePipeline} from './hooks/usePipeline.js';

export default function App(){
  const {
    phase,
    image,
    coins,
    activeId,
    processingLabel,
    backendStatus,
    setActiveId,
    loadFile,
    rerun,
    reset,
    checkBackend,
    startScan,
    updateCoinIdentity,
 } = usePipeline();

  useEffect(() => {
    checkBackend();
 }, [checkBackend]);

  return(
    <>
      {phase === 'welcome' && <Welcome onStart={startScan} />}
      {phase === 'landing' && <Landing backendStatus={backendStatus} onFile={loadFile} />}
      {phase === 'workspace' && (
        <Workspace
          image={image}
          coins={coins}
          activeId={activeId}
          setActiveId={setActiveId}
          onBack={reset}
          onRerun={rerun}
          onIdentityChange={updateCoinIdentity}
        />
      )}

      {phase === 'processing' && (
        <div id="processing-overlay">
          <HelpButton className="icon-btn help-btn help-btn-floating" />
          <div className="proc-card">
            <div className="spinner" />
            <p id="proc-label">{processingLabel}</p>
          </div>
        </div>
      )}
    </>
  );
}
