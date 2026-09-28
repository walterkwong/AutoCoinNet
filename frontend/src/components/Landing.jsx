import {useCallback, useRef, useState} from 'react';
import CameraCapture from './CameraCapture.jsx';
import HelpButton from './HelpButton.jsx';

const STATUS_TEXT = {
  loading: 'Connecting to backend server...',
  ok: 'Server connected',
  error: `API server offline. Please check your internet connection or contact support.`,
};

export default function Landing({backendStatus, onFile}){
  const [mode, setMode] = useState('camera');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();

      const file = event.dataTransfer.files[0];

      if(file?.type.startsWith('image/')){
        onFile(file);
      }
    },
    [onFile]
  );

  const handleCameraUnavailable = useCallback(() => {
    setCameraUnavailable(true);
    setMode('upload');
  }, []);

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if(file){
      onFile(file);
    }
  };

  const handleDropZoneKeyDown = (event) => {
    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault();
      openFilePicker();
    }
  };

  return(
    <section id="landing">
      <HelpButton className="icon-btn help-btn help-btn-floating" />

      <div className="landing-inner">
        <h1>AutoCoinScan</h1>
        <p className="sub">
          Detect, Classify and Valuate Coins with Low Latency.
        </p>

        {mode === 'camera' ? (
          <div className="capture-panel">
            <CameraCapture
              onCapture={onFile}
              onUnavailable={handleCameraUnavailable}
              guide="none"
            />

            <button
              className="mode-switch-link"
              onClick={() => setMode('upload')}
            >
              Or upload a photo instead
            </button>
          </div>
        ) : (
          <div className="capture-panel">
            <div
              id="drop-zone"
              className="drop-zone"
              role="button"
              tabIndex={0}
              aria-label="Upload coin image"
              onClick={openFilePicker}
              onKeyDown={handleDropZoneKeyDown}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
              />

              <p className="dz-label">
                Upload a coin photo
              </p>
              <p className="dz-hint">
                JPG or PNG
              </p>
            </div>

            {!cameraUnavailable && (
              <button
                className="mode-switch-link"
                onClick={() => setMode('camera')}
              >
                Or use your camera instead
              </button>
            )}
          </div>
        )}

        <div
          className={`model-status-bar model-status-${backendStatus}`}
        >
          {STATUS_TEXT[backendStatus]}
        </div>
      </div>
    </section>
  );
}