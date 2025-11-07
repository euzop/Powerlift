import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PowerLiftAPI from '../services/api';

type ConnectionStatusProps = {
  onRetry?: () => void;
};

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isRetrying, setIsRetrying] = useState(false);
  
  useEffect(() => {
    checkConnection();
  }, []);
  
  const checkConnection = async () => {
    setStatus('checking');
    
    try {
      await PowerLiftAPI.healthCheck();
      setStatus('connected');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setStatus('disconnected');
    }
  };
  
  const handleRetry = async () => {
    setIsRetrying(true);
    
    try {
      await checkConnection();
      if (onRetry) onRetry();
    } finally {
      setIsRetrying(false);
    }
  };
  
  if (status === 'connected') {
    return (
      <View style={[styles.container, styles.connected]}>
        <Ionicons name="checkmark-circle" size={16} color="#00FF88" />
        <Text style={styles.connectedText}>Connected to server</Text>
      </View>
    );
  }
  
  if (status === 'checking') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.statusText}>Checking connection...</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, styles.disconnected]}>
      <Ionicons name="alert-circle" size={16} color="#FF3366" />
      <Text style={styles.disconnectedText}>Not connected to backend server</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={handleRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.retryText}>Retry</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333333',
    marginVertical: 8,
  },
  connected: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  disconnected: {
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.3)',
  },
  statusText: {
    color: '#FFFFFF',
    marginLeft: 8,
  },
  connectedText: {
    color: '#00FF88',
    marginLeft: 8,
  },
  disconnectedText: {
    color: '#FF3366',
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#444444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ConnectionStatus; 