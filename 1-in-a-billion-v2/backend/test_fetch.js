const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=');
  return acc;
}, {});

async function run() {
  try {
    const jobId = '1073415e-2a3c-438c-ad43-a441142a2041';
    const url = env.SUPABASE_URL + '/rest/v1/jobs?id=eq.' + jobId;
    const res = await axios.get(url, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
    const data = res.data;
    if (data && data.length > 0) {
      console.log('--- JOB PARAMS ---');
      console.log(JSON.stringify(data[0].params, null, 2));
      const userId = data[0].user_id;
      
      const filesRes = await axios.post(env.SUPABASE_URL + '/storage/v1/object/list/job-artifacts', 
        { prefix: userId + '/' + jobId + '/text', limit: 10 },
        { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } }
      );
      const files = filesRes.data;
      if (files.length) {
        for (const f of files) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const textRes = await axios.get(env.SUPABASE_URL + '/storage/v1/object/public/job-artifacts/' + userId + '/' + jobId + '/text/' + f.name);
          const textData = textRes.data;
          console.log('\n--- ' + f.name + ' ---');
          console.log(textData.substring(0, 500) + '...\n' + textData.substring(textData.length - 500));
        }
      }
    } else {
      console.log('Job not found in database.');
    }
  } catch (err) {
    console.error(err.message);
  }
}
run();
