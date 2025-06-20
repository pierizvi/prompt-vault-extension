const state = {
  prompts: [],
  filteredPrompts: [],
  currentPrompt: null,
  isRecording: true
};

// Elements
const elements = {
  totalPrompts: document.getElementById('totalPrompts'),
  totalWords: document.getElementById('totalWords'),
  platformCount: document.getElementById('platformCount'),
  toggle: document.getElementById('toggle'),
  searchInput: document.getElementById('searchInput'),
  promptsList: document.getElementById('promptsList'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  modal: document.getElementById('modal'),
  modalClose: document.getElementById('modalClose'),
  modalIcon: document.getElementById('modalIcon'),
  modalPlatform: document.getElementById('modalPlatform'),
  modalTime: document.getElementById('modalTime'),
  modalText: document.getElementById('modalText'),
  modalWords: document.getElementById('modalWords'),
  modalChars: document.getElementById('modalChars'),
  copyBtn: document.getElementById('copyBtn'),
  copyUrlBtn: document.getElementById('copyUrlBtn'),
  openBtn: document.getElementById('openBtn')
};

// Initialize
async function init() {
  await loadRecordingStatus();
  await loadPrompts();
  setupEventListeners();
}

// Load recording status
async function loadRecordingStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['recordingEnabled'], (result) => {
      state.isRecording = result.recordingEnabled !== false;
      updateToggleUI();
      resolve();
    });
  });
}

// Update toggle UI
function updateToggleUI() {
  if (state.isRecording) {
    elements.toggle.classList.add('active');
  } else {
    elements.toggle.classList.remove('active');
  }
}

// Load prompts
async function loadPrompts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prompts'], (result) => {
      state.prompts = result.prompts || [];
      state.filteredPrompts = [...state.prompts];
      updateStats();
      renderPrompts();
      resolve();
    });
  });
}

// Update statistics

//overwhelming 
function updateStats() {
  const totalWords = state.prompts.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  const platforms = [...new Set(state.prompts.map(p => p.platform))];
  
  elements.totalPrompts.textContent = state.prompts.length.toLocaleString();
  elements.totalWords.textContent = totalWords.toLocaleString();
  elements.platformCount.textContent = platforms.length;
}

// Format time
function formatTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  
  return time.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}
//render new ones******newones**
// Render prompts
function renderPrompts() {
  if (state.filteredPrompts.length === 0) {
    elements.promptsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${state.prompts.length > 0 ? '🔍' : '🚀'}</div>
        <div class="empty-title">${state.prompts.length > 0 ? 'No matches found' : 'Welcome to Prompt Vault Pro'}</div>
        <div class="empty-text">${state.prompts.length > 0 ? 'Try adjusting your search' : 'Visit any AI platform and your prompts will be automatically saved here'}</div>
      </div>
    `;
    return;
  }

  elements.promptsList.innerHTML = state.filteredPrompts.map((prompt, index) => `
    <div class="prompt-card" data-id="${prompt.id}" style="--platform-color: ${prompt.platformColor || '#666'}; animation-delay: ${index * 0.05}s">
      <div class="prompt-header">
        <div class="prompt-meta">
          <div class="platform-badge" style="background: ${prompt.platformColor || '#666'}">
            <span class="platform-icon">${prompt.platformIcon || '🤖'}</span>
            <span>${prompt.platform}</span>
          </div>
          <span class="prompt-time">${formatTime(prompt.timestamp)}</span>
        </div>
        <div class="prompt-actions">
          <button class="action-btn" data-action="copy" data-id="${prompt.id}" title="Copy text">📋</button>
          <button class="action-btn" data-action="open" data-id="${prompt.id}" title="Open chat">↗️</button>
        </div>
      </div>
      <div class="prompt-text">${escapeHtml(prompt.text)}</div>
      <div class="prompt-footer">
        <div class="prompt-stat">
          <span>💬</span>
          <span>${prompt.wordCount || 0} words</span>
        </div>
        <div class="prompt-stat">
          <span>🔤</span>
          <span>${prompt.charCount || 0} chars</span>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', handlePromptClick);
  });

  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', handleActionClick);
  });
}

