import LiquidGlass from 'liquid-glass-react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { LiquidGlassSurface } from '../../src/components/ui/LiquidGlassSurface';
import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop';
import '../../src/styles/globals.css';
import '../../src/styles/financial-backdrop.css';
import '../../src/styles/liquid-glass-surfaces.css';
import './liquid-glass-reference.css';

const STATIC_MOUSE_POSITION = { x: 0, y: 0 };
const STATIC_MOUSE_OFFSET = { x: 0, y: 0 };

document.documentElement.dataset.appSurface = 'auth';
document.documentElement.dataset.appBackdrop = 'auth';
document.documentElement.dataset.appTone = 'normal';

function ComparisonContent() {
  return (
    <div className="liquid-glass-reference-content" aria-hidden="true">
      <div className="liquid-glass-reference-content__mark" />
      <div className="liquid-glass-reference-content__lines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function OfficialReference() {
  return (
    <LiquidGlass
      className="liquid-glass-reference-effect"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100%',
        height: '100%',
      }}
      displacementScale={70}
      blurAmount={0}
      saturation={140}
      aberrationIntensity={2}
      elasticity={0}
      cornerRadius={24}
      padding="0"
      mode="standard"
      overLight={false}
      mouseContainer={null}
      globalMousePos={STATIC_MOUSE_POSITION}
      mouseOffset={STATIC_MOUSE_OFFSET}
    >
      <ComparisonContent />
    </LiquidGlass>
  );
}

function ComparisonHarness() {
  return (
    <div
      className="liquid-glass-reference-sampling-layer"
      data-comparison-sampling-layer="true"
    >
      <FinancialBackdrop />
      <main
        className="liquid-glass-reference-page"
        data-comparison-background="project-auth"
      >
        <section
          className="liquid-glass-reference-cell"
          data-comparison-surface="project"
          aria-label="项目组件"
        >
          <strong className="liquid-glass-reference-label">项目组件</strong>
          <div className="liquid-glass-reference-card liquid-glass-reference-card--project">
            <LiquidGlassSurface
              variant="desktopAuthCard"
              overLight={false}
              blurAmount={0}
              saturation={140}
            >
              <ComparisonContent />
            </LiquidGlassSurface>
          </div>
        </section>

        <section
          className="liquid-glass-reference-cell"
          data-comparison-surface="official"
          aria-label="官方组件"
        >
          <strong className="liquid-glass-reference-label">官方组件</strong>
          <div className="liquid-glass-reference-card liquid-glass-reference-card--official">
            <OfficialReference />
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<ComparisonHarness />);
