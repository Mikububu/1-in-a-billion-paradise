import 'dotenv/config';
import { swissEngine } from './src/services/swissEphemeris';

async function main() {
  console.log('🔮 Testing Human Design calculation for Michael\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Michael's birth data
  const payload = {
    birthDate: '1968-08-23',
    birthTime: '13:50',
    timezone: 'Europe/Vienna',
    latitude: 46.6167,
    longitude: 13.85,
    relationshipIntensity: 5,
    relationshipMode: 'sensual' as const,
    primaryLanguage: 'en' as const,
  };

  console.log('📋 Birth Data:');
  console.log(`   Date: ${payload.birthDate}`);
  console.log(`   Time: ${payload.birthTime}`);
  console.log(`   Timezone: ${payload.timezone}`);
  console.log(`   Location: Villach, Austria (${payload.latitude}, ${payload.longitude})\n`);

  try {
    const placements = await swissEngine.computePlacements(payload);

    console.log('✨ Tropical (Western) Placements:');
    console.log(`   Sun: ${placements.sunSign} (${placements.sunLongitude.toFixed(2)}°)`);
    console.log(`   Moon: ${placements.moonSign} (${placements.moonLongitude.toFixed(2)}°)`);
    console.log(`   Rising: ${placements.risingSign} (${placements.ascendantLongitude.toFixed(2)}°)\n`);

    if (placements.humanDesign) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🧬 HUMAN DESIGN CALCULATION:');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`   Type: ${placements.humanDesign.type}`);
      console.log(`   Strategy: ${placements.humanDesign.strategy}`);
      console.log(`   Authority: ${placements.humanDesign.authority}`);
      console.log(`   Profile: ${placements.humanDesign.profile}`);
      console.log(`   Incarnation Cross: ${placements.humanDesign.incarnationCross}`);
      console.log(`   Defined Centers: ${placements.humanDesign.definedCenters.join(', ')}`);
      console.log(`   Active Gates: ${placements.humanDesign.activeGates.join(', ')}`);
      console.log(`   Active Channels: ${placements.humanDesign.activeChannels.join(', ')}\n`);
    } else {
      console.error('❌ No Human Design data calculated!');
    }

    if (placements.geneKeys) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔑 GENE KEYS CALCULATION:');
      console.log('═══════════════════════════════════════════════════════════\n');
      if (placements.geneKeys.lifesWork) {
        console.log(`   Life's Work: Gene Key ${placements.geneKeys.lifesWork.geneKey}.${placements.geneKeys.lifesWork.line}`);
        console.log(`      Shadow: ${placements.geneKeys.lifesWork.shadow}`);
        console.log(`      Gift: ${placements.geneKeys.lifesWork.gift}`);
        console.log(`      Siddhi: ${placements.geneKeys.lifesWork.siddhi}\n`);
      }
      if (placements.geneKeys.evolution) {
        console.log(`   Evolution: Gene Key ${placements.geneKeys.evolution.geneKey}.${placements.geneKeys.evolution.line}`);
        console.log(`      Shadow: ${placements.geneKeys.evolution.shadow}`);
        console.log(`      Gift: ${placements.geneKeys.evolution.gift}`);
        console.log(`      Siddhi: ${placements.geneKeys.evolution.siddhi}\n`);
      }
    } else {
      console.error('❌ No Gene Keys data calculated!');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
