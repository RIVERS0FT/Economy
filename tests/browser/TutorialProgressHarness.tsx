import { useMemo, useState } from 'react';
import { useGameTutorial } from '../../src/game-guide/useGameTutorial';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import type { FacilityGroup } from '../../src/types';

export function TutorialProgressHarness({ base }: { base: LoadedGameViewModel }) {
  const [groups, setGroups] = useState<Record<string, FacilityGroup[]>>({});
  const [selectedProvinceId, setSelectedProvinceId] = useState('110000');
  const game = useMemo(() => ({ ...base.game, userId: base.user.id,
    provinceFacilityGroups: groups, facilityGroups: groups[selectedProvinceId] ?? [],
  }), [base.game, groups, selectedProvinceId]);
  const tutorial = useGameTutorial({ ...base, game, selectedProvinceId });
  const factoryId = base.game.facilityTypes[0].id;
  const snapshot = (provinceId: string, status: FacilityGroup['status'], lifetimeOutput: number) => ({
    ...base.game.facilityGroups[0], provinceId, facilityTypeId: factoryId,
    count: 1, status, participatingCount: status === 'running' ? 1 : 0, lifetimeOutput,
  } as FacilityGroup);
  Object.assign(window, { __tutorialFixture: {
    build: (ok: boolean, status: FacilityGroup['status'] = 'running') => {
      if (!ok) return;
      setGroups({ '110000': [snapshot('110000', status, 0)], '120000': [snapshot('120000', 'running', 100)] });
      tutorial.recordBuildSubmit(factoryId, '110000', 0);
    },
    production: (provinceId: string, output: number) => setGroups((current) => ({ ...current, [provinceId]: [snapshot(provinceId, 'running', output)] })),
    selectProvince: setSelectedProvinceId,
    restart: tutorial.restart,
  } });
  return <div data-tutorial-progress-fixture="true" data-step={tutorial.run?.currentStep ?? 'none'}
    data-target={JSON.stringify(tutorial.targetLocation)} data-ready={tutorial.ready} />;
}
