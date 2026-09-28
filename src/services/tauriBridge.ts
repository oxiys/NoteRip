import type { FileNode, GitSyncResult, CodeRunResult } from '../types';


// Check if running inside Tauri v2 environment
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Lazy invoke import for Tauri v2
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// In-Memory / LocalStorage Mock for Dev Preview in Browser
const MOCK_STORAGE_KEY = 'noterip_mock_vault_v1';

interface MockVaultData {
  vaultPath: string;
  files: Record<string, string>; // path -> content
}

const DEFAULT_MOCK_FILES: Record<string, string> = {
  '00 - Precorsi/Logica Booleana e Insiemi.md': `# Logica Booleana e Insiemi

Fondamenti logici e matematici propedeutici ai corsi di informatica ed elettronica.

### Argomenti:
- Proposizioni logiche e connettivi (AND, OR, NOT)
- Tabelle di verità e tautologie
- Insiemi, unione, intersezione e complementare
- Riferimenti collegati ad [[01 - Corsi/Architettura degli Elaboratori/Algebra di Boole e Reti Combinatorie 1 - Porte e Forme Canoniche]].

#precorsi #logica #matematica`,

  '01 - Corsi/Architettura degli Elaboratori/Algebra di Boole e Reti Combinatorie 1 - Porte e Forme Canoniche.md': `# Algebra di Boole e Reti Combinatorie 1 - Porte e Forme Canoniche

Introduzione all'algebra booleana, alle funzioni logiche e alle porte hardware elementari.

### Porte Logiche Fondamentali:
- **AND**: $Y = A \\cdot B$
- **OR**: $Y = A + B$
- **NOT**: $Y = \\bar{A}$
- **NAND / NOR**: insiemi funzionalmente completi

\`\`\`mermaid
graph LR
    A[Ingresso A] --> AND[Porta AND]
    B[Ingresso B] --> AND
    AND --> Y[Uscita Y = A AND B]
\`\`\`

Vedi il proseguimento in [[01 - Corsi/Architettura degli Elaboratori/Algebra di Boole e Reti Combinatorie 2 - Assiomi e Semplificazioni]].

#architettura #boole #hardware #porte`,

  '01 - Corsi/Architettura degli Elaboratori/Algebra di Boole e Reti Combinatorie 2 - Assiomi e Semplificazioni.md': `# Algebra di Boole e Reti Combinatorie 2 - Assiomi e Semplificazioni

Assiomi dell'algebra booleana, teoremi di De Morgan e mappe di Karnaugh per la minimizzazione delle reti.

### Teoremi di De Morgan:
$$\\overline{A \\cdot B} = \\bar{A} + \\bar{B}$$
$$\\overline{A + B} = \\bar{A} \\cdot \\bar{B}$$

### Forme Canoniche:
1. **SOP (Sum of Products)**: somma di mintermini $\\sum m$
2. **POS (Product of Sums)**: prodotto di maxtermini $\\prod M$

Collega con [[01 - Corsi/Architettura degli Elaboratori/Codifica dei Caratteri Alfanumerici]] per la codifica numerica.

#architettura #demorgan #karnaugh #reti`,

  '01 - Corsi/Architettura degli Elaboratori/Codifica dei Caratteri Alfanumerici.md': `# Codifica dei Caratteri Alfanumerici

Rappresentazione di testo, simboli e caratteri mediante sequenze binarie.

- **ASCII standard (7 bit)**: 128 caratteri
- **ASCII esteso (8 bit)**: 256 caratteri (ISO 8859-1)
- **Unicode (UTF-8, UTF-16)**: standard moderno multi-byte universale.

Vedi anche [[01 - Corsi/Architettura degli Elaboratori/Sistema binario e operazioni]].

#architettura #codifica #ascii #unicode`,

  '01 - Corsi/Architettura degli Elaboratori/Sistema binario e operazioni.md': `# Sistema binario e operazioni

Aritmetica binaria, complemento a due e gestione dell'overflow nella ALU.

### Aritmetica e Addizione Binaria:
L'addizione in binario si esegue colonna per colonna da destra a sinistra (LSB verso MSB) sommando le cifre binarie secondo le regole elementari:
- $0 + 0 = 0$
- $0 + 1 = 1$
- $1 + 0 = 1$
- $1 + 1 = 0$ con riporto di $1$ (in quanto $1+1 = 2_{10} = 10_2$)
- $1 + 1 + 1 = 1$ con riporto di $1$ ($3_{10} = 11_2$)

### Rappresentazione in Complemento a 2:
Dato un numero a $n$ bit:
$$N = -b_{n-1} 2^{n-1} + \sum_{i=0}^{n-2} b_i 2^i$$

### 🧠 Flashcards per Ripasso (SM-2):
Come si calcola il complemento a due di un numero binario?::Invertendo tutti i bit (complemento a 1) e sommando 1 al bit meno significativo (LSB).
Nel formato standard IEEE 754 a 32 bit, l'esponente occupa {c1::8 bit} con un bias di {c2::127}.
Il massimo valore intero positivo rappresentabile con 8 bit senza segno è {c1::255 ($2^8-1$)}.

#architettura #binario #alu #complemento`,

  '01 - Corsi/Architettura degli Elaboratori/Storia e rappresentazione dell\'informazione.md': `# Storia e rappresentazione dell'informazione

Evoluzione delle architetture computazionali: dal modello di Von Neumann ai moderni calcolatori paralleli.

- **Architettura di Von Neumann**: CPU, Bus, Memoria Principale e I/O unificati.
- **Concetto di bit e byte**: unità minime di misura dell'informazione.

#architettura #storia #von-neumann`,

  '01 - Corsi/Programmazione/Linguaggio C e Puntatori.md': `# Linguaggio C e Puntatori

Studio del linguaggio C per la programmazione di sistema, gestione della memoria e puntatori.

\`\`\`c
#include <stdio.h>

int main(void) {
    int valore = 100;
    int *ptr = &valore;
    printf("Valore: %d, Indirizzo: %p\\n", *ptr, (void*)ptr);
    return 0;
}
\`\`\`

### 🧠 Flashcards:
Qual è la differenza fondamentale tra malloc() e calloc()?::malloc alloca memoria grezza non azzerata, mentre calloc azzera a zero tutti i byte allocati.
Un puntatore a {c1::void (void*)} in C può puntare a qualsiasi tipo, ma non può essere {c2::dereferenziato} direttamente senza un cast di tipo.
Cosa restituisce l'operatore sizeof() in C?::La dimensione in byte del tipo o della variabile specificata.

#programmazione #c #puntatori`,

  '01 - Corsi/Programmazione Object-Oriented/Classi e Polimorfismo Java.md': `# Classi e Polimorfismo Java

Principi di OOP: incapsulamento, ereditarietà, interfacce e polimorfismo dinamico.

\`\`\`java
public class Animale {
    public void emettiVerso() {
        System.out.println("Verso generico");
    }
}
\`\`\`

#oop #java #polimorfismo`,

  'Images/.keep': '',
  'Computer Science/Algoritmi e Strutture Dati.md': `# Algoritmi e Strutture Dati

Studio dei fondamenti computazionali per l'analisi di complessità e le strutture dati avanzate.

### Concetti Chiave:
- Complessità asintotica (Big O, Omega, Theta)
- Grafi e visite: DFS, BFS
- Strutture ad albero: AVL, Red-Black Trees, Heap
- Collegamento diretto a [[Teoria dei Grafi]] per la formulazione matematica.

> [!NOTE]
> Ricorda di consultare gli appunti di [[Sistemi Operativi]] per l'impatto della cache sull'efficienza degli algoritmi.

#algoritmi #informatica #esami`,

  'Computer Science/Teoria dei Grafi.md': `# Teoria dei Grafi

Un grafo $G = (V, E)$ consiste in un insieme di vertici $V$ e archi $E$.

### Rappresentazioni Comuni:
1. **Matrice di adiacenza**: ottima per grafi densi $O(V^2)$.
2. **Liste di adiacenza**: ideale per grafi sparsi $O(V + E)$.

### Algoritmi su Grafi:
- Minimo cammino: Dijkstra, Bellman-Ford
- Minimum Spanning Tree (MST): Kruskal, Prim
- Vedi implementazione pratica in [[Algoritmi e Strutture Dati]].

Utilizzato fortemente anche in [[Sistemi Distribuiti]] per il consenso di rete.

#matematica #grafi #algoritmi`,

  'Computer Science/Sistemi Operativi.md': `# Sistemi Operativi

Architettura del kernel, gestione della memoria e concorrenza.

### Temi Principali:
- Gestione della CPU: Scheduling (Round Robin, CFS, Priorità)
- Memoria Virtuale e Paginazione (TLB, Page Fault)
- Concorrenza: Mutex, Semafori, Monitor e Deadlock detection.
- Per l'allocazione delle risorse, si usano gli algoritmi analizzati in [[Algoritmi e Strutture Dati]].

Questo corso si collega direttamente alla scalabilità in [[Sistemi Distribuiti]].

### 🧠 Flashcards Esame Sistemi Operativi:
Cos'è un semaforo di Dijkstra?::Una variabile intera sincronizzata attraverso operazioni atomiche P() (wait) e V() (signal) per la mutua esclusione.
Quali sono le 4 condizioni di Coffman necessarie affinché si verifichi un Deadlock?::1. Mutua esclusione, 2. Possesso e attesa, 3. Nessuna prelazione, 4. Attesa circolare.
L'algoritmo del {c1::Banchiere di Dijkstra} viene impiegato per {c2::l'evitamento (avoidance)} dei deadlock negli OS.

#sistemi #kernel #concorrenza`,

  'Computer Science/Sistemi Distribuiti.md': `# Sistemi Distribuiti

Studio di sistemi composti da nodi multipli autonomi che comunicano via rete.

### Argomenti Fondamentali:
- Teorema CAP (Consistenza, Disponibilità, Tolleranza alle partizioni)
- Algoritmi di Consenso: Paxos, Raft
- Modello di clock logico: Lamport Timestamps e Vector Clocks
- Riferimenti a [[Teoria dei Grafi]] per la topologia di rete peer-to-peer.
- Connessione con il threading visto in [[Sistemi Operativi]].

#distribuito #network #cloud`,

  'Programmazione/C e Java in NoteRip.md': `# Sviluppo in C e Java con NoteRip

NoteRip supporta diagrammi interattivi Mermaid ed esecuzione diretta dei tuoi snippet di codice **C** e **Java**!

### 1. Diagramma Architetturale (Mermaid)
\`\`\`mermaid
graph TD
    User([Studente / Developer]) --> Write[Scrittura Appunti Markdown]
    Write --> CodeBlocks[Blocchi di Codice C & Java]
    CodeBlocks --> RunBtn[Pulsante "Esegui"]
    RunBtn --> Runner[Tauri Backend Core]
    Runner --> Compiler{Compilatore Locale}
    Compiler -- C --> GCC[GCC / Clang]
    Compiler -- Java --> JDK[Javac / OpenJDK]
    GCC --> Output[Terminale Integrato]
    JDK --> Output
\`\`\`

### 2. Snippet di Codice C (Eseguibile)
Clicca sul pulsante **Esegui** in alto a destra per compilare con GCC/Clang:

\`\`\`c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("Ciao dal codice C eseguito dentro NoteRip!\\n");
    int somma = 0;
    for (int i = 1; i <= 5; i++) {
        somma += i;
        printf("Passo %d: somma corrente = %d\\n", i, somma);
    }
    printf("Risultato finale: %d\\n", somma);
    return 0;
}
\`\`\`

#### Layout della Memoria (Puntatori & Allocazione Dinamica):
\`\`\`mermaid
graph LR
    subgraph STACK ["Memoria Stack"]
        PTR["int* p<br/>Indirizzo: 0x7ffd20"]
    end
    subgraph HEAP ["Memoria Heap (malloc)"]
        VAL["Valore: 42<br/>Indirizzo: 0x1050"]
    end
    PTR -->|punta a| VAL
\`\`\`

Vedi anche [[Algoritmi e Strutture Dati]] e [[Sistemi Operativi]] per l'impatto della memoria virtuale.

---

### 3. Snippet di Codice Java (Eseguibile)
\`\`\`java
public class Main {
    public static void main(String[] args) {
        System.out.println("Esecuzione di classe Java su NoteRip!");
        String[] materie = {"Algoritmi", "Sistemi Operativi", "Basi di Dati"};
        for (String m : materie) {
            System.out.println(" - Modulo: " + m);
        }
    }
}
\`\`\`

#### Gerarchia delle Classi (UML Mermaid):
\`\`\`mermaid
classDiagram
    class StrutturaDati {
        <<interface>>
        +size() int
        +isEmpty() boolean
    }
    class ListaConcatenata {
        +size() int
        +isEmpty() boolean
    }
    StrutturaDati <|.. ListaConcatenata : implements
\`\`\`

#programmazione #c #java #mermaid #codice`,

  'Benvenuto su NoteRip.md': `# Benvenuto su NoteRip 

Un'applicazione per appunti accademici **Local-First**, veloce, elegante ed ispirata a macOS Sequoia & iPadOS Notes.

### Funzionalità Principali:
- **Local-First al 100%**: tutti i tuoi appunti sono file Markdown plain-text (\`.md\`) salvati sul tuo disco.
- **Sincronizzazione Gratuita**: Salva il tuo Vault su iCloud Drive, OneDrive o Git privato.
- **Grafici & Diagrammi Mermaid**: flowchart, sequenze, diagrammi delle classi UML e mappe mentali direttamente nei tuoi appunti.
- **Esecuzione C e Java**: compila ed esegui i tuoi snippet C e classi Java direttamente dall'editor.
- **Bidirectional Links**: digita \`[[NomeNota]]\` per collegare istantaneamente concetti.
- **Graph View Interattiva**: clicca l'icona del grafo nella barra laterale per esplorare le tue connessioni con fisica delle particelle su Canvas!
- **Backlinks Panel**: visualizza in tempo reale quali note puntano al documento corrente.

Inizia aprendo la nuova guida [[Programmazione/C e Java in NoteRip]] o una delle note su [[Algoritmi e Strutture Dati]].

#benvenuto #noterip #apple`,
};

