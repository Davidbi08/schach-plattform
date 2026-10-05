'use client';

import { useEffect } from 'react';

export default function OfflineRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  return null;
}
