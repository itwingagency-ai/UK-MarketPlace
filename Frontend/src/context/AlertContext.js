import React, { createContext, useState, useContext, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alertConfig, setAlertConfig] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  const showAlert = useCallback((config) => {
    setAlertConfig(config);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const hideAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true })
    ]).start(() => setAlertConfig(null));
  }, [fadeAnim, scaleAnim]);

  const handleConfirm = () => {
    if (alertConfig?.onConfirm) {
      alertConfig.onConfirm();
    }
    hideAlert();
  };

  const handleCancel = () => {
    if (alertConfig?.onCancel) {
      alertConfig.onCancel();
    }
    hideAlert();
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alertConfig && (
        <Modal transparent visible={true} animationType="none" onRequestClose={handleCancel}>
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancel} />
            <Animated.View style={[styles.alertBox, { transform: [{ scale: scaleAnim }] }]}>
              
              {alertConfig.icon !== false && (
                <View style={[styles.iconWrapper, alertConfig.isDestructive && { backgroundColor: '#FEE2E2' }]}>
                  <Feather 
                    name={alertConfig.icon || (alertConfig.isDestructive ? 'alert-triangle' : 'info')} 
                    size={28} 
                    color={alertConfig.isDestructive ? '#EF4444' : Colors.primary} 
                  />
                </View>
              )}

              <Text style={styles.title}>{alertConfig.title}</Text>
              
              {alertConfig.message && (
                <Text style={styles.message}>{alertConfig.message}</Text>
              )}

              <View style={styles.actions}>
                {alertConfig.showCancel !== false && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
                    <Text style={styles.cancelText}>{alertConfig.cancelText || 'Cancel'}</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[styles.confirmBtn, alertConfig.isDestructive && { backgroundColor: '#EF4444' }]} 
                  onPress={handleConfirm} 
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmText}>{alertConfig.confirmText || 'Confirm'}</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

export const useCustomAlert = () => useContext(AlertContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    zIndex: 9999,
  },
  alertBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadow.lg,
  },
  iconWrapper: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
