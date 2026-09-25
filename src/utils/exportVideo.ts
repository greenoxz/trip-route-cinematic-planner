import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { Map as MapLibreMap } from 'maplibre-gl';

export async function exportVideo(map: MapLibreMap, durationS: number = 15, fps: number = 30): Promise<string> {
  const ffmpeg = new FFmpeg();
  
  // Need to load ffmpeg core. Using the default CDN urls for simplicity in this demo.
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
  });

  const totalFrames = durationS * fps;
  
  // This is a naive frame capture for demonstration.
  // In a real app, you would drive the animation frame-by-frame deterministically.
  for (let i = 0; i < totalFrames; i++) {
    // Force map to render a specific time (mocked here)
    // map.jumpTo(...)
    // await map.once('render') or await idle
    
    // Capture canvas
    const canvas = map.getCanvas();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Convert to uint8 array
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const buffer = new Uint8Array(await blob.arrayBuffer());
    
    // Write to ffmpeg virtual fs
    const num = i.toString().padStart(4, '0');
    await ffmpeg.writeFile(`frame_${num}.jpg`, buffer);
  }

  // Run FFmpeg to encode to mp4
  await ffmpeg.exec([
    '-framerate', `${fps}`,
    '-i', 'frame_%04d.jpg',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
  
  return url;
}
