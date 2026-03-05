import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
    withDelay
} from 'react-native-reanimated';

// Let's implement our own animated text to avoid adding redash if it's not present.
import { TextInput } from 'react-native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface AnimatedAttendanceRingProps {
    percentage: number;
    color: string;
    size?: number;
    strokeWidth?: number;
    backgroundColor?: string;
}

const AnimatedAttendanceRing: React.FC<AnimatedAttendanceRingProps> = ({
    percentage,
    color,
    size = 100,
    strokeWidth = 10,
    backgroundColor = '#E5E7EB'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(400, withTiming(percentage / 100, {
            duration: 1500,
            easing: Easing.out(Easing.cubic)
        }));
    }, [percentage]);

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset = circumference * (1 - progress.value);
        return {
            strokeDashoffset,
        };
    });

    const animatedTextProps = useAnimatedProps(() => {
        return {
            text: `${Math.round(progress.value * 100)}%`,
            // @ts-ignore - needed for TextInput animation
            defaultValue: `${Math.round(progress.value * 100)}%`
        };
    });


    return (
        <View style={[{ width: size, height: size }, styles.container]}>
            <Svg width={size} height={size}>
                {/* Background Ring */}
                <Circle
                    stroke={backgroundColor}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                {/* Foreground Animated Ring */}
                <AnimatedCircle
                    stroke={color}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    // Rotate the circle so it starts from the top (-90 degrees)
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>

            <View style={StyleSheet.absoluteFillObject}>
                <View style={styles.textContainer}>
                    <AnimatedTextInput
                        underlineColorAndroid="transparent"
                        editable={false}
                        value={`${percentage}%`}
                        animatedProps={animatedTextProps}
                        style={[styles.text, { color }]}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    }
});

export default AnimatedAttendanceRing;
