import React, { useState, useMemo } from 'react';
import {
  CircuitBoard,
  Table,
  Copy,
  Check,
} from 'lucide-react';

export interface CircuitRendererProps {
  code: string;
  lang?: string;
  onEdit?: () => void;
}

interface CircuitNode {
  id: string;
  type:
    | 'IN'
    | 'OUT'
    | 'AND'
    | 'OR'
    | 'NOT'
    | 'XOR'
    | 'NAND'
    | 'NOR'
    | 'XNOR'
    | 'ALU'
    | 'MUX'
    | 'D_FF'
    | 'REG'
    | 'ADDER'
    | 'BLOCK';
  label: string;
  inputs: string[];
  outputs: string[];
  initialValue?: boolean;
  params?: Record<string, string>;
  col: number;
  row: number;
}

interface CircuitWire {
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

interface ParsedCircuit {
  title: string;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  inputs: string[];
  outputs: string[];
}

interface WaveformSignal {
  name: string;
  type: 'clk' | 'signal' | 'bus';
  wave: string[];
  data?: string[];
}

/**
 * Parse logic circuit DSL:
 * IN A = 1
 * IN B = 0
 * XOR Sum = A, B
 * AND Carry = A, B
 * OUT Sum, Carry
 */
function parseCircuitDsl(code: string): ParsedCircuit {
  const lines = code.split('\n');
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];
  const inputs: string[] = [];
  const outputs: string[] = [];
  let title = 'Circuito Logico / Architetturale';

