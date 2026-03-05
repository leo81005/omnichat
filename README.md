# OmniChat

Interact with multiple AI assistants simultaneously in a split-screen interface.
Type once and send your prompts to ChatGPT, Claude, Gemini, Perplexity, and Grok at the same time.

## Based on PolyGPT

OmniChat is a fork of [PolyGPT](https://github.com/ncvgl/polygpt) by [Nathan Cavaglione (ncvgl)](https://github.com/ncvgl). Huge thanks to Nathan for creating the original project!

## What's New in OmniChat

Building on the solid foundation of PolyGPT, OmniChat adds:

- **File & Image Upload** - Attach files and images from the unified control bar and send them to all AI providers simultaneously. Supports drag-and-drop and a dedicated Attach button.
- **Send Button** - In addition to pressing Enter, you can now click a Send button to submit your message.
- **Improved Perplexity Compatibility** - Fixed text synchronization issues with Perplexity's Lexical editor for reliable real-time input mirroring.

## Privacy

- 100% Private, no data is collected
- Your login credentials stay between you and your AI provider

## Features

- **5-way split view** - ChatGPT, Claude, Gemini, Perplexity, and Grok in a 2x2 grid (with provider switching)
- **Unified input** - Type once, send to all providers simultaneously
- **File & image upload** - Attach files and images to send alongside your text
- **Provider switching** - Change any quadrant to a different provider on the fly
- **Supersize mode** - Expand any quadrant to 80% width for focused work
- **Session persistence** - Stay logged in across app restarts
- **No API keys needed** - Uses official web interfaces directly
- **Zoom controls** - Adjust text size across all views
- **Cross-platform** - macOS, Windows, and Linux

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)

### Installation

```bash
git clone https://github.com/leo81005/omnichat.git
cd omnichat
npm install
```

### Run

```bash
npm start
```

### Build

```bash
npm run build
```

## How File Upload Works

OmniChat uses two strategies to inject files into AI provider webviews:

- **Images**: Copied to clipboard via `clipboard.writeImage()` and pasted into the provider using `webContents.paste()`, creating trusted paste events that all providers accept.
- **Non-image files** (PDF, TXT, etc.): Injected via `webContents.executeJavaScript()` which finds the provider's file input element and sets files using the DataTransfer API.

The app automatically waits for uploads to complete before submitting your message.

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## Credits

- Original project: [PolyGPT](https://github.com/ncvgl/polygpt) by [Nathan Cavaglione](https://github.com/ncvgl)

## License

MIT - See [LICENSE](LICENSE) for details.
