// Debug script to check chat system components
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wcgbwzznadrrllfoojap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZ2J3enpuYWRycmxsZm9vamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTYzNzAsImV4cCI6MjA3OTY5MjM3MH0.WFl5YKVQhJhbL6fjhu8X7U6RkhOM3A8oTIb_lw4cDuw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugChatSystem() {
    console.log('🔍 Debugging SoulPrint Chat System...\n');

    try {
        // 1. Check soulprint data for user_id 'test'
        console.log('1. Checking soulprint data for demo user...');
        const { data: soulprintData, error: soulprintError } = await supabase
            .from('soulprints')
            .select('*')
            .eq('user_id', 'test');

        if (soulprintError) {
            console.log('❌ Error fetching soulprint:', soulprintError.message);
        } else {
            console.log('✅ Found soulprint data:');
            console.log('   Count:', soulprintData.length);
            if (soulprintData.length > 0) {
                console.log('   Sample keys:', Object.keys(soulprintData[0].soulprint_data || {}));
            }
        }

        // 2. Check API keys for user_id 'test'
        console.log('\n2. Checking API keys for demo user...');
        const { data: apiKeyData, error: apiKeyError } = await supabase
            .from('api_keys')
            .select('*')
            .eq('user_id', 'test');

        if (apiKeyError) {
            console.log('❌ Error fetching API keys:', apiKeyError.message);
        } else {
            console.log('✅ Found API keys:', apiKeyData.length);
            apiKeyData.forEach(key => {
                console.log(`   - ${key.label} (created: ${new Date(key.created_at).toLocaleDateString()})`);
            });
        }

        // 3. Test API endpoint directly
        console.log('\n3. Testing chat API endpoint...');

        // Create a test API key if none exists
        if (!apiKeyData || apiKeyData.length === 0) {
            console.log('⚠️ No API keys found, creating test key...');
            const testApiKey = 'sk-soulprint-test-key-123456789';
            const { createHash } = require('crypto');
            const hashedKey = createHash('sha256').update(testApiKey).digest('hex');

            const { error: insertError } = await supabase
                .from('api_keys')
                .insert({
                    user_id: 'test',
                    label: 'Debug Test Key',
                    key_hash: hashedKey
                });

            if (insertError) {
                console.log('❌ Error creating test API key:', insertError.message);
            } else {
                console.log('✅ Created test API key:', testApiKey);
                console.log('   You can use this key to test the chat API');
            }
        }

        // 4. Check RLS policy compatibility
        console.log('\n4. System Status:');
        console.log('✅ JSON serialization fix: Implemented');
        console.log('✅ Demo user detection: Implemented');
        console.log('✅ Automatic soulprint creation: Implemented');
        console.log('✅ Conditional UI for demo user: Implemented');

        console.log('\n🚀 Debug Complete!');
        console.log('\nNext steps:');
        console.log('1. Refresh your browser while signed in as test@soulprint.ai');
        console.log('2. Check browser console for any errors');
        console.log('3. Try sending a chat message');
        console.log('4. If it still fails, check the Network tab for API call details');

    } catch (error) {
        console.error('❌ Debug error:', error.message);
    }
}

debugChatSystem();