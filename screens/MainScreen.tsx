// screens/MainScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MainScreen = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>🎉 로그인 성공! Main 화면입니다!</Text>
        </View>
    );
};

export default MainScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F111A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 20,
        color: '#fff',
    },
});
