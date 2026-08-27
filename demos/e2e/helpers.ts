import type { Page } from '@playwright/test';

const BLOCKED_TILE_HOSTS = [
  'services.arcgisonline.com',
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'nominatim.openstreetmap.org',
  'googletagmanager.com',
];

export async function blockExternalTiles(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (BLOCKED_TILE_HOSTS.some((host) => url.hostname.endsWith(host))) {
      return route.abort();
    }
    return route.continue();
  });
}

export interface CpuProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
}

export interface CpuProfile {
  nodes: CpuProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

interface HotFunction {
  name: string;
  source: string;
  selfMs: number;
  totalMs: number;
}

export function tallyHotFunctions(profile: CpuProfile, limit: number): HotFunction[] {
  const sampleInterval =
    profile.timeDeltas && profile.timeDeltas.length > 0
      ? profile.timeDeltas.reduce((a, b) => a + b, 0) / profile.timeDeltas.length
      : 1000;
  const nodesById = new Map<number, CpuProfileNode>();
  for (const node of profile.nodes) nodesById.set(node.id, node);

  const selfMicros = new Map<number, number>();
  if (profile.samples && profile.timeDeltas) {
    for (let i = 0; i < profile.samples.length; i++) {
      const sample = profile.samples[i];
      const delta = profile.timeDeltas[i] ?? sampleInterval;
      if (sample === undefined) continue;
      selfMicros.set(sample, (selfMicros.get(sample) ?? 0) + delta);
    }
  } else {
    for (const node of profile.nodes) {
      selfMicros.set(node.id, (node.hitCount ?? 0) * sampleInterval);
    }
  }

  const totalMicros = new Map<number, number>();
  function totalFor(nodeId: number): number {
    const cached = totalMicros.get(nodeId);
    if (cached !== undefined) return cached;
    const node = nodesById.get(nodeId);
    if (!node) return 0;
    let sum = selfMicros.get(nodeId) ?? 0;
    for (const childId of node.children ?? []) sum += totalFor(childId);
    totalMicros.set(nodeId, sum);
    return sum;
  }
  for (const node of profile.nodes) totalFor(node.id);

  const ranked: HotFunction[] = profile.nodes.map((node) => {
    const name = node.callFrame.functionName.length > 0
      ? node.callFrame.functionName
      : '(anonymous)';
    const url = node.callFrame.url || '';
    const line = node.callFrame.lineNumber >= 0 ? `:${node.callFrame.lineNumber + 1}` : '';
    return {
      name,
      source: url ? `${url.split('/').slice(-2).join('/')}${line}` : '(native)',
      selfMs: (selfMicros.get(node.id) ?? 0) / 1000,
      totalMs: (totalMicros.get(node.id) ?? 0) / 1000,
    };
  });
  ranked.sort((a, b) => b.selfMs - a.selfMs);
  return ranked.slice(0, limit);
}
