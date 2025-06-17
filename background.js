console.log('🚀 Prompt Vault: Background service started');

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('🎉 Prompt Vault: First install');
    
    // Set default values
    await chrome.storage.local.set({
      prompts: [],
      totalPrompts: 0,
      recordingEnabled: true,
      installDate: new Date().toISOString(),
      settings: {
        theme: 'light',
        autoExport: false,
        maxPrompts: 1000
      }
    });
    
    // Open welcome page
    chrome.tabs.create({
      url: 'https:pierizvi.bearblog.dev/'
    });
  }
});

// Update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.totalPrompts) {
      const count = changes.totalPrompts.newValue || 0;
      chrome.action.setBadgeText({
        text: count > 0 ? count.toString() : ''
      });
    }
    
    if (changes.recordingEnabled) {
      chrome.action.setBadgeBackgroundColor({
        color: changes.recordingEnabled.newValue ? '#00C851' : '#ff4444'
      });
    }
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.openPopup();
});