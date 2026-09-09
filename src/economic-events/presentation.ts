import type { RegionalEconomicEventView, PublicProjectView } from '../public-projects/types';
import type { ProvinceMapPoint } from '../components/provinces/provinceMapProjection';

export const ECONOMIC_EVENT_TEMPLATE_IDS = [
  'festival-catering', 'protein-procurement', 'home-renovation',
  'seasonal-apparel', 'daily-restocking', 'equipment-renewal',
] as const;

// A display anchor, not the location or extent of the economic effect.
export const GLOBAL_EVENT_MAP_COORDINATE: [number, number] = [-98.5, 38.5];
export const PUBLIC_PROJECT_EVENT_PREFIX = 'public-project-event:';

export interface PresentedEconomicEvent extends RegionalEconomicEventView {
  project?: PublicProjectView;
}

export function presentEconomicEvents(
  events: readonly RegionalEconomicEventView[],
  projects: readonly PublicProjectView[] = [],
): PresentedEconomicEvent[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const byId = new Map<string, PresentedEconomicEvent>();
  for (const event of events) {
    if (!event.id || byId.has(event.id)) continue;
    const project = event.id.startsWith(PUBLIC_PROJECT_EVENT_PREFIX)
      ? projectById.get(event.id.slice(PUBLIC_PROJECT_EVENT_PREFIX.length)) : undefined;
    byId.set(event.id, { ...event, project });
  }
  // Older snapshots can deliver the project view without its calendar row.
  // This is a read-only projection of that same authority, never a new event.
  for (const project of projects) {
    const id = `${PUBLIC_PROJECT_EVENT_PREFIX}${project.id}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id, templateId: 'public-project', scope: 'global', project,
      title: project.title, description: project.description,
      announcedAt: project.announcedAt, startsAt: project.startsAt,
      endsAt: project.endsAt, rampMs: 0, classLabels: [],
      productIds: project.goals.map((goal) => goal.productId),
    });
  }
  return [...byId.values()].sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

export function economicEventPhase(event: PresentedEconomicEvent, now: number) {
  if (event.project?.status === 'completed' || event.project?.status === 'expired' || event.endsAt <= now) return 'completed';
  return event.startsAt > now ? 'upcoming' : 'active';
}

export function economicEventMapVisible(event: PresentedEconomicEvent, now: number) {
  return Number.isFinite(event.announcedAt) && Number.isFinite(event.startsAt)
    && Number.isFinite(event.endsAt) && event.endsAt > event.startsAt
    && event.announcedAt <= now && economicEventPhase(event, now) !== 'completed';
}

export function economicEventScopeLabel(event: PresentedEconomicEvent) {
  if (event.templateId === 'public-project') {
    return event.project ? `${event.project.provinceName} · 全服参与` : '公共项目 · 地点待同步';
  }
  return event.scope === 'regional' ? (event.provinceName || '地区事件') : '全国生效';
}

export function economicEventAnchor(
  event: PresentedEconomicEvent,
  capitalPoints: ReadonlyMap<string, ProvinceMapPoint>,
  globalPoint: ProvinceMapPoint,
): ProvinceMapPoint | null {
  const point = event.templateId === 'public-project'
    ? capitalPoints.get(event.project?.provinceId ?? '')
    : event.scope === 'regional' ? capitalPoints.get(event.provinceId ?? '') : globalPoint;
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

export interface EconomicEventMarker {
  event: PresentedEconomicEvent;
  anchor: ProvinceMapPoint;
  position: ProvinceMapPoint;
}

/** Resolve overlap in screen pixels while keeping a leader at the true world anchor. */
export function layoutEconomicEventMarkers(
  events: readonly PresentedEconomicEvent[],
  capitalPoints: ReadonlyMap<string, ProvinceMapPoint>,
  globalPoint: ProvinceMapPoint,
  unitsPerPixel: number,
): EconomicEventMarker[] {
  const scale = Number.isFinite(unitsPerPixel) && unitsPerPixel > 0 ? unitsPerPixel : 1;
  const markers: EconomicEventMarker[] = [];
  for (const event of [...events].sort((a, b) => a.id.localeCompare(b.id))) {
    const anchor = economicEventAnchor(event, capitalPoints, globalPoint);
    if (!anchor) continue;
    let position = { x: anchor.x, y: anchor.y - 32 * scale };
    // There are more candidates than prior markers; no item limit or random offset.
    for (let candidate = 0; candidate <= markers.length * 8 + 8; candidate += 1) {
      const ring = candidate === 0 ? 0 : Math.ceil(candidate / 8);
      const angle = ((candidate - 1) % 8) * Math.PI / 4;
      position = {
        x: anchor.x + (ring ? Math.sin(angle) * ring * 56 : 0) * scale,
        y: anchor.y + (-32 - (ring ? Math.cos(angle) * ring * 56 : 0)) * scale,
      };
      if (markers.every((other) => Math.abs(other.position.x - position.x) >= 48 * scale
        || Math.abs(other.position.y - position.y) >= 48 * scale)) break;
    }
    markers.push({ event, anchor, position });
  }
  return markers;
}
