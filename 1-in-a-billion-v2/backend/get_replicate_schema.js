const axios = require('axios');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

(async () => {
    try {
        const url = 'https://api.replicate.com/v1/models/resemble-ai/chatterbox-turbo';
        const res = await axios.get(url, { headers: { 'Authorization': 'Bearer ' + env.REPLICATE_API_TOKEN } });
        console.log(JSON.stringify(res.data.latest_version.openapi_schema.components.schemas.Input, null, 2));
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
})();
