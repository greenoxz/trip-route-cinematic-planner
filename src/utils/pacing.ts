import type { Waypoint, Leg, CameraKeyframe } from '../types/trip';

export function autoPaceTimeline(legs: Leg[], waypoints: Waypoint[], targetDurationS: number) {
  const pauseTime = 1.5; // 1.5s per waypoint
  const numWaypoints = waypoints.length;
  
  if (numWaypoints < 2) return [];

  let remainingTime = targetDurationS - (numWaypoints * pauseTime);
  if (remainingTime < 0) remainingTime = 0; // fallback if too many waypoints

  let totalWeight = 0;
  legs.forEach(leg => {
    let weight = leg.distanceM;
    if (leg.mode === 'flight') {
      weight *= 0.1; // compress flight time
    }
    totalWeight += weight;
  });

  const pacedLegs = legs.map(leg => {
    let weight = leg.distanceM;
    if (leg.mode === 'flight') {
      weight *= 0.1;
    }
    const ratio = totalWeight > 0 ? weight / totalWeight : 1 / legs.length;
    let legDuration = remainingTime * ratio;
    
    // clamp
    legDuration = Math.max(1.5, Math.min(legDuration, 10));
    
    return {
      ...leg,
      pacedDurationS: legDuration
    };
  });

  // Calculate Keyframes
  const keyframes: CameraKeyframe[] = [];
  let currentTime = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    
    // Arrival at waypoint
    keyframes.push({
      t: currentTime / targetDurationS,
      lng: wp.lng,
      lat: wp.lat,
      alt: 1000,
      heading: 0,
      pitch: 45,
      easing: 'linear',
      cameraMode: 'follow'
    });

    // Stay at waypoint
    currentTime += pauseTime;

    keyframes.push({
      t: currentTime / targetDurationS,
      lng: wp.lng,
      lat: wp.lat,
      alt: 1000,
      heading: 45, // small rotation
      pitch: 45,
      easing: 'linear',
      cameraMode: 'orbit'
    });

    if (i < pacedLegs.length) {
      currentTime += pacedLegs[i].pacedDurationS;
    }
  }

  return keyframes;
}
