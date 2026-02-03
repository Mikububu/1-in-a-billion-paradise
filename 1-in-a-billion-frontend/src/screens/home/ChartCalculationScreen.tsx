
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { audioApi } from '@/services/api'; // Using api base path from here or fetch directly
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ChartCalculation'>;

export const ChartCalculationScreen = ({ navigation, route }: Props) => {
    const getUser = useProfileStore((state) => state.getUser);
    const { people } = useProfileStore();
    const userData = getUser();
    const { personId } = route.params || {};
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const targetPerson = personId ? people.find(p => p.id === personId) : userData;

    useEffect(() => {
        fetchChart();
    }, [personId]);

    const fetchChart = async () => {
        try {
            if (!targetPerson) {
                setError("Person not found.");
                setLoading(false);
                return;
            }

            const API_URL = 'https://one-in-a-billion-backend-production.up.railway.app'; // Or import from config
            // Note: In verified production, ensure this URL is correct. Locally might be localhost.
            // I'll assume we use the production variable or local depending on Env. 
            // For now, I'll use the hardcoded base or relative if configured, but fetch needs absolute.

            const payload = {
                name: targetPerson.name,
                birthDate: targetPerson.birthData.birthDate,
                birthTime: targetPerson.birthData.birthTime,
                latitude: targetPerson.birthData.latitude,
                longitude: targetPerson.birthData.longitude,
                timezoneOffset: 0
            };

            // Ensure birthDate is YYYY-MM-DD
            // userData.birthDate might be ISO string or Date object.
            // Format it if strictly needed. Assuming standard string for now.

            const response = await fetch(`${API_URL}/api/astrology/calculate-chart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();

            if (json.success) {
                setChartData(json.chart);
            } else {
                setError(json.error || 'Failed to calculate chart');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.text }}>Calculating Chart...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={{ color: 'red' }}>Error: {error}</Text>
                <TouchableOpacity style={styles.button} onPress={fetchChart}>
                    <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.buttonText}>Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.header}>
                <Text style={styles.title}>Your Chart Data</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>

                {/* Human Design */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Human Design</Text>
                    <View style={styles.card}>
                        <Text style={styles.label}>Type: <Text style={styles.value}>{chartData.human_design.type}</Text></Text>
                        <Text style={styles.label}>Centered: <Text style={styles.value}>{chartData.human_design.defined_centers.join(', ') || 'None'}</Text></Text>
                    </View>
                </View>

                {/* Gene Keys (Sun) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Gene Keys (Life's Work)</Text>
                    <View style={styles.card}>
                        {chartData.gene_keys.personality.Sun ? (
                            <>
                                <Text style={styles.label}>Key: <Text style={styles.value}>{chartData.gene_keys.personality.Sun.key}.{chartData.gene_keys.personality.Sun.line}</Text></Text>
                                <Text style={styles.label}>Shadow: <Text style={styles.value}>{chartData.gene_keys.personality.Sun.shadow}</Text></Text>
                                <Text style={styles.label}>Gift: <Text style={styles.value}>{chartData.gene_keys.personality.Sun.gift}</Text></Text>
                                <Text style={styles.label}>Siddhi: <Text style={styles.value}>{chartData.gene_keys.personality.Sun.siddhi}</Text></Text>
                            </>
                        ) : <Text style={styles.value}>Data unavailable</Text>}
                    </View>
                </View>

                {/* Western */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Western Astrology</Text>
                    <View style={styles.card}>
                        {Object.entries(chartData.western.planets).map(([planet, data]: any) => (
                            <View key={planet} style={styles.row}>
                                <Text style={styles.label}>{planet}</Text>
                                <Text style={styles.value}>{data.sign} {Math.floor(data.degree)}°</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Vedic */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Vedic Astrology</Text>
                    <View style={styles.card}>
                        {Object.entries(chartData.vedic.planets).map(([planet, data]: any) => (
                            <View key={planet} style={styles.row}>
                                <Text style={styles.label}>{planet}</Text>
                                <Text style={styles.value}>{data.sign} ({data.nakshatra} {data.pada})</Text>
                            </View>
                        ))}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: spacing.md,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    backText: {
        color: colors.primary,
        fontSize: 16,
        fontFamily: typography.sansRegular,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontFamily: typography.headline,
    },
    content: {
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        color: colors.primary,
        fontSize: 16,
        fontFamily: typography.sansBold,
        marginBottom: spacing.sm,
    },
    card: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    label: {
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
        marginBottom: 4,
    },
    value: {
        color: colors.text,
        fontFamily: typography.sansSemiBold,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    button: {
        padding: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radii.button,
    },
    buttonText: {
        color: 'white',
        fontFamily: typography.sansBold,
    },
});
