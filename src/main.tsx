import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import './styles/enscribe.css';
import './styles/guessit.css';
import './styles/hubRedesign.css';
import './styles/twistit.css';
import './styles/changeit.css';
import './styles/crushit.css';

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  StatusBar.setBackgroundColor({ color: '#0D1D68' }).catch(() => undefined);
  StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
