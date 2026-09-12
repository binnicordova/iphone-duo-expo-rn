import { Animated, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { getLinearGradient } from '../motion/optionalModules';

/** Resolved once at import time; `expo-linear-gradient` is optional. */
const LinearGradient = getLinearGradient();

const BAND_FALLBACK_COUNT = 48;

export interface DarkenLayerProps {
  /** `'left'` puts the opaque end on the left edge, `'right'` on the right. */
  darkEdge: 'left' | 'right';
  /** Animated opacity of the whole ramp. */
  opacity: Animated.AnimatedInterpolation<number>;
  /** Colour of the opaque end. */
  color: string;
}

/**
 * The shader's `atten` term: `1 - darkening * radius`, where the radius grows
 * linearly with the distance from the hinge. Because that makes the darkening
 * linear in x, a single static ramp scaled by an animated opacity reproduces it
 * exactly — so the layer never re-renders while the device moves.
 *
 * The ramp itself comes from `expo-linear-gradient` when it is installed, from
 * React Native's own gradient support otherwise, and from a stack of stepped
 * bands as a last resort.
 */
export function DarkenLayer({ darkEdge, opacity, color }: DarkenLayerProps) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Ramp darkEdge={darkEdge} color={color} />
    </Animated.View>
  );
}

function Ramp({ darkEdge, color }: { darkEdge: 'left' | 'right'; color: string }) {
  const transparent = toTransparent(color);
  const colors = darkEdge === 'left' ? [color, transparent] : [transparent, color];

  if (LinearGradient) {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  // React Native ships CSS-style gradients on iOS and Android; react-native-web
  // does not expose the same prop, so the web path uses the banded fallback.
  if (Platform.OS !== 'web') {
    const style = {
      experimental_backgroundImage: `linear-gradient(to right, ${colors[0]} 0%, ${colors[1]} 100%)`,
    } as unknown as ViewStyle;
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} />;
  }

  return <BandedRamp darkEdge={darkEdge} color={color} />;
}

function BandedRamp({ darkEdge, color }: { darkEdge: 'left' | 'right'; color: string }) {
  const bands = [];
  for (let i = 0; i < BAND_FALLBACK_COUNT; i++) {
    const fraction = (i + 0.5) / BAND_FALLBACK_COUNT;
    const alpha = darkEdge === 'left' ? 1 - fraction : fraction;
    bands.push(
      <View
        key={i}
        style={{
          flex: 1,
          backgroundColor: withAlpha(color, alpha),
        }}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.row]}>
      {bands}
    </View>
  );
}

/** Same colour at zero alpha, so gradients do not fade through white. */
function toTransparent(color: string): string {
  return withAlpha(color, 0);
}

function withAlpha(color: string, alpha: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1];
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
