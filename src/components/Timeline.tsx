import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';

export function Timeline() {
  const { currentTime, isPlaying, setIsPlaying, setCurrentTime } = useTripStore();
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const animate = (time: number) => {
        const delta = time - (lastTimeRef.current || time);
        lastTimeRef.current = time;
        
        const state = useTripStore.getState();
        const prevTime = state.currentTime;
        
        let durationS = state.trip.template.durationS || 15;
        
        // Apply max speed limit if set
        if (state.maxCameraSpeedKmS > 0 && state.trip.legs.length > 0) {
          const totalDistanceKm = state.trip.legs.reduce((sum, leg) => sum + (leg.distanceM || 0), 0) / 1000;
          const minRequiredDuration = totalDistanceKm / state.maxCameraSpeedKmS;
          if (minRequiredDuration > durationS) {
            durationS = minRequiredDuration;
          }
        }
        
        let next = prevTime + delta / (durationS * 1000);
        
        if (next >= 1) {
          next = 1;
          setIsPlaying(false);
        }
        
        setCurrentTime(next);
        
        if (next < 1) {
          requestRef.current = requestAnimationFrame(animate);
        }
      };
      requestRef.current = requestAnimationFrame(animate);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, setCurrentTime, setIsPlaying]);

  return (
    <div className="h-24 bg-gray-800 border-t border-gray-700 flex flex-col z-10">
      <div className="flex-1 flex flex-col p-2 gap-2">
        <div className="flex items-center gap-4 px-4">
          <button 
            className="p-1 hover:bg-gray-700 rounded text-gray-300"
            onClick={() => setCurrentTime(0)}
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button 
            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button 
            className="p-1 hover:bg-gray-700 rounded text-gray-300"
            onClick={() => setCurrentTime(1)}
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <div className="text-sm font-mono text-gray-400">
            {(currentTime * 100).toFixed(1)}%
          </div>
        </div>
        <div className="flex-1 relative mx-4 flex items-center">
          <input 
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

