import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3-force';
import { useVaultStore } from '../store/useVaultStore';
import type { GraphNode } from '../types';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Play,
  Pause,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  ArrowRight,
  Link2,
  Check,
  Search,
  SlidersHorizontal,
  FolderTree,
  Eye,
  EyeOff,
} from 'lucide-react';
import { normalizeNoteName } from '../services/indexer';
import { detectUnlinkedMentions, detectSharedTagLinks } from '../services/mentionDetector';
import type { DetectedMention } from '../services/mentionDetector';

interface InternalNode extends GraphNode, d3.SimulationNodeDatum {
  folder: string;
  tags: string[];
  folderColor: string;
  wikilinkCount: number;
  mentionCount: number;
  tagLinkCount: number;
  targetX?: number;
  targetY?: number;
}

type LinkType = 'wikilink' | 'mention' | 'tag';

interface InternalLink extends d3.SimulationLinkDatum<InternalNode> {
  source: InternalNode | string;
  target: InternalNode | string;
  type: LinkType;
  mentionData?: DetectedMention;
  sharedTags?: string[];
  weight: number;
}

// Catppuccin harmonic folder palette for cohesive clustering
const FOLDER_COLORS = [
  '#cba6f7', // Mauve
  '#89b4fa', // Blue
  '#94e2d5', // Teal
  '#fab387', // Peach
  '#a6e3a1', // Green
  '#f9e2af', // Yellow
  '#f5c2e7', // Pink
  '#74c7ec', // Sapphire
  '#f2cdcd', // Flamingo
  '#b4befe', // Lavender
];

