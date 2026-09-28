export const API_BASE = import.meta.env.VITE_API_URL;

async function requestJson(path, options = {}){
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if(!res.ok){
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || `Request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err){
    if(err.name === 'TimeoutError'){
      throw new Error(`Request to backend timed out.`);
    }
    throw err;
  }
}

// ping server health
export async function pingBackend(){
  try {
    return await requestJson('/health');
  } catch {
    return requestJson('/');
  }
}

// YOLO
export async function detectCoins(fileBlob){
  const formData = new FormData();
  formData.append('file', fileBlob);
  const data = await requestJson('/detect', {
    method: 'POST',
    body: formData,
  });
  return data.detections ?? [];
}

// classification/grading 
export async function classifyBatch(blobs, topK = 5){
  if(!blobs.length) return [];
  const formData = new FormData();
  blobs.forEach((blob, i) => formData.append('files', blob, `coin_${i}.png`));
  const data = await requestJson(`/classify_batch?top_k=${topK}`, {
    method: 'POST',
    body: formData,
  });
  return data.results ?? [];
}