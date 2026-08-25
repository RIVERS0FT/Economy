import type { GameTutorialController } from '../game-guide/useGameTutorial';
import { Button, StatusTag } from './ui/layout';

export function GameGuideStrip({
  tutorial,
  variant = 'panel',
}: {
  tutorial: GameTutorialController;
  variant?: 'panel' | 'outliner';
}) {
  if (!tutorial.isVisible || !tutorial.currentStep) return null;

  const progress = Math.round((tutorial.currentStepIndex / tutorial.totalSteps) * 100);
  const skipTutorial = () => {
    const confirmed = window.confirm(
      [
        '确定跳过教程吗？',
        '跳过后，本轮教程进度将被清除，教程不会再自动显示。',
        '如需重新体验，可前往“设置 / 游戏设置 / 教程”点击“重新开始教程”。',
        '跳过教程不会影响任何游戏资产或经营状态。',
      ].join('\n\n'),
    );
    if (confirmed) tutorial.skip?.();
  };

  return (
    <section
      className={variant === 'outliner' ? 'game-guide-strip game-guide-strip--outliner' : 'game-guide-strip panel'}
      aria-labelledby={variant === 'outliner' ? undefined : 'game-guide-title'}
      aria-label={variant === 'outliner' ? '当前教程任务' : undefined}
    >
      {variant === 'outliner' ? null : (
        <div className="game-guide-heading">
          <strong id="game-guide-title">教程</strong>
          <StatusTag tone="info">步骤 {tutorial.currentStepIndex}/{tutorial.totalSteps}</StatusTag>
        </div>
      )}
      {variant === 'outliner' ? (
        <div className="game-guide-outliner-step">
          <StatusTag tone="info">步骤 {tutorial.currentStepIndex}/{tutorial.totalSteps}</StatusTag>
        </div>
      ) : null}
      <div
        className="game-guide-progress"
        role="progressbar"
        aria-label="教程总体进度"
        aria-valuemin={0}
        aria-valuemax={tutorial.totalSteps}
        aria-valuenow={tutorial.currentStepIndex}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="game-guide-task">
        <strong>{tutorial.currentStep.title}</strong>
        <p>{tutorial.currentStep.description}</p>
      </div>
      <div className="game-guide-actions">
        <Button onClick={tutorial.openCurrentTarget}>{tutorial.currentStep.actionLabel}</Button>
        <Button variant="text" onClick={skipTutorial}>跳过</Button>
      </div>
    </section>
  );
}
