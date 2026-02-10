/**
 * STORAGE INSPECTOR - Debug Component
 * 
 * Add this to any screen to see what's in AsyncStorage
 * Import: import { StorageInspector } from '@/components/StorageInspector';
 * Use: <StorageInspector />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '@/theme/tokens';

export const StorageInspector = () => {
  const [data, setData] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  const inspect = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const profileData = await AsyncStorage.getItem('profile-storage');
      const authData = await AsyncStorage.getItem('auth-storage');
      
      let profile = null;
      let auth = null;
      
      if (profileData) {
        const parsed = JSON.parse(profileData);
        profile = parsed?.state || parsed;
      }
      
      if (authData) {
        const parsed = JSON.parse(authData);
        auth = parsed?.state || parsed;
      }
      
      setData({
        keys,
        profile,
        auth,
        people: profile?.people || [],
      });
      setVisible(true);
    } catch (err) {
      console.error('Storage inspect error:', err);
    }
  };

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.fab}
        onPress={inspect}
      >
        <Text style={styles.fabText}>🔍</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📦 AsyncStorage Inspector</Text>
          <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗂️ All Keys ({data?.keys?.length || 0})</Text>
          {data?.keys?.map((key: string, idx: number) => (
            <Text key={idx} style={styles.keyText}>• {key}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 People in Profile Store ({data?.people?.length || 0})</Text>
          {data?.people?.map((person: any, idx: number) => (
            <View key={idx} style={styles.personCard}>
              <Text style={styles.personName}>
                {idx + 1}. {person.name} {person.isUser ? '(YOU)' : ''}
              </Text>
              <Text style={styles.personDetail}>ID: {person.id}</Text>
              <Text style={styles.personDetail}>Email: {person.email || 'N/A'}</Text>
              <Text style={styles.personDetail}>
                Birth: {person.birthData?.birthDate || 'N/A'}
              </Text>
              <Text style={styles.personDetail}>
                Placements: {person.placements?.sunSign || '❌'} / {person.placements?.moonSign || '❌'} / {person.placements?.risingSign || '❌'}
              </Text>
              <Text style={styles.personDetail}>
                Created: {person.createdAt}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Auth Store</Text>
          <Text style={styles.detail}>Display Name: {data?.auth?.displayName || 'N/A'}</Text>
          <Text style={styles.detail}>User ID: {data?.auth?.user?.id || 'N/A'}</Text>
          <Text style={styles.detail}>Has Session: {data?.auth?.session ? 'YES' : 'NO'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.locationText}>
            🎯 Location: AsyncStorage → "profile-storage" → state.people[]
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 9999,
  },
  fabText: {
    fontSize: 24,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex: 10000,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 40,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.text,
  },
  closeButton: {
    padding: 10,
  },
  closeText: {
    fontSize: 24,
    color: colors.text,
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
    marginBottom: 10,
  },
  keyText: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 4,
  },
  personCard: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  personName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  personDetail: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 3,
  },
  detail: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.text,
    marginBottom: 5,
  },
  locationText: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.accent,
    fontStyle: 'italic',
  },
});

