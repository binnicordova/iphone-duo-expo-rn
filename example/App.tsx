import { DuoFoldProvider } from 'iphone-duo-expo-rn';
import { StatusBar } from 'react-native';
import { useState } from 'react';

import { DemoScreen } from './src/DemoScreen';
import { SettingsSheet } from './src/SettingsSheet';

const MAX_TILT = 45;

export default function App() {
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <DuoFoldProvider parameters={{ maxTiltDegrees: MAX_TILT }}>
      <StatusBar barStyle="dark-content" />
      <DemoScreen onSettingsPress={() => setSettingsVisible(true)} />
      {/* Rendered inside the provider so `useDuoFold()` can reach the context.
          A Modal draws in its own window, so the sheet itself stays unfolded. */}
      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        maxTilt={MAX_TILT}
      />
    </DuoFoldProvider>
  );
}
