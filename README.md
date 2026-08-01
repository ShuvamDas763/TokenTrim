# TrimToken

TrimToken is a desktop overlay application designed to compress your text before sending it to Large Language Models (LLMs). By aggressively trimming filler words, redundant phrases, and non-essential characters, TrimToken helps you drastically reduce your LLM API quota burn and lower your AI costs.

## Features

- **Global Hotkey Compression**: Select text in any application and press `Ctrl+Shift+C` (customizable) to instantly compress it.
- **Two-Tier Compression Pipeline**:
  - **Tier 0 (Local, Instant)**: Uses local heuristics and learned patterns to strip out filler words, whitespace, and fluff without any API calls. Ideal for short messages.
  - **Tier 1 (LLM-Powered)**: For longer texts, leverages free or low-cost LLM API providers (Groq, Cerebras, NVIDIA NIM) to perform semantic compression, summarizing and shrinking text while preserving core meaning and structure (like code blocks).
- **Preview & Undo**:
  - Review Tier 1 semantic compressions in a floating, glassmorphism preview popup before applying.
  - Instantly revert any compression with the `Ctrl+Shift+Z` undo hotkey.
- **Adaptive Learning**: TrimToken logs the phrases it compresses. If you frequently revert certain removals, the app learns and auto-excludes those phrases from future compressions.
- **Smart Segment Parser**: Code blocks, URLs, numbers, and quoted strings are detected and protected from aggressive trimming to ensure technical accuracy is never lost.
- **Theming System**: Choose from three beautiful, custom-designed themes:
  - **Command Center** (Dark charcoal & electric blue)
  - **Arctic** (Nord-inspired slate & frost blue)
  - **Sunset** (Warm amber & orange)
- **Visual Feedback**: The system tray icon adapts to the current state (Idle, Compressing, API Call, Error) with a subtle bounce animation during processing. The settings panel features a dynamic, theme-aware particle background.

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tokentrim.git
   cd tokentrim
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application in development mode:
   ```bash
   npm run dev
   ```

## Configuration

Settings and API keys are stored locally at `~/.trimtoken/config.json`.

You can access the Settings panel by double-clicking the TrimToken tray icon or right-clicking and selecting "Settings".

- **General**: Configure hotkeys and preview behaviors.
- **Providers**: Enter your API keys for the Tier 1 compression providers. Providers are tried in sequence (daily-renewing first, one-time pools last).
- **Advanced**: Tune the aggressiveness of the local Tier 0 compressor (1-5) and set the token threshold boundary between Tier 0 and Tier 1.
- **Phrase Log**: View the learned confidence scores for filler phrases and manually include/exclude specific phrases.

## Architecture

- **Main Process (`src/main/main.js`)**: Handles global hotkeys, clipboard interaction, the compression pipeline, tray management, and IPC communication.
- **Renderer (`src/renderer/`)**: Houses the Settings UI and Preview popup, built with Vanilla HTML/CSS/JS and CSS custom properties for instant theming.
- **Tier 0 (`src/main/tier0/`)**: Local rule-based compressor and smart segment parser.
- **Tier 1 (`src/main/tier1/`)**: LLM provider chain logic.
- **Learning (`src/main/learning/`)**: Phrase tracking and adaptive exclusion logic.

## Building for Production

To build a standalone executable installer (NSIS for Windows):

```bash
npm run build
```

## License

MIT
