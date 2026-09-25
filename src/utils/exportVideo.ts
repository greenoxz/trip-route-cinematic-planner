import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useTripStore } from '../store/useTripStore';

export async function exportVideo(map: MapLibreMap, durationS: number = 15, fps: number = 30): Promise<string> {
  const ffmpeg = new FFmpeg();
  
  // Load ffmpeg locally from public folder
  const baseURL = window.location.origin;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  const totalFrames = durationS * fps;
  const store = useTripStore.getState();
  
  // Ensure we are paused during export
  store.setIsPlaying(false);
  
  const captureFrame = (time: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      // 1. Update time so MapView reacts and moves camera
      store.setCurrentTime(time);
      
      // 2. Wait for map to settle (wait 2 frames to ensure MapLibre rendered)
      setTimeout(() => {
        const canvas = map.getCanvas();
        // 3. Grab Data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // 4. Convert to ArrayBuffer
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => blob.arrayBuffer())
          .then(buf => resolve(new Uint8Array(buf)));
      }, 50); // small delay to let React and MapLibre re-render
    });
  };

  for (let i = 0; i < totalFrames; i++) {
    store.setExportProgress(i / totalFrames);
    const normalizedTime = i / totalFrames;
    const buffer = await captureFrame(normalizedTime);
    
    const num = i.toString().padStart(4, '0');
    await ffmpeg.writeFile(`frame_${num}.jpg`, buffer);
  }
  
  store.setExportProgress(1.0); // Encoding phase

  // Run FFmpeg to encode to mp4
  await ffmpeg.exec([
    '-framerate', `${fps}`,
    '-i', 'frame_%04d.jpg',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  const bufferArray = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const url = URL.createObjectURL(new Blob([bufferArray], { type: 'video/mp4' }));
  
  store.setExportProgress(null);
  
  return url;
}
