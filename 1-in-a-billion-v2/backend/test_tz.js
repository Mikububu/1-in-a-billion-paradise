const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

(async () => {
    try {
        const jobId = '1073415e-2a3c-438c-ad43-a441142a2041';
        const url = env.SUPABASE_URL + '/rest/v1/jobs?id=eq.' + jobId;
        const res = await axios.get(url, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
        const data = res.data;
        if (data && data.length > 0) {
            console.log(JSON.stringify(data[0].params.person1.birthData, null, 2));
            console.log(JSON.stringify(data[0].params.person2.birthData, null, 2));
        } else {
            console.log("Job not found.");
        }
    } catch (e) { console.error(e.message); }
})();
