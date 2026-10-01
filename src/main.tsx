import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import 'katex/dist/katex.min.css';
import App from './App.tsx';


import { useVaultStore } from './store/useVaultStore';

// Eliminate browser-native dropdown banners ("tauri.localhost says ...") globally
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    try {
      useVaultStore.getState().showToast(String(message ?? ''), 'info');
    } catch {
      console.warn('Alert intercepted:', message);
    }
  };
  window.confirm = (message?: string) => {
    console.warn('Sync window.confirm intercepted to prevent browser dialog ("tauri.localhost says"). Use requestConfirm() instead:', message);
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
