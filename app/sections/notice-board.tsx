import React, { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'

export default function NoticeBoardSection() {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, scaleAnim])

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 16,
        backgroundColor: '#f5f5f5',
      }}
    >
      <Animated.View
        style={{
          width: '100%',
          maxWidth: 400,
          paddingVertical: 24,
          paddingHorizontal: 20,
          borderRadius: 16,
          backgroundColor: 'white',
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Rm Games
        </Text>
        <Text
          style={{
            fontSize: 16,
            textAlign: 'center',
            color: '#444',
          }}
        >
          विश्वास का धंदा विश्वास के साथ  💞
        </Text>
      </Animated.View>
    </View>
  )
}
