import L from 'leaflet';
import { useEffect, useRef } from 'preact/hooks';

import type { TrackEntry } from '../../types.ts';
import { CONFIG } from '../../config.ts';

import styles from './MapView.module.css';

interface Props {
  tracks: TrackEntry[];
  onTrackClick?: (tourId: number) => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTooltipContent(t: TrackEntry): string {
  const name = escapeHtml(t.name || '');
  if (t.coverImageUrl) {
    return `<div style="text-align:center"><img src="${escapeHtml(t.coverImageUrl)}" style="width:${CONFIG.COVER_IMAGE_WIDTH}px;height:${CONFIG.COVER_IMAGE_HEIGHT}px;object-fit:cover;border-radius:4px;display:block;margin-bottom:4px" alt="" /><div style="font-size:12px;font-weight:600">${name}</div></div>`;
  }
  return name;
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

    const resizeObs = new ResizeObserver(() => map.invalidateSize());
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
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

    const { MAP_STYLES } = CONFIG;
    const bounds: L.LatLngTuple[] = [];

    for (const t of tracks) {
      if (!t.coords || t.coords.length === 0) continue;

      const handleClick = () => onTrackClick?.(t.tourId);
      const tooltipContent = buildTooltipContent(t);
      const tooltipOpts: L.TooltipOptions = {
        direction: 'top',
        ...(t.coverImageUrl ? { className: 'cover-tooltip' } : {}),
      };

      if (t.coords.length === 1) {
        const p = t.coords[0];
        const m = L.circleMarker([p.lat, p.lng], {
          radius: MAP_STYLES.MARKER_RADIUS,
          color: '#fff',
          fillColor: t.color,
          fillOpacity: 0.9,
          weight: MAP_STYLES.MARKER_WEIGHT,
          interactive: true,
        });
        m.bindTooltip(tooltipContent, tooltipOpts);
        m.on('click', handleClick);
        markerLayer.addLayer(m);
        bounds.push([p.lat, p.lng]);
      } else {
        const ll: L.LatLngTuple[] = t.coords.map((c) => [c.lat, c.lng]);
        const poly = L.polyline(ll, {
          color: t.color,
          weight: MAP_STYLES.TRACK_WEIGHT,
          opacity: MAP_STYLES.TRACK_OPACITY,
          interactive: true,
        });
        poly.bindTooltip(tooltipContent, { ...tooltipOpts, sticky: true });
        poly.on('click', handleClick);
        trackLayer.addLayer(poly);

        const s = t.coords[0];
        const startMarker = L.circleMarker([s.lat, s.lng], {
          radius: MAP_STYLES.START_MARKER_RADIUS,
          color: '#fff',
          fillColor: t.color,
          fillOpacity: 1,
          weight: MAP_STYLES.START_MARKER_WEIGHT,
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
