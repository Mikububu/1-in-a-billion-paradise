/**
 * ADD MINIMAX API KEY TO SUPABASE
 * 
 * Adds the MiniMax API key to the Supabase api_keys table.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';

const MINIMAX_API_KEY = 'sk-api-xWT7nhj_tK-5XckrK03LCM_CSAlQuzODSgicp0RvVuZc6rtNpjAaT3FhEHvgHg2kDTEJ1c-XLSZO86DWa6bUtvo-IKqIuXDG_dzYLuarZhlm5yo9M7cS7P0';

async function addMinimaxKey() {
  console.log('🔧 Adding MiniMax API key to Supabase...');

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase service client not available');
    process.exit(1);
  }

  // Check if key already exists
  const { data: existing, error: checkError } = await supabase
    .from('api_keys')
    .select('id, service, key_name')
    .eq('service', 'minimax')
    .single();

  if (existing && !checkError) {
    console.log('⚠️ MiniMax key already exists. Updating...');
    
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({
        token: MINIMAX_API_KEY,
        key_name: 'main',
        description: 'MiniMax API key for music/song generation',
        updated_at: new Date().toISOString(),
      })
      .eq('service', 'minimax');

    if (updateError) {
      console.error('❌ Failed to update MiniMax key:', updateError.message);
      process.exit(1);
    }

    console.log('✅ MiniMax API key updated successfully');
  } else {
    console.log('📝 Inserting new MiniMax key...');
    
    const { error: insertError } = await supabase
      .from('api_keys')
      .insert({
        service: 'minimax',
        key_name: 'main',
        token: MINIMAX_API_KEY,
        description: 'MiniMax API key for music/song generation',
      });

    if (insertError) {
      console.error('❌ Failed to insert MiniMax key:', insertError.message);
      process.exit(1);
    }

    console.log('✅ MiniMax API key added successfully');
  }

  // Verify the key was saved
  const { data: verify, error: verifyError } = await supabase
    .from('api_keys')
    .select('service, key_name, description')
    .eq('service', 'minimax')
    .single();

  if (verifyError || !verify) {
    console.error('❌ Failed to verify MiniMax key:', verifyError?.message);
    process.exit(1);
  }

  console.log('✅ Verification successful:');
  console.log(`   Service: ${verify.service}`);
  console.log(`   Key Name: ${verify.key_name}`);
  console.log(`   Description: ${verify.description}`);
}

// Run if called directly
if (require.main === module) {
  addMinimaxKey()
    .then(() => {
      console.log('🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { addMinimaxKey };

