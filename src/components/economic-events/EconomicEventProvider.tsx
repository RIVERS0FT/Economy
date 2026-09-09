import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useGameAuthorityDependencies } from '../../app/gameAuthorityStore';
import { presentEconomicEvents } from '../../economic-events/presentation';
import type { ExtendedEconomicCalendarState } from '../../public-projects/types';
import type { EconomyState } from '../../types';
import { EconomicEventContext } from './EconomicEventContext';
import { EconomicEventDialog } from './EconomicEventDialog';
import '../../styles/economic-events.css';

export function EconomicEventProvider({ game, children }: { game: EconomyState; children: ReactNode }) {
  const authority = useGameAuthorityDependencies(['market.calendar']);
  const source = authority && authority.userId === game.userId ? authority : game;
  const calendar = source.economicCalendar as ExtendedEconomicCalendarState | undefined;
  const events = useMemo(() => presentEconomicEvents(calendar?.events ?? [], calendar?.publicProjects?.projects), [calendar]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openEvent = useCallback((id: string) => setSelectedId(id), []);
  const closeEvent = useCallback(() => setSelectedId(null), []);
  const value = useMemo(() => ({ events, referenceNow: source.lastProcessedAt, openEvent }), [events, source.lastProcessedAt, openEvent]);
  const selectedEvent = selectedId ? events.find((event) => event.id === selectedId) : undefined;
  return (
    <EconomicEventContext.Provider value={value}>
      {children}
      {selectedId ? (
        <EconomicEventDialog
          event={selectedEvent}
          referenceNow={source.lastProcessedAt}
          products={source.products ?? game.products ?? []}
          onClose={closeEvent}
        />
      ) : null}
    </EconomicEventContext.Provider>
  );
}
