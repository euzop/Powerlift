import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ErrorToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number; // Duration in ms
  type?: 'error' | 'warning' | 'success';
}

export default function ErrorToast({ 
  message, 
  visible, 
  onDismiss, 
  duration = 3000,
  type = 'error'
}: ErrorToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  
  // Get icon and color based on type
  const getTypeProperties = () => {
    switch (type) {
      case 'warning':
        return { 
          icon: 'warning-outline', 
          color: '#FFCC00',
          backgroundColor: 'rgba(255, 204, 0, 0.15)'
        };
      case 'success':
        return { 
          icon: 'checkmark-circle-outline', 
          color: '#00FF88',
          backgroundColor: 'rgba(0, 255, 136, 0.15)'
        };
      case 'error':
      default:
        return { 
          icon: 'alert-circle-outline', 
          color: '#FF3B4E',
          backgroundColor: 'rgba(255, 59, 78, 0.15)'
        };
    }
  };
  
  const { icon, color, backgroundColor } = getTypeProperties();
  
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;
    
    if (visible) {
      // Show toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Auto hide after duration
      hideTimeout = setTimeout(() => {
        onDismiss();
      }, duration);
    } else {
      // Hide toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [visible, translateY, opacity, duration, onDismiss]);
  
  if (!message) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateY }],
          opacity,
          top: insets.top,
          width: width - 32,
          backgroundColor,
        }
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={[styles.message, { color: '#FFFFFF' }]}>{message}</Text>
      </View>
      
      <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="#AAAAAA" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  closeButton: {
    padding: 4,
  },
}); 