// Handle prompt click
function handlePromptClick(e) {
  if (e.target.closest('.action-btn')) return;
  
  const id = e.currentTarget.dataset.id;
  state.currentPrompt = state.prompts.find(p => p.id === id);
  
  if (state.currentPrompt) {
    showModal(state.currentPrompt);
  }
}

// Handle action button click
function handleActionClick(e) {
  e.stopPropagation();
  
  const action = e.currentTarget.dataset.action;
  const id = e.currentTarget.dataset.id;
  const prompt = state.prompts.find(p => p.id === id);
  
  if (!prompt) return;
  
  if (action === 'copy') {
    copyText(prompt.text);
  } else if (action === 'open') {
    chrome.tabs.create({ url: prompt.url });
  }
}

// Show modal with smooth animation
function showModal(prompt) {
  elements.modalIcon.textContent = prompt.platformIcon || '🤖';
  elements.modalPlatform.textContent = prompt.platform;
  elements.modalTime.textContent = new Date(prompt.timestamp).toLocaleString();
  elements.modalText.textContent = prompt.text;
  elements.modalWords.textContent = prompt.wordCount || 0;
  elements.modalChars.textContent = prompt.charCount || 0;
  
  elements.modal.style.display = 'block';
  elements.modal.style.opacity = '0';
  
  requestAnimationFrame(() => {
    elements.modal.style.opacity = '1';
  });
}

// Copy text to clipboard
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Copied to clipboard');
  } catch (err) {
    showToast('❌ Copy failed');
  }
}

// Show toast notification with enhanced animation
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) {
    existing.style.animation = 'none';
    existing.offsetHeight; // Force reflow
    existing.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.opacity = '0';
  document.body.appendChild(toast);
  
  // Smooth fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.animation = 'slideUpToast 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  });
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideDownToast 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 2500);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup event listeners
function setupEventListeners() {
  // Toggle recording
  elements.toggle.addEventListener('click', async () => {
    state.isRecording = !state.isRecording;
    await chrome.storage.local.set({ recordingEnabled: state.isRecording });
    updateToggleUI();
    showToast(state.isRecording ? '✅ Recording enabled' : '⏸️ Recording paused');
  });

  // Search
  elements.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
      state.filteredPrompts = [...state.prompts];
    } else {
      state.filteredPrompts = state.prompts.filter(p => 
        p.text.toLowerCase().includes(query) ||
        p.platform.toLowerCase().includes(query)
      );
    }
    
    renderPrompts();
  });

  // Export
  elements.exportBtn.addEventListener('click', () => {
    const data = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      totalPrompts: state.prompts.length,
      prompts: state.prompts
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-vault-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('✅ Export completed');
  });

  // Clear all
  elements.clearBtn.addEventListener('click', async () => {
    if (state.prompts.length === 0) return;
    
    if (confirm(`Delete all ${state.prompts.length} prompts? This cannot be undone.`)) {
      await chrome.storage.local.set({ 
        prompts: [],
        totalPrompts: 0 
      });
      
      state.prompts = [];
      state.filteredPrompts = [];
      updateStats();
      renderPrompts();
      showToast('✅ All prompts cleared');
    }
  });

  // Modal close with smooth animation
  elements.modalClose.addEventListener('click', () => {
    elements.modal.style.opacity = '0';
    setTimeout(() => {
      elements.modal.style.display = 'none';
    }, 200);
  });

  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) {
      elements.modal.style.opacity = '0';
      setTimeout(() => {
        elements.modal.style.display = 'none';
      }, 200);
    }
  });

  // Modal actions
  elements.copyBtn.addEventListener('click', () => {
    if (state.currentPrompt) {
      copyText(state.currentPrompt.text);
    }
  });

  elements.copyUrlBtn.addEventListener('click', () => {
    if (state.currentPrompt) {
      copyText(state.currentPrompt.url);
    }
  });

  elements.openBtn.addEventListener('click', () => {
    if (state.currentPrompt) {
      chrome.tabs.create({ url: state.currentPrompt.url });
    }
  });
}

// Start the app
init();