import React, { createContext, useState, useContext, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alertConfig, setAlertConfig] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  const showAlert = useCallback((config) => {
    setAlertConfig(config);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, ...Motion.springs.snappy, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const hideAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true })
    ]).start(({ finished }) => {
      // A showAlert() during the fade-out interrupts it; keep the new alert
      if (finished) setAlertConfig(null);
    });
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
                <View style={[styles.iconWrapper, alertConfig.isDestructive && styles.iconWrapperDestructive]}>
                  <Feather 
                    name={alertConfig.icon || (alertConfig.isDestructive ? 'alert-triangle' : 'info')} 
                    size={28} 
                    color={alertConfig.isDestructive ? Colors.errorText : Colors.primary} 
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
                  style={[styles.confirmBtn, alertConfig.isDestructive && styles.confirmBtnDestructive]} 
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
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 9999,
  },
  alertBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['3xl'],
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadow.xl,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
    ...Shadow.morphic3d,
  },
  iconWrapperDestructive: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.accentLight,
    shadowColor: Colors.accent,
  },
  title: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: Typography.family.semibold,
    color: Colors.text,
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDestructive: {
    backgroundColor: Colors.accent,
  },
  confirmText: {
    fontFamily: Typography.family.bold,
    color: Colors.white,
    fontSize: 15,
  },
});
