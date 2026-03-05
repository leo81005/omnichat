# Contributing to PolyGPT

Thank you for considering contributing to PolyGPT! This document outlines the process and guidelines.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/ncvgl/polygpt/issues)
2. If not, create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Your platform (macOS/Windows/Linux)
   - App version or git commit hash
   - Screenshots if applicable

### Suggesting Features

1. Open a GitHub Issue with the `enhancement` label
2. Describe the feature and why it would be useful
3. Include examples

### Code Contributions

#### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/polygpt.git
   cd polygpt
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Workflow

1. Make your changes
2. Test thoroughly:
   ```bash
   npm start  # Run the app
   npm run dev  # Run with DevTools
   ```
3. Test on all providers (ChatGPT, Claude, Gemini, Perplexity) if relevant
4. Commit with clear messages:
   ```bash
   git add src/path/to/file.js
   git commit -m "Add feature: brief description"
   ```

#### Submitting a Pull Request

1. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request on GitHub
3. Describe your changes clearly:
   - What problem does it solve?
   - How did you test it?
   - Screenshots/videos if UI changes

#### Areas to Contribute

- Bug fixes for selector issues
- Adding new AI providers
- Improving text injection logic

## Adding a New AI Provider

To add a new provider (e.g., Anthropic, Mistral):

1. **Create preload script:** `src/preload/PROVIDER-preload.js`
   - Use `src/preload/chatgpt-preload.js` as template
   - Define selectors for input, submit, new chat buttons
   - Handle text injection (contenteditable vs textarea)

2. **Update window manager:** `src/main/window-manager.js`
   - Add provider to `PROVIDERS` object with URL and preload path
   - Set userAgent if needed

3. **Update selectors config:** `config/selectors.json`
   - Add selector arrays for input, submit, newChat

4. **Test thoroughly:**
   - Text injection with newlines
   - Submit button
   - New chat button
   - Provider switching
   - Supersize mode

## Questions?

Open a GitHub Discussion

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Welcome newcomers
- Assume good intentions

Thank you for contributing!
