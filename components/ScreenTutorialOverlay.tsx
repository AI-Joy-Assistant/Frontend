import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTutorial, SCREEN_TUTORIALS, TutorialItem, TutorialScreen } from '../store/TutorialContext';
import { COLORS } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 각 화면별 헤더 아이콘 (하단 바와 동일)
const SCREEN_HEADER_ICONS: Record<TutorialScreen, string> = {
    home: 'home',
    request: 'add-circle',
    chat: 'chatbubble',
    event: 'calendar',
};

const ScreenTutorialOverlay: React.FC = () => {
    const { activeScreen, markTutorialComplete, hideScreenTutorial } = useTutorial();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (activeScreen) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(titleAnim, {
                    toValue: 0,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            fadeAnim.setValue(0);
            titleAnim.setValue(20);
        }
    }, [activeScreen]);

    if (!activeScreen) {
        return null;
    }

    const tutorial = SCREEN_TUTORIALS[activeScreen];
    const items = tutorial.items;
    const headerIcon = SCREEN_HEADER_ICONS[activeScreen];

    const handleComplete = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            markTutorialComplete(activeScreen);
        });
    };

    return (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            {/* 어두운 배경 */}
            <View style={styles.backdrop} />

            {/* 헤더 */}
            <Animated.View
                style={[
                    styles.headerContainer,
                    { transform: [{ translateY: titleAnim }] }
                ]}
            >
                <View style={styles.headerIconRing}>
                    <View style={styles.headerIcon}>
                        <Ionicons name={headerIcon as any} size={32} color={'#4F46E5'} />
                    </View>
                </View>
                <Text style={styles.headerTitle}>{tutorial.title}</Text>
                <Text style={styles.headerSubtitle}>{tutorial.subtitle}</Text>
            </Animated.View>

            {/* 아이템들 (가로 한 줄 배치) */}
            <View style={styles.itemsRowContainer}>
                {items.map((item) => (
                    <TutorialItemView key={item.id} item={item} />
                ))}
            </View>

            {/* 하단 버튼 영역 */}
            <View style={styles.bottomButtonContainer}>
                <TouchableOpacity
                    onPress={handleComplete}
                    activeOpacity={0.8}
                    style={styles.completeButton}
                >
                    <LinearGradient
                        colors={['#4F46E5', '#3730A3']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientButton}
                    >
                        <Text style={styles.completeButtonText}>확인했어요</Text>
                        <Ionicons name="checkmark" size={20} color="white" style={{ marginLeft: 6 }} />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={hideScreenTutorial} style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>나중에 보기</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

// 개별 튜토리얼 아이템 컴포넌트 (가로 한 줄 배치)
const TutorialItemView: React.FC<{ item: TutorialItem }> = ({ item }) => {
    return (
        <View style={styles.itemBox}>
            {/* 아이콘 서클 (흰색 배경) */}
            <View style={styles.iconCircle}>
                <Ionicons name={item.icon as any} size={24} color={'#4F46E5'} />
            </View>

            {/* 텍스트 내용 */}
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDesc}>{item.description}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(20, 20, 30, 0.90)',
    },
    headerContainer: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.08,
        width: '100%',
        alignItems: 'center',
        zIndex: 10,
    },
    headerIconRing: {
        marginBottom: 12,
        padding: 4,
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        borderRadius: 50,
    },
    headerIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 16,
        elevation: 10,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 4,
        includeFontPadding: false,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#C7D2FE',
        fontWeight: '600',
        opacity: 0.9,
    },

    // 가로 한 줄 컨테이너
    itemsRowContainer: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.38,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        zIndex: 20,
    },
    itemBox: {
        flex: 1,
        alignItems: 'center',
        maxWidth: 110,
    },

    // Item Styles
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: 'white',
        marginBottom: 6,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    itemDesc: {
        fontSize: 12,
        fontWeight: '500',
        color: '#E0E7FF',
        lineHeight: 18,
        opacity: 0.9,
        textAlign: 'center',
    },

    // Bottom Buttons
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    completeButton: {
        width: '100%',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 12,
    },
    gradientButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 18,
    },
    completeButtonText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    skipButton: {
        padding: 12,
    },
    skipButtonText: {
        color: '#94A3B8',
        fontSize: 14,
        textDecorationLine: 'underline',
        fontWeight: '500',
    },
});

export default ScreenTutorialOverlay;
