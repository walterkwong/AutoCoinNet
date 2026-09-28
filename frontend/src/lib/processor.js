// process coin on upload

const OUTPUT_SIZE = 512;

export class CoinProcessor {
  constructor(img){
    this.img = img;
    this.w = img.naturalWidth;
    this.h = img.naturalHeight;
  }

  async process(detection, idx){
    const { bbox, polygonNorm = [], confidence } = detection;
    const bx = (bbox?.x ?? 0) * this.w;
    const by = (bbox?.y ?? 0) * this.h;
    const bw = (bbox?.w ?? 0.5) * this.w;
    const bh = (bbox?.h ?? 0.5) * this.h;

    // canvas 512x512
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    const cx = OUTPUT_SIZE / 2;
    const cy = OUTPUT_SIZE / 2;
    const radius = (OUTPUT_SIZE * 0.92) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // circular clip mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(this.img, bx, by, bw, bh, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    // edge ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d6d1c4';
    ctx.stroke();

    return {
      idx,
      confidence,
      bbox,
      polygonNorm,
      correctedCanvas: canvas,
    };
  }
}

export function canvasToFlattenedBlob(canvas, bg = '#f2ede0'){
  return new Promise((resolve) => {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);

    flat.toBlob(resolve, 'image/png');
  });
}