  const nodeMap = new Map<string, CircuitNode>();

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Comment or title
    if (line.startsWith('#') || line.startsWith('//')) {
      const commentText = line.replace(/^[#//\s]+/, '').trim();
      if (!title || title === 'Circuito Logico / Architetturale') {
        title = commentText;
      }
      continue;
    }

    // Input definition: IN A = 1 or IN A, B
    const inMatch = line.match(/^IN\s+(.+)$/i);
    if (inMatch) {
      const parts = inMatch[1].split(',');
      for (const part of parts) {
        const [rawName, rawVal] = part.split('=').map((s) => s.trim());
        if (!rawName) continue;
        const initialVal = rawVal === '1' || rawVal?.toLowerCase() === 'true' || rawVal?.toLowerCase() === 'high';
        inputs.push(rawName);
        const node: CircuitNode = {
          id: rawName,
          type: 'IN',
          label: rawName,
          inputs: [],
          outputs: ['out'],
          initialValue: initialVal,
          col: 0,
          row: inputs.length - 1,
        };
        nodes.push(node);
        nodeMap.set(rawName, node);
      }
      continue;
    }

    // Output definition: OUT X, Y
    const outMatch = line.match(/^OUT\s+(.+)$/i);
    if (outMatch) {
      const parts = outMatch[1].split(',').map((s) => s.trim());
      for (const part of parts) {
        if (!part) continue;
        outputs.push(part);
      }
      continue;
    }

    // Architecture Block definition:
    // ALU alu [A: in1, B: in2] -> [RES: sum, ZERO: z]
    // BLOCK name [Label] [ports] -> [ports]
    const blockMatch = line.match(/^(ALU|MUX|D_FF|REG|ADDER|BLOCK)\s+(\w+)(?:\s+\[([^\]]*)\])?(?:\s+\[([^\]]*)\])?(?:\s*->\s*\[([^\]]*)\])?/i);
    if (blockMatch) {
      const type = blockMatch[1].toUpperCase() as CircuitNode['type'];
      const id = blockMatch[2];
      const customLabel = blockMatch[3]?.trim() || id;
      const rawInPorts = (blockMatch[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const rawOutPorts = (blockMatch[5] || '').split(',').map((s) => s.trim()).filter(Boolean);

      const inPortNames: string[] = [];
      const outPortNames: string[] = rawOutPorts.length > 0 ? rawOutPorts.map((p) => p.split(':')[0].trim()) : ['OUT'];

      const node: CircuitNode = {
        id,
        type,
        label: customLabel,
        inputs: [],
        outputs: outPortNames,
        col: 1,
        row: nodes.length,
      };

      for (const p of rawInPorts) {
        const [portName, sourceNet] = p.includes(':') ? p.split(':').map((s) => s.trim()) : [p, p];
        inPortNames.push(portName);
        if (sourceNet) {
          node.inputs.push(sourceNet);
          wires.push({
            fromNode: sourceNet,
            fromPort: 'out',
            toNode: id,
            toPort: portName,
          });
        }
      }

      nodes.push(node);
      nodeMap.set(id, node);
      continue;
    }

    // Standard Logic Gate definition:
    // GATE out = in1, in2 (e.g. AND out = A, B or XOR sum = A, B)
    const gateMatch = line.match(/^(AND|OR|NOT|XOR|NAND|NOR|XNOR)\s+(\w+)\s*=\s*(.+)$/i);
    if (gateMatch) {
      const gateType = gateMatch[1].toUpperCase() as CircuitNode['type'];
      const outName = gateMatch[2].trim();
      const inNets = gateMatch[3].split(',').map((s) => s.trim()).filter(Boolean);

      const node: CircuitNode = {
        id: outName,
        type: gateType,
        label: outName,
        inputs: inNets,
        outputs: ['out'],
        col: 1,
        row: nodes.length,
      };

      for (const inNet of inNets) {
        wires.push({
          fromNode: inNet,
          fromPort: 'out',
          toNode: outName,
          toPort: 'in',
        });
      }

      nodes.push(node);
      nodeMap.set(outName, node);
      continue;
    }

    // Direct wire syntax: WIRE fromPort -> toPort
    const wireMatch = line.match(/^WIRE\s+(\w+)(?:\.(\w+))?\s*->\s*(\w+)(?:\.(\w+))?/i);
    if (wireMatch) {
      wires.push({
        fromNode: wireMatch[1],
        fromPort: wireMatch[2] || 'out',
        toNode: wireMatch[3],
        toPort: wireMatch[4] || 'in',
      });
      continue;
    }
  }

  // Create OUT nodes for designated outputs
  for (let idx = 0; idx < outputs.length; idx++) {
    const outName = outputs[idx];
    const outNodeId = `OUT_${outName}`;
    const node: CircuitNode = {
      id: outNodeId,
      type: 'OUT',
      label: outName,
      inputs: [outName],
      outputs: [],
      col: 2,
      row: idx,
    };
    nodes.push(node);
    wires.push({
      fromNode: outName,
      fromPort: 'out',
      toNode: outNodeId,
      toPort: 'in',
    });
  }

  // Simple Column Layout (Topological depth assignment)
  const depthMap = new Map<string, number>();
  for (const inId of inputs) depthMap.set(inId, 0);

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 8) {
    changed = false;
    iterations++;
    for (const node of nodes) {
      if (node.type === 'IN') continue;
      let maxInputDepth = 0;
      for (const inNet of node.inputs) {
        const d = depthMap.get(inNet);
        if (d !== undefined && d >= maxInputDepth) {
          maxInputDepth = d + 1;
        }
      }
      const current = depthMap.get(node.id) || 1;
      if (maxInputDepth > current) {
        depthMap.set(node.id, maxInputDepth);
        changed = true;
      }
    }
  }

  for (const node of nodes) {
    if (node.type === 'OUT') {
      const maxCol = Math.max(2, ...Array.from(depthMap.values()));
      node.col = maxCol + 1;
    } else if (node.type !== 'IN') {
      node.col = depthMap.get(node.id) || 1;
    }
  }

  // Assign rows within each column
  const cols = new Map<number, CircuitNode[]>();
  for (const node of nodes) {
    const list = cols.get(node.col) || [];
    list.push(node);
    cols.set(node.col, list);
  }

  cols.forEach((colNodes) => {
    colNodes.forEach((n, r) => {
      n.row = r;
    });
  });

  return { title, nodes, wires, inputs, outputs };
}

