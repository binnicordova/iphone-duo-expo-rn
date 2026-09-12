import { DuoFoldProvider } from './components/DuoFoldProvider';
import { DuoFoldView } from './components/DuoFoldView';
import { withDuoFold } from './components/withDuoFold';
import { FoldMotionModel } from './core/FoldMotionModel';
import { DEFAULT_FOLD_PARAMETERS, solveFoldTransform } from './core/foldGeometry';

/**
 * Namespace export, for `import IphoneDuoExpoRn from 'iphone-duo-expo-rn'`.
 * The named exports in `index.ts` are the primary API.
 */
const IphoneDuoExpoRnModule = {
  DuoFoldProvider,
  DuoFoldView,
  withDuoFold,
  FoldMotionModel,
  solveFoldTransform,
  DEFAULT_FOLD_PARAMETERS,
};

export default IphoneDuoExpoRnModule;
