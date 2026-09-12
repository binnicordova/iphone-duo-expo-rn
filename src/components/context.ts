import { createContext, useContext } from 'react';

import type { FoldParameters } from '../core/foldGeometry';
import type { DuoFoldEngine } from '../motion/DuoFoldEngine';

export interface DuoFoldContextValue {
  engine: DuoFoldEngine;
  parameters: FoldParameters;
}

export const DuoFoldContext = createContext<DuoFoldContextValue | null>(null);

/** Reads the nearest fold context, or `null` outside a provider. */
export function useDuoFoldContext(): DuoFoldContextValue | null {
  return useContext(DuoFoldContext);
}
