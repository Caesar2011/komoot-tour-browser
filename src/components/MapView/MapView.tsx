import L from 'leaflet';
import { useEffect, useRef } from 'preact/hooks';

import type { TrackEntry } from '../../types.ts';

import { CONFIG } from '../../config.ts';
import styles from './MapView.module.css';

interface Props {
  tracks: TrackEntry[];
}

export function MapView({ tracks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
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

    // Invalidate after mount to fix sizing
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw tracks when they change
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

      if (t.coords.length === 1) {
        const p = t.coords[0];
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 6,
          color: t.color,
          fillColor: t.color,
          fillOpacity: 0.8,
          weight: 2,
        });
        m.bindTooltip(t.name || '', { direction: 'top' });
        markerLayer.addLayer(m);
        bounds.push([p.lat, p.lng]);
      } else {
        const ll: L.LatLngTuple[] = t.coords.map((c) => [c.lat, c.lng]);
        const poly = L.polyline(ll, { color: t.color, weight: 3, opacity: 0.85 });
        poly.bindTooltip(t.name || '', { sticky: true, direction: 'top' });
        trackLayer.addLayer(poly);
        const s = t.coords[0];
        markerLayer.addLayer(
          L.circleMarker([s.lat, s.lng], {
            radius: 5,
            color: '#fff',
            fillColor: t.color,
            fillOpacity: 1,
            weight: 2,
          }),
        );
        bounds.push(...ll);
      }
    }

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }

    // Re-invalidate after track draw
    setTimeout(() => map.invalidateSize(), 50);
  }, [tracks]);

  return (
    <div class={styles.container}>
      <div ref={containerRef} class={styles.map} />
    </div>
  );
}
