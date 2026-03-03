import { env } from './src/config/env';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testModel() {
  const modelName = process.env.CLAUDE_MODEL;

  const { data: keys } = await supabase.from('api_keys').select('*').eq('provider', 'claude').eq('is_active', true).single();
  const apiKey = keys?.api_key || process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    console.error("Missing CLAUDE_API_KEY");
    return;
  }

  console.log(`Testing Anthropic API with model: ${modelName}`);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: modelName,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say hi.' }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );
    console.log("SUCCESS! Model is valid. Response:", response.data.content[0].text);
  } catch (error: any) {
    console.error("FAILED! Model is invalid or API error.");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testModel();
