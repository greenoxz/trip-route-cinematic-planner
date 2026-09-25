import React, { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTripStore } from '../store/useTripStore';
import * as turf from '@turf/turf';

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const { trip, updateWaypoint, currentTime, isPlaying, cameraSmoothness, cameraZoomOffset, easingCurve } = useTripStore();
  const markersRef = useRef<Record<string, Marker>>({});
  const navigatorMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty', 
      center: [100.5, 13.7], 
      zoom: 5,
      pitch: 45,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      map.addSource('flights', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'routes-layer',
        type: 'line',
        source: 'routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width']
        }
      });
      
      map.addLayer({
        id: 'flights-layer',
        type: 'fill-extrusion',
        source: 'flights',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.8
        }
      });

      // Create Navigation Marker (Arrow)
      const navEl = document.createElement('div');
      navEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5))"><polygon points="12 2 22 22 12 18 2 22"></polygon></svg>`;
      navEl.style.width = '32px';
      navEl.style.height = '32px';
      
      const navMarker = new Marker({ 
        element: navEl, 
        pitchAlignment: 'map', 
        rotationAlignment: 'map' 
      });
      navigatorMarkerRef.current = navMarker;

      mapLoadedRef.current = true;
      setMapLoaded(true);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Sync markers with waypoints
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const waypointIds = new Set(trip.waypoints.map(w => w.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!waypointIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    trip.waypoints.forEach(wp => {
      if (!markersRef.current[wp.id]) {
        const marker = new Marker({ draggable: true, color: '#FF0000' })
          .setLngLat([wp.lng, wp.lat])
          .addTo(map);
        
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          updateWaypoint(wp.id, { lng: lngLat.lng, lat: lngLat.lat });
        });

        markersRef.current[wp.id] = marker;
      } else {
        markersRef.current[wp.id].setLngLat([wp.lng, wp.lat]);
      }
    });
  }, [trip.waypoints, updateWaypoint]);

  // Render Routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('routes') as GeoJSONSource;
    const flightSource = map.getSource('flights') as GeoJSONSource;
    if (!source || !flightSource) return;

    const features2D: any[] = [];
    const features3D: any[] = [];

    trip.legs.forEach(leg => {
      if (!leg.geometry) return;

      const color = trip.style.lineColorByMode[leg.mode] || '#FFF';
      
      if (leg.mode === 'flight') {
        // leg.geometry is a FeatureCollection of 3D segments
        if (leg.geometry.type === 'FeatureCollection') {
          leg.geometry.features.forEach((f: any) => {
            f.properties = { ...f.properties, color };
            features3D.push(f);
          });
        }
      } else {
        let width = 3;
        if (leg.mode === 'walk') width = 2;
        else if (leg.mode === 'drive') width = 4;
        else if (leg.mode === 'bike' || leg.mode === 'motorcycle') width = 3;
        
        features2D.push(turf.feature(leg.geometry, { color, width }));
      }
    });

    source.setData(turf.featureCollection(features2D) as any);
    flightSource.setData(turf.featureCollection(features3D) as any);
  }, [trip.legs, trip.style, mapLoaded]);

  // Camera Animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    if (trip.legs.length === 0) {
      if (navigatorMarkerRef.current && navigatorMarkerRef.current.getLngLat()) {
        navigatorMarkerRef.current.remove();
        // create a new one next time or just reset
      }
      return;
    }

    // --- Dynamic Auto-Pacing Algorithm ---
    // Apply Ease-In-Out curve so the trip starts slowly, speeds up in the middle, and slows down at the end.
    let easedTime = currentTime;
    if (easingCurve === 'ease-in-out-quad') {
      easedTime = currentTime < 0.5 ? 2 * currentTime * currentTime : 1 - Math.pow(-2 * currentTime + 2, 2) / 2;
    } else if (easingCurve === 'ease-in-out-cubic') {
      easedTime = currentTime < 0.5 ? 4 * currentTime * currentTime * currentTime : 1 - Math.pow(-2 * currentTime + 2, 3) / 2;
    } else if (easingCurve === 'ease-out') {
      easedTime = 1 - Math.pow(1 - currentTime, 3);
    }

    // Instead of giving each leg equal time, we allocate time based on a non-linear distance curve,
    // so long flights don't go too fast, and short drives don't take forever.
    const pacedLegs = trip.legs.map(leg => {
      let weight = Math.pow(leg.distanceM || 1000, 0.4); // Logarithmic/power curve for speed normalization
      if (leg.mode === 'flight') weight *= 0.5; // Flights are naturally faster
      return { ...leg, weight };
    });
    
    const totalWeight = pacedLegs.reduce((sum, leg) => sum + leg.weight, 0);
    
    let currentT = 0;
    let activeLegIndex = -1;
    let legProgress = 0;

    for (let i = 0; i < pacedLegs.length; i++) {
      const legDuration = pacedLegs[i].weight / totalWeight;
      const startT = currentT;
      const endT = currentT + legDuration;
      
      if (easedTime >= startT && easedTime <= endT) {
        activeLegIndex = i;
        legProgress = (easedTime - startT) / legDuration;
        break;
      }
      currentT = endT;
    }

    // Edge case if currentTime is exactly 1 or floating point misses
    if (activeLegIndex === -1) {
      activeLegIndex = pacedLegs.length - 1;
      legProgress = 1;
    }

    const legIndex = activeLegIndex;
    const legTime = legProgress;
    // ------------------------------------
      const currentLeg = trip.legs[legIndex];
      if (currentLeg) {
        try {
          let point;
          let bearing = map.getBearing();
          
          if (currentLeg.mode === 'flight') {
            const startPt = trip.waypoints.find(w => w.id === currentLeg.from);
            const endPt = trip.waypoints.find(w => w.id === currentLeg.to);
            if (startPt && endPt) {
              const arc = turf.greatCircle([startPt.lng, startPt.lat], [endPt.lng, endPt.lat]);
              const length = turf.length(arc);
              const currentDist = length * legTime;
              point = turf.along(arc, currentDist);
              
              // Calculate bearing looking ahead
              const pointAhead = turf.along(arc, Math.min(length, currentDist + 50));
              bearing = turf.bearing(point, pointAhead);
            }
          } else if (currentLeg.geometry) {
            const line = turf.lineString(currentLeg.geometry.coordinates);
            const length = turf.length(line);
            const currentDist = length * legTime;
            point = turf.along(line, currentDist);
            
            // Calculate bearing looking ahead
            const pointAhead = turf.along(line, Math.min(length, currentDist + 0.1)); // 100m ahead
            if (currentDist + 0.1 < length) {
              bearing = turf.bearing(point, pointAhead);
            }
          }
          
          if (point) {
            const targetZoom = (currentLeg.mode === 'flight' ? 4 : 14) + cameraZoomOffset;
            const targetPitch = currentLeg.mode === 'flight' ? 30 : 60;
            
            const pointCoords = point.geometry.coordinates as [number, number];
            
            // Update navigator arrow
            if (navigatorMarkerRef.current) {
              const navMarker = navigatorMarkerRef.current;
              navMarker.setLngLat(pointCoords).addTo(map);
              navMarker.setRotation(bearing);
            }

            if (isPlaying) {
               // Smooth interpolation (damping) to prevent dizziness
               const currentBearing = map.getBearing();
               const currentZoom = map.getZoom();
               const currentPitch = map.getPitch();
               
               // Shortest angular distance
               let diff = ((bearing - currentBearing + 540) % 360) - 180;
               const smoothBearing = currentBearing + diff * cameraSmoothness;
               
               const smoothZoom = currentZoom + (targetZoom - currentZoom) * cameraSmoothness;
               const smoothPitch = currentPitch + (targetPitch - currentPitch) * cameraSmoothness;

               map.jumpTo({
                 center: point.geometry.coordinates as [number, number],
                 zoom: smoothZoom,
                 pitch: smoothPitch,
                 bearing: smoothBearing
               });
            } else {
               map.easeTo({
                 center: point.geometry.coordinates as [number, number],
                 zoom: targetZoom,
                 pitch: targetPitch,
                 bearing,
                 duration: 100,
                 easing: (t) => t
               });
            }
          }
        } catch (e) {
          // ignore
        }
      }
  }, [currentTime, trip.legs, isPlaying, cameraSmoothness, cameraZoomOffset, easingCurve]);

  return (
    <div className="absolute inset-0 w-full h-full" ref={mapContainer} />
  );
}

