# NoteRip 📝⚡

**NoteRip** è un'applicazione desktop moderna, ultra-veloce e locale per la gestione di note, basi di conoscenza personali (PKM), grafi di connessione e snippet di codice. Costruita su **Tauri v2**, **Rust** e **React 19**, NoteRip garantisce la massima privacy mantenendo tutti i tuoi file in formato Markdown locale all'interno del tuo Vault.

---

## ✨ Funzionalità Principali

- 📂 **Local-First Vault**: I tuoi dati rimangono sul tuo computer in file standard `.md` organizzati in cartelle gerarchiche.
- ⚡ **Prestazioni Elevate**: Backend leggero e nativo in Rust con interfaccia reattiva in React 19 + TypeScript.
- 🌐 **Graph View Dinamica**: Visualizzazione interattiva dei collegamenti bidirezionali (`[[Note]]`) basata su D3 Force Simulation.
- 💻 **Snippet Runner Nativo**: Esecuzione diretta di snippet di codice in C, C++ e Java con output in tempo reale.
- 🧮 **Supporto Matematico & Diagrammi**: Rendering KaTeX per formule LaTeX e Mermaid.js per diagrammi di flusso e architetture.
- 🃏 **Sistema Flashcard**: Studio e ripasso attivo delle note con flashcard integrate.
- 🔄 **Sincronizzazione Git Integrata**: Commit e push automatici delle note su repository Git remoto con un click.
- 🔍 **Ricerca Rapida & Command Palette**: Ricerca full-text e accesso rapido alle azioni (`Ctrl + K`).

---

## 🛠️ Stack Tecnologico

- **Core & Backend Nativo**: [Tauri v2](https://v2.tauri.app/), [Rust](https://www.rust-lang.org/)
- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Stile & Design**: [TailwindCSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Rendering & Parser**: KaTeX, Mermaid.js, PrismJS, D3.js

---

## 📁 Struttura del Progetto

```plaintext
NoteRip/
├── .github/                   # Workflow CI/CD e configurazioni GitHub (opzionale)
├── public/                    # Asset statici (icone, favicon)
├── src/                       # Frontend React + TypeScript
│   ├── assets/                # Immagini, icone e loghi
│   ├── components/            # Componenti UI (Editor, Sidebar, GraphView, ecc.)
│   ├── services/              # Logica di business (indexer, flashcard, IPC bridge)
│   ├── store/                 # State management globale (Zustand vault store)
│   ├── types/                 # Definizioni TypeScript per note, nodi e configurazioni
│   ├── App.tsx                # Layout principale dell'applicazione
│   └── index.css              # Stili globali e configurazione Tailwind
├── src-tauri/                 # Backend Rust Tauri v2
│   ├── capabilities/          # Permessi e ACL per Tauri v2
│   ├── icons/                 # Icone per bundle desktop
│   ├── src/
│   │   ├── main.rs            # Entrypoint binario Tauri
│   │   ├── lib.rs             # Registrazione comandi IPC
│   │   └── vault.rs           # Gestione I/O file, Git sync e Code Runner
│   ├── Cargo.toml             # Dipendenze Rust
│   └── tauri.conf.json        # Configurazione bundle e finestre Tauri
├── package.json               # Dipendenze npm e script di build
├── tailwind.config.js         # Configurazione tema e design system
├── tsconfig.json              # Configurazione compilatore TypeScript
└── vite.config.ts             # Configurazione bundler Vite
```

---

## 🚀 Prerequisiti

Prima di iniziare, assicurati di avere installato sul tuo sistema:
1. **Node.js** (versione 18 o superiore) & **npm**
2. **Rust** & **Cargo** (installabili tramite [rustup.rs](https://rustup.rs/))
3. **Microsoft C++ Build Tools** (su Windows) o toolchain equivalente
4. (Opzionale) **GCC/Clang** e **JDK/Javac** nel PATH per eseguire snippet di codice C/C++ o Java

---

## 💻 Installazione e Sviluppo Locale

1. **Clona il repository**:
   ```bash
   git clone https://github.com/<username>/NoteRip.git
   cd NoteRip
   ```

2. **Installa le dipendenze npm**:
   ```bash
   npm install
   ```

3. **Avvia l'ambiente di sviluppo Tauri**:
   ```bash
   npm run tauri dev
   ```

4. **Compila il pacchetto di produzione (installer per Windows)**:
   ```bash
   npm run tauri build
   ```
   L'eseguibile di installazione verrà generato in `src-tauri/target/release/bundle/nsis/`.

---

## 📄 Licenza

Distribuito sotto licenza MIT. Consulta `LICENSE` per maggiori informazioni.
