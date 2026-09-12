import { StyleSheet, View } from 'react-native';

const Ink = '#0D0D0D';
const Muted = '#5D5D5D';

/** The sidebar glyph: two stacked rules, the lower one shorter. */
export function MenuIcon() {
  return (
    <View style={styles.menu}>
      <View style={[styles.rule, { width: 15 }]} />
      <View style={[styles.rule, { width: 10, marginTop: 4 }]} />
    </View>
  );
}

/** The overflow glyph: three dots in a row. */
export function DotsIcon() {
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <View style={[styles.dot, { marginLeft: 3 }]} />
      <View style={[styles.dot, { marginLeft: 3 }]} />
    </View>
  );
}

/** The composer's attach glyph. */
export function PlusIcon() {
  return (
    <View style={styles.plus}>
      <View style={styles.plusBarH} />
      <View style={styles.plusBarV} />
    </View>
  );
}

/** A microphone: capsule, cradle and stem. */
export function MicIcon() {
  return (
    <View style={styles.mic}>
      <View style={styles.micCapsule} />
      <View style={styles.micCradle} />
      <View style={styles.micStem} />
    </View>
  );
}

/** Voice-mode waveform: four bars, tallest in the middle. */
export function WaveformIcon() {
  return (
    <View style={[styles.row, { alignItems: 'center' }]}>
      {[8, 15, 15, 8].map((height, index) => (
        <View key={index} style={[styles.bar, { height, marginLeft: index === 0 ? 0 : 3 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  menu: { alignItems: 'flex-start' },
  rule: { height: 2, borderRadius: 1, backgroundColor: Ink },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Ink },
  plus: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  plusBarH: { position: 'absolute', width: 16, height: 2, borderRadius: 1, backgroundColor: Ink },
  plusBarV: { position: 'absolute', width: 2, height: 16, borderRadius: 1, backgroundColor: Ink },
  mic: { width: 16, height: 20, alignItems: 'center' },
  micCapsule: { width: 8, height: 11, borderRadius: 4, backgroundColor: Muted },
  micCradle: {
    width: 14,
    height: 7,
    marginTop: -2,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: Muted,
  },
  micStem: { width: 2, height: 3, backgroundColor: Muted },
  bar: { width: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
});
