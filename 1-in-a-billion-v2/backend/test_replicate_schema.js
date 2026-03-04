const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

(async () => {
    try {
        const url = 'https://api.replicate.com/v1/models/resemble-ai/chatterbox-turbo/versions';
        const res = await axios.get(url, { headers: { 'Authorization': 'Bearer ' + env.REPLICATE_API_TOKEN } });
        const data = res.data;
        if (data && data.results && data.results.length > 0) {
            console.log(JSON.stringify(data.results[0].openapi_schema.components.schemas.Input, null, 2));
        } else {
            console.log("No versions found.");
        }
    } catch (e) { console.error("Error:", e.response ? e.response.data : e.message); }
})();
