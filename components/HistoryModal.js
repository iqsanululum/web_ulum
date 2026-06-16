'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { exportSinglePDF, exportHistoryPDF } from '@/utils/pdfExport';

export default function HistoryModal({ isOpen, onClose, earthquakes, onClear }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="history-overlay">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="history-modal"
        >
          <div className="history-header">
            <h3><i className="fa-solid fa-clock-rotate-left me-2"></i> Riwayat Getaran</h3>
            <div className="d-flex align-items-center">
                <button 
                    className="btn btn-sm btn-primary me-2" 
                    onClick={() => exportHistoryPDF(earthquakes)}
                    disabled={earthquakes.length === 0}
                >
                    <i className="fa-solid fa-file-pdf me-2"></i> Cetak Semua
                </button>
                <button className="btn btn-sm btn-outline-danger me-2" onClick={onClear}>Hapus Riwayat</button>
                <button className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
          </div>
          <div className="history-body">
            <table className="table table-dark table-hover mb-0">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Lokasi</th>
                  <th>Mag</th>
                  <th>Kedalaman</th>
                  <th>Koordinat</th>
                  <th className="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {earthquakes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">Belum ada riwayat tercatat.</td>
                  </tr>
                ) : (
                  earthquakes.map((q) => (
                    <tr key={q.id}>
                      <td className="text-secondary">{q.date} {q.time}</td>
                      <td className="fw-bold">{q.location}</td>
                      <td><span className="badge" style={{ backgroundColor: q.magnitude >= 6 ? '#ff4757' : (q.magnitude >= 5 ? '#e67e22' : '#f1c40f') }}>{q.magnitude}</span></td>
                      <td>{q.depth} km</td>
                      <td className="text-secondary">{q.lat.toFixed(3)}, {q.lng.toFixed(3)}</td>
                      <td className="text-end">
                        <button 
                            className="btn btn-sm btn-outline-light" 
                            onClick={(e) => {
                                e.stopPropagation();
                                exportSinglePDF(q);
                            }}
                            title="Cetak PDF Detail"
                        >
                            <i className="fa-solid fa-file-pdf"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
