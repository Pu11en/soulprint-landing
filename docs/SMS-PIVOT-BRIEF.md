# SoulPrint: The SMS Pivot

**For:** Ben  
**From:** Drew  
**Date:** January 29, 2026

---

## The Big Idea

**Your best friend lives in your messages.**

We're pivoting SoulPrint from a web-only chat app to an **SMS-first AI companion**. Users will text a phone number, save it as a contact, and interact with their AI like they would a real friend — right alongside their other conversations.

---

## Why SMS?

1. **Intimacy** — Text messages feel personal. That's where your real friends are.
2. **Zero friction** — No app download, no login every time. Just text.
3. **Always available** — Works on any phone, any carrier, even without internet (for basic texts).
4. **The mission** — SoulPrint is about *identity*. Your AI should feel like an extension of you, not another app icon.

---

## What It Can Do

Everything ForgeBot can do, but through text:

- **Chat & remember** — Long-term memory powered by our RLM (Retrieval-augmented Long-term Memory)
- **Generate images** — "Send me a photo of a sunset over Chicago"
- **Create videos** — Short clips, AI-generated content
- **Build websites** — Text your idea → get a live URL → refine via text
- **Research** — Web search, news, current events (Perplexity integration)
- **Send emails** — Draft and send on your behalf
- **Know you** — Import your ChatGPT history so it already understands you

---

## The Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER'S PHONE                      │
│              (SMS / iMessage contact)                │
└─────────────────┬───────────────────────────────────┘
                  │ Text messages
                  ▼
┌─────────────────────────────────────────────────────┐
│              SMS GATEWAY (Twilio/etc)                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              SOULPRINT ENGINE                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  • AI Core (Claude/GPT)                       │  │
│  │  • RLM Memory System                          │  │
│  │  • Tool Suite (images, video, web, email)     │  │
│  │  • Website Builder                            │  │
│  │  • User Identity Profile                      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│           SOULPRINTENGINE.AI (Dashboard)             │
│  • View conversation history                         │
│  • Manage memory & preferences                       │
│  • See websites you've built                         │
│  • Import ChatGPT data                               │
│  • Upgrade/billing                                   │
└─────────────────────────────────────────────────────┘
```

---

## What We Already Have

| Component | Status |
|-----------|--------|
| AI chat with memory (RLM) | ✅ Built |
| ChatGPT import | ✅ Built |
| User profiles & auth | ✅ Built |
| Image generation | ✅ Ready (Kie AI) |
| Video generation | ✅ Ready (Veo3) |
| Website builder | ✅ Ready (ForgeBot capability) |
| Web research | ✅ Built (Perplexity) |
| Dashboard UI | ✅ Built (soulprintengine.ai) |
| SMS integration | 🔲 Next step |

---

## What We Need to Build

1. **SMS Gateway Integration**
   - Twilio or similar
   - Inbound: receive texts → route to SoulPrint engine
   - Outbound: send responses, images, links

2. **Phone Number Provisioning**
   - Each user gets a dedicated number? Or shared number with user ID?
   - Probably start with shared number + user identification

3. **Media Handling**
   - MMS for images/videos
   - Link delivery for websites and larger content

4. **Session Management**
   - Map phone numbers to user accounts
   - Handle new user onboarding via SMS

---

## The User Journey

1. **Sign up** at soulprintengine.ai
2. **Import** ChatGPT history (optional but powerful)
3. **Get your number** — save it as "SoulPrint" or give it a name
4. **Text your AI** — it knows you, it can do things for you
5. **Dashboard** — check in at the website to see history, built sites, memory

---

## Why This Works

- **ForgeBot proved it** — Drew uses this exact setup daily. It works.
- **Memory makes it personal** — Not a generic chatbot, it's *your* AI
- **Tools make it useful** — Not just chat, it actually does things
- **SMS makes it intimate** — Your AI is a contact, not an app

---

## Next Steps

1. Set up Twilio (or evaluate alternatives like MessageBird)
2. Build SMS webhook → SoulPrint engine routing
3. Test with Drew's number first
4. Design onboarding flow for new SMS users
5. Launch beta to small group

---

*"Your best friend lives in your messages. Now your AI can too."*
