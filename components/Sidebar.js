'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportSinglePDF } from '@/utils/pdfExport';

export default function Sidebar({ earthquakes, mqttConfig, setMqttConfig, mqttStatus }) {
  const [localConfig, setLocalConfig] = useState({
    brokerUrl: mqttConfig?.brokerUrl || '',
    topic: mqttConfig?.topic || ''
  });
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  // Keep local config in sync with parent config
  useEffect(() => {
    if (mqttConfig) {
      setLocalConfig({
        brokerUrl: mqttConfig.brokerUrl,
        topic: mqttConfig.topic
      });
    }
  }, [mqttConfig]);

  const onQuakeClick = (quake) => {
    if (window.__flyToQuake) {
      window.__flyToQuake(quake.id, quake.lat, quake.lng);
    }
  };

  const handleApplyConfig = () => {
    setMqttConfig({
      brokerUrl: localConfig.brokerUrl,
      topic: localConfig.topic
    });
  };

  return (
    <div id="sidebar">
      <div className="sidebar-header d-flex justify-content-between align-items-center">
        <h5>
          <i className="fa-solid fa-wave-square me-2"></i> Log Getaran Jember
        </h5>
        <span className="badge bg-success text-white px-3 py-1 rounded-pill" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
          MQTT Live
        </span>
      </div>

      {/* MQTT Status & Settings Toggle */}
      <div className="px-3 py-2 border-bottom" style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
        <div className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="d-flex align-items-center">
            <span className={`status-dot me-2 rounded-circle ${
              mqttStatus === 'connected' ? 'bg-success' :
              mqttStatus === 'connecting' ? 'bg-warning' : 'bg-danger'
            }`} style={{ 
              width: '8px', 
              height: '8px', 
              display: 'inline-block',
              boxShadow: mqttStatus === 'connected' ? '0 0 10px #2ed573' : (mqttStatus === 'connecting' ? '0 0 10px #f1c40f' : '0 0 10px #ff4757')
            }}></span>
            <span className="small text-secondary" style={{ fontSize: '0.8rem' }}>
              MQTT Status: <strong className={
                mqttStatus === 'connected' ? 'text-success' :
                mqttStatus === 'connecting' ? 'text-warning' : 'text-danger'
              }>
                {mqttStatus === 'connected' ? 'Terhubung' :
                 mqttStatus === 'connecting' ? 'Menghubungkan...' : 'Terputus'}
              </strong>
            </span>
          </div>
          
          <button 
            className="btn btn-sm btn-link p-0 text-secondary hover-text-white transition-all"
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            title="Pengaturan MQTT"
          >
            <i className={`fa-solid ${isConfigExpanded ? 'fa-circle-xmark' : 'fa-gear'}`} style={{ fontSize: '1.1rem' }}></i>
          </button>
        </div>

        {/* Collapsible MQTT Config Panel */}
        <AnimatePresence>
          {isConfigExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mqtt-settings p-3 rounded mt-2" 
              style={{ 
                background: 'rgba(0, 0, 0, 0.3)', 
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden'
              }}
            >
              <div className="mb-2">
                <label className="text-secondary small mb-1" style={{ fontSize: '0.75rem' }}>Broker WebSocket URL</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm bg-dark text-light border-secondary-subtle" 
                  style={{ fontSize: '0.8rem', opacity: 0.8 }}
                  value={localConfig.brokerUrl}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, brokerUrl: e.target.value }))}
                />
              </div>
              
              <div className="mb-3">
                <label className="text-secondary small mb-1" style={{ fontSize: '0.75rem' }}>Topik MQTT</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm bg-dark text-light border-secondary-subtle" 
                  style={{ fontSize: '0.8rem', opacity: 0.8 }}
                  value={localConfig.topic}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, topic: e.target.value }))}
                />
              </div>

              <div className="d-grid gap-2">
                <button 
                  className="btn btn-sm btn-outline-light" 
                  onClick={handleApplyConfig}
                  style={{ fontSize: '0.75rem' }}
                >
                  <i className="fa-solid fa-rotate-right me-1"></i> Terapkan & Hubungkan Kembali
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div id="earthquake-list">
        <AnimatePresence initial={false}>
          {earthquakes.length === 0 ? (
            <div className="text-center text-muted mt-4" id="waiting-msg">
              <div className="spinner-grow spinner-grow-sm text-danger" role="status"></div>
              <p className="mt-2">Menunggu data sensor...</p>
            </div>
          ) : (
            earthquakes.map((data) => {
              let color = '#f1c40f';
              if (data.magnitude >= 5) color = '#e67e22';
              if (data.magnitude >= 6) color = '#e74c3c';

              return (
                <motion.div
                  key={data.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  layout
                  className="quake-item"
                  style={{ borderLeftColor: color }}
                  onClick={() => onQuakeClick(data)}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="q-mag" style={{ color: color }}>
                      {data.magnitude}
                    </span>
                    <div className="d-flex align-items-center">
                        <span className="q-details me-3">
                            <i className="fa-regular fa-clock"></i> {data.time}
                        </span>
                        <button 
                            className="btn btn-sm btn-link p-0 text-light opacity-50 hover-opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                exportSinglePDF(data);
                            }}
                            title="Export PDF"
                        >
                            <i className="fa-solid fa-file-pdf"></i>
                        </button>
                    </div>
                  </div>
                  <div className="q-location">{data.location}</div>
                  <div className="q-details d-flex justify-content-between">
                    <span>
                      <i className="fa-solid fa-water"></i> {data.depth} km
                    </span>
                    <span>
                      <i className="fa-solid fa-location-dot"></i> {data.lat.toFixed(2)}, {data.lng.toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
