import L from 'leaflet';
import { useEffect, useRef } from 'preact/hooks';

import type { TrackEntry } from '../../types.ts';

import { CONFIG } from '../../config.ts';
import styles from './MapView.module.css';

interface Props {
  tracks: TrackEntry[];
  onTrackClick?: (tourId: number) => void;
}

export function MapView({ tracks, onTrackClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      zoomControl: true,
    });
    L.tileLayer(CONFIG.TILE_URL, {
      attribution: CONFIG.TILE_ATTR,
      maxZoom: 19,
    }).addTo(map);

    trackLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const trackLayer = trackLayerRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !trackLayer || !markerLayer) return;

    trackLayer.clearLayers();
    markerLayer.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    for (const t of tracks) {
      if (!t.coords || t.coords.length === 0) continue;

      const handleClick = () => onTrackClick?.(t.tourId);

      if (t.coords.length === 1) {
        const p = t.coords[0];
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color: '#fff',
          fillColor: t.color,
          fillOpacity: 0.9,
          weight: 2,
          interactive: true,
        });
        m.bindTooltip(t.name || '', { direction: 'top' });
        m.on('click', handleClick);
        markerLayer.addLayer(m);
        bounds.push([p.lat, p.lng]);
      } else {
        const ll: L.LatLngTuple[] = t.coords.map((c) => [c.lat, c.lng]);
        const poly = L.polyline(ll, {
          color: t.color,
          weight: 3,
          opacity: 0.85,
          interactive: true,
        });
        poly.bindTooltip(t.name || '', { sticky: true, direction: 'top' });
        poly.on('click', handleClick);
        trackLayer.addLayer(poly);

        const s = t.coords[0];
        const startMarker = L.circleMarker([s.lat, s.lng], {
          radius: 5,
          color: '#fff',
          fillColor: t.color,
          fillOpacity: 1,
          weight: 2,
        });
        startMarker.on('click', handleClick);
        markerLayer.addLayer(startMarker);
        bounds.push(...ll);
      }
    }

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [tracks, onTrackClick]);

  return (
    <div class={styles.container}>
      <div ref={containerRef} class={styles.map} />
    </div>
  );
}