/**
 * Parse waveform timing syntax:
 * clk:   _~_~_~_~
 * req:   __~~____
 * ack:   ___~~___
 * data:  ==D0==D1
 */
function parseWaveformDsl(code: string): WaveformSignal[] {
  const lines = code.split('\n');
  const signals: WaveformSignal[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const match = trimmed.match(/^([\w\d_]+)\s*:\s*([^\n]+)$/);
    if (!match) continue;

    const name = match[1];
    const rawWave = match[2].trim();
    const isClock = name.toLowerCase().includes('clk') || name.toLowerCase().includes('clock');

    // Split chars into steps
    const waveChars = rawWave.replace(/\s+/g, '').split('');
    signals.push({
      name,
      type: isClock ? 'clk' : rawWave.includes('=') ? 'bus' : 'signal',
      wave: waveChars,
    });
  }

  return signals;
}

export const CircuitRenderer: React.FC<CircuitRendererProps> = ({ code, lang = 'circuit', onEdit }) => {
  const [copied, setCopied] = useState(false);
  const [showTruthTable, setShowTruthTable] = useState(false);

  // Check if waveform timing mode
  const isTimingMode = lang === 'timing' || lang === 'wave' || code.includes('CLOCK') || code.includes('clk:');

  // Parse Circuit
  const circuit = useMemo(() => {
    if (isTimingMode) return null;
    return parseCircuitDsl(code);
  }, [code, isTimingMode]);

  // Parse Waveform
  const waveforms = useMemo(() => {
    if (!isTimingMode) return null;
    return parseWaveformDsl(code);
  }, [code, isTimingMode]);

  // Live input state for interactive simulation
  const [inputStates, setInputStates] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (circuit) {
      for (const node of circuit.nodes) {
        if (node.type === 'IN') {
          map[node.id] = node.initialValue ?? false;
        }
      }
    }
    return map;
  });

  const toggleInput = (inputId: string) => {
    setInputStates((prev) => ({ ...prev, [inputId]: !prev[inputId] }));
  };

  // Evaluate logic values across the entire circuit
  const evaluatedValues = useMemo(() => {
    const values: Record<string, boolean> = { ...inputStates };
    if (!circuit) return values;

    // Evaluate in topological column order
    const sortedNodes = [...circuit.nodes].sort((a, b) => a.col - b.col);

    for (const node of sortedNodes) {
      if (node.type === 'IN') {
        values[node.id] = inputStates[node.id] ?? false;
        continue;
      }

      const inVals = node.inputs.map((net) => values[net] ?? false);

      let outVal = false;
      switch (node.type) {
        case 'AND':
          outVal = inVals.length > 0 && inVals.every(Boolean);
          break;
        case 'OR':
          outVal = inVals.some(Boolean);
          break;
        case 'NOT':
          outVal = !inVals[0];
          break;
        case 'XOR':
          outVal = inVals.filter(Boolean).length % 2 === 1;
          break;
        case 'NAND':
          outVal = !(inVals.length > 0 && inVals.every(Boolean));
          break;
        case 'NOR':
          outVal = !inVals.some(Boolean);
          break;
        case 'XNOR':
          outVal = inVals.filter(Boolean).length % 2 === 0;
          break;
        case 'MUX':
          // inVals: [d0, d1, sel]
          outVal = inVals[2] ? inVals[1] : inVals[0];
          break;
        case 'ADDER':
          // Half/Full adder sum
          outVal = inVals.filter(Boolean).length % 2 === 1;
          break;
        case 'OUT':
          outVal = inVals[0] ?? false;
          break;
        default:
          outVal = inVals[0] ?? false;
          break;
      }

      values[node.id] = outVal;
    }

    return values;
  }, [circuit, inputStates]);

  // Compute truth table
  const truthTable = useMemo(() => {
    if (!circuit || circuit.inputs.length === 0 || circuit.inputs.length > 5) return null;
    const numRows = Math.pow(2, circuit.inputs.length);
    const rows: { inputs: Record<string, boolean>; outputs: Record<string, boolean> }[] = [];

    for (let i = 0; i < numRows; i++) {
      const currentInputs: Record<string, boolean> = {};
      circuit.inputs.forEach((inp, bitIdx) => {
        // MSB first
        const bit = (i >> (circuit.inputs.length - 1 - bitIdx)) & 1;
        currentInputs[inp] = bit === 1;
      });

      // Local eval
      const localVals: Record<string, boolean> = { ...currentInputs };
      const sorted = [...circuit.nodes].sort((a, b) => a.col - b.col);

      for (const node of sorted) {
        if (node.type === 'IN') continue;
        const inVals = node.inputs.map((net) => localVals[net] ?? false);
        let outVal = false;
        switch (node.type) {
          case 'AND':
            outVal = inVals.length > 0 && inVals.every(Boolean);
            break;
          case 'OR':
            outVal = inVals.some(Boolean);
            break;
          case 'NOT':
            outVal = !inVals[0];
            break;
          case 'XOR':
            outVal = inVals.filter(Boolean).length % 2 === 1;
            break;
          case 'NAND':
            outVal = !(inVals.length > 0 && inVals.every(Boolean));
            break;
          case 'NOR':
            outVal = !inVals.some(Boolean);
            break;
          case 'XNOR':
            outVal = inVals.filter(Boolean).length % 2 === 0;
            break;
          default:
            outVal = inVals[0] ?? false;
            break;
        }
        localVals[node.id] = outVal;
      }

      const currentOutputs: Record<string, boolean> = {};
      circuit.outputs.forEach((out) => {
        currentOutputs[out] = localVals[out] ?? false;
      });

      rows.push({ inputs: currentInputs, outputs: currentOutputs });
    }

    return rows;
  }, [circuit]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dimensions & Spacing for SVG circuit layout
  const colWidth = 160;
  const rowHeight = 70;
  const paddingX = 70;
  const paddingY = 60;

  const totalCols = circuit ? Math.max(1, ...circuit.nodes.map((n) => n.col)) + 1 : 1;
  const totalRows = circuit ? Math.max(1, ...circuit.nodes.map((n) => n.row)) + 1 : 1;

  const svgWidth = Math.max(480, totalCols * colWidth + paddingX * 2);
  const svgHeight = Math.max(220, totalRows * rowHeight + paddingY * 2);

  return (
    <div className="my-4 rounded-xl bg-[#171B22] border border-[#272C36] overflow-hidden shadow-subtle select-none">
      {/* Circuit Header Bar */}
      <div className="h-10 px-4 border-b border-[#272C36] bg-[#131720] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[#0E1116] border border-[#272C36] text-[#E5484D]">
            <CircuitBoard size={14} strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-[#F3F4F6]">
            {isTimingMode ? 'Diagramma Temporale di Clock' : circuit?.title || 'Circuito di Architettura'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#171B22] border border-[#272C36] text-[#9CA3AF]">
            {isTimingMode ? 'Waveform' : 'Simulatore Logico'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isTimingMode && truthTable && (
            <button
              onClick={() => setShowTruthTable(!showTruthTable)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                showTruthTable
                  ? 'bg-[#171B22] text-[#E5484D] border-[#E5484D]/40'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6] border-[#272C36] hover:bg-[#171B22]'
              }`}
              title="Mostra / Nascondi Tabella di Verità"
            >
              <Table size={12} strokeWidth={1.5} />
              <span>Tabella Verità</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded-lg border border-[#272C36] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22] text-[11px] transition-colors"
            >
              Modifica Codice
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-[#272C36] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22] transition-colors"
            title="Copia codice circuito"
          >
            {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Main Interactive Diagram View */}
      <div className="p-4 overflow-x-auto flex justify-center bg-[#0E1116]/60">
        {isTimingMode && waveforms ? (
          /* Waveform Timing Diagram View */
          <div className="w-full max-w-2xl py-3 px-4 font-mono text-xs space-y-4">
            {waveforms.map((sig) => (
              <div key={sig.name} className="flex items-center gap-4">
                <span className="w-20 font-bold text-[#F3F4F6] truncate text-right">{sig.name}</span>
                <div className="flex items-center gap-0.5 bg-[#171B22] border border-[#272C36] rounded-lg p-2 overflow-x-auto">
                  {sig.wave.map((step, idx) => {
                    const isHigh = step === '1' || step === '~' || step === 'H';
                    const isLow = step === '0' || step === '_' || step === 'L';
                    const isBus = step === '=' || step === 'x';
                    return (
                      <div key={idx} className="w-6 h-6 flex flex-col justify-end relative shrink-0">
                        {isHigh ? (
                          <div className="w-full h-full border-t-2 border-r-2 border-[#4ADE80] bg-[#4ADE80]/10" />
                        ) : isLow ? (
                          <div className="w-full h-full border-b-2 border-r-2 border-[#6B7280] bg-[#131720]" />
                        ) : isBus ? (
                          <div className="w-full h-full border-y-2 border-r-2 border-[#60A5FA] bg-[#60A5FA]/10 flex items-center justify-center text-[9px] text-[#F3F4F6]">
                            D{idx}
                          </div>
                        ) : (
                          <div className="w-full h-0.5 bg-[#272C36] self-center" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : circuit ? (
          /* SVG Logic Circuit Schematic */
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="overflow-visible select-none"
          >
            <defs>
              {/* Glow filter for active high signals */}
              <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#4ADE80" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* 1. Draw Interconnecting Wires */}
            {circuit.wires.map((wire, idx) => {
              const srcNode = circuit.nodes.find((n) => n.id === wire.fromNode);
              const dstNode = circuit.nodes.find((n) => n.id === wire.toNode);
              if (!srcNode || !dstNode) return null;

              const x1 = paddingX + srcNode.col * colWidth + 45;
              const y1 = paddingY + srcNode.row * rowHeight + 20;

              const x2 = paddingX + dstNode.col * colWidth - 10;
              const y2 = paddingY + dstNode.row * rowHeight + 20;

              const midX = (x1 + x2) / 2;
              const isHigh = evaluatedValues[wire.fromNode] ?? false;

              // Orthogonal step routing
              const pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

              return (
                <g key={`wire-${idx}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isHigh ? '#4ADE80' : '#272C36'}
                    strokeWidth={isHigh ? 2.5 : 1.5}
                    filter={isHigh ? 'url(#wire-glow)' : undefined}
                    className="transition-colors duration-150"
                  />
                  {/* Wire signal value indicator dot */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={isHigh ? 3 : 2}
                    fill={isHigh ? '#4ADE80' : '#3A4150'}
                  />
                </g>
              );
            })}

            {/* 2. Draw Circuit Nodes / Logic Gates / Blocks */}
            {circuit.nodes.map((node) => {
              const posX = paddingX + node.col * colWidth;
              const posY = paddingY + node.row * rowHeight;
              const isHigh = evaluatedValues[node.id] ?? false;

              // Interactive Input Node
              if (node.type === 'IN') {
                const val = inputStates[node.id] ?? false;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${posX - 25}, ${posY})`}
                    onClick={() => toggleInput(node.id)}
                    className="cursor-pointer group"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="50"
                      height="38"
                      rx="8"
                      fill="#171B22"
                      stroke={val ? '#4ADE80' : '#272C36'}
                      strokeWidth={val ? '2' : '1'}
                      className="group-hover:stroke-[#E5484D] transition-colors"
                    />
                    <text
                      x="14"
                      y="18"
                      fontSize="11"
                      fill="#9CA3AF"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {node.label}
                    </text>
                    <text
                      x="35"
                      y="24"
                      fontSize="13"
                      fill={val ? '#4ADE80' : '#6B7280'}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {val ? '1' : '0'}
                    </text>
                    <title>Clicca per commutare stato (0 / 1)</title>
                  </g>
                );
              }

              // Output Display Node
              if (node.type === 'OUT') {
                return (
                  <g key={node.id} transform={`translate(${posX}, ${posY})`}>
                    <rect
                      x="0"
                      y="2"
                      width="55"
                      height="36"
                      rx="8"
                      fill="#171B22"
                      stroke={isHigh ? '#4ADE80' : '#272C36'}
                      strokeWidth={isHigh ? '2' : '1'}
                    />
                    <text
                      x="10"
                      y="18"
                      fontSize="10"
                      fill="#9CA3AF"
                      fontFamily="monospace"
                    >
                      {node.label}
                    </text>
                    <text
                      x="35"
                      y="25"
                      fontSize="13"
                      fill={isHigh ? '#4ADE80' : '#6B7280'}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {isHigh ? '1' : '0'}
                    </text>
                  </g>
                );
              }

              // Logic Gate Rendering (ANSI / IEEE symbols)
              return (
                <g key={node.id} transform={`translate(${posX}, ${posY})`}>
                  {/* Gate Symbol Background Card */}
                  <rect
                    x="0"
                    y="0"
                    width="46"
                    height="40"
                    rx="8"
                    fill="#171B22"
                    stroke={isHigh ? '#4ADE80' : '#272C36'}
                    strokeWidth="1.5"
                  />

                  {/* Gate Type Text & Label */}
                  <text
                    x="23"
                    y="22"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={isHigh ? '#F3F4F6' : '#9CA3AF'}
                  >
                    {node.type}
                  </text>
                  <text
                    x="23"
                    y="34"
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="sans-serif"
                    fill="#6B7280"
                  >
                    {node.label !== node.type ? node.label : ''}
                  </text>

                  {/* Input Connection Pins */}
                  <circle cx="-5" cy="12" r="2.5" fill="#3A4150" />
                  <circle cx="-5" cy="28" r="2.5" fill="#3A4150" />

                  {/* Output Pin */}
                  <circle
                    cx="51"
                    cy="20"
                    r="2.5"
                    fill={isHigh ? '#4ADE80' : '#3A4150'}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>

      {/* Interactive Helper Footer */}
      <div className="px-4 py-2 border-t border-[#272C36] bg-[#131720] flex items-center justify-between text-[11px] text-[#9CA3AF]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          <span>Simulazione interattiva attiva: clicca sui pin d'ingresso (0 / 1) per testare la propagazione logica.</span>
        </div>
        <span className="font-mono text-[10px] text-[#6B7280]">NoteRip Logic Engine</span>
      </div>

      {/* Auto-Generated Truth Table View */}
      {showTruthTable && truthTable && (
        <div className="p-4 border-t border-[#272C36] bg-[#0E1116] overflow-x-auto">
          <div className="text-xs font-semibold text-[#F3F4F6] mb-2 flex items-center gap-1.5">
            <Table size={13} className="text-[#E5484D]" />
            <span>Tabella di Verità Completa (Tutte le {truthTable.length} combinazioni possibili)</span>
          </div>

          <table className="w-full text-center text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#272C36] bg-[#171B22] text-[#9CA3AF]">
                {circuit?.inputs.map((inp) => (
                  <th key={inp} className="py-1.5 px-3 font-semibold text-[#F3F4F6]">
                    {inp}
                  </th>
                ))}
                <th className="w-4 border-l border-r border-[#272C36]" />
                {circuit?.outputs.map((out) => (
                  <th key={out} className="py-1.5 px-3 font-semibold text-[#E5484D]">
                    {out}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272C36]">
              {truthTable.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#171B22]/50 transition-colors">
                  {circuit?.inputs.map((inp) => (
                    <td key={inp} className={`py-1 px-3 ${row.inputs[inp] ? 'text-[#4ADE80]' : 'text-[#6B7280]'}`}>
                      {row.inputs[inp] ? '1' : '0'}
                    </td>
                  ))}
                  <td className="w-4 border-l border-r border-[#272C36] bg-[#131720]" />
                  {circuit?.outputs.map((out) => (
                    <td key={out} className={`py-1 px-3 font-bold ${row.outputs[out] ? 'text-[#4ADE80]' : 'text-[#6B7280]'}`}>
                      {row.outputs[out] ? '1' : '0'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
