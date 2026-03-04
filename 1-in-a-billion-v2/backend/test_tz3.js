const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

(async () => {
    try {
        const url = env.SUPABASE_URL + '/rest/v1/jobs?select=id,params&order=created_at.desc&limit=5';
        const res = await axios.get(url, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
        const data = res.data;
        if (data && data.length > 0) {
            data.forEach(j => {
                console.log(j.id);
                if (j.params && j.params.person1 && j.params.person1.birthData) {
                    console.log("P1 tz:", j.params.person1.birthData.timezone);
                } else {
                    console.log("P1 tz: None/Null");
                }
                if (j.params && j.params.person2 && j.params.person2.birthData) {
                    console.log("P2 tz:", j.params.person2.birthData.timezone);
                } else {
                    console.log("P2 tz: None/Null");
                }
            });
        } else {
            console.log("No jobs found.");
        }
    } catch (e) { console.error("Error:", e.response ? e.response.data : e.message); }
})();
