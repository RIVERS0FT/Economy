import type { GameTutorialController } from '../game-guide/useGameTutorial';
import { Button, StatusTag } from './ui/layout';

export function GameGuideStrip({ tutorial }: { tutorial: GameTutorialController }) {
  if (!tutorial.isVisible || !tutorial.currentStep) return null;

  const progress = Math.round((tutorial.currentStepIndex / tutorial.totalSteps) * 100);
  return (
    <section className="game-guide-strip" aria-labelledby="game-guide-title">
      <div className="game-guide-heading">
        <div>
          <span>基础教程</span>
          <strong id="game-guide-title">{tutorial.currentStep.title}</strong>
        </div>
        <StatusTag tone="info">步骤 {tutorial.currentStepIndex}/{tutorial.totalSteps}</StatusTag>
      </div>
      <div
        className="game-guide-progress"
        role="progressbar"
        aria-label="基础教程进度"
        aria-valuemin={0}
        aria-valuemax={tutorial.totalSteps}
        aria-valuenow={tutorial.currentStepIndex}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>{tutorial.currentStep.description}</p>
      <div className="game-guide-actions">
        <Button onClick={tutorial.openCurrentTarget}>{tutorial.currentStep.actionLabel}</Button>
        <Button variant="text" onClick={tutorial.hide}>暂时隐藏</Button>
      </div>
    </section>
  );
}