function getMockData(): MockVaultData {
  const saved = localStorage.getItem(MOCK_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  const initial: MockVaultData = {
    vaultPath: '~/Documents/NoteRip-Vault',
    files: { ...DEFAULT_MOCK_FILES },
  };
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveMockData(data: MockVaultData) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
}

export const tauriBridge = {
  async selectVault(): Promise<string | null> {
    if (isTauri()) {
      return await invokeTauri<string | null>('select_vault');
    }
    // Web mock
    return getMockData().vaultPath;
  },

  async scanVault(vaultPath: string): Promise<FileNode[]> {
    if (isTauri()) {
      return await invokeTauri<FileNode[]>('scan_vault', { vaultPath });
    }

    // Web mock recursive multi-level build tree
    const data = getMockData();
    interface MockFolder {
      name: string;
      relPath: string;
      subfolders: Map<string, MockFolder>;
      files: FileNode[];
    }

    const rootFolder: MockFolder = {
      name: '',
      relPath: '',
      subfolders: new Map(),
      files: [],
    };

    const now = Date.now();
    for (const [relPath, content] of Object.entries(data.files)) {
      if (relPath.endsWith('.keep')) continue;
      const parts = relPath.split('/');
      const fileName = parts[parts.length - 1];
      const folderParts = parts.slice(0, -1);

      let curr = rootFolder;
      let accPath = '';
      for (const seg of folderParts) {
        accPath = accPath ? `${accPath}/${seg}` : seg;
        if (!curr.subfolders.has(seg)) {
          curr.subfolders.set(seg, {
            name: seg,
            relPath: accPath,
            subfolders: new Map(),
            files: [],
          });
        }
        curr = curr.subfolders.get(seg)!;
      }

      curr.files.push({
        path: `${data.vaultPath}/${relPath}`,
        name: fileName,
        is_dir: false,
        extension: 'md',
        children: null,
        updated_at: now - 1800000,
        size: content.length,
      });
    }

    function buildNodes(folder: MockFolder, basePath: string): FileNode[] {
      const nodes: FileNode[] = [];
      // Subfolders first
      Array.from(folder.subfolders.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((sub) => {
          const subFullPath = `${basePath}/${sub.name}`;
          nodes.push({
            path: subFullPath,
            name: sub.name,
            is_dir: true,
            extension: null,
            children: buildNodes(sub, subFullPath),
            updated_at: now,
            size: null,
          });
        });

      // Files sorted
      folder.files
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((f) => nodes.push(f));

      return nodes;
    }

    return buildNodes(rootFolder, data.vaultPath);
  },

  async readNote(filePath: string): Promise<string> {
    if (isTauri()) {
      return await invokeTauri<string>('read_note', { filePath });
    }

    const data = getMockData();
    const rel = filePath.replace(`${data.vaultPath}/`, '').replace(/^\//, '');
    return data.files[rel] ?? '';
  },

  async writeNote(filePath: string, content: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri<void>('write_note', { filePath, content });
      return;
    }

    const data = getMockData();
    const rel = filePath.replace(`${data.vaultPath}/`, '').replace(/^\//, '');
    data.files[rel] = content;
    saveMockData(data);
  },

  async createNote(vaultPath: string, relPath: string, content?: string): Promise<string> {
    if (isTauri()) {
      return await invokeTauri<string>('create_note', { vaultPath, relPath, content });
    }

    const data = getMockData();
    let cleanRel = relPath.trim();
    if (!cleanRel.endsWith('.md')) cleanRel += '.md';
    data.files[cleanRel] = content || `# ${cleanRel.split('/').pop()?.replace('.md', '') || 'Nota'}\n\n`;
    saveMockData(data);
    return `${data.vaultPath}/${cleanRel}`;
  },

  async createFolder(vaultPath: string, relPath: string): Promise<string> {
    if (isTauri()) {
      return await invokeTauri<string>('create_folder', { vaultPath, relPath });
    }

    const data = getMockData();
    const cleanRel = relPath.replace(/^\//, '').replace(/\/$/, '');
    data.files[`${cleanRel}/.keep`] = '';
    saveMockData(data);
    return `${data.vaultPath}/${cleanRel}`;
  },

  async deleteNote(filePath: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri<void>('delete_note', { filePath });
      return;
    }

    const data = getMockData();
    const rel = filePath.replace(`${data.vaultPath}/`, '').replace(/^\//, '');
    delete data.files[rel];
    saveMockData(data);
  },

  async renameNote(oldPath: string, newPath: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri<void>('rename_note', { oldPath, newPath });
      return;
    }

    const data = getMockData();
    const oldRel = oldPath.replace(`${data.vaultPath}/`, '').replace(/^\//, '');
    const newRel = newPath.replace(`${data.vaultPath}/`, '').replace(/^\//, '');
    if (data.files[oldRel] !== undefined) {
      data.files[newRel] = data.files[oldRel];
      delete data.files[oldRel];
      saveMockData(data);
    }
  },

  async gitSyncVault(vaultPath: string, commitMsg?: string): Promise<GitSyncResult> {
    if (isTauri()) {
      return await invokeTauri<GitSyncResult>('git_sync_vault', { vaultPath, commitMsg });
    }

    // Web mock simulation
    return {
      success: true,
      message: 'Git Sync (Mock): modifiche salvate e sincronizzate.',
      files_changed: 2,
    };
  },

  async runCode(lang: string, code: string): Promise<CodeRunResult> {
    if (isTauri()) {
      return await invokeTauri<CodeRunResult>('run_code', { lang, code });
    }

    // Web mock simulation for testing/preview in standard browser
    await new Promise((r) => setTimeout(r, 600));

    const cleanCode = code.trim();
    const isC = lang.toLowerCase() === 'c' || lang.toLowerCase() === 'cpp';
    const isJava = lang.toLowerCase() === 'java';

    if (!isC && !isJava) {
      return {
        success: false,
        stdout: '',
        stderr: `Linguaggio "${lang}" non supportato per l'esecuzione. Supportati: C, Java.`,
        exit_code: 1,
        execution_time_ms: 10,
      };
    }

    // Mock output simulation parsing simple print statements
    const printMatches: string[] = [];
    if (isC) {
      const printfRegex = /printf\s*\(\s*"([^"]*)"/g;
      let m;
      while ((m = printfRegex.exec(cleanCode)) !== null) {
        printMatches.push(m[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
      }
      if (printMatches.length === 0) {
        printMatches.push('[Mock C Runner]: Programma C compilato ed eseguito con successo (main returned 0).');
      }
    } else if (isJava) {
      const printlnRegex = /System\.out\.println\s*\(\s*"([^"]*)"\s*\)/g;
      let m;
      while ((m = printlnRegex.exec(cleanCode)) !== null) {
        printMatches.push(m[1]);
      }
      if (printMatches.length === 0) {
        printMatches.push('[Mock Java Runner]: Classe compilata ed eseguita con successo con JDK.');
      }
    }

    return {
      success: true,
      stdout: printMatches.join('\n'),
      stderr: '',
      exit_code: 0,
      execution_time_ms: 245,
    };
  },
};
