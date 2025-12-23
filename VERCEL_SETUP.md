# Vercel Deployment Setup

Since your AI is running locally on your computer, Vercel needs a way to reach it. We use **ngrok** for this.

## 1. Get Your Ngrok URL
Your current active ngrok URL is:
```
https://df20b581af74.ngrok-free.app
```
*(Note: If you restart ngrok, this URL will change)*

## 2. Configure Vercel Environment Variables
1. Go to your project settings in Vercel.
2. Navigate to **Environment Variables**.
3. Add these variables:
   - **Key**: `OLLAMA_URL`
   - **Value**: `https://df20b581af74.ngrok-free.app`
   - **Environments**: Production, Preview, Development
   
   - **Key**: `GEMINI_API_KEY`
   - **Value**: (Your Google Gemini API Key)
   - **Environments**: Production, Preview, Development

## 3. Redeploy
Once the variable is added, redeploy your application (or push a new commit) for the changes to take effect.

## 4. Verification
The application is now configured to:
1. Receive the questionnaire submission.
2. Send the data to your local computer via the ngrok tunnel.
3. Your local Ollama (Hermes 3) will generate the SoulPrint (taking ~1 minute).
4. The result will be sent back to Vercel and saved to the database.
