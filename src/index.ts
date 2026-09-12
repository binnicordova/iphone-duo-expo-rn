export { DuoFoldProvider, type DuoFoldProviderProps } from './components/DuoFoldProvider';
export { DuoFoldView, type DuoFoldViewProps } from './components/DuoFoldView';
export { withDuoFold } from './components/withDuoFold';

export {
  useDuoFold,
  useOptionalDuoFold,
  useDuoFoldState,
  useDuoFoldStatus,
  useDuoFoldTilt,
} from './hooks/useDuoFold';

export {
  DEFAULT_FOLD_PARAMETERS,
  TILT_LIMIT_DEGREES,
  eyeDistanceDp,
  foldBlurRadiusDp,
  foldBlurStrength,
  foldDarkenAlpha,
  hingeSideForTilt,
  sampleUiPlane,
  solveFoldTransform,
} from './core/foldGeometry';

export { FoldMotionModel, MOTION_DEFAULTS } from './core/FoldMotionModel';
export { DuoFoldEngine, type DuoFoldEngineOptions } from './motion/DuoFoldEngine';

export * from './DuoFold.types';

export { default } from './IphoneDuoExpoRnModule';
