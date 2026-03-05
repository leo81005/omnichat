const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const throttle = require('../utils/throttle');

const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const refreshBtn = document.getElementById('refreshBtn');
const newChatBtn = document.getElementById('newChatBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const inputWrapper = document.querySelector('.input-wrapper');

let currentText = '';
let pendingFiles = []; // { name, type, size, base64, isImage }

function updateCharCount() {
  charCount.textContent = textInput.value.length;
}

const sendTextUpdate = throttle(async (text) => {
  currentText = text;
  await ipcRenderer.invoke('send-text-update', text);
}, 50);

textInput.addEventListener('input', (event) => {
  updateCharCount();
  sendTextUpdate(event.target.value);
});

textInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitMessage();
  }
});

// --- File handling ---

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function addFiles(fileList) {
  for (const file of fileList) {
    if (file.size > 20 * 1024 * 1024) {
      console.warn(`File ${file.name} exceeds 20MB limit, skipping.`);
      continue;
    }
    const buffer = fs.readFileSync(file.path);
    const base64 = buffer.toString('base64');
    const isImage = file.type.startsWith('image/');

    pendingFiles.push({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      base64,
      isImage,
    });
  }
  renderFilePreview();
}

function renderFilePreview() {
  filePreview.innerHTML = '';
  pendingFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';

    if (file.isImage) {
      const thumb = document.createElement('img');
      thumb.src = `data:${file.type};base64,${file.base64}`;
      chip.appendChild(thumb);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-chip-name';
    nameSpan.textContent = file.name;
    nameSpan.title = file.name;
    chip.appendChild(nameSpan);

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'file-chip-size';
    sizeSpan.textContent = formatSize(file.size);
    chip.appendChild(sizeSpan);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-chip-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => {
      pendingFiles.splice(index, 1);
      renderFilePreview();
    });
    chip.appendChild(removeBtn);

    filePreview.appendChild(chip);
  });
}

// Send button
sendBtn.addEventListener('click', () => {
  submitMessage();
});

// Attach button
attachBtn.addEventListener('click', () => {
  fileInput.click();
});

// File input change
fileInput.addEventListener('change', (event) => {
  addFiles(Array.from(event.target.files));
  fileInput.value = '';
});

// Drag-and-drop
inputWrapper.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.stopPropagation();
  inputWrapper.classList.add('drag-over');
});

inputWrapper.addEventListener('dragleave', (event) => {
  event.preventDefault();
  event.stopPropagation();
  inputWrapper.classList.remove('drag-over');
});

inputWrapper.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  inputWrapper.classList.remove('drag-over');
  addFiles(Array.from(event.dataTransfer.files));
});

// --- Submit ---

function submitMessage() {
  if (currentText.trim() === '' && pendingFiles.length === 0) {
    return;
  }

  if (pendingFiles.length > 0) {
    const filesData = pendingFiles.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      base64: f.base64,
      isImage: f.isImage,
    }));
    ipcRenderer.invoke('submit-message-with-files', {
      text: currentText,
      files: filesData,
    }).catch((error) => {
      console.error('Failed to submit with files:', error);
    });
  } else {
    ipcRenderer.invoke('submit-message').catch((error) => {
      console.error('Failed to submit:', error);
    });
  }

  textInput.value = '';
  currentText = '';
  pendingFiles = [];
  renderFilePreview();
  updateCharCount();
}

// --- Existing button handlers ---

refreshBtn.addEventListener('click', () => {
  ipcRenderer.invoke('refresh-pages').catch((error) => {
    console.error('Failed to refresh:', error);
  });
});

newChatBtn.addEventListener('click', () => {
  ipcRenderer.invoke('new-chat').catch((error) => {
    console.error('Failed to start new chat:', error);
  });

  textInput.value = '';
  currentText = '';
  pendingFiles = [];
  renderFilePreview();
  updateCharCount();
});

zoomInBtn.addEventListener('click', () => {
  ipcRenderer.invoke('zoom-in').catch((error) => {
    console.error('Failed to zoom in:', error);
  });
});

zoomOutBtn.addEventListener('click', () => {
  ipcRenderer.invoke('zoom-out').catch((error) => {
    console.error('Failed to zoom out:', error);
  });
});

textInput.focus();

updateCharCount();
