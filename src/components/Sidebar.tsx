import React, { useState } from 'react';
import { useTripStore } from '../store/useTripStore';
import { GripVertical, MapPin, Plus, Trash2, Settings, Video, RefreshCw, Download } from 'lucide-react';
import type { Waypoint } from '../types/trip';
import { calculateAllLegs } from '../utils/routing';

export function Sidebar() {
  const { 
    trip, addWaypoint, removeWaypoint, updateWaypoint, 
    setLegs, setLegMode, cameraSmoothness, setCameraSmoothness, 
    cameraZoomOffset, setCameraZoomOffset, easingCurve, setEasingCurve,
    maxCameraSpeedKmS, setMaxCameraSpeedKmS
  } = useTripStore();
  const [newWaypointName, setNewWaypointName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeout = React.useRef<any>(null);

  const handleSearch = (query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        if (data.features) setSearchResults(data.features);
      } catch (e) {
        console.error(e);
      }
    }, 300);
  };

  const handleSelectLocation = (feature: any) => {
    const newId = `wp_${Date.now()}`;
    const wp: Waypoint = {
      id: newId,
      name: feature.properties.name,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      stayMin: 60
    };
    addWaypoint(wp);
    setNewWaypointName('');
    setSearchResults([]);
  };

  const handleUpdateRoutes = async () => {
    if (trip.waypoints.length < 2) return;
    setIsCalculating(true);
    try {
      const legs = await calculateAllLegs(trip.waypoints, trip.legs);
      setLegs(legs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    // Simulate export process
    setTimeout(() => {
      alert('Export feature is scaffolded and uses FFmpeg.wasm in the background. Check src/utils/exportVideo.ts');
      setIsExporting(false);
    }, 2000);
  };

  return (
    <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col z-10">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Video className="w-5 h-5 text-blue-400" />
          Trip Planner
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <div className="mb-6 flex-1">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">Waypoints</h2>
            <button 
              onClick={handleUpdateRoutes} 
              disabled={isCalculating || trip.waypoints.length < 2}
              className="text-xs flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isCalculating ? 'animate-spin' : ''}`} />
              Update Routes
            </button>
          </div>
          <div className="space-y-2">
            {trip.waypoints.map((wp, index) => (
              <React.Fragment key={wp.id}>
                <div className="flex items-center gap-2 bg-gray-700 p-2 rounded-md">
                  <GripVertical className="w-4 h-4 text-gray-500 cursor-move" />
                  <div className="flex-1 flex flex-col">
                    <span className="font-medium text-sm">{wp.name}</span>
                    <span className="text-xs text-gray-400">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                  </div>
                  <button 
                    onClick={() => removeWaypoint(wp.id)}
                    className="p-1 hover:bg-gray-600 rounded text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Leg mode selector (between waypoints) */}
                {index < trip.waypoints.length - 1 && (
                  <div className="flex justify-center my-1 relative">
                    <div className="absolute top-0 bottom-0 left-4 border-l-2 border-gray-600 border-dashed"></div>
                    <select 
                      className="bg-gray-800 border border-gray-600 text-xs rounded-full px-2 py-1 text-gray-300 z-10"
                      value={trip.legs[index]?.mode || 'drive'}
                      onChange={(e) => setLegMode(index, e.target.value as any)}
                    >
                      <option value="walk">🚶 Walk</option>
                      <option value="bike">🚲 Bike</option>
                      <option value="motorcycle">🏍️ Motorcycle</option>
                      <option value="drive">🚗 Drive</option>
                      <option value="flight">✈️ Flight</option>
                      <option value="ferry">⛴️ Ferry</option>
                    </select>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <div className="mt-3 relative">
            <div className="flex gap-2">
              <input 
                type="text"
                value={newWaypointName}
                onChange={(e) => {
                  setNewWaypointName(e.target.value);
                  handleSearch(e.target.value);
                }}
                placeholder="Search location..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg overflow-hidden z-20">
                {searchResults.map((result: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSelectLocation(result)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-600 border-b border-gray-600 last:border-0"
                  >
                    <div className="font-medium">{result.properties.name}</div>
                    <div className="text-xs text-gray-400">
                      {[result.properties.city, result.properties.state, result.properties.country].filter(Boolean).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <div className="mb-4 bg-gray-700 p-3 rounded-md space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex justify-between">
                <span>Camera Smoothness</span>
                <span>{Math.round(cameraSmoothness * 100)}%</span>
              </h2>
              <input 
                type="range"
                min="0.01"
                max="0.2"
                step="0.01"
                value={cameraSmoothness}
                onChange={(e) => setCameraSmoothness(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
            
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex justify-between">
                <span>Camera Zoom Offset</span>
                <span>{cameraZoomOffset > 0 ? '+' : ''}{cameraZoomOffset}</span>
              </h2>
              <input 
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={cameraZoomOffset}
                onChange={(e) => setCameraZoomOffset(parseFloat(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
            
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Playback Easing</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'linear', name: 'Linear', path: 'M 2 22 L 38 2' },
                  { id: 'ease-in-out-quad', name: 'Smooth', path: 'M 2 22 C 14 22, 26 2, 38 2' },
                  { id: 'ease-in-out-cubic', name: 'Cinematic', path: 'M 2 22 C 20 22, 20 2, 38 2' },
                  { id: 'ease-out', name: 'Brake', path: 'M 2 22 C 2 2, 14 2, 38 2' }
                ].map(curve => (
                  <button
                    key={curve.id}
                    onClick={() => setEasingCurve(curve.id as any)}
                    className={`flex flex-col items-center justify-center p-2 rounded border ${
                      easingCurve === curve.id 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <svg width="40" height="24" viewBox="0 0 40 24" className="mb-1">
                      <path d={curve.path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] uppercase font-medium">{curve.name}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Max Camera Speed</h2>
              <select 
                className="w-full bg-gray-900 border border-gray-600 rounded p-1.5 text-xs"
                value={maxCameraSpeedKmS}
                onChange={(e) => setMaxCameraSpeedKmS(Number(e.target.value))}
              >
                <option value={0}>Unlimited (Sync to Video Length)</option>
                <option value={50}>50 km/sec</option>
                <option value={100}>100 km/sec (Slow)</option>
                <option value={500}>500 km/sec (Medium)</option>
                <option value={1000}>1,000 km/sec (Fast)</option>
                <option value={5000}>5,000 km/sec (Super Fast)</option>
              </select>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Export Options</h2>
          <select 
            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm mb-3"
            value={trip.template.preset}
            onChange={(e) => {
              const val = e.target.value;
              let dur = 15;
              let ar = '9:16';
              if (val === 'tiktok_30s') dur = 30;
              if (val === 'youtube_60s') dur = 60;
              if (val === 'youtube_standard') { dur = 60; ar = '16:9'; }
              if (val === 'instagram_square') { dur = 30; ar = '1:1'; }
              useTripStore.getState().setTemplate({ preset: val, durationS: dur, aspectRatio: ar });
            }}
          >
            <option value="reels_15s">Reels (15s, 9:16)</option>
            <option value="tiktok_30s">TikTok (30s, 9:16)</option>
            <option value="youtube_60s">YT Shorts (60s, 9:16)</option>
            <option value="youtube_standard">YouTube (16:9)</option>
            <option value="instagram_square">Instagram (1:1)</option>
          </select>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting...' : 'Export MP4'}
          </button>
        </div>
      </div>
    </aside>
  );
}

