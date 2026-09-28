import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHoveredGroup, setIsHoveredGroup] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});

      appWindow
        .onResized(() => {
          appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
    } catch {
      // In web browser dev mode without Tauri window host
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (err) {
      console.warn('Minimize not available outside Tauri:', err);
    }
  };

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    } catch (err) {
      console.warn('ToggleMaximize not available outside Tauri:', err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (err) {
      console.warn('Close not available outside Tauri:', err);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHoveredGroup(true)}
      onMouseLeave={() => setIsHoveredGroup(false)}
      className="flex items-center gap-2 pl-3 pr-1 py-1 shrink-0 z-40 select-none ml-1"
      title="Controlli finestra"
    >
      {/* Minimize (Yellow) */}
      <button
        type="button"
        onClick={handleMinimize}
        className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80 hover:brightness-110 active:scale-90 flex items-center justify-center transition-all cursor-pointer shadow-sm"
        title="Riduci a icona"
      >
        <span
          className={`text-[8px] font-bold text-[#7A4B00] transition-opacity duration-150 leading-none ${
            isHoveredGroup ? 'opacity-100' : 'opacity-0'
          }`}
        >
          –
        </span>
      </button>

      {/* Maximize / Restore (Green) */}
      <button
        type="button"
        onClick={handleToggleMaximize}
        className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/80 hover:brightness-110 active:scale-90 flex items-center justify-center transition-all cursor-pointer shadow-sm"
        title={isMaximized ? 'Ripristina' : 'Ingrandisci a schermo intero'}
      >
        <span
          className={`text-[8px] font-bold text-[#0D5B18] transition-opacity duration-150 leading-none ${
            isHoveredGroup ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {isMaximized ? '⤡' : '+'}
        </span>
      </button>

      {/* Close (Red) */}
      <button
        type="button"
        onClick={handleClose}
        className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/80 hover:brightness-110 active:scale-90 flex items-center justify-center transition-all cursor-pointer shadow-sm"
        title="Chiudi NoteRip"
      >
        <span
          className={`text-[8px] font-bold text-[#5B0B0A] transition-opacity duration-150 leading-none ${
            isHoveredGroup ? 'opacity-100' : 'opacity-0'
          }`}
        >
          ✕
        </span>
      </button>
    </div>
  );
};
