import {useCallback, useEffect, useRef, useState} from 'react';

export default function CameraCapture({
  onCapture,
  onUnavailable,
  guide = 'none',
  guideLabel,
  facingMode = 'environment',
  fileName = 'capture.jpg',
}){
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stopStream = (stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    async function startCamera(){
      if(!navigator.mediaDevices?.getUserMedia){
        setError('no-camera-api');
        onUnavailable?.();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {ideal: facingMode},
            width: {ideal: 1920},
            height: {ideal: 1920},
          },
          audio: false,
        });

        if(cancelled){
          stopStream(stream);
          return;
        }

        streamRef.current = stream;

        if(videoRef.current){
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setReady(true);
      } catch (err){
        console.error('[camera] failed to get stream:', err);

        if(!cancelled){
          setError('denied');
          onUnavailable?.();
        }
      }
    }

    startCamera();

    return() => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;

    if(!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if(!context) return;

    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if(!blob) return;

        const file = new File([blob], fileName, {
          type: 'image/jpeg',
        });

        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }, [onCapture, fileName]);

  if(error){
    return(
      <div className="camera-error">
        <p>
          Couldn&rsquo;t access the camera
          {error === 'denied' ? ' (permission denied)' : ''}.
        </p>
      </div>
    );
  }

  return(
    <div className={`camera-viewfinder camera-guide-${guide}`}>
      <video
        ref={videoRef}
        className="camera-video"
        playsInline
        muted
      />

      {guide === 'circle' && (
        <div className="camera-guide-overlay">
          <div className="camera-guide-circle" />
          {guideLabel && (
            <p className="camera-guide-label">{guideLabel}</p>
          )}
        </div>
      )}

      <button
        type="button"
        className="camera-shutter"
        aria-label="Take picture"
        disabled={!ready}
        onClick={handleCapture}
      >
        <span className="camera-shutter-ring" />
      </button>
    </div>
  );
}