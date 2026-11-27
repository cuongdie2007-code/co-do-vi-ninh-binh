import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, ExternalLink, Info, Navigation, Star, X } from 'lucide-react';
import { GeoLocation, PersonalRestaurantMeta, Restaurant } from '../types/restaurant';
import {
  buildMapsDirectionUrl,
  calcDistanceKm,
  formatDistance,
  getCrispPhotoUrl,
  getEffectivePrice,
  getRestaurantOpenStatus,
  normalizeShortNeighborhood,
} from '../utils/restaurantUtils';

interface RestaurantsMapViewProps {
  restaurants: Restaurant[];
  anchor: GeoLocation;
  anchorLabel: string;
  isGpsActive: boolean;
  gpsBusy: boolean;
  metaById: Record<string, PersonalRestaurantMeta>;
  mapsApp: 'google' | 'apple';
  onLocateGps: () => void;
  onSelectRestaurant: (r: Restaurant) => void;
}

function getCategoryEmoji(categoryName: string): string {
  const low = (categoryName || '').toLowerCase();
  if (low.includes('lẩu') || low.includes('nướng') || low.includes('bbq')) return '🍲';
  if (low.includes('cá') || low.includes('hải sản') || low.includes('ốc')) return '🐟';
  if (low.includes('cà phê') || low.includes('cafe') || low.includes('trà')) return '🧋';
  if (low.includes('bánh') || low.includes('chè') || low.includes('vặt')) return '🧁';
  if (low.includes('nhậu') || low.includes('bia')) return '🍻';
  if (low.includes('nhật') || low.includes('hàn') || low.includes('pizza')) return '🍱';
  return '🍜';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const RestaurantsMapView: React.FC<RestaurantsMapViewProps> = ({
  restaurants,
  anchor,
  anchorLabel,
  isGpsActive,
  gpsBusy,
  metaById,
  mapsApp,
  onLocateGps,
  onSelectRestaurant,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const anchorLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const validRestaurants = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          Number.isFinite(r.location?.lat) &&
          Number.isFinite(r.location?.lng) &&
          r.location.lat !== 0 &&
          r.location.lng !== 0
      ),
    [restaurants]
  );

  const selectedRestaurant = useMemo(
    () => validRestaurants.find((r) => r.id === selectedId) || null,
    [validRestaurants, selectedId]
  );

  useEffect(() => {
    if (selectedId && !validRestaurants.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, validRestaurants]);

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [anchor.lat, anchor.lng],
      zoom: 14,
      zoomControl: false,
    });

    const primaryTiles = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri · Ninh Bình',
        maxZoom: 18,
      }
    ).addTo(map);

    let fallbackAdded = false;
    primaryTiles.on('tileerror', () => {
      if (fallbackAdded) return;
      fallbackAdded = true;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const anchorGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    map.on('click', () => {
      setSelectedId(null);
    });

    mapRef.current = map;
    anchorLayerRef.current = anchorGroup;
    markersLayerRef.current = markersGroup;

    // Ensure proper size calculation inside animated tab container
    const raf = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      window.cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      anchorLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Recenter softly and update blue anchor pin whenever GPS/anchor changes
  useEffect(() => {
    const map = mapRef.current;
    const anchorLayer = anchorLayerRef.current;
    if (!map || !anchorLayer) return;

    anchorLayer.clearLayers();
    const userIcon = L.divIcon({
      className: '',
      html: `<div class="codovi-map-user-marker" title="${escapeHtml(anchorLabel)}"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker([anchor.lat, anchor.lng], { icon: userIcon, zIndexOffset: 900 }).addTo(anchorLayer);

    if (!selectedId) {
      map.panTo([anchor.lat, anchor.lng], { animate: true, duration: 0.45 });
    }
  }, [anchor.lat, anchor.lng, anchorLabel]);

  // Render restaurant pins inside layer group
  useEffect(() => {
    const layer = markersLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    const now = new Date();
    const capped = validRestaurants.slice(0, 180);

    capped.forEach((r) => {
      const isSelected = r.id === selectedId;
      const open = getRestaurantOpenStatus(r, now);
      const emoji = getCategoryEmoji(r.categoryName);
      const shortTitle = r.title.length > 16 ? `${r.title.slice(0, 15).trim()}…` : r.title;
      const labelHtml = isSelected
        ? `<span>${emoji}</span><span class="codovi-map-pin-name">${escapeHtml(shortTitle)}</span>`
        : `<span>${emoji}</span>${
            r.totalScore ? `<span style="font-size:10px;opacity:0.95">${r.totalScore.toFixed(1)}</span>` : ''
          }`;

      const icon = L.divIcon({
        className: '',
        html: `<div class="codovi-map-pin ${open.isOpenNow ? 'is-open' : ''} ${
          isSelected ? 'is-selected' : ''
        }">${labelHtml}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([r.location.lat, r.location.lng], {
        icon,
        zIndexOffset: isSelected ? 700 : open.isOpenNow ? 250 : 100,
      });

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        setSelectedId(r.id);
        map.panTo([r.location.lat, r.location.lng], { animate: true, duration: 0.4 });
      });

      marker.addTo(layer);
    });
  }, [validRestaurants, selectedId]);

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map || validRestaurants.length === 0) return;
    const points = validRestaurants
      .slice(0, 80)
      .map((r) => [r.location.lat, r.location.lng] as [number, number]);
    points.push([anchor.lat, anchor.lng]);
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15, animate: true });
  };

  const selectedThumb = selectedRestaurant
    ? getCrispPhotoUrl(selectedRestaurant.imageUrl, 240)
    : null;
  const selectedOpen = selectedRestaurant ? getRestaurantOpenStatus(selectedRestaurant) : null;
  const selectedPrice = selectedRestaurant
    ? getEffectivePrice(selectedRestaurant, metaById[selectedRestaurant.id]?.customPrice)
    : null;
  const selectedDist = selectedRestaurant
    ? formatDistance(calcDistanceKm(anchor, selectedRestaurant.location))
    : null;

  return (
    <div className="codovi-map-shell">
      <div ref={containerRef} className="codovi-leaflet-canvas" />

      {/* Top Left Status / Fit Chip */}
      <button
        type="button"
        onClick={handleFitAll}
        className="lg-surface-strong"
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 410,
          borderRadius: 999,
          padding: '6px 11px',
          fontSize: 11.5,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
        title="Thu phóng vừa tất cả quán"
      >
        <span>📍 {validRestaurants.length} quán</span>
        <span style={{ opacity: 0.65 }}>· {isGpsActive ? 'GPS của bạn' : anchorLabel}</span>
      </button>

      {/* Bottom Right Floating Recenter & GPS Button */}
      <button
        type="button"
        onClick={() => {
          onLocateGps();
          mapRef.current?.setView([anchor.lat, anchor.lng], 15, { animate: true });
        }}
        className="lg-surface-strong"
        style={{
          position: 'absolute',
          right: 10,
          bottom: selectedRestaurant ? 148 : 26,
          zIndex: 410,
          width: 42,
          height: 42,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isGpsActive ? '1.5px solid #38bdf8' : '1px solid var(--glass-border)',
          color: isGpsActive ? '#38bdf8' : 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'bottom 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        title="Định vị GPS & về vị trí của tôi"
        aria-label="Định vị GPS của tôi"
      >
        <Crosshair
          size={18}
          style={gpsBusy ? { animation: 'spin 1s linear infinite' } : undefined}
        />
      </button>

      {/* Selected Pin Slide-Up Card or Hint Pill */}
      {selectedRestaurant ? (
        <div className="lg-surface-strong lg-sheen codovi-map-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                overflow: 'hidden',
                flexShrink: 0,
                background: 'rgba(15,23,42,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedThumb ? (
                <img
                  src={selectedThumb}
                  alt={selectedRestaurant.title}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 22 }}>🍜</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedRestaurant.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 3,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                {selectedOpen && (
                  <span
                    className={
                      selectedOpen.isOpenNow ? 'status-open' : 'status-closed'
                    }
                    style={{ fontSize: 10.5, fontWeight: 700 }}
                  >
                    ● {selectedOpen.label}
                  </span>
                )}
                {selectedDist && <span>· {selectedDist}</span>}
                {selectedPrice && (
                  <span className="price-pill-highlight" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {selectedPrice}
                  </span>
                )}
                {selectedRestaurant.totalScore && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                    <Star size={11} fill="#fbbf24" color="#fbbf24" />
                    {selectedRestaurant.totalScore.toFixed(1)}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {normalizeShortNeighborhood(selectedRestaurant)} · {selectedRestaurant.categoryName}
              </div>
            </div>

            <button
              type="button"
              className="apple-icon-btn"
              onClick={() => setSelectedId(null)}
              aria-label="Đóng xem nhanh"
              style={{ width: 28, height: 28, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="lg-btn-accent"
              style={{ flex: 1, minHeight: 36, fontSize: 12.5, borderRadius: 12 }}
              onClick={() => onSelectRestaurant(selectedRestaurant)}
            >
              <Info size={14} /> Xem chi tiết & Thực đơn
            </button>
            <a
              href={buildMapsDirectionUrl(selectedRestaurant, mapsApp)}
              target="_blank"
              rel="noreferrer"
              className="lg-pill"
              style={{
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Navigation size={13} /> Chỉ đường <ExternalLink size={11} />
            </a>
          </div>
        </div>
      ) : (
        <div
          className="lg-surface-strong"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            zIndex: 405,
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Chạm ghim quán để xem nhanh & chỉ đường
        </div>
      )}
    </div>
  );
};
