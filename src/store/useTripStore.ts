import { create } from 'zustand';
import type { Trip, Waypoint, Leg, CameraKeyframe, TemplatePreset, TransportMode } from '../types/trip';

interface TripState {
  trip: Trip;
  currentTime: number; // 0 to 1, representing normalized time along the trip
  isPlaying: boolean;
  setWaypoints: (waypoints: Waypoint[]) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>) => void;
  addWaypoint: (waypoint: Waypoint) => void;
  removeWaypoint: (id: string) => void;
  setLegs: (legs: Leg[]) => void;
  setLegMode: (index: number, mode: TransportMode) => Promise<void>;
  setTemplate: (template: TemplatePreset) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  cameraSmoothness: number;
  setCameraSmoothness: (smoothness: number) => void;
  cameraZoomOffset: number;
  setCameraZoomOffset: (offset: number) => void;
  easingCurve: 'linear' | 'ease-in-out-quad' | 'ease-in-out-cubic' | 'ease-out';
  setEasingCurve: (curve: 'linear' | 'ease-in-out-quad' | 'ease-in-out-cubic' | 'ease-out') => void;
  maxCameraSpeedKmS: number;
  setMaxCameraSpeedKmS: (speed: number) => void;
}

const defaultTrip: Trip = {
  id: 't1',
  name: 'New Trip',
  waypoints: [],
  legs: [],
  cameraKeyframes: [],
  template: {
    preset: 'reels_15s',
    durationS: 15,
    aspectRatio: '9:16'
  },
  style: {
    lineColorByMode: {
      walk: '#4CAF50',
      bike: '#8BC34A',
      motorcycle: '#FFC107',
      drive: '#FF6B35',
      flight: '#2196F3',
      ferry: '#00BCD4'
    },
    trailStyle: 'glow',
    markerIcon: 'pin'
  }
};

export const useTripStore = create<TripState>((set, get) => ({
  trip: defaultTrip,
  currentTime: 0,
  isPlaying: false,
  setWaypoints: (waypoints) => set((state) => ({ trip: { ...state.trip, waypoints } })),
  updateWaypoint: (id, data) => set((state) => ({
    trip: {
      ...state.trip,
      waypoints: state.trip.waypoints.map(w => w.id === id ? { ...w, ...data } : w)
    }
  })),
  addWaypoint: (waypoint) => set((state) => ({
    trip: { ...state.trip, waypoints: [...state.trip.waypoints, waypoint] }
  })),
  removeWaypoint: (id) => set((state) => ({
    trip: { ...state.trip, waypoints: state.trip.waypoints.filter(w => w.id !== id) }
  })),
  setLegs: (legs) => set((state) => ({ trip: { ...state.trip, legs } })),
  setLegMode: async (index, mode) => {
    // Let the UI handle the recalculation, here we just update the mode
    // Actually, calculating route requires fetch, we should do it in the UI or here.
    // It's cleaner to just update the mode and let the user press "Update Routes" 
    // or we can recalculate it right here. Let's just update the state here.
    set((state) => {
      const newLegs = [...state.trip.legs];
      if (newLegs[index]) {
        newLegs[index] = { ...newLegs[index], mode };
      }
      return { trip: { ...state.trip, legs: newLegs } };
    });
  },
  setTemplate: (template) => set((state) => ({ trip: { ...state.trip, template } })),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  cameraSmoothness: 0.05,
  setCameraSmoothness: (cameraSmoothness) => set({ cameraSmoothness }),
  cameraZoomOffset: 0,
  setCameraZoomOffset: (cameraZoomOffset) => set({ cameraZoomOffset }),
  easingCurve: 'ease-in-out-quad',
  setEasingCurve: (easingCurve) => set({ easingCurve }),
  maxCameraSpeedKmS: 0, // 0 = unlimited
  setMaxCameraSpeedKmS: (maxCameraSpeedKmS) => set({ maxCameraSpeedKmS })
}));
