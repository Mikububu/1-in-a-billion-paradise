import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme/tokens';

/**
 * SystemEssence Component
 * 
 * Displays the key identifiers (essences) for an astrological system.
 * Essences are the 2-4 most important characteristics that define a person in each system.
 * 
 * Examples:
 * - Western: Sun, Moon, Rising signs
 * - Vedic: Nakshatra, Lagna
 * - Human Design: Type, Profile
 * - Gene Keys: Life's Work gene key number
 * 
 * See: docs/SYSTEM_ESSENCES.md
 */

interface SystemEssenceProps {
  systemId: string;
  essences: any; // Person's essences object from Supabase
  placements?: any; // Legacy placements object (for Western backward compatibility)
}

export const SystemEssence: React.FC<SystemEssenceProps> = ({
  systemId,
  essences,
  placements,
}) => {
  // Western: Sun, Moon, Rising
  if (systemId === 'western') {
    const western = essences?.western || placements;
    if (!western || (!western.sunSign && !western.moonSign && !western.risingSign)) {
      return null;
    }

    return (
      <View style={styles.chipsRow}>
        {western.sunSign && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>☉ {western.sunSign}</Text>
          </View>
        )}
        {western.moonSign && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>☽ {western.moonSign}</Text>
          </View>
        )}
        {western.risingSign && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>↑ {western.risingSign}</Text>
          </View>
        )}
      </View>
    );
  }

  // Vedic: Nakshatra + Lagna (+ optionally Moon)
  if (systemId === 'vedic') {
    const vedic = essences?.vedic;
    if (!vedic || (!vedic.nakshatra && !vedic.lagna)) {
      return null;
    }

    return (
      <View style={styles.chipsRow}>
        {vedic.nakshatra && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{vedic.nakshatra}</Text>
          </View>
        )}
        {vedic.lagna && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{vedic.lagna} Lagna</Text>
          </View>
        )}
        {vedic.moonSign && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>☽ {vedic.moonSign}</Text>
          </View>
        )}
      </View>
    );
  }

  // Human Design: Type + Profile
  if (systemId === 'human_design') {
    const hd = essences?.humanDesign;
    if (!hd || (!hd.type && !hd.profile)) {
      return null;
    }

    return (
      <View style={styles.chipsRow}>
        {hd.type && hd.profile ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{hd.type} {hd.profile}</Text>
          </View>
        ) : (
          <>
            {hd.type && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{hd.type}</Text>
              </View>
            )}
            {hd.profile && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{hd.profile} Profile</Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  // Gene Keys: Life's Work (+ optionally Evolution)
  if (systemId === 'gene_keys') {
    const gk = essences?.geneKeys;
    if (!gk || !gk.lifesWork) {
      return null;
    }

    return (
      <View style={styles.chipsRow}>
        {gk.lifesWork && gk.evolution ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Gene Key {gk.lifesWork}/{gk.evolution}</Text>
          </View>
        ) : (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Gene Key {gk.lifesWork}</Text>
          </View>
        )}
      </View>
    );
  }

  // Kabbalah: Primary Sephirah + Gematria
  if (systemId === 'kabbalah') {
    const kab = essences?.kabbalah;
    if (!kab || (!kab.primarySephirah && !kab.gematria)) {
      return null;
    }

    return (
      <View style={styles.chipsRow}>
        {kab.primarySephirah && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{kab.primarySephirah}</Text>
          </View>
        )}
        {kab.gematria && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Gematria: {kab.gematria}</Text>
          </View>
        )}
      </View>
    );
  }

  // Verdict: No essences by design
  if (systemId === 'verdict') {
    return null;
  }

  // Unknown system or no essences
  return null;
};

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.text,
  },
});
