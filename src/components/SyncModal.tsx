import React, { useState } from 'react';
import {
  X,
  Cloud,
  GitBranch,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check,
  Smartphone,
  Laptop,
  HardDrive,
  Info,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import type { AutoSyncOption } from '../store/useVaultStore';
import { detectCloudDrive } from '../services/cloudDriveDetector';

export const SyncModal: React.FC = () => {
  const {
    isSyncModalOpen,
    toggleSyncModal,
    vaultPath,
    gitStatus,
    autoSyncInterval,
    setAutoSyncInterval,
    lastSyncTime,
    runGitSync,
    openVaultDialog,
  } = useVaultStore();

  const [activeTab, setActiveTab] = useState<'cloud' | 'git' | 'p2p'>('cloud');
  const [customCommitMsg, setCustomCommitMsg] = useState('');

  const cloudDrive = detectCloudDrive(vaultPath);

  if (!isSyncModalOpen) return null;

  const handleManualSync = async () => {
    await runGitSync(customCommitMsg.trim() || undefined);
    setCustomCommitMsg('');
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Nessuna sincronizzazione recente';
    const diff = Math.floor((Date.now() - lastSyncTime) / 1000);
    if (diff < 60) return `Pochi secondi fa`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minuti fa`;
    return new Date(lastSyncTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl apple-card-item shadow-2xl border border-black/10 dark:border-white/15 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
              <Cloud size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Sincronizzazione Vault (Local-First)
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Opzioni semplici, automatiche e senza lock-in per sincronizzare le tue note
              </p>
            </div>
          </div>

          <button
            onClick={toggleSyncModal}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Strip */}
        <div className="px-4 py-2 bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate min-w-0 mr-2">
            <HardDrive size={13} className="text-[var(--accent)] shrink-0" />
            <span className="text-[var(--text-secondary)] shrink-0 font-medium">Vault:</span>
            <span className="text-[var(--text-primary)] font-mono text-[11px] truncate">
              {vaultPath || 'Nessun Vault caricato'}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {cloudDrive.isCloudDrive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>{cloudDrive.provider} Synced</span>
              </span>
            )}
            <div className="flex items-center space-x-1.5 text-[11px] text-[var(--text-muted)]">
              <Clock size={12} />
              <span>{formatLastSync()}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-black/5 dark:border-white/10 px-4 pt-2 gap-2 bg-black/[0.01] dark:bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'cloud'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Cloud size={14} />
            <span>Cartella Cloud {cloudDrive.isCloudDrive ? `(${cloudDrive.providerShort} Attivo)` : '(Consigliato)'}</span>
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'git'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <GitBranch size={14} />
            <span>Git Auto-Sync (Avanzato)</span>
          </button>
          <button
            onClick={() => setActiveTab('p2p')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'p2p'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck size={14} />
            <span>P2P Syncthing</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Cloud Folder (Zero Config - Most User-Friendly) */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              {cloudDrive.isCloudDrive ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <span>Cloud Drive Riconosciuto: {cloudDrive.provider}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                        In Sincronizzazione
                      </span>
                    </div>
                    <p className="text-[#9CA3AF] leading-relaxed">
                      La cartella selezionata fa parte di <strong className="text-[#F3F4F6]">{cloudDrive.provider}</strong>. Le modifiche ai tuoi appunti e flashcard vengono sincronizzate automaticamente e protette sul cloud in tempo reale.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-start space-x-3">
                  <Info size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">
                      Metodo Consigliato: Zero Configurazione & 100% Affidabile
                    </p>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      NoteRip salva tutti i tuoi documenti come normalissimi file <code className="font-mono text-[var(--accent)]">.md</code>.
                      Se collochi la cartella del Vault dentro il tuo servizio cloud (Google Drive, OneDrive, iCloud Drive o Dropbox), la sincronizzazione avverrà <strong>in modo istantaneo e trasparente</strong> in background!
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-primary)]">
                    <Laptop size={14} className="text-blue-400" />
                    <span>OneDrive (Windows)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                    Già integrato in Windows. Crea o sposta la cartella in <code className="font-mono text-[10px]">C:\Users\...\OneDrive\NoteRip</code>.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-primary)]">
                    <Smartphone size={14} className="text-purple-400" />
                    <span>iCloud Drive</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                    Ideale per chi ha Mac, iPad o iPhone. Gli appunti appariranno subito nell'app File o Obsidian mobile.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-primary)]">
                    <HardDrive size={14} className="text-amber-500" />
                    <span>Google Drive / Dropbox</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                    Usa il client desktop di Google Drive o Dropbox per sincronizzare una cartella sul tuo disco locale.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={async () => {
                    await openVaultDialog();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs shadow-apple-sm transition-all"
                >
                  <FolderOpen size={15} />
                  <span>Scegli o Sposta Cartella Vault nel Cloud</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Git Auto-Sync (For Developers & Students) */}
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Frequenza Sincronizzazione Automatica (Background)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'off', label: 'Manuale', desc: 'Solo su richiesta' },
                      { id: 'on_save', label: 'Al Salvataggio', desc: 'Consigliato' },
                      { id: '5m', label: 'Ogni 5 Min', desc: 'Automatico' },
                      { id: '15m', label: 'Ogni 15 Min', desc: 'Periodico' },
                    ] as { id: AutoSyncOption; label: string; desc: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAutoSyncInterval(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        autoSyncInterval === opt.id
                          ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                          : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{opt.label}</span>
                        {autoSyncInterval === opt.id && <Check size={12} className="text-[var(--accent)]" />}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Trigger with Custom Commit Message */}
              <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  Sincronizzazione Manuale Istantanea
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCommitMsg}
                    onChange={(e) => setCustomCommitMsg(e.target.value)}
                    placeholder="Messaggio commit facoltativo (es. Aggiunti appunti C e Java)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={handleManualSync}
                    disabled={gitStatus.isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={gitStatus.isSyncing ? 'animate-spin' : ''} />
                    <span>{gitStatus.isSyncing ? 'Sincronizzazione...' : 'Sincronizza Ora'}</span>
                  </button>
                </div>

                {/* Git Feedback Message */}
                {gitStatus.lastResult && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">{gitStatus.lastResult.message}</div>
                      <div className="text-[10px] opacity-80">
                        File modificati / tracciati: {gitStatus.lastResult.files_changed}
                      </div>
                    </div>
                  </div>
                )}

                {gitStatus.error && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Attenzione</div>
                      <div className="text-[11px] opacity-90">{gitStatus.error}</div>
                      <div className="text-[10px] mt-1 text-[var(--text-muted)]">
                        Assicurati di aver inizializzato un repository Git nella cartella del Vault (<code className="font-mono">git init</code>) e configurato un remote (es. GitHub).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: P2P Syncthing */}
          {activeTab === 'p2p' && (
            <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-2">
                <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Sincronizzazione Peer-to-Peer con Syncthing</span>
                </div>
                <p>
                  Per chi desidera la massima privacy senza affidare i propri appunti a server terzi (come Google, Microsoft o Apple):
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px]">
                  <li>Installa <strong>Syncthing</strong> (open-source e gratuito) sui tuoi computer e smartphone.</li>
                  <li>Aggiungi la cartella del tuo Vault NoteRip come cartella condivisa in Syncthing.</li>
                  <li>I tuoi file si sincronizzeranno direttamente tra i tuoi dispositivi attraverso connessioni crittografate end-to-end.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            Tutti i file rimangono sempre al 100% sotto il tuo controllo locale.
          </span>
          <button
            onClick={toggleSyncModal}
            className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--text-primary)] text-xs font-medium transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
