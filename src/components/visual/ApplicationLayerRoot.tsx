import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FinancialBackdrop } from './FinancialBackdrop';

const ApplicationMapLayerContext = createContext<HTMLElement | null>(null);

export function ApplicationLayerRoot({ children }: { children: ReactNode }) {
  const [mapLayer, setMapLayer] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <FinancialBackdrop />
      <div
        ref={setMapLayer}
        className="application-map-layer"
        data-application-layer="map"
      />
      <div className="application-ui-layer" data-application-layer="ui">
        <ApplicationMapLayerContext.Provider value={mapLayer}>
          <div className="application-content-root">{children}</div>
        </ApplicationMapLayerContext.Provider>
      </div>
    </>
  );
}

export function ApplicationMapLayerPortal({ children }: { children: ReactNode }) {
  const mapLayer = useContext(ApplicationMapLayerContext);
  return mapLayer ? createPortal(children, mapLayer) : null;
}
