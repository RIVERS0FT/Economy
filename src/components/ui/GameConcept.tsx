import type { ReactNode } from 'react';
import { gameConceptDefinition, type GameConceptId } from '../../game-guide/gameConcepts';
import { SafeTooltip } from './SafeTooltip';

export function GameConcept({
  concept,
  children,
}: {
  concept: GameConceptId;
  children?: ReactNode;
}) {
  const definition = gameConceptDefinition(concept);
  return (
    <SafeTooltip
      content={(
        <span className="game-concept-tooltip">
          <strong>{definition.label}</strong>
          <span>{definition.description}</span>
        </span>
      )}
      className="game-concept-anchor"
      anchorRole="term"
      anchorTabIndex={0}
    >
      <span className="game-concept-text" data-game-concept={concept}>
        {children ?? definition.label}
      </span>
    </SafeTooltip>
  );
}
