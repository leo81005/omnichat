const { ipcRenderer } = require('electron');
const {
  loadConfig,
  findElement,
  createSubmitHandler,
  setupIPCListeners,
  setupInputScanner,
  createUIControls,
  setupViewInfoListener,
  setupSupersizeListener,
  setupLoadingOverlay,
  waitForDOM,
} = require('./shared-preload-utils');

const config = loadConfig();
const provider = 'perplexity';

let inputElement = null;
let lastText = '';

function injectText(text) {
  inputElement = findElement(config.perplexity?.input);

  if (!inputElement) {
    ipcRenderer.invoke('selector-error', 'perplexity', 'Input element not found');
    return;
  }

  if (text === lastText) return;

  inputElement.focus();

  if (inputElement.tagName === 'TEXTAREA') {
    inputElement.value = text;
    inputElement.selectionStart = text.length;
    inputElement.selectionEnd = text.length;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputElement.contentEditable === 'true') {
    // Lexical editor: always do a full select-all + replace via execCommand
    // This keeps Lexical's internal state in sync
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputElement);
      sel.removeAllRanges();
      sel.addRange(range);

      if (text.length > 0) {
        document.execCommand('insertText', false, text);
      } else {
        document.execCommand('delete');
      }
    } catch (err) {
      // Fallback: direct DOM manipulation + input event
      while (inputElement.firstChild) {
        inputElement.removeChild(inputElement.firstChild);
      }
      if (text.length > 0) {
        inputElement.appendChild(document.createTextNode(text));
      }
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (inputElement.tagName === 'INPUT') {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  lastText = text;
}

const submitMessage = createSubmitHandler(
  provider,
  config,
  () => inputElement,
  null
);

setupIPCListeners(provider, config, injectText, submitMessage, { value: lastText });

setupInputScanner(
  provider,
  config,
  () => inputElement,
  (el) => { inputElement = el; },
  null
);

const getViewInfo = setupViewInfoListener((viewInfo) => {
  window.omnichatGetViewInfo = () => viewInfo;
  createUIControls(viewInfo);
});

setupSupersizeListener();

setupLoadingOverlay();

waitForDOM(() => {
  const viewInfo = getViewInfo();
  if (viewInfo) createUIControls(viewInfo);
});
