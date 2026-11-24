/**
 * MapLibre map showing a trip's route line and numbered stop markers.
 * Figma: "Screen 2 · Trip Detail" (div.map) and "Screen 3 · Trip Editor".
 *
 * The route comes from each Segment's cached GeoJSON, so viewing a trip never
 * calls the routing API. Estimated legs (no routing key configured) are dashed.
 */
import type { Segment } from '@roadtrip/shared';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './map.css';

const MAP_STYLE =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) ?? 'https://tiles.openfreemap.org/styles/liberty';

interface MapStop {
  id?: string;
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  stops: MapStop[];
  segments: Segment[];
  className?: string;
  /** Highlight one stop's marker (e.g. hovered in the list). */
  activeStopId?: string | null;
  onStopClick?: (index: number) => void;
  children?: ReactNode;
}

function routeData(stops: MapStop[], segments: Segment[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = segments.length
    ? segments.map((s) => ({
        type: 'Feature',
        properties: { estimate: s.isEstimate },
        geometry: s.geometry ?? { type: 'LineString', coordinates: [] },
      }))
    : // Unsaved edits: draw straight lines until the server returns routes.
      stops.slice(1).map((s, i) => ({
        type: 'Feature',
        properties: { estimate: true },
        geometry: {
          type: 'LineString',
          coordinates: [
            [stops[i]!.lng, stops[i]!.lat],
            [s.lng, s.lat],
          ],
        },
      }));
  return { type: 'FeatureCollection', features };
}

export function TripMap({ stops, segments, className, activeStopId, onStopClick, children }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: MAP_STYLE,
      center: [-122.3, 47.6],
      zoom: 5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b0b0b', 'line-width': 9 },
      });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        filter: ['!=', ['get', 'estimate'], true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e1ac10', 'line-width': 5 },
      });
      map.addLayer({
        id: 'route-estimate',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'estimate'], true],
        paint: { 'line-color': '#e1ac10', 'line-width': 4, 'line-dasharray': [2, 1.5] },
      });
      setLoaded(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Route line + markers whenever the trip changes.
  const stopsKey = stops.map((s) => `${s.lat},${s.lng}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource('route') as GeoJSONSource).setData(routeData(stops, segments));

    markers.current.forEach((m) => m.remove());
    markers.current = stops.map((s, i) => {
      const el = document.createElement('button');
      el.className = 'map-marker';
      el.textContent = String(i + 1);
      el.title = s.name;
      el.setAttribute('aria-label', `Stop ${i + 1}: ${s.name}`);
      if (s.id) el.dataset.stopId = s.id;
      el.addEventListener('click', () => onStopClick?.(i));
      return new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, stopsKey, segments]);

  // Fit the map to the trip when the set of stops changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || stops.length === 0) return;
    if (stops.length === 1) {
      map.easeTo({ center: [stops[0]!.lng, stops[0]!.lat], zoom: 9 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, stopsKey]);

  useEffect(() => {
    markers.current.forEach((m) =>
      m.getElement().classList.toggle('active', m.getElement().dataset.stopId === activeStopId),
    );
  }, [activeStopId, stopsKey]);

  return (
    <div className={`map ${className ?? ''}`}>
      <div ref={container} className="map-canvas" />
      {children}
    </div>
  );
}
