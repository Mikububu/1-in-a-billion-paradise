/**
 * SONG GENERATION SERVICE
 * 
 * Generates a full song with vocals using MiniMax Music API.
 * Takes lyrics and generates a 3-minute song with deep male vocals,
 * dark poetic style (70% Leonard Cohen, 20% Paul Simon, 10% Tom Waits).
 */

import { apiKeys } from './apiKeysHelper';
import axios from 'axios';

// CORRECT API endpoint per MiniMax docs: https://platform.minimax.io/docs/api-reference/music-generation
const MINIMAX_MUSIC_BASE_URL = 'https://api.minimax.io';

export interface Persona {
  id: string;
  name: string;
  weight: number;
  style_tags: string[];
}

export interface SongGenerationInput {
  lyrics: string;
  personName: string;
  style?: string;
  emotion?: string;
  duration?: number; // seconds, default 180 (3 minutes)
  personas?: Persona[]; // Dynamic mixer configuration
  customPrompt?: string; // NEW: LLM-generated custom prompt (overrides default)
}

export interface SongGenerationResult {
  audioUrl?: string;
  audioBase64?: string;
  duration: number;
  traceId?: string;
}

/**
 * Generate a full song with vocals using MiniMax Music API
 * 
 * Cost: ~$0.0825 per song (1 credit = 1 song)
 */
export async function generateSong(input: SongGenerationInput): Promise<SongGenerationResult> {
  const { lyrics, personName, style = 'dark_poetic', emotion = 'intimate', duration = 180, personas, customPrompt } = input;

  try {
    // Get API key
    const apiKey = await apiKeys.minimax();

    // Use custom prompt from LLM if provided (NEW: Psychological Pipeline)
    let prompt: string;

    if (customPrompt) {
      // LLM decided the perfect style - use it directly!
      prompt = customPrompt;
      console.log(`🎵 Using LLM-generated custom prompt for ${personName}`);
      console.log(`   Prompt: ${prompt.substring(0, 150)}...`);
    } else if (personas && personas.length > 0) {
      // Dynamic prompt from mixer (legacy)
      const mixDesc = personas
        .filter(p => p.weight > 0)
        .map(p => `${p.weight}% ${p.name} (${p.style_tags.join(', ')})`)
        .join(', ');

      const stylePrompt = `Style: ${mixDesc}. The song should feel dark, beautiful, minimal, and emotionally intimate using the specified artist influences.`;
      prompt = `A dark, poetic song with deep male vocals. ${stylePrompt} Use sparse instrumentation: piano, acoustic guitar, subtle strings. The vocal should be a deep, resonant male voice with emotional depth and intimacy.`;
      console.log(`🎵 Using persona mixer prompt for ${personName}`);
    } else {
      // Fallback hardcoded prompt (if somehow no custom prompt provided)
      const stylePrompt = `Style: 70% Leonard Cohen (deep, philosophical, minimal), 20% Paul Simon (melodic, introspective), 10% Tom Waits (raw, intimate). The song should feel dark, beautiful, minimal, and emotionally intimate—NOT pop or commercial.`;
      prompt = `A dark, poetic song with deep male vocals. ${stylePrompt} Use sparse instrumentation: piano, acoustic guitar, subtle strings. The vocal should be a deep, resonant male voice with emotional depth and intimacy.`;
      console.log(`🎵 Using fallback prompt for ${personName}`);
    }

    console.log(`🎵 Generating song for ${personName} (${duration}s)...`);

    const response = await axios({
      method: 'POST',
      url: `${MINIMAX_MUSIC_BASE_URL}/v1/music_generation`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: 'music-2.0', // Updated per MiniMax docs
        prompt,
        lyrics,
        output_format: 'url', // Get URL instead of hex-encoded audio
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3',
        },
      },
      timeout: 300000, // 5 minutes timeout (song generation can take time)
    });

    if (response.status !== 200) {
      throw new Error(`MiniMax API returned status ${response.status}`);
    }

    const baseResp = response.data?.base_resp;
    if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
      throw new Error(`MiniMax error ${baseResp.status_code}: ${baseResp.status_msg || 'unknown'}`);
    }

    const data = response.data?.data;
    if (!data) {
      const snippet = JSON.stringify(response.data || {}).slice(0, 500);
      throw new Error(`No data in MiniMax response (snippet=${snippet})`);
    }

    // Music 2.0 API returns:
    // - data.audio: hex-encoded audio OR URL (depending on output_format)
    // - data.status: 2 = success
    // - extra_info.music_duration: duration in ms
    const audioData = data.audio;
    const extraInfo = response.data?.extra_info;
    const songDuration = extraInfo?.music_duration ? Math.round(extraInfo.music_duration / 1000) : duration;
    const traceId = response.data.trace_id;

    if (!audioData) {
      throw new Error('No audio data in MiniMax response');
    }

    // Determine if we got a URL or hex-encoded audio
    const isUrl = typeof audioData === 'string' && audioData.startsWith('http');
    const audioUrl = isUrl ? audioData : undefined;
    const audioBase64 = !isUrl ? Buffer.from(audioData, 'hex').toString('base64') : undefined;

    console.log(`✅ Song generated successfully (${songDuration}s)`);
    if (audioUrl) {
      console.log(`   Audio URL: ${audioUrl.substring(0, 50)}...`);
    } else if (audioBase64) {
      console.log(`   Audio Base64: ${audioBase64.length} chars`);
    }

    return {
      audioUrl,
      audioBase64,
      duration: songDuration,
      traceId,
    };
  } catch (error: any) {
    console.error('❌ Song generation failed:', error);

    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data));
      throw new Error(`MiniMax API error: ${error.response.data?.error?.message || error.response.statusText}`);
    }

    throw new Error(`Failed to generate song: ${error.message}`);
  }
}

/**
 * Download audio from URL and convert to base64 if needed
 */
export async function downloadSongAudio(audioUrl: string): Promise<string> {
  try {
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    // Convert to base64
    const buffer = Buffer.from(response.data);
    return buffer.toString('base64');
  } catch (error: any) {
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}

