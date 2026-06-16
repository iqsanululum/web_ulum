'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import HistoryModal from '@/components/HistoryModal';

// Dynamically import Map component to disable SSR for Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div
      className="d-flex justify-content-center align-items-center bg-dark text-light"
      style={{ flexGrow: 1 }}
    >
      Memuat Peta...
    </div>
  ),
});

export default function Home() {
  const [earthquakes, setEarthquakes] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // MQTT States
  const [mqttConfig, setMqttConfig] = useState({
    brokerUrl: 'wss://broker.emqx.io:8084/mqtt',
    topic: 'jember/quake',
  });
  const [mqttStatus, setMqttStatus] = useState('disconnected');

  // ── Load history from database on mount ──────────────────────────────────
  useEffect(() => {
    fetch('/api/earthquakes')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEarthquakes(data);
      })
      .catch((err) => console.error('Failed to load history:', err));
  }, []);

  // ── Helper: save one record to database ──────────────────────────────────
  const saveToDatabase = async (record) => {
    try {
      await fetch('/api/earthquakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    } catch (err) {
      console.error('Failed to save to database:', err);
    }
  };

  // ── MQTT Connection ───────────────────────────────────────────────────────
  useEffect(() => {
    let client = null;
    setMqttStatus('connecting');

    const connectMqtt = async () => {
      try {
        const mqttModule = await import('mqtt');
        const connect =
          mqttModule.connect || mqttModule.default?.connect || mqttModule.default;

        client = connect(mqttConfig.brokerUrl, {
          reconnectPeriod: 5000,
          connectTimeout: 10000,
        });

        client.on('connect', () => {
          setMqttStatus('connected');
          client.subscribe(mqttConfig.topic, (err) => {
            if (err) {
              console.error('MQTT subscribe error:', err);
              setMqttStatus('error');
            }
          });
        });

        client.on('message', (topic, message) => {
          try {
            const rawData = JSON.parse(message.toString());

            const magnitude = parseFloat(rawData.magnitude) || 0;
            const depth     = parseInt(rawData.depth)       || 0;
            const location  = rawData.location              || 'Unknown Location';
            const lat       = parseFloat(rawData.lat)       || 0;
            const lng       = parseFloat(rawData.lng)       || 0;
            const vibration = parseFloat(rawData.vibration) || 0;
            const status    = rawData.status                || 'WASPADA';

            const now = new Date();
            const timeStr =
              now.getHours().toString().padStart(2, '0') + ':' +
              now.getMinutes().toString().padStart(2, '0') + ':' +
              now.getSeconds().toString().padStart(2, '0');

            const newData = {
              id:        Date.now(),
              location,
              lat,
              lng,
              magnitude,
              depth,
              vibration,
              status,
              time: timeStr,
              date: now.toLocaleDateString('id-ID'),
            };

            // Save to MySQL
            saveToDatabase(newData);

            // Update UI (keep last 50 in memory)
            setEarthquakes((prev) => [newData, ...prev].slice(0, 50));
          } catch (e) {
            console.error('Error parsing MQTT message:', e);
          }
        });

        client.on('error', (err) => {
          console.error('MQTT connection error:', err);
          setMqttStatus('error');
        });

        client.on('close', () => setMqttStatus('disconnected'));
      } catch (err) {
        console.error('Failed to load MQTT client:', err);
        setMqttStatus('error');
      }
    };

    connectMqtt();

    return () => {
      if (client) client.end();
    };
  }, [mqttConfig]);

  // ── Clear all history ─────────────────────────────────────────────────────
  const handleClearHistory = async () => {
    try {
      await fetch('/api/earthquakes', { method: 'DELETE' });
      setEarthquakes([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <main>
      <Navbar onOpenHistory={() => setIsHistoryOpen(true)} />
      <div id="main-container">
        <Map earthquakes={earthquakes} />
        <Sidebar
          earthquakes={earthquakes}
          mqttConfig={mqttConfig}
          setMqttConfig={setMqttConfig}
          mqttStatus={mqttStatus}
        />
      </div>
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        earthquakes={earthquakes}
        onClear={handleClearHistory}
      />
    </main>
  );
}
