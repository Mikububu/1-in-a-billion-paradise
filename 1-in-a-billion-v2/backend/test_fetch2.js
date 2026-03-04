const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

async function run() {
  try {
    const url = env.SUPABASE_URL + '/rest/v1/jobs?order=created_at.desc&limit=5';
    const res = await axios.get(url, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
    const data = res.data;
    console.log(data.map(j => ({ id: j.id, params: j.params })));
  } catch (err) {
    console.error(err.message);
  }
}
run();
