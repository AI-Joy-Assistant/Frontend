// 전역 Text 기본 스타일 설정 - iOS/Android에서만 NanumSquare 폰트 적용
// 웹에서는 시스템 폰트 사용
import { Text, TextInput, Platform } from 'react-native';
import { FONTS } from '../constants/Fonts';

export function applyGlobalFonts() {
    // 웹에서는 폰트 적용 안 함 (시스템 폰트 사용)
    if (Platform.OS === 'web') {
        console.log('[Font] Web platform - using system fonts');
        return;
    }

    console.log('[Font] Native platform - applying NanumSquare fonts');

    // Text 컴포넌트 기본 폰트 설정
    const oldTextRender = (Text as any).render;
    if (!oldTextRender) return;

    (Text as any).render = function (...args: any[]) {
        const origin = oldTextRender.call(this, ...args);
        if (!origin || !origin.props) return origin;

        const style = origin.props.style;
        const flatStyle = Array.isArray(style)
            ? Object.assign({}, ...style.flat().filter(Boolean))
            : style || {};

        // fontWeight에 따른 폰트 선택
        let fontFamily = FONTS.regular;
        const weight = flatStyle.fontWeight;

        if (weight === 'bold' || weight === '700') {
            fontFamily = FONTS.bold;
        } else if (weight === '800' || weight === '900') {
            fontFamily = FONTS.extraBold;
        } else if (weight === '100' || weight === '200' || weight === '300') {
            fontFamily = FONTS.light;
        } else if (weight === '600') {
            fontFamily = FONTS.bold;
        }

        return {
            ...origin,
            props: {
                ...origin.props,
                style: [
                    { fontFamily },
                    style,
                    { fontWeight: undefined }, // 폰트 파일 자체가 weight 포함
                ],
            },
        };
    };

    // TextInput 컴포넌트 기본 폰트 설정
    const oldTextInputRender = (TextInput as any).render;
    if (!oldTextInputRender) return;

    (TextInput as any).render = function (...args: any[]) {
        const origin = oldTextInputRender.call(this, ...args);
        if (!origin || !origin.props) return origin;

        return {
            ...origin,
            props: {
                ...origin.props,
                style: [{ fontFamily: FONTS.regular }, origin.props.style],
            },
        };
    };
}
