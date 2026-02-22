/**
 * VEDIC MODULES AUTODEBUG TEST
 * 
 * Comprehensive test suite for all Vedic modules:
 * - Vedic routes (vedic.ts, vedic_v2.ts)
 * - Vedic engines
 * - API endpoints
 * - Error handling
 */

import axios from 'axios';
import { env } from '../config/env';

const BASE_URL = `http://localhost:${env.PORT || 8787}`;

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await fn();
    results.push({ name, status: 'pass', details: result });
    console.log(`✅ PASS: ${name}`);
  } catch (error: any) {
    results.push({ name, status: 'fail', error: error.message });
    console.error(`❌ FAIL: ${name} - ${error.message}`);
  }
}

async function testVedicHealth() {
  await test('Vedic Health Check (v1)', async () => {
    const response = await axios.get(`${BASE_URL}/api/vedic/health`, { timeout: 5000 });
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (response.data.status !== 'ok') throw new Error('Invalid response');
    return response.data;
  });
}

async function testVedicV2Health() {
  await test('Vedic V2 Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/api/vedic-v2/health`, { timeout: 5000 });
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    return response.data;
  });
}

async function testVedicMatch() {
  await test('Vedic Match Endpoint', async () => {
    const testData = {
      person_a: {
        birthDate: '1990-01-01',
        birthTime: '12:00',
        timezone: 'UTC',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      person_b: {
        birthDate: '1992-06-15',
        birthTime: '14:30',
        timezone: 'UTC',
        latitude: 34.0522,
        longitude: -118.2437,
      },
    };

    try {
      const response = await axios.post(`${BASE_URL}/api/vedic/match`, testData, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return { status: response.status, hasData: !!response.data };
    } catch (error: any) {
      // If endpoint doesn't exist or has errors, that's OK for now
      if (error.response?.status === 404) {
        throw new Error('Endpoint not registered in server');
      }
      throw error;
    }
  });
}

async function testVedicScore() {
  await test('Vedic Score Endpoint', async () => {
    const testData = {
      person_a: {
        moon_rashi: 1,
        moon_nakshatra: 5,
        gana: 1,
        yoni: 3,
        mars_house: 7,
        seventh_house_ruler: 4,
        dasha_lord: 2,
        mahadasha_index: 0,
        gender: 0,
      },
      person_b: {
        moon_rashi: 2,
        moon_nakshatra: 8,
        gana: 2,
        yoni: 5,
        mars_house: 1,
        seventh_house_ruler: 5,
        dasha_lord: 3,
        mahadasha_index: 1,
        gender: 1,
      },
    };

    try {
      const response = await axios.post(`${BASE_URL}/api/vedic/score`, testData, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return { status: response.status, hasScore: typeof response.data.total === 'number' };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Endpoint not registered');
      }
      throw error;
    }
  });
}

async function testVedicV2Match() {
  await test('Vedic V2 Match Endpoint', async () => {
    const testData = {
      person_a: {
        moon_rashi: 1,
        moon_nakshatra: 5,
        gana: 1,
        yoni: 3,
        mars_house: 7,
        seventh_house_ruler: 4,
        dasha_lord: 2,
        mahadasha_index: 0,
        gender: 0,
      },
      person_b: {
        moon_rashi: 2,
        moon_nakshatra: 8,
        gana: 2,
        yoni: 5,
        mars_house: 1,
        seventh_house_ruler: 5,
        dasha_lord: 3,
        mahadasha_index: 1,
        gender: 1,
      },
    };

    try {
      const response = await axios.post(`${BASE_URL}/api/vedic-v2/match`, testData, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return { status: response.status, hasData: !!response.data };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Endpoint not registered');
      }
      throw error;
    }
  });
}

async function checkBackendRunning() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function runAllTests() {
  console.log('🔍 Vedic Modules Autodebug Test Suite');
  console.log('═══════════════════════════════════════════');

  const backendRunning = await checkBackendRunning();
  if (!backendRunning) {
    console.error('❌ Backend server is not running!');
    console.error('   Please start it with: npm run dev');
    process.exit(1);
  }

  console.log(`✅ Backend server is running at ${BASE_URL}`);

  // Run all tests
  await testVedicHealth();
  await testVedicV2Health();
  await testVedicMatch();
  await testVedicScore();
  await testVedicV2Match();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('═══════════════════════════════════════════');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  if (failed === 0) {
    console.log('\n✅ All Vedic module tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

