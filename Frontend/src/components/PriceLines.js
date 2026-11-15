import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatPence } from './ProductCard';
import { Colors, Typography } from '../theme';

const REDUCING = new Set(['discount', 'coupon', 'loyalty']);

/**
 * The server's price lines for one order (discounts, coupons, fees, tip).
 * Amounts are signed pence exactly as the server computed them; this only
 * formats them. Reductions show in green with a minus sign.
 */
export default function PriceLines({ lines, showInfo = true, style }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <View style={style}>
      {lines.map((line, i) => {
        const reduces = REDUCING.has(line.kind);
        return (
          <View key={`${line.kind}-${line.code}-${i}`} style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.label}>{line.label || line.code}</Text>
              {showInfo && line.info ? <Text style={styles.info}>{line.info}</Text> : null}
            </View>
            <Text style={[styles.value, reduces && styles.reduce]}>
              {reduces ? `-${formatPence(-line.amount)}` : formatPence(line.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4 },
  label: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary },
  info: { fontFamily: Typography.family.regular, fontSize: 11, color: Colors.muted, marginTop: 1 },
  value: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  reduce: { color: Colors.successText },
});
