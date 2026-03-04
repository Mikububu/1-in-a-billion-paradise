const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

(async () => {
    try {
        const url = env.SUPABASE_URL + '/rest/v1/jobs?order=created_at.desc&limit=5';
        const res = await axios.get(url, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
        res.data.forEach(job => console.log(job.id));
    } catch (e) { console.error(e.message); }
})();
