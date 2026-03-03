/**
 * 날짜/시간 파싱 유틸리티
 * NaN 방지를 위한 안전한 Date 파싱 함수들
 */

/**
 * 안전하게 Date 객체를 파싱합니다.
 * 유효하지 않은 입력이면 null을 반환합니다.
 */
export function safeDateParse(input: string | undefined | null): Date | null {
    if (!input || typeof input !== 'string' || input.trim() === '') return null;
    try {
        const date = new Date(input);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch {
        return null;
    }
}

/**
 * 안전하게 날짜를 포맷팅합니다.
 * 파싱 실패 시 fallback 문자열을 반환합니다.
 */
export function safeFormatDate(
    input: string | undefined | null,
    fallback: string = '로딩 중...'
): string {
    const date = safeDateParse(input);
    if (!date) return fallback;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 안전하게 시간을 포맷팅합니다 (HH:MM).
 * 파싱 실패 시 fallback 문자열을 반환합니다.
 */
export function safeFormatTime(
    input: string | undefined | null,
    fallback: string = ''
): string {
    const date = safeDateParse(input);
    if (!date) return fallback;
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * 안전하게 로컬 시간 문자열을 반환합니다.
 * toLocaleTimeString 호출 전에 유효성을 검사합니다.
 */
export function safeLocaleTimeString(
    input: string | undefined | null,
    locale: string = 'ko-KR',
    options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
    fallback: string = ''
): string {
    const date = safeDateParse(input);
    if (!date) return fallback;
    try {
        return date.toLocaleTimeString(locale, options);
    } catch {
        return fallback;
    }
}
