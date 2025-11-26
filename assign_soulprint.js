const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env vars manually
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Connecting to Supabase...');

    // 1. Find the demo user
    // Note: listUsers requires service_role key usually.
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error listing users:', userError.message);
        // If we can't list users, we can't find the ID easily unless we know it.
        // Let's try to just insert a dummy soulprint for a known ID if we can't find email.
        // Or just fail gracefully.
        return;
    }

    const demoUser = users?.users.find(u => u.email === 'demo@soulprint.ai');
    console.log('Demo User ID:', demoUser ? demoUser.id : 'Not Found');

    if (!demoUser) {
        console.log('Creating demo user...');
        // Optional: Create if not exists, but for now just exit if not found
        return;
    }

    // 2. List some soulprints
    const { data: soulprints, error: spError } = await supabase
        .from('soulprints')
        .select('*')
        .limit(5);

    if (spError) {
        console.error('Error listing soulprints:', spError.message);
        return;
    }

    console.log('Found Soulprints:', soulprints.length);

    if (soulprints.length > 0) {
        // 3. Assign to demo user
        console.log(`Assigning soulprint data to ${demoUser.id}...`);

        // We want to COPY the data, not move the row.
        const sourceData = soulprints[0].soulprint_data;

        const { error: updateError } = await supabase
            .from('soulprints')
            .upsert({
                user_id: demoUser.id,
                soulprint_data: sourceData
            }, { onConflict: 'user_id' });

        if (updateError) console.error('Error assigning:', updateError.message);
        else console.log('Successfully assigned SoulPrint to demo user!');
    } else {
        console.log('No existing soulprints found to copy.');
    }
}

main();
