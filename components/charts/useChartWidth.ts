import {useCallback, useState} from 'react';
import {LayoutChangeEvent} from 'react-native';

/** Gifted-charts' `width` excludes the y-axis labels, so measure the real container and subtract them. */
export function useChartWidth(yAxisLabelWidth: number) {
  const [containerWidth, setContainerWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setContainerWidth(Math.floor(e.nativeEvent.layout.width)), []);
  return {onLayout, width: Math.max(0, containerWidth - yAxisLabelWidth - 12), ready: containerWidth > 0};
}
