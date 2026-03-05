import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../utils/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Student {
    id: string;
    name: string;
    rollNo: string;
    status: 'present' | 'absent' | 'unmarked';
}

interface Props {
    student: Student;
    onStatusChange: (id: string, status: 'present' | 'absent' | 'unmarked') => void;
}

const SwipeableStudentCard: React.FC<Props> = ({ student, onStatusChange }) => {
    const translateX = useSharedValue(0);
    const status = student.status;

    // Reset position when status changes externally (e.g. checkbox)
    useEffect(() => {
        if (status === 'unmarked') {
            translateX.value = withSpring(0);
        } else if (status === 'present') {
            // Keep it centered but styled, or swipe it off? The requirement says "change background", implies it stays in list.
            // User said: "Swipe Right -> Mark student as Present". "Status change must be instant and visible". "Swipes should snap back smoothly".
            // This usually means the card snaps back to 0 but changes color.
            translateX.value = withSpring(0);
        } else if (status === 'absent') {
            translateX.value = withSpring(0);
        }
    }, [status]);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20]) // Prevent accidental swipes while scrolling vertically
        .onUpdate((event) => {
            translateX.value = event.translationX;
        })
        .onEnd(() => {
            if (translateX.value > SWIPE_THRESHOLD) {
                // Swiped Right -> Present
                runOnJS(HapticFeedback.success)();
                runOnJS(onStatusChange)(student.id, 'present');
            } else if (translateX.value < -SWIPE_THRESHOLD) {
                // Swiped Left -> Absent
                runOnJS(HapticFeedback.error)();
                runOnJS(onStatusChange)(student.id, 'absent');
            }
            // Always snap back
            translateX.value = withSpring(0);
        });

    const animatedStyle = useAnimatedStyle(() => {
        // Interpolate background color based on status PROP, not swipe position, for the final state.
        // But during swipe, we want feedback.

        // Let's mix both. If swiping, show swipe color. If idle, show status color.

        let backgroundColor;

        // Base colors
        const colorUnmarked = '#FFFFFF';
        const colorPresent = '#DCFCE7'; // Light green
        const colorAbsent = '#FEE2E2'; // Light red

        if (status === 'present') backgroundColor = colorPresent;
        else if (status === 'absent') backgroundColor = colorAbsent;
        else backgroundColor = colorUnmarked;

        // Dynamic overlay during swipe?
        // Actually, interpolation on translationX provides the "feedback" during swipe
        // We can interpolate from current status color to the target color

        const swipeOverlayColor = interpolateColor(
            translateX.value,
            [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
            [colorAbsent, backgroundColor, colorPresent] // Left=Red, Center=Current, Right=Green
        );

        return {
            transform: [{ translateX: translateX.value }],
            backgroundColor: swipeOverlayColor,
        };
    });


    // Left Icon (Absent - appears when swiping right? No, swiping RIGHT means presenting, so we show PRESENT icon on LEFT side of card? 
    // Usually: Swipe Right (move card right) reveals something on left.
    // Spec: "Swipe Right -> Mark student as Present". Moving card right reveals the "Left Action" which is visually behind.
    // But here we are moving the CARD itself.
    // Let's simply change the card color and maybe show an icon overlay.

    return (
        <View style={styles.container}>
            {/* Background Layers for swipe feedback (optional, but good for "revealing" actions) 
                However, spec says "Card turns green/red". 
            */}

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.card, animatedStyle]}>
                    <View style={styles.cardContent}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{student.name.charAt(0)}</Text>
                        </View>

                        <View style={styles.info}>
                            <Text style={styles.name}>{student.name}</Text>
                            <Text style={styles.roll}>{student.rollNo}</Text>
                        </View>

                        <View style={styles.statusContainer}>
                            <TouchableOpacity
                                onPress={() => {
                                    // Cycle status: unmarked -> present -> absent -> unmarked
                                    const next = status === 'unmarked' ? 'present' : status === 'present' ? 'absent' : 'unmarked';
                                    onStatusChange(student.id, next);
                                }}
                                style={[
                                    styles.checkbox,
                                    status === 'present' && styles.checkboxPresent,
                                    status === 'absent' && styles.checkboxAbsent
                                ]}
                            >
                                {status === 'present' && <Ionicons name="checkmark" size={16} color="#fff" />}
                                {status === 'absent' && <Ionicons name="close" size={16} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Swipe Feedback Icons floating or overlay */}
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4B5563',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    roll: {
        fontSize: 14,
        color: '#6B7280',
    },
    statusContainer: {
        marginLeft: 10,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#D1D5DB', // Gray border for unmarked
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    checkboxPresent: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    checkboxAbsent: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
});

export default SwipeableStudentCard;
