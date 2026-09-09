import festival from '../assets/facility-icons/food-factory.png';
import protein from '../assets/facility-icons/ranch.png';
import home from '../assets/facility-icons/furniture-factory.png';
import apparel from '../assets/facility-icons/garment-factory.png';
import restocking from '../assets/facility-icons/paper-mill.png';
import equipment from '../assets/facility-icons/machine-factory.png';
import project from '../assets/facility-icons/tool-workshop.png';

// Reuse approved full-resolution scenes without changing their source or baseline.
export const ECONOMIC_EVENT_ARTWORK: Readonly<Record<string, string>> = {
  'festival-catering': festival,
  'protein-procurement': protein,
  'home-renovation': home,
  'seasonal-apparel': apparel,
  'daily-restocking': restocking,
  'equipment-renewal': equipment,
  'public-project': project,
};
export const ECONOMIC_EVENT_FALLBACK_ARTWORK = project;