export const GraphView: React.FC = () => {
  const {
    notes,
    activeNotePath,
    isDarkMode,
    theme,
    graphSettings,
    selectNote,
    setActiveView,
    updateGraphSettings,
    linkMentionInNote,
  } = useVaultStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<InternalNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showMentionsDrawer, setShowMentionsDrawer] = useState(false);
  const [mentionsFilter, setMentionsFilter] = useState('');
  const [linkedStatusMap, setLinkedStatusMap] = useState<Record<string, boolean>>({});

  const simulationRef = useRef<d3.Simulation<InternalNode, InternalLink> | null>(null);
  const nodesRef = useRef<InternalNode[]>([]);
  const linksRef = useRef<InternalLink[]>([]);
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<InternalNode | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // Map folder names to distinct Catppuccin colors
  const folderColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const folders = Array.from(new Set(notes.map((n) => n.folder || 'Root'))).sort();
    folders.forEach((f, idx) => {
      map.set(f, FOLDER_COLORS[idx % FOLDER_COLORS.length]);
    });
    return map;
  }, [notes]);

  // Multi-Criteria Graph Builder
  const {
    graphNodes,
    graphLinks,
    detectedMentionsList,
    stats,
  } = useMemo(() => {
    const titleToPath = new Map<string, string>();
    notes.forEach((n) => {
      titleToPath.set(normalizeNoteName(n.title).toLowerCase(), n.path);
    });

    const wikilinkCounts = new Map<string, number>();
    const mentionCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const connectedPairs = new Set<string>();

    const rawLinks: Array<{
      source: string;
      target: string;
      type: LinkType;
      mentionData?: DetectedMention;
      sharedTags?: string[];
      weight: number;
    }> = [];

    // Criterion 1: Explicit [[WikiLinks]]
    let wikiLinkTotal = 0;
    if (graphSettings.showWikiLinks) {
      notes.forEach((note) => {
        const sourcePath = note.path;
        note.outlinks.forEach((targetTitle) => {
          const targetPath = titleToPath.get(normalizeNoteName(targetTitle).toLowerCase());
          if (targetPath && targetPath !== sourcePath) {
            const pairKey = [sourcePath, targetPath].sort().join('<->');
            if (!connectedPairs.has(pairKey)) {
              connectedPairs.add(pairKey);
              rawLinks.push({
                source: sourcePath,
                target: targetPath,
                type: 'wikilink',
                weight: 1.0,
              });
              wikiLinkTotal++;
              wikilinkCounts.set(sourcePath, (wikilinkCounts.get(sourcePath) || 0) + 1);
              wikilinkCounts.set(targetPath, (wikilinkCounts.get(targetPath) || 0) + 1);
            }
          }
        });
      });
    }

    // Criterion 2: Intelligent Mention Detection (Unlinked Concepts)
    let mentions: DetectedMention[] = [];
    if (graphSettings.showMentions) {
      mentions = detectUnlinkedMentions(notes, graphSettings.mentionConfidence);

      mentions.forEach((mention) => {
        const pairKey = [mention.sourcePath, mention.targetPath].sort().join('<->');
        if (!connectedPairs.has(pairKey)) {
          connectedPairs.add(pairKey);
          rawLinks.push({
            source: mention.sourcePath,
            target: mention.targetPath,
            type: 'mention',
            mentionData: mention,
            weight: 0.75,
          });
          mentionCounts.set(mention.sourcePath, (mentionCounts.get(mention.sourcePath) || 0) + 1);
          mentionCounts.set(mention.targetPath, (mentionCounts.get(mention.targetPath) || 0) + 1);
        }
      });
    }

    // Criterion 3: Shared Tags Thematic Affinity
    let sharedTagTotal = 0;
    if (graphSettings.showSharedTags) {
      const sharedTagLinks = detectSharedTagLinks(notes, graphSettings.minSharedTags);

      sharedTagLinks.forEach((stl) => {
        const pairKey = [stl.sourcePath, stl.targetPath].sort().join('<->');
        if (!connectedPairs.has(pairKey)) {
          connectedPairs.add(pairKey);
          rawLinks.push({
            source: stl.sourcePath,
            target: stl.targetPath,
            type: 'tag',
            sharedTags: stl.sharedTags,
            weight: 0.55 + Math.min(0.4, stl.count * 0.15),
          });
          sharedTagTotal++;
          tagCounts.set(stl.sourcePath, (tagCounts.get(stl.sourcePath) || 0) + 1);
          tagCounts.set(stl.targetPath, (tagCounts.get(stl.targetPath) || 0) + 1);
        }
      });
    }

    // Build raw nodes
    let allNodes: InternalNode[] = notes.map((n) => {
      const wCount = wikilinkCounts.get(n.path) || 0;
      const mCount = mentionCounts.get(n.path) || 0;
      const tCount = tagCounts.get(n.path) || 0;
      const totalLinks = wCount + mCount + tCount;

      return {
        id: n.path,
        label: n.title,
        path: n.path,
        folder: n.folder || 'Root',
        tags: n.tags,
        folderColor: folderColorMap.get(n.folder || 'Root') || '#cba6f7',
        linkCount: totalLinks,
        wikilinkCount: wCount,
        mentionCount: mCount,
        tagLinkCount: tCount,
      };
    });

    // Criterion 5: Filter Orphan Nodes
    if (!graphSettings.showOrphans) {
      allNodes = allNodes.filter((n) => n.linkCount > 0);
    }

    // Filter by search query if active
    const activeIds = new Set(allNodes.map((n) => n.id));
    const validLinks: InternalLink[] = rawLinks
      .filter((l) => activeIds.has(l.source) && activeIds.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
        type: l.type,
        mentionData: l.mentionData,
        sharedTags: l.sharedTags,
        weight: l.weight,
      }));

    return {
      graphNodes: allNodes,
      graphLinks: validLinks,
      detectedMentionsList: mentions,
      stats: {
        totalNodes: allNodes.length,
        totalLinks: validLinks.length,
        wikiLinks: wikiLinkTotal,
        mentions: mentions.length,
        sharedTags: sharedTagTotal,
      },
    };
  }, [notes, graphSettings, folderColorMap]);

  // Setup D3 Force Simulation with Folder Clustering & Dynamic Physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const simNodes: InternalNode[] = graphNodes.map((n) => ({ ...n }));
    const simLinks: InternalLink[] = graphLinks.map((l) => ({ ...l }));

    // Assign folder cluster centroids if groupByFolder is active
    if (graphSettings.groupByFolder) {
      const uniqueFolders = Array.from(new Set(simNodes.map((n) => n.folder)));
      const radius = Math.min(width, height) * 0.35;
      const folderCenters = new Map<string, { x: number; y: number }>();

      uniqueFolders.forEach((folder, idx) => {
        const angle = (idx / uniqueFolders.length) * 2 * Math.PI;
        folderCenters.set(folder, {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
        });
      });

      simNodes.forEach((node) => {
        const center = folderCenters.get(node.folder);
        if (center) {
          node.targetX = center.x;
          node.targetY = center.y;
        }
      });
    }

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    const linkDistance = (link: InternalLink) => {
      if (link.type === 'wikilink') return 100;
      if (link.type === 'mention') return 140;
      return 170; // Shared tags
    };

    const linkStrength = (link: InternalLink) => {
      if (link.type === 'wikilink') return 0.7;
      if (link.type === 'mention') return 0.45;
      return 0.3; // Shared tags
    };

    const simulation = d3
      .forceSimulation<InternalNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<InternalNode, InternalLink>(simLinks)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.06))
      .force(
        'collision',
        d3.forceCollide<InternalNode>().radius((d) => Math.max(16, 10 + Math.sqrt(d.linkCount + 1) * 3.5))
      );

    // Apply folder cluster attraction force
    if (graphSettings.groupByFolder) {
      simulation
        .force('folderX', d3.forceX<InternalNode>((d) => d.targetX ?? width / 2).strength(0.12))
        .force('folderY', d3.forceY<InternalNode>((d) => d.targetY ?? height / 2).strength(0.12));
    }

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [graphNodes, graphLinks, graphSettings.groupByFolder]);

  // Canvas Render Loop with Catppuccin / Theme Styling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Crimson Noir color palette for graph rendering
      const wikilinkColor = 'rgba(229, 72, 77, 0.45)';
      const mentionColor = 'rgba(96, 165, 250, 0.6)';
      const tagColor = 'rgba(251, 146, 60, 0.5)';

      const nodeDefaultColor = '#272C36';
      const textColor = '#F3F4F6';
      const activeAccent = '#E5484D';

      const searchFilterLower = graphSettings.searchFilter.trim().toLowerCase();

      // 1. Draw Links
      const links = linksRef.current;
      links.forEach((link) => {
        const source = link.source as InternalNode;
        const target = link.target as InternalNode;
        if (!source.x || !source.y || !target.x || !target.y) return;

        const isConnectedToHover =
          hoveredNode && (source.id === hoveredNode.id || target.id === hoveredNode.id);
        const isConnectedToActive =
          activeNotePath && (source.id === activeNotePath || target.id === activeNotePath);
        const isHighlighted = isConnectedToHover || isConnectedToActive;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (link.type === 'wikilink') {
          // Explicit WikiLink: Solid line
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted ? activeAccent : wikilinkColor;
          ctx.lineWidth = (isHighlighted ? 2.2 : 1.2) / transform.k;
        } else if (link.type === 'mention') {
          // Unlinked Mention: Dashed line
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = isHighlighted ? '#60A5FA' : mentionColor;
          const occ = link.mentionData?.occurrenceCount || 1;
          const dynamicWidth = Math.min(3.5, 1.2 + occ * 0.35);
          ctx.lineWidth = (isHighlighted ? dynamicWidth + 1.2 : dynamicWidth) / transform.k;
        } else if (link.type === 'tag') {
          // Shared Tag: Dotted line
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = isHighlighted ? '#FB923C' : tagColor;
          ctx.lineWidth = (isHighlighted ? 2 : 1.1) / transform.k;
        }

        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 2. Draw Nodes
      const nodes = nodesRef.current;
      nodes.forEach((node) => {
        if (!node.x || !node.y) return;

        const isActive = node.path === activeNotePath;
        const isHovered = hoveredNode?.id === node.id;
        const radius = Math.max(5.5, 4.5 + Math.sqrt(node.linkCount + 1) * 2.8);

        // Search match state
        const matchesSearch =
          searchFilterLower.length > 0 &&
          (node.label.toLowerCase().includes(searchFilterLower) ||
            node.tags.some((t) => t.toLowerCase().includes(searchFilterLower)) ||
            node.folder.toLowerCase().includes(searchFilterLower));

        // Outer Glow Ring
        if (isActive || isHovered || matchesSearch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4.5 / transform.k, 0, 2 * Math.PI);
          ctx.fillStyle = isActive
            ? 'rgba(229, 72, 77, 0.35)'
            : matchesSearch
            ? 'rgba(251, 146, 60, 0.35)'
            : 'rgba(255, 255, 255, 0.15)';
          ctx.fill();
        }

        // Inner Circle with Folder Tint or Highlight
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        if (isActive) {
          ctx.fillStyle = activeAccent;
        } else if (matchesSearch) {
          ctx.fillStyle = '#FB923C';
        } else if (graphSettings.groupByFolder) {
          ctx.fillStyle = node.folderColor;
        } else {
          ctx.fillStyle = isHovered ? activeAccent : nodeDefaultColor;
        }
        ctx.fill();

        // Node border
        ctx.strokeStyle = '#0E1116';
        ctx.lineWidth = 1.6 / transform.k;
        ctx.stroke();

        // Node Label
        const showLabel =
          transform.k > 0.65 || isActive || isHovered || matchesSearch || node.linkCount > 1;

        if (showLabel) {
          ctx.font = `${Math.max(10, 11 / transform.k)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.fillStyle = isActive || isHovered ? activeAccent : matchesSearch ? '#FB923C' : textColor;
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y + radius + 11.5 / transform.k);
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [transform, hoveredNode, activeNotePath, isDarkMode, theme, graphSettings]);

  // Pan & Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newK = Math.max(0.25, Math.min(3.8, transform.k * zoomFactor));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform({
      k: newK,
      x: mouseX - (mouseX - transform.x) * (newK / transform.k),
      y: mouseY - (mouseY - transform.y) * (newK / transform.k),
    });
  };

  const getNodeAtPos = (clientX: number, clientY: number): InternalNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - transform.x) / transform.k;
    const y = (clientY - rect.top - transform.y) / transform.k;

    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.x && node.y) {
        const radius = Math.max(8, 5 + Math.sqrt(node.linkCount + 1) * 2.8);
        const distSq = (node.x - x) * (node.x - x) + (node.y - y) * (node.y - y);
        if (distSq <= radius * radius) {
          return node;
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getNodeAtPos(e.clientX, e.clientY);
    if (node) {
      isDraggingRef.current = true;
      draggedNodeRef.current = node;
      node.fx = node.x;
      node.fy = node.y;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
    } else {
      dragStartPosRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      isDraggingRef.current = true;
      draggedNodeRef.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) {
      const node = getNodeAtPos(e.clientX, e.clientY);
      setHoveredNode(node);
      if (node) {
        setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 });
      } else {
        setTooltipPos(null);
      }
      return;
    }

    if (draggedNodeRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      draggedNodeRef.current.fx = (e.clientX - rect.left - transform.x) / transform.k;
      draggedNodeRef.current.fy = (e.clientY - rect.top - transform.y) / transform.k;
    } else {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStartPosRef.current.x,
        y: e.clientY - dragStartPosRef.current.y,
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }
    isDraggingRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    const node = getNodeAtPos(e.clientX, e.clientY);
    if (node) {
      selectNote(node.path);
      setActiveView('notes');
    }
  };

  const resetZoom = () => {
    setTransform({ x: 0, y: 0, k: 1 });
  };

  const togglePause = () => {
    if (!simulationRef.current) return;
    if (isPaused) {
      simulationRef.current.restart();
    } else {
      simulationRef.current.stop();
    }
    setIsPaused(!isPaused);
  };

  const handleConvertMention = async (m: DetectedMention, key: string) => {
    await linkMentionInNote(m.sourcePath, m.targetTitle, m.matchedTerm);
    setLinkedStatusMap((prev) => ({ ...prev, [key]: true }));
  };

  const filteredMentions = useMemo(() => {
    if (!mentionsFilter.trim()) return detectedMentionsList;
    const q = mentionsFilter.toLowerCase();
    return detectedMentionsList.filter(
      (m) =>
        m.sourceTitle.toLowerCase().includes(q) ||
        m.targetTitle.toLowerCase().includes(q) ||
        m.matchedTerm.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
    );
  }, [detectedMentionsList, mentionsFilter]);

  return (
    <div className="flex-1 h-full relative overflow-hidden bg-[var(--bg-app)] select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-1.5 p-1.5 rounded-2xl apple-sidebar-panel apple-vibrant border border-black/10 dark:border-white/10 shadow-apple-md">
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(3.8, t.k * 1.2) }))}
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.25, t.k * 0.8) }))}
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetZoom}
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
          title="Centra Visuale"
        >
          <RotateCcw size={16} />
        </button>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

        <button
          onClick={togglePause}
          className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
          title={isPaused ? 'Avvia simulazione fisica' : 'Ferma simulazione fisica'}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

        {/* Real-time search filter */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Cerca nodi nel grafo..."
            value={graphSettings.searchFilter}
            onChange={(e) => updateGraphSettings({ searchFilter: e.target.value })}
            className="w-36 md:w-44 pl-7 pr-6 py-1 text-xs bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {graphSettings.searchFilter && (
            <button
              onClick={() => updateGraphSettings({ searchFilter: '' })}
              className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

        {/* Criteria & Settings Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsPopover(!showSettingsPopover)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
              showSettingsPopover
                ? 'bg-[var(--accent)] text-white shadow-apple-sm font-semibold'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-primary)]'
            }`}
            title="Configura criteri di auto-collegamento e layout"
          >
            <SlidersHorizontal size={14} />
            <span>Criteri & Filtri</span>
          </button>

          {/* Criteria Popover Card */}
          {showSettingsPopover && (
            <div className="absolute top-11 left-0 w-72 rounded-2xl apple-card-item shadow-apple-popover p-3.5 border border-black/10 dark:border-white/15 z-50 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/10">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Criteri Auto-Creazione Grafo
                </span>
                <button
                  onClick={() => setShowSettingsPopover(false)}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)]"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Criterion 1: WikiLinks */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[var(--text-primary)] font-medium">WikiLinks Diretti</span>
                </div>
                <input
                  type="checkbox"
                  checked={graphSettings.showWikiLinks}
                  onChange={(e) => updateGraphSettings({ showWikiLinks: e.target.checked })}
                  className="rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Criterion 2: Unlinked Mentions */}
              <div className="space-y-1.5 text-xs pt-1 border-t border-black/5 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span className="text-[var(--text-primary)] font-medium">Menzioni Testuali</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={graphSettings.showMentions}
                    onChange={(e) => updateGraphSettings({ showMentions: e.target.checked })}
                    className="rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                  />
                </div>

                {graphSettings.showMentions && (
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pl-4">
                    <span>Soglia confidenza:</span>
                    <select
                      value={graphSettings.mentionConfidence}
                      onChange={(e) =>
                        updateGraphSettings({
                          mentionConfidence: e.target.value as 'alta' | 'media' | 'bassa',
                        })
                      }
                      className="text-[11px] bg-black/5 dark:bg-white/10 rounded-lg px-2 py-0.5 border border-black/5 dark:border-white/10 text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="alta">Solo Alta</option>
                      <option value="media">Media & Alta</option>
                      <option value="bassa">Tutte</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Criterion 3: Shared Tags */}
              <div className="space-y-1.5 text-xs pt-1 border-t border-black/5 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-peach-400" style={{ backgroundColor: '#fab387' }} />
                    <span className="text-[var(--text-primary)] font-medium">Tag Condivisi</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={graphSettings.showSharedTags}
                    onChange={(e) => updateGraphSettings({ showSharedTags: e.target.checked })}
                    className="rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                  />
                </div>

                {graphSettings.showSharedTags && (
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pl-4">
                    <span>Minimo tag comuni:</span>
                    <div className="flex items-center space-x-1">
                      {[1, 2].map((num) => (
                        <button
                          key={num}
                          onClick={() => updateGraphSettings({ minSharedTags: num })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            graphSettings.minSharedTags === num
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-black/5 dark:bg-white/10 text-[var(--text-secondary)]'
                          }`}
                        >
                          &ge; {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Criterion 4: Folder Galaxy Grouping */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/10">
                <div className="flex items-center space-x-2">
                  <FolderTree size={14} className="text-[var(--accent)]" />
                  <span className="text-[var(--text-primary)] font-medium">Raggruppa per Cartella</span>
                </div>
                <input
                  type="checkbox"
                  checked={graphSettings.groupByFolder}
                  onChange={(e) => updateGraphSettings({ groupByFolder: e.target.checked })}
                  className="rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                />
              </div>

              {/* Criterion 5: Show/Hide Orphans */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/10">
                <div className="flex items-center space-x-2">
                  {graphSettings.showOrphans ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span className="text-[var(--text-primary)] font-medium">Mostra Nodi Isolati</span>
                </div>
                <input
                  type="checkbox"
                  checked={graphSettings.showOrphans}
                  onChange={(e) => updateGraphSettings({ showOrphans: e.target.checked })}
                  className="rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

        {/* Stats counter badge */}
        <div className="px-2 text-xs font-medium text-[var(--text-muted)] font-mono flex items-center space-x-2">
          <span>{stats.totalNodes} nodi</span>
          <span>•</span>
          <span>{stats.totalLinks} collegamenti</span>

          {graphSettings.showMentions && detectedMentionsList.length > 0 && (
            <button
              onClick={() => setShowMentionsDrawer(!showMentionsDrawer)}
              className="ml-1 px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold text-[11px] flex items-center space-x-1 hover:bg-sky-500/25 transition-colors shadow-apple-sm"
              title="Visualizza dettagli delle menzioni rilevate"
            >
              <span>+{detectedMentionsList.length} menzioni</span>
              {showMentionsDrawer ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Close Graph View button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setActiveView('notes')}
          className="p-2 rounded-xl apple-sidebar-panel apple-vibrant border border-black/10 dark:border-white/10 shadow-apple-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Torna all'Editor"
        >
          <X size={16} />
        </button>
      </div>

      {/* Physics Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* Rich Interactive Tooltip on Node Hover */}
      {hoveredNode && tooltipPos && (
        <div
          className="fixed z-40 pointer-events-none rounded-2xl apple-card-item shadow-apple-lg border border-black/10 dark:border-white/15 p-3 text-xs space-y-1.5 max-w-xs"
          style={{ top: tooltipPos.y, left: tooltipPos.x }}
        >
          <div className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hoveredNode.folderColor }}
            />
            <h4 className="font-bold text-[var(--text-primary)] truncate text-xs">
              {hoveredNode.label}
            </h4>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)] flex items-center space-x-2">
            <span>Cartella: <strong className="text-[var(--text-primary)]">{hoveredNode.folder}</strong></span>
          </div>

          {hoveredNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {hoveredNode.tags.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded text-[9px] bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] font-mono"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="pt-1.5 border-t border-black/5 dark:border-white/10 grid grid-cols-3 gap-1 text-[10px] text-center font-mono">
            <div className="p-1 rounded bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold">
              {hoveredNode.wikilinkCount} Wiki
            </div>
            <div className="p-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold">
              {hoveredNode.mentionCount} Menz
            </div>
            <div className="p-1 rounded bg-peach-500/15 text-peach-600 dark:text-peach-300 font-semibold" style={{ color: '#fab387' }}>
              {hoveredNode.tagLinkCount} Tag
            </div>
          </div>
        </div>
      )}

      {/* Detailed Mentions Drawer */}
      {graphSettings.showMentions && showMentionsDrawer && detectedMentionsList.length > 0 && (
        <div className="absolute bottom-14 left-4 right-4 md:right-auto md:w-[500px] max-h-96 z-30 apple-sidebar-panel apple-vibrant rounded-2xl border border-black/10 dark:border-white/10 shadow-apple-popover p-3.5 flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
              <Sparkles size={15} className="text-sky-500" />
              <span>Connessioni Intelligenti Rilevate ({filteredMentions.length})</span>
            </div>
            <button
              onClick={() => setShowMentionsDrawer(false)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-2 relative">
            <Search size={13} className="absolute left-2.5 top-2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filtra connessioni per nota o concetto..."
              value={mentionsFilter}
              onChange={(e) => setMentionsFilter(e.target.value)}
              className="w-full pl-7 pr-3 py-1 text-xs bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto mt-2.5 space-y-2 pr-1">
            {filteredMentions.map((m, idx) => {
              const itemKey = `${m.sourcePath}->${m.targetPath}-${m.matchedTerm}`;
              const isAlreadyLinked = linkedStatusMap[itemKey];

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs space-y-1.5 hover:border-sky-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between font-medium">
                    <div className="flex items-center space-x-1.5 text-[var(--text-primary)] min-w-0">
                      <FileText size={12} className="text-[var(--accent)] shrink-0" />
                      <span className="truncate font-semibold">{m.sourceTitle}</span>
                    </div>
                    <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0 mx-1.5" />
                    <div className="flex items-center space-x-1.5 text-sky-500 min-w-0">
                      <span className="truncate font-semibold">{m.targetTitle}</span>
                    </div>

                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                        m.confidence === 'alta'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : m.confidence === 'media'
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {m.confidence}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] italic font-sans bg-black/[0.02] dark:bg-white/[0.02] p-1.5 rounded-lg border border-black/5 dark:border-white/5 leading-relaxed">
                    {m.snippet}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] pt-0.5">
                    <span>
                      Termine rilevato:{' '}
                      <strong className="text-[var(--text-primary)] font-mono">
                        "{m.matchedTerm}"
                      </strong>{' '}
                      ({m.occurrenceCount} occorrenze)
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleConvertMention(m, itemKey)}
                        disabled={isAlreadyLinked}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors ${
                          isAlreadyLinked
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 cursor-default'
                            : 'bg-sky-500 hover:bg-sky-600 text-white shadow-apple-sm'
                        }`}
                        title="Inserisci un vero [[WikiLink]] nel testo della nota"
                      >
                        {isAlreadyLinked ? (
                          <>
                            <Check size={11} />
                            <span>Collegato!</span>
                          </>
                        ) : (
                          <>
                            <Link2 size={11} />
                            <span>Collega [[WikiLink]]</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          selectNote(m.sourcePath);
                          setActiveView('notes');
                        }}
                        className="text-[var(--accent)] hover:underline text-[10px] font-medium"
                      >
                        Apri nota →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Legend and Info Pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full apple-sidebar-panel apple-vibrant border border-black/10 dark:border-white/10 text-[11px] text-[var(--text-secondary)] shadow-apple-sm pointer-events-none flex items-center space-x-3">
        <span className="flex items-center space-x-1">
          <span className="w-2.5 h-0.5 bg-[var(--accent)] rounded" />
          <span>WikiLink</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2.5 h-0.5 bg-sky-400 border-b border-dashed border-sky-400" />
          <span>Menzione Testo</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2.5 h-0.5 bg-peach-400 border-b border-dotted" style={{ borderColor: '#fab387' }} />
          <span>Tag Condiviso</span>
        </span>
      </div>
    </div>
  );
};
