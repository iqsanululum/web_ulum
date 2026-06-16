'use client';
import { useState, useEffect } from 'react';

export default function Navbar({ onOpenHistory }) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('id-ID', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark">
      <div className="container-fluid">
        <div className="d-flex align-items-center">
            <a className="navbar-brand me-4" href="#">
                <i className="fa-solid fa-earth-americas me-2"></i> Jember Area
            </a>
            <button 
                className="btn btn-outline-light btn-sm rounded-pill px-3"
                onClick={onOpenHistory}
            >
                <i className="fa-solid fa-clock-rotate-left me-2"></i> Riwayat
            </button>
        </div>
        <div className="d-flex align-items-center">
          <span className="text-light me-3">
            <span className="status-indicator"></span> System Active
          </span>
          <span className="text-muted" id="current-time">
            {currentTime}
          </span>
        </div>
      </div>
    </nav>
  );
}
