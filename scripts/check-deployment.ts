
import axios from 'axios';

const BACKEND_URL = 'https://1-in-a-billion-backend.fly.dev';

async function checkDeployment() {
    console.log(`Checking deployment status for: ${BACKEND_URL}`);

    try {
        const start = Date.now();
        const response = await axios.get(`${BACKEND_URL}/health`);
        const duration = Date.now() - start;

        if (response.status === 200) {
            console.log('\n✅ DEPLOYMENT CONFIRMED!');
            console.log(`Status: ${response.status} OK`);
            console.log(`Latency: ${duration}ms`);
            console.log('Response:', response.data);
            console.log('\nThe backend is live and responding correctly.');
        } else {
            console.log(`\n⚠️ WARNING: Backend returned status ${response.status}`);
            console.log('Response:', response.data);
        }
    } catch (error: any) {
        console.error('\n❌ DEPLOYMENT CHECK FAILED');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        console.log('\nPossible causes:');
        console.log('1. Deployment is still in progress (check GitHub Actions).');
        console.log('2. The app crashed on start (check Fly.io logs).');
        console.log('3. DNS is distinct/propagating.');
    }
}

checkDeployment();
