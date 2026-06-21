'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function Map({ earthquakes, onMarkerClick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const quakeLayer = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    // Initialize map if not already done
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([-8.1714, 113.7236], 10);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstance.current);

      quakeLayer.current = L.layerGroup().addTo(mapInstance.current);
    }

    // Fix for Leaflet icons not appearing correctly in React/Next.js
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    return () => {
      // Clean up on component unmount
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers when earthquakes data changes
  useEffect(() => {
    if (!quakeLayer.current || !mapInstance.current) return;

    quakeLayer.current.clearLayers();
    markersRef.current = {};

    // Koordinat tetap stasiun sensor di Puger, Jember
    const PUGER_LAT = -8.1714;
    const PUGER_LNG = 113.7236;

    earthquakes.forEach((data) => {
      let color = '#f1c40f'; // Kuning (Kecil)
      let radius = data.magnitude * 3;
      if (data.magnitude >= 5) color = '#e67e22'; // Orange (Sedang)
      if (data.magnitude >= 6) color = '#e74c3c'; // Merah (Besar)

      const marker = L.circleMarker([PUGER_LAT, PUGER_LNG], {
        radius: radius,
        fillColor: color,
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        className: 'pulse-marker'
      }).addTo(quakeLayer.current);

      marker.bindPopup(`
        <strong>Lokasi:</strong> ${data.location}<br>
        <strong>Magnitudo:</strong> ${data.magnitude} SR<br>
        <strong>Kedalaman:</strong> ${data.depth} km<br>
        <strong>Waktu:</strong> ${data.time}
      `);

      // Store marker reference for external control (like flyTo)
      markersRef.current[data.id] = marker;
    });

    // Tampilkan hanya marker terbaru (data pertama = paling baru)
    // Sembunyikan marker lama agar hanya 1 titik yang terlihat
    const ids = Object.keys(markersRef.current);
    ids.forEach((id, index) => {
      if (index > 0) {
        markersRef.current[id].setStyle({ opacity: 0, fillOpacity: 0 });
      }
    });
  }, [earthquakes]);

  // Exposed method to fly to specific coordinates
  useEffect(() => {
    window.__flyToQuake = (id, lat, lng) => {
      // Selalu fly ke titik Puger
      const PUGER_LAT = -8.1714;
      const PUGER_LNG = 113.7236;
      if (mapInstance.current) {
        mapInstance.current.flyTo([PUGER_LAT, PUGER_LNG], 12, { animate: true, duration: 1 });
        if (markersRef.current[id]) {
          markersRef.current[id].openPopup();
        }
      }
    };
  }, []);

  return <div id="map" ref={mapRef}></div>;
}
