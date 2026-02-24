/**
 * EMAIL CONFIGURATION SETUP SCRIPT
 * 
 * This script helps configure Supabase email settings.
 * Note: Most email settings must be configured via Supabase Dashboard,
 * but this script provides the exact values and validates the setup.
 */

import { createSupabaseServiceClient } from '../services/supabaseClient';
import { env } from '../config/env';

const EMAIL_CONFIG = {
  senderEmail: 'noreply@1-in-a-billion.app',
  senderName: '1 In A Billion',
  frontendUrl: env.FRONTEND_URL || 'oneinabillionv2://auth',
  redirectUrls: [
    'oneinabillionv2://auth/confirm',
    'oneinabillionv2://auth/reset-password',
    'oneinabillionv2://auth/callback',
  ],
};

/**
 * Email Templates Configuration
 */
const EMAIL_TEMPLATES = {
  signup: {
    subject: 'Your 1 In A Billion verification code',
    body: `
<h2>Welcome to 1 In A Billion</h2>
<p>Enter this code in the app to verify your email:</p>
<div style="text-align: center; margin: 24px 0;">
  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f5f3f0; padding: 16px 28px; border-radius: 12px; display: inline-block;">{{ .Token }}</span>
</div>
<p style="color: #666; font-size: 14px;">This code expires in 24 hours.</p>
<p style="color: #999; font-size: 12px; margin-top: 24px;">If you didn't create an account, you can safely ignore this email.</p>
    `.trim(),
  },
  resetPassword: {
    subject: 'Reset your password for 1 In A Billion',
    body: `
<h2>Password Reset Request</h2>
<p>We received a request to reset your password. Click the link below to create a new password:</p>
<p><a href="{{ .ConfirmationURL }}" style="background-color: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
<p style="color: #666; font-size: 12px; margin-top: 24px;">For security, never share this link with anyone.</p>
    `.trim(),
  },
  magicLink: {
    subject: 'Sign in to 1 In A Billion',
    body: `
<h2>Sign In</h2>
<p>Click the link below to sign in to your account:</p>
<p><a href="{{ .ConfirmationURL }}" style="background-color: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Sign In</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
    `.trim(),
  },
};

async function validateSupabaseConnection() {
  console.log('🔍 Validating Supabase connection...');
  
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    throw new Error('❌ Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Test connection by checking auth.users table
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    throw new Error(`❌ Supabase connection failed: ${error.message}`);
  }

  console.log('✅ Supabase connection validated');
  return true;
}

function printConfigurationInstructions() {
  console.log('\n📧 EMAIL CONFIGURATION INSTRUCTIONS\n');
  console.log('═'.repeat(60));
  console.log('STEP 1: Configure Email Sender');
  console.log('═'.repeat(60));
  console.log('Go to: Supabase Dashboard → Authentication → Email Templates');
  console.log(`\nSet the following:`);
  console.log(`  From Email: ${EMAIL_CONFIG.senderEmail}`);
  console.log(`  From Name: ${EMAIL_CONFIG.senderName}`);
  
  console.log('\n═'.repeat(60));
  console.log('STEP 2: Configure Redirect URLs');
  console.log('═'.repeat(60));
  console.log('Go to: Supabase Dashboard → Authentication → URL Configuration');
  console.log(`\nSite URL: ${EMAIL_CONFIG.frontendUrl}`);
  console.log('\nAdd these Redirect URLs:');
  EMAIL_CONFIG.redirectUrls.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });

  console.log('\n═'.repeat(60));
  console.log('STEP 3: Configure Email Templates');
  console.log('═'.repeat(60));
  console.log('Go to: Supabase Dashboard → Authentication → Email Templates');
  console.log('\n📝 Signup Confirmation Template:');
  console.log('   Template: "Confirm signup"');
  console.log(`   Subject: ${EMAIL_TEMPLATES.signup.subject}`);
  console.log('\n   Body HTML:');
  console.log('   ' + EMAIL_TEMPLATES.signup.body.split('\n').join('\n   '));

  console.log('\n📝 Password Reset Template:');
  console.log('   Template: "Reset password"');
  console.log(`   Subject: ${EMAIL_TEMPLATES.resetPassword.subject}`);
  console.log('\n   Body HTML:');
  console.log('   ' + EMAIL_TEMPLATES.resetPassword.body.split('\n').join('\n   '));

  console.log('\n═'.repeat(60));
  console.log('STEP 4: Enable Email Confirmations (IMPORTANT)');
  console.log('═'.repeat(60));
  console.log('Go to: Supabase Dashboard → Authentication → Settings');
  console.log('\nEnable:');
  console.log('  ✅ Enable email confirmations');
  console.log('  ✅ Enable signup via email');
  console.log('\nThis ensures users must confirm their email before signing in.');

  console.log('\n═'.repeat(60));
  console.log('STEP 5: SMTP Configuration (Optional but Recommended)');
  console.log('═'.repeat(60));
  console.log('For production, set up custom SMTP:');
  console.log('  Go to: Settings → Auth → SMTP Settings');
  console.log('\nRecommended providers:');
  console.log('  • SendGrid (smtp.sendgrid.net:587)');
  console.log('  • Mailgun (smtp.mailgun.org:587)');
  console.log('  • AWS SES (email-smtp.region.amazonaws.com:587)');
  console.log('\nConfiguration:');
  console.log(`  SMTP Host: [your-provider]`);
  console.log(`  SMTP Port: 587 (or 465 for SSL)`);
  console.log(`  SMTP User: ${EMAIL_CONFIG.senderEmail}`);
  console.log(`  SMTP Password: [your-smtp-password]`);
  console.log(`  Sender Email: ${EMAIL_CONFIG.senderEmail}`);
  console.log(`  Sender Name: ${EMAIL_CONFIG.senderName}`);

  console.log('\n═'.repeat(60));
  console.log('STEP 6: Domain Verification (if using custom domain)');
  console.log('═'.repeat(60));
  console.log('If using noreply@1-in-a-billion.app:');
  console.log('  1. Add SPF record: v=spf1 include:supabase.co ~all');
  console.log('  2. Add DKIM record (provided by Supabase)');
  console.log('  3. Verify domain in Supabase Dashboard');

  console.log('\n═'.repeat(60));
  console.log('✅ Configuration Complete!');
  console.log('═'.repeat(60));
  console.log('\nTest the setup:');
  console.log('  1. Sign up with a test email');
  console.log('  2. Check inbox for confirmation email');
  console.log('  3. Click link to confirm');
  console.log('  4. Try password reset flow');
  console.log('\n');
}

async function main() {
  try {
    console.log('🚀 Setting up email configuration...\n');

    // Validate connection
    await validateSupabaseConnection();

    // Print configuration instructions
    printConfigurationInstructions();

    console.log('📋 Next Steps:');
    console.log('   1. Follow the instructions above to configure Supabase Dashboard');
    console.log('   2. Test email sending with a signup');
    console.log('   3. Verify redirect URLs work correctly');
    console.log('\n');

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Export templates for use in other scripts
export { EMAIL_CONFIG, EMAIL_TEMPLATES };

// Run if called directly
if (require.main === module) {
  main();
}

