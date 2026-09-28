import {useCallback, useRef, useState} from 'react';
import {
  CoinProcessor,
  canvasToFlattenedBlob,
} from '../lib/processor.js';
import {
  deriveIdentity,
  candidateLists,
} from '../lib/taxonomy.js';
import {
  detectCoins,
  classifyBatch,
  pingBackend,
} from '../api.js';

const DETECTION_CONF_CUTOFF = 0.5;
const TOP_K = 5;

const STEP_LABELS = {
  detecting: 'Locating coins...',
  cleaning: ({current, total}) =>
    `Isolating coins (${current}/${total})...`,
  classifying: ({total}) =>
    `Classifying & grading ${total} coin(s)...`,
  error: 'Processing failed',
};

function classifyCoin(coin, classification){
  const identity = deriveIdentity(classification);

  return {
    ...coin,
    classification,
    identity,
    detectedIdentity: identity,
    identityCandidates: candidateLists(classification),
  };
}

function loadImage(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => resolve({el: img, url});
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };

    img.src = url;
  });
}

export function usePipeline(){
  const [phase, setPhase] = useState('welcome');
  const [backendStatus, setBackendStatus] = useState('loading');
  const [image, setImage] = useState(null);
  const [coins, setCoins] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [pipelineStep, setPipelineStep] = useState({
    step: null,
    progress: null,
  });
  const fileRef = useRef(null);

  const checkBackend = useCallback(async () => {
    setBackendStatus('loading');

    try {
      await pingBackend();
      setBackendStatus('ok');
    } catch {
      setBackendStatus('error');
    }
  }, []);

  const runPipeline = useCallback(async (img, file) => {
    setCoins([]);
    setActiveId(null);

    try {
      setPipelineStep({
        step: 'detecting',
        progress: null,
      });

      const rawDetections = await detectCoins(file);

      const kept = rawDetections.filter(
        (d) => d.confidence >= DETECTION_CONF_CUTOFF
      );

      const processor = new CoinProcessor(img.el);
      let cleanedCount = 0;

      setPipelineStep({
        step: 'cleaning',
        progress: {
          current: 0,
          total: kept.length,
        },
      });

      const processed = (
        await Promise.all(
          kept.map(async (detection, idx) => {
            try {
              const res = await processor.process(
                detection,
                idx
              );

              cleanedCount += 1;

              setPipelineStep({
                step: 'cleaning',
                progress: {
                  current: cleanedCount,
                  total: kept.length,
                },
              });

              return res;
            } catch (err){
              console.error(
                `Failed to process coin #${idx}:`,
                err
              );
              return null;
            }
          })
        )
      ).filter(Boolean);

      // classify
      let results = [];

      if(processed.length > 0){
        setPipelineStep({
          step: 'classifying',
          progress: {
            total: processed.length,
          },
        });

        const blobs = await Promise.all(
          processed.map((c) =>
            canvasToFlattenedBlob(c.correctedCanvas)
          )
        );

        results = await classifyBatch(blobs, TOP_K).catch(
          (err) => {
            console.error(
              'Classification batch failed:',
              err
            );
            return [];
          }
        );
      }

      setCoins(
        processed.map((coin, idx) =>
          classifyCoin(
            coin,
            results[idx] ?? null
          )
        )
      );

      setPipelineStep({
        step: null,
        progress: null,
      });

      setPhase('workspace');
    } catch (err){
      console.error('Pipeline execution error:', err);
      setBackendStatus('error');
      setPhase('landing');
    }
  }, []);

  const loadFile = useCallback(
    async (file) => {
      fileRef.current = file;

      try {
        const img = await loadImage(file);
        setImage(img);
        setPhase('processing');
        runPipeline(img, file);
      } catch (err){
        console.error('Failed to load image:', err);
      }
    },
    [runPipeline]
  );

  const rerun = useCallback(() => {
    if(!image || !fileRef.current) return;

    setPhase('processing');
    runPipeline(image, fileRef.current);
  }, [image, runPipeline]);

  const reset = useCallback(() => {
    if(image?.url){
      URL.revokeObjectURL(image.url);
    }

    setImage(null);
    setCoins([]);
    setActiveId(null);
    fileRef.current = null;
    setPhase('landing');
    checkBackend();
  }, [image, checkBackend]);

  const updateCoinIdentity = useCallback((idx, patch) => {
    setCoins((prev) =>
      prev.map((coin) =>
        coin.idx === idx
          ? {
              ...coin,
              identity: {
                ...coin.identity,
                ...patch,
              },
            }
          : coin
      )
    );
  }, []);

  const processingLabel = pipelineStep.step
    ? typeof STEP_LABELS[pipelineStep.step] === 'function'
      ? STEP_LABELS[pipelineStep.step](pipelineStep.progress)
      : STEP_LABELS[pipelineStep.step]
    : '';

  return {
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
    startScan: () => setPhase('landing'),
    updateCoinIdentity,
  };
}