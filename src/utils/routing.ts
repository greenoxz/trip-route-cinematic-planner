import type { Waypoint, Leg, TransportMode } from '../types/trip';
import * as turf from '@turf/turf';
import searoute from 'searoute-js';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

export async function calculateRoute(from: Waypoint, to: Waypoint, mode: TransportMode): Promise<Leg> {
  let geometry: any;
  let distanceM = 0;
  let durationS = 0;
  let arcHeightM = 0;

  const startCoord = [from.lng, from.lat];
  const endCoord = [to.lng, to.lat];

  if (mode === 'drive' || mode === 'walk' || mode === 'bike' || mode === 'motorcycle') {
    let profile = 'driving';
    if (mode === 'walk') profile = 'foot';
    if (mode === 'bike' || mode === 'motorcycle') profile = 'bike'; // use bike profile for 2-wheelers

    const url = `${OSRM_BASE}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        geometry = data.routes[0].geometry;
        distanceM = data.routes[0].distance;
        durationS = data.routes[0].duration;
      } else {
        throw new Error('No route found');
      }
    } catch (e) {
      console.error(e);
      // Fallback to straight line
      geometry = turf.lineString([startCoord, endCoord]).geometry;
      distanceM = turf.distance(startCoord, endCoord, { units: 'meters' });
      durationS = distanceM / (mode === 'drive' ? 13.8 : 1.4); // 50km/h or 5km/h
    }
  } else if (mode === 'flight') {
    const arc = turf.greatCircle(startCoord, endCoord, { properties: { mode: 'flight' } });
    distanceM = turf.distance(startCoord, endCoord, { units: 'meters' });
    durationS = distanceM / 250; // roughly 900 km/h
    arcHeightM = Math.min(distanceM * 0.1, 15000); // max 15km high

    // Add Z coordinate (parabola) and convert to 3D fill-extrusion segments
    if (arc.geometry && arc.geometry.coordinates) {
      const coords = arc.geometry.coordinates;
      const numPoints = Math.max(coords.length, 100); 
      // We should probably just use turf.lineChunk or regenerate high-res curve
      
      const features = [];
      const steps = 100;
      for (let j = 0; j < steps; j++) {
        const progress1 = j / steps;
        const progress2 = (j + 1) / steps;
        
        const pt1 = turf.along(arc, progress1 * distanceM, { units: 'meters' }).geometry.coordinates;
        const pt2 = turf.along(arc, Math.min(progress2 * distanceM, distanceM), { units: 'meters' }).geometry.coordinates;
        
        const z1 = 4 * arcHeightM * progress1 * (1 - progress1);
        const z2 = 4 * arcHeightM * progress2 * (1 - progress2);
        
        // Create a small thick polygon (like a tube or thick line)
        const segmentLine = turf.lineString([pt1, pt2]);
        const buffered = turf.buffer(segmentLine, 2, { units: 'kilometers' }); // 2km wide line
        
        if (buffered) {
          buffered.properties = {
            mode: 'flight',
            base: Math.max(0, Math.min(z1, z2) - 100), // thin height
            height: Math.max(10, Math.max(z1, z2) + 100)
          };
          features.push(buffered);
        }
      }
      geometry = turf.featureCollection(features).geometry; // Actually, just store the feature collection in geometry for flights
      // Wait, leg.geometry is supposed to be a LineString. If we change it to FeatureCollection, we need to adapt MapView.
      // I'll just return the FeatureCollection as the geometry!
      geometry = turf.featureCollection(features);
    }
  } else if (mode === 'ferry') {
    try {
      // searoute.default is often required for some packages depending on CJS/ESM
      const route = typeof searoute === 'function' ? searoute(startCoord, endCoord) : (searoute as any).default(startCoord, endCoord);
      geometry = route.geometry;
      distanceM = route.properties.length * 1000; // Assuming length in km
      durationS = distanceM / 10; // roughly 36 km/h
    } catch (e) {
      console.error(e);
      const arc = turf.greatCircle(startCoord, endCoord);
      geometry = arc.geometry;
      distanceM = turf.distance(startCoord, endCoord, { units: 'meters' });
      durationS = distanceM / 10;
    }
  }

  return {
    from: from.id,
    to: to.id,
    mode,
    geometry,
    distanceM,
    durationS,
    arcHeightM
  };
}

export async function calculateAllLegs(waypoints: Waypoint[], existingLegs: Leg[] = [], defaultMode: TransportMode = 'drive'): Promise<Leg[]> {
  const legs: Leg[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    
    // Check if we already have a leg for this pair with a specific mode
    const existingLeg = existingLegs.find(l => l.from === from.id && l.to === to.id);
    let mode = existingLeg ? existingLeg.mode : defaultMode;

    if (!existingLeg) {
      // Auto-detect flight if > 300km as a simple heuristic
      const dist = turf.distance([from.lng, from.lat], [to.lng, to.lat], { units: 'kilometers' });
      if (dist > 300) mode = 'flight';
    }

    const leg = await calculateRoute(from, to, mode);
    legs.push(leg);
  }
  return legs;
}
