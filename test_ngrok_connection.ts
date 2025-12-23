import { checkHealth } from './lib/llm/local-client';

// Simulate Vercel Environment
process.env.OLLAMA_URL = 'https://9369552735ba.ngrok-free.app';

async function testConnection() {
    console.log(`Testing connection to: ${process.env.OLLAMA_URL}`);
    
    try {
        const isHealthy = await checkHealth();
        if (isHealthy) {
            console.log('✅ SUCCESS: Connected to Local LLM via Ngrok!');
        } else {
            console.error('❌ FAILED: Could not connect via Ngrok.');
        }
    } catch (e) {
        console.error('❌ ERROR:', e);
    }
}

testConnection();
