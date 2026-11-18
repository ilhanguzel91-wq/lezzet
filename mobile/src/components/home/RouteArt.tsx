import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../lib/theme';

/** Decorative winding road with three stops, drawn behind the home page hero. */
export function RouteArt({ width = 320, height = 120, opacity = 1 }: { width?: number; height?: number; opacity?: number }) {
  const road = 'M8 104 C 70 108, 70 44, 132 46 S 214 104, 262 70 S 300 22, 314 16';
  return (
    <Svg width={width} height={height} viewBox="0 0 320 120" opacity={opacity} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={road} stroke={colors.onDark} strokeOpacity={0.12} strokeWidth={14} fill="none" strokeLinecap="round" />
      <Path d={road} stroke={colors.saffron} strokeWidth={3} strokeDasharray="2 9" fill="none" strokeLinecap="round" />
      {[
        [8, 104],
        [132, 46],
        [262, 70],
      ].map(([cx, cy]) => (
        <Circle key={cx} cx={cx} cy={cy} r={7} fill={colors.accent} stroke={colors.onDark} strokeWidth={2.5} />
      ))}
      <Circle cx={314} cy={16} r={5} fill={colors.saffron} />
    </Svg>
  );
}
