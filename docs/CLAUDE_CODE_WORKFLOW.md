# Using Claude Code in VS Code for SoulPrint Development

## Quick Start

### 1. Install Claude Code Extension

In VS Code:
1. Open Extensions (Cmd+Shift+X)
2. Search for "Claude Code"
3. Install the official Anthropic extension

### 2. Open SoulPrint Project

```bash
cd soulprint-landing
code .
```

### 3. Start Claude Code

- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
- Type "Claude Code" and select "Start Session"
- Or use the Claude Code icon in the sidebar

---

## Common Workflows

### When Planning a Feature

```
You: "Plan how to add voice-based personality detection to SoulPrint"

Claude will:
1. Analyze the existing codebase
2. Create a task breakdown
3. Identify files to modify
4. Suggest architecture
```

### When Implementing Code

```
You: "Implement the voice analysis feature we planned"

Claude will:
1. Create/modify files
2. Show you diffs
3. Run tests if configured
4. Commit when ready
```

### When Debugging

```
You: "The chat isn't using the new AWS endpoint. Debug this."

Claude will:
1. Read relevant files
2. Trace the code flow
3. Identify the issue
4. Propose fixes
```

### When Exploring the Codebase

```
You: "How does the memory system work?"

Claude will:
1. Find relevant files
2. Explain the architecture
3. Show code relationships
```

---

## SoulPrint-Specific Commands

### Test the Compete Stack

```
"Test the /api/v2/chat/completions endpoint with a sample message"
```

### Check System Health

```
"What's the current health status of all compete stack components?"
```

### Export Fine-Tuning Data

```
"Export the last 1000 high-quality training examples in ShareGPT format"
```

### Update Personality Detection

```
"Add these personality markers to the Big Five detector: [your markers]"
```

### Deploy to AWS

```
"Help me deploy the Terraform infrastructure to AWS"
```

---

## Best Practices

### 1. Be Specific

❌ "Fix the chat"
✅ "The chat response isn't showing emotion detection in the metadata. Check lib/compete/orchestrator.ts"

### 2. Provide Context

❌ "Add a feature"
✅ "Add voice analysis to the personality detector. We want to analyze speech patterns from the voice recording component at components/voice-recorder/"

### 3. Break Down Large Tasks

❌ "Build the entire fine-tuning pipeline"
✅ "First, let's set up the data collection. Then we'll handle export formats."

### 4. Review Changes

Always review Claude's proposed changes before accepting:
- Check for security issues
- Verify logic matches your intent
- Test locally before committing

---

## Keyboard Shortcuts

| Action | Mac | Windows |
|--------|-----|---------|
| Open Claude Code | Cmd+Shift+P | Ctrl+Shift+P |
| Accept suggestion | Tab | Tab |
| Reject suggestion | Esc | Esc |
| New conversation | Cmd+N | Ctrl+N |

---

## File Structure Reference

```
soulprint-landing/
├── app/
│   ├── api/
│   │   ├── v2/chat/completions/  # New compete stack endpoint
│   │   └── gemini/chat/          # Old endpoint (fallback)
│   └── dashboard/chat/           # Chat UI
├── lib/
│   ├── aws/                      # vLLM client
│   ├── mem0/                     # Memory system
│   ├── personality/              # Big Five + emotion detection
│   ├── prompt/                   # Dynamic prompt builder
│   ├── finetuning/               # Training data collection
│   └── compete/                  # Main orchestrator
├── infrastructure/
│   └── aws/                      # Terraform configs
└── docs/
    ├── COMPETE_STACK_SPEC.md     # Full technical spec
    └── SETUP_GUIDE.md            # Step-by-step setup
```

---

## Next Session Starters

When you come back to work on SoulPrint, try these prompts:

```
"Summarize what we built in the compete stack and what's left to do"

"Show me the current state of the AWS infrastructure deployment"

"What are the highest priority improvements for the AI companion quality?"

"Help me test the emotion detection with sample messages"
```

---

*Pro tip: Keep this file open in a split view while working with Claude Code for quick reference.*
