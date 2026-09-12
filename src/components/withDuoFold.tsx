import type { ComponentType } from 'react';

import { DuoFoldProvider } from './DuoFoldProvider';
import type { DuoFoldConfig } from '../DuoFold.types';

/**
 * Wraps a component in a {@link DuoFoldProvider}.
 *
 * Handy for Expo Router layouts and for `registerRootComponent`, where the
 * default export has to stay a component:
 *
 * ```tsx
 * // app/_layout.tsx
 * import { withDuoFold } from 'iphone-duo-expo-rn';
 * import { Stack } from 'expo-router';
 *
 * function RootLayout() {
 *   return <Stack />;
 * }
 *
 * export default withDuoFold(RootLayout);
 * ```
 */
export function withDuoFold<P extends object>(
  Component: ComponentType<P>,
  config: DuoFoldConfig = {}
): ComponentType<P> {
  function DuoFoldWrapper(props: P) {
    return (
      <DuoFoldProvider {...config}>
        <Component {...props} />
      </DuoFoldProvider>
    );
  }
  DuoFoldWrapper.displayName = `withDuoFold(${Component.displayName ?? Component.name ?? 'Component'})`;
  return DuoFoldWrapper;
}
