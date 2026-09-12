import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

export interface TiltSliderProps {
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

/** A dependency-free slider, so the example installs nothing extra. */
export function TiltSlider({ value, minimum, maximum, onChange }: TiltSliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => emit(event.nativeEvent.locationX),
      onPanResponderMove: (event) => emit(event.nativeEvent.locationX),
    })
  ).current;

  function emit(x: number) {
    if (widthRef.current <= 0) return;
    const fraction = Math.min(Math.max(x / widthRef.current, 0), 1);
    onChangeRef.current(minimum + fraction * (maximum - minimum));
  }

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const fraction = (value - minimum) / (maximum - minimum);
  const thumbLeft = Math.min(Math.max(fraction, 0), 1) * Math.max(width - 20, 0);

  return (
    <View style={styles.hitArea} onLayout={onLayout} {...responder.panHandlers}>
      <View style={styles.track} />
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: 36, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#D4D4DC' },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2E7CF6',
  },
});
