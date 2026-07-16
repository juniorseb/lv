import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

// Apparition douce (fondu + léger glissé vers le haut). Utilisée pour faire
// apparaître les cartes progressivement (Design System §9 « J'ai des options »,
// §10 transitions 200-300 ms). `delay` permet un effet en cascade (stagger).
type Props = {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
};

export default function FadeSlideIn({ children, delay = 0, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
