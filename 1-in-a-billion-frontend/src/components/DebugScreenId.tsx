/**
 * Debug Screen ID Component
 * Shows screen number in dev mode for easy reference
 */

import { Text, View, StyleSheet } from 'react-native';

interface DebugScreenIdProps {
  id: number | string;
}

export const DebugScreenId = ({ id }: DebugScreenIdProps) => {
  // Temporarily disabled while polishing design.
  // (We keep the component so it can be re-enabled later.)
  void id;
  return null;

  // return (
  //   <View style={styles.container}>
  //     <Text style={styles.text}>{id}</Text>
  //   </View>
  // );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});





