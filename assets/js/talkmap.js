(() => {
  'use strict';
  const node = document.getElementById('talk-map');
  const payload = document.getElementById('talk-map-data');
  if (!node || !payload || typeof L === 'undefined') return;

  let points;
  try {
    points = JSON.parse(payload.textContent);
  } catch (error) {
    return;
  }
  if (!Array.isArray(points) || !points.length) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(node, {
    scrollWheelZoom: false,
    zoomAnimation: !still,
    fadeAnimation: !still,
    markerZoomAnimation: !still
  });

  // Esri's dark canvas serves without an API key and suits the dark surface.
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_';
  L.tileLayer(`${esri}Base/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  }).addTo(map);
  L.tileLayer(`${esri}Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }).addTo(map);

  const pin = L.divIcon({ className: 'talk-pin', html: '<span></span>', iconSize: [16, 16] });

  // Popups are assembled as nodes rather than markup so record text is never parsed as HTML.
  const markers = points.map((point) => {
    const body = document.createElement('div');
    const link = document.createElement('a');
    link.href = point.url;
    link.textContent = point.title;
    const meta = document.createElement('span');
    meta.className = 'talk-pin-meta';
    meta.textContent = `${point.venue} · ${point.location} · ${point.date}`;
    body.append(link, meta);
    return L.marker([point.lat, point.lng], { icon: pin, title: point.title })
      .bindPopup(body)
      .addTo(map);
  });

  map.fitBounds(L.featureGroup(markers).getBounds().pad(0.45));
  if (map.getZoom() > 5) map.setZoom(5);
  node.classList.add('is-ready');
})();
