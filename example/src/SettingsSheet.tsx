import { useDuoFold, useDuoFoldStatus, useDuoFoldTilt } from 'iphone-duo-expo-rn';
import { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { TiltSlider } from './TiltSlider';

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  maxTilt: number;
}

/**
 * The reference app's settings dialog: live tilt readout, a manual slider, a
 * sensor/manual switch, the auto-calibrate toggle and Recalibrate.
 */
export function SettingsSheet({ visible, onClose, maxTilt }: SettingsSheetProps) {
  const fold = useDuoFold();
  const { hasSensor, source } = useDuoFoldStatus();
  const tilt = useDuoFoldTilt(20);
  const [autoRecenter, setAutoRecenter] = useState(true);

  const usingSensor = source === 'sensor';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Settings</Text>
          <Text style={styles.readout}>
            Tilt: {tilt.toFixed(1)}° · hinge {tilt < 0 ? 'L' : 'R'}
          </Text>
          {!hasSensor ? (
            <Text style={styles.warning}>No motion sensor — manual mode</Text>
          ) : null}

          <TiltSlider
            value={tilt}
            minimum={-maxTilt}
            maximum={maxTilt}
            // Dragging in sensor mode drops to manual, so the effect stays
            // inspectable on a simulator.
            onChange={(next) => fold.setManualTilt(next)}
          />

          <Row label={usingSensor ? 'Sensor' : 'Manual'}>
            <Switch
              value={usingSensor}
              disabled={!hasSensor}
              onValueChange={(next) => fold.setManualTilt(next ? null : tilt)}
            />
          </Row>

          <Row label="Auto-calibrate">
            <Switch
              value={autoRecenter}
              onValueChange={(next) => {
                setAutoRecenter(next);
                fold.setAutoRecenterEnabled(next);
              }}
            />
          </Row>

          <TouchableOpacity style={styles.button} onPress={() => fold.recalibrate()}>
            <Text style={styles.buttonLabel}>Recalibrate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.done} onPress={onClose}>
            <Text style={styles.doneLabel}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: '#14141A' },
  readout: { marginTop: 8, fontSize: 13, color: '#14141A' },
  warning: { marginTop: 4, fontSize: 12, color: '#B54708' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowLabel: { flex: 1, fontSize: 14, color: '#14141A' },
  button: {
    marginTop: 14,
    backgroundColor: '#2E7CF6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: { color: '#FFFFFF', fontWeight: '600' },
  done: { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
  doneLabel: { color: '#2E7CF6', fontWeight: '600' },
});
