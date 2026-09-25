export type TransportMode = 'walk' | 'bike' | 'motorcycle' | 'drive' | 'flight' | 'ferry';

export interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  name: string;
  arriveAt?: string;
  stayMin: number;
}

export interface Leg {
  from: string;
  to: string;
  mode: TransportMode;
  geometry: any; // GeoJSON LineString
  distanceM: number;
  durationS: number;
  arcHeightM?: number;
}

export interface CameraKeyframe {
  t: number; // 0 to 1
  lng: number;
  lat: number;
  alt: number;
  heading: number;
  pitch: number;
  easing: string;
  cameraMode: 'follow' | 'chase' | 'orbit' | 'birds-eye' | 'crane';
}

export interface TemplatePreset {
  preset: string;
  durationS: number;
  aspectRatio: string;
}

export interface Trip {
  id: string;
  name: string;
  waypoints: Waypoint[];
  legs: Leg[];
  cameraKeyframes: CameraKeyframe[];
  template: TemplatePreset;
  style: {
    lineColorByMode: Record<TransportMode, string>;
    trailStyle: string;
    markerIcon: string;
  };
}
