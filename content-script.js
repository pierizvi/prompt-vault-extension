(function() {
  'use strict';
  
  console.log('🚀 Prompt Vault: Initializing...');
  

  const CONFIG = {
    PLATFORMS: {
      'chat.openai.com': { name: 'ChatGPT', icon: '🤖', color: '#10a37f' },
      'chatgpt.com': { name: 'ChatGPT', icon: '🤖', color: '#10a37f' },
      'claude.ai': { name: 'Claude', icon: '🧠', color: '#ff6f00' },
      'gemini.google.com': { name: 'Gemini', icon: '✨', color: '#4285f4' },
      'bard.google.com': { name: 'Bard', icon: '✨', color: '#4285f4' },
      'chat.qwen.alibaba.com': { name: 'Qwen', icon: '🌏', color: '#ff5722' },
      'qwen.alibaba.com': { name: 'Qwen', icon: '🌏', color: '#ff5722' },
      'poe.com': { name: 'Poe', icon: '🦜', color: '#9c27b0' },
      'you.com': { name: 'You.com', icon: '🔍', color: '#2196f3' },
      'character.ai': { name: 'Character.AI', icon: '👤', color: '#673ab7' },
      'beta.character.ai': { name: 'Character.AI', icon: '👤', color: '#673ab7' },
      'copilot.microsoft.com': { name: 'Copilot', icon: '🚁', color: '#0078d4' },
      'chat.mistral.ai': { name: 'Mistral', icon: '🌪️', color: '#ff9800' },
      'huggingface.co': { name: 'HuggingFace', icon: '🤗', color: '#ffeb3b' },
      'perplexity.ai': { name: 'Perplexity', icon: '🔮', color: '#e91e63' },
      'replicate.com': { name: 'Replicate', icon: '🔄', color: '#795548' },
      'cohere.com': { name: 'Cohere', icon: '🌊', color: '#00bcd4' }
    },    INPUT_SELECTORS: [
      'textarea',
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      '.ProseMirror',
      '[role="textbox"]',
      'rich-textarea',
      '.ql-editor',
      '[data-placeholder*="Message"]',
      '[placeholder*="Message"]',
      '[placeholder*="message"]',
      '[placeholder*="Ask"]',
      '[placeholder*="ask"]',
      '[placeholder*="Type"]',
      '[placeholder*="type"]',
      '[placeholder*="Enter"]',
      '[placeholder*="enter"]',
      '[placeholder*="prompt"]',
      '[placeholder*="Prompt"]',

      '.ProseMirror-focused',
      '[data-testid="message-composer"]',
      '.composer-input',
  
      '#prompt-textarea',
      '[data-testid*="composer"]',

      '[data-testid*="input"]',
      '[class*="input-area"]',
      '[class*="composer"]',
 
      '[contenteditable]',
      '.editable',
      '.input-area',
      '.message-input',

      '[class*="textbox"]',
      '[class*="text-input"]',
      '[class*="message-box"]',
      '[class*="chat-input"]',
      '[data-testid*="textbox"]',
      '[data-testid*="text-input"]'
    ],
    BUTTON_SELECTORS: [
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[data-testid*="send"]',
      'button:has(svg)',
      '[role="button"]',
      '.send-button',
      '[class*="send"]',
      '[class*="submit"]'
    ]
  };  
  let state = {
    isRecording: true,
    platform: null,
    lastCapturedText: '',
    lastCapturedTime: 0,
    observers: [],
    interceptedRequests: new Map(),
    captureInProgress: false,
    capturePromise: null,
    recentPasteTime: 0,
    pastedContent: '',
    pastedElement: null,
    awaitingPromptAfterPaste: false,
    pastedContentNotification: null
  };

  let stagedPasteState = {
    hasStaged: false,
    fullContent: '',
    stagedTime: 0,
    targetElement: null,
    notification: null,
    formats: {
      text: '',
      html: '',
      rtf: ''
    }
  };

  function detectPlatform() {
    const hostname = window.location.hostname;
    const currentUrl = window.location.href;
    
    for (const [domain, info] of Object.entries(CONFIG.PLATFORMS)) {
      if (hostname.includes(domain)) {
        return {
          ...info,
          domain: hostname,
          url: currentUrl
        };
      }
    }

    if (hostname.includes('.ai') || hostname.includes('chat') || hostname.includes('llm')) {
      return {
        name: 'AI Platform',
        icon: '🤖',
        color: '#666666',
        domain: hostname,
        url: currentUrl
      };
    }
    return null;
  }

  function updatePlatformInfo() {
    const newPlatform = detectPlatform();
    if (newPlatform && state.platform) {

      const oldUrl = state.platform.url;
      state.platform.url = newPlatform.url;
      
      if (oldUrl !== newPlatform.url) {
        console.log('🔄 Prompt Vault: Updated platform URL');
        console.log('  Old URL:', oldUrl);
        console.log('  New URL:', newPlatform.url);
      }
    } else if (newPlatform) {
      state.platform = newPlatform;
      console.log('🎯 Prompt Vault: Platform detected:', newPlatform.name, 'at', newPlatform.url);
    }
  }  
  function isToolRelatedContent(text) {
    if (!text || text.trim().length === 0) return true;
    
    const cleanText = text.trim().toLowerCase();
    

    if (cleanText.length < 3) return true;
    

    const toolPatterns = [

      /^(deepsearch|canvas|search tool|web search|analyze|tool)$/,

      /^(searching|analyzing|generating|creating|drawing|sketching|coding|running|executing)\.{0,3}$/,
      /^(tool|extension|plugin)\s+(activated|enabled|running|complete|loaded)$/,
      /^using\s+\w+(\s+tool)?$/,
      /^\w+\s+tool(\s+(is\s+)?running)?$/,

      /^gemini\s+(advanced|extensions?)$/,
      /^(deep|web)\s*search$/,
      /^canvas\s+(mode|tool|activated)?$/,

      /^(ok|done|ready|complete|activated|enabled|loaded|running)\.?$/,
      // Tool result indicators
      /^result:?$/,
      /^output:?$/,
      /^(search\s+)?results?:?$/
    ];
    

    for (const pattern of toolPatterns) {
      if (pattern.test(cleanText)) {
        console.log('🚫 Detected tool-related pattern:', cleanText);
        return true;
      }
    }
    

    if (cleanText.length < 15) {

      const conversationalStarters = [
        'hi', 'hello', 'hey', 'thanks', 'thank you', 'please', 'can you',
        'could you', 'would you', 'help', 'yes', 'no', 'okay', 'ok'
      ];
      
      const isConversational = conversationalStarters.some(starter => 
        cleanText.includes(starter)
      );
      
      if (!isConversational) {

        const hasQuestionWords = /\b(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\b/.test(cleanText);
        const hasConversationalPunctuation = /[?!]/.test(cleanText);
        
        if (!hasQuestionWords && !hasConversationalPunctuation) {
          console.log('🚫 Filtering short non-conversational text:', cleanText);
          return true;
        }
      }
    }
    
    return false;
  }


  function extractCompleteText(element) {
    if (!element) return '';
    

    if (element.value !== undefined) {
      return element.value;
    }
    

    const pastedContainers = element.querySelectorAll('.bg-bg-000, .whitespace-pre-wrap, .font-mono, [class*="pasted"], [class*="code-block"]');
    if (pastedContainers.length > 0) {
      let allText = '';
      pastedContainers.forEach(container => {
        const containerText = container.textContent || container.innerText || '';
        if (containerText.trim()) {
          allText += containerText + '\n';
        }
      });
      if (allText.trim()) {
        console.log('📋 Found pasted content containers:', pastedContainers.length);
        

        const elementText = (element.textContent || element.innerText || '').trim();
        const containerText = allText.trim();
        

        if (elementText.length > containerText.length) {
          return elementText; 
        }
        
        return containerText; 
      }
    }
    
    const clone = element.cloneNode(true);
    
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('p, div, li, pre, code').forEach(block => {
      if (block.nextSibling) {
        block.appendChild(document.createTextNode('\n'));
      }
    });
    
    let text = (clone.textContent || clone.innerText || '').trim();
    
    if (!text || text.length < 10) {
      const allTextNodes = [];
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const nodeText = node.textContent.trim();
        if (nodeText && nodeText.length > 0) {
          allTextNodes.push(nodeText);
        }
      }
      
      if (allTextNodes.length > 0) {
        text = allTextNodes.join(' ').trim();
        console.log('📋 Extracted text from text nodes:', allTextNodes.length);
      }
    }
    
    return text; // Return FULL text without any truncation
  }

  // Extract all text with formatting preserved - enhanced for Claude and pasted content
  function extractText(element) {
    if (!element) return '';
    
    // Handle different element types
    if (element.value !== undefined) {
      return element.value;
    }
    
    // For Claude and similar platforms, prioritize pasted content containers
    const pastedContainers = element.querySelectorAll('.bg-bg-000, .whitespace-pre-wrap, .font-mono, [class*="pasted"], [class*="code-block"]');
    if (pastedContainers.length > 0) {
      let allText = '';
      pastedContainers.forEach(container => {
        const containerText = container.textContent || container.innerText || '';
        if (containerText.trim()) {
          allText += containerText + '\n';
        }
      });
      if (allText.trim()) {
        console.log('📋 Prompt Vault: Found pasted content containers:', pastedContainers.length);
        
        // Also check for any additional text outside the containers
        const elementText = (element.textContent || element.innerText || '').trim();
        const containerText = allText.trim();
        
        // If there's more text in the element than just the containers, combine them
        if (elementText.length > containerText.length) {
          // Try to preserve the order - check if container text is at the beginning, middle, or end
          if (elementText.startsWith(containerText)) {
            return elementText; // Container is at start, use full element text
          } else if (elementText.endsWith(containerText)) {
            return elementText; // Container is at end, use full element text  
          } else {
            // Container is in middle or text is mixed, try to build proper order
            return elementText; // Use full element text to preserve user's formatting
          }
        }
        
        return containerText; // Return just the container text if it's all we have
      }
    }
    
    // Clone to avoid modifying original
    const clone = element.cloneNode(true);
    
    // Replace block elements with newlines to preserve formatting
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('p, div, li, pre, code').forEach(block => {
      if (block.nextSibling) {
        block.appendChild(document.createTextNode('\n'));
      }
    });
      // Get all text content
    let text = (clone.textContent || clone.innerText || '').trim();
    
    // Enhanced filtering for Gemini tool names and other unwanted content
    const toolNames = [
      'deepsearch', 'canvas', 'search tool', 'tool', 'analyze', 'web search',
      'generate image', 'create chart', 'draw diagram', 'sketch', 'code',
      'run code', 'execute', 'debug', 'test', 'compile', 'translate',
      'summarize', 'explain', 'rewrite', 'math solver', 'calculate',
      'solve equation', 'compute', 'gemini advanced', 'extensions',
      'plugins', 'add-ons'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check if the text is just a tool name or very short tool-related text
    if (text.length < 100) { // Increased threshold for better detection
      for (const toolName of toolNames) {
        // Exact match or contained within short text
        if (lowerText === toolName || 
            (lowerText.includes(toolName) && text.length < 50) ||
            // Check for tool activation patterns
            lowerText.match(new RegExp(`^(using |activating |running )?${toolName}(\\s|$)`, 'i')) ||
            // Check for tool result patterns  
            lowerText.match(new RegExp(`${toolName}(\\s)?(activated|enabled|running|complete)`, 'i'))) {
          console.log('🚫 Filtering out tool-related content:', text);
          return '';
        }
      }
      
      // Additional patterns for tool interactions
      const toolPatterns = [
        /^(searching|analyzing|generating|creating|drawing|sketching|coding|running|executing|debugging|testing|compiling|translating|summarizing|explaining|rewriting|calculating|solving|computing)\.{3}$/i,
        /^tool\s+(activated|enabled|running|complete)$/i,
        /^(extension|plugin|add-on)\s+(loaded|activated|enabled)$/i,
        /^\w+\s+tool$/i, // Single word followed by "tool"
        /^using\s+\w+$/i // "using [toolname]"
      ];
      
      for (const pattern of toolPatterns) {
        if (pattern.test(text)) {
          console.log('🚫 Filtering out tool pattern:', text);
          return '';
        }
      }
    }
    
    // Additional check: look inside the element for all text-containing descendants
    if (!text || text.length < 10) {
      const allTextNodes = [];
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const nodeText = node.textContent.trim();
        if (nodeText && nodeText.length > 0) {
          allTextNodes.push(nodeText);
        }
      }
      
      if (allTextNodes.length > 0) {
        text = allTextNodes.join(' ').trim();
        console.log('📋 Prompt Vault: Extracted text from text nodes:', allTextNodes.length);
      }
    }
    
    return text;
  }  // FIXED: Enhanced input detection with better staged content support
  function findActiveInput() {
    console.log('🔍 FIXED: Searching for active input...');
    
    // PRIORITY 1: Check focused element first (even if empty - for staged content)
    if (document.activeElement) {
      const tagName = document.activeElement.tagName.toLowerCase();
      const isInputElement = tagName === 'textarea' || 
                            tagName === 'input' || 
                            document.activeElement.contentEditable === 'true' ||
                            document.activeElement.hasAttribute('contenteditable') ||
                            document.activeElement.getAttribute('role') === 'textbox';
      
      if (isInputElement) {
        console.log('🎯 FIXED: Found focused input element:', tagName);
        return document.activeElement;
      }
    }
    
    // PRIORITY 2: Look for recently used or staged content target
    if (stagedPasteState.targetElement && stagedPasteState.targetElement.isConnected) {
      console.log('🎯 FIXED: Using staged content target element');
      return stagedPasteState.targetElement;
    }
    
    // PRIORITY 3: If we're waiting for content after a paste, look for the complete prompt
    if (state.awaitingPromptAfterPaste) {
      const promptContent = findCompletePromptContent();
      if (promptContent) {
        console.log('🎯 Found complete prompt content after paste');
        return promptContent.element;
      }
    }
    
    // PRIORITY 4: Look for elements containing pasted content
    if (state.pastedContent) {
      console.log('🔍 Looking for elements with pasted content...');
      const allElements = document.querySelectorAll('textarea, [contenteditable], .ProseMirror, [role="textbox"], input[type="text"]');
      for (const el of allElements) {
        const text = extractCompleteText(el);
        if (text && text.includes(state.pastedContent.substring(0, 100))) {
          console.log('✅ Found element with pasted content!');
          return el;
        }
      }
    }
    
    // PRIORITY 5: Standard search - prioritize visible inputs (even empty ones)
    for (const selector of CONFIG.INPUT_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Check if element is visible and interactive
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         (el.offsetParent !== null || el.closest('[contenteditable="true"]'));
        
        if (isVisible) {
          console.log(`✅ FIXED: Found visible input using ${selector}`);
          return el;
        }
      }
    }
    
    // PRIORITY 6: Find input with most content (fallback)
    let bestInput = null;
    let longestText = '';
    
    for (const selector of CONFIG.INPUT_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = extractCompleteText(el);
        if (text && text.length > longestText.length && text.length > 10) {
          longestText = text;
          bestInput = el;
          console.log(`📝 Found content in ${selector}:`, text.substring(0, 50) + '...');
        }
      }
    }
    
    if (bestInput) {
      console.log(`✅ Selected input with ${longestText.length} characters`);
      return bestInput;
    }
    
    console.log('❌ FIXED: No suitable input found - trying emergency selectors...');
    
    // EMERGENCY: Try common input patterns
    const emergencySelectors = [
      'textarea:first-of-type',
      '[contenteditable="true"]:first-of-type',
      '.ProseMirror:first-of-type',
      '[role="textbox"]:first-of-type',
      'div[contenteditable]:first-of-type'
    ];
    
    for (const selector of emergencySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log(`🚨 FIXED: Emergency input found with ${selector}`);
        return el;
      }
    }
    
    console.log('❌ FIXED: Absolutely no input found');
    return null;
  }// Capture and save prompt with URL change detection (enhanced for paste events)
  async function capturePrompt(source) {
    if (!state.isRecording || !state.platform) return;
    
    console.log(`🎯 Attempting to capture prompt from: ${source}`);
    
    let input = null;
    let text = '';
    
    // Special handling for paste-related captures
    if (source.includes('paste') && state.awaitingPromptAfterPaste) {
      console.log('📋 Handling paste-related capture...');
      
      const promptContent = findCompletePromptContent();
      if (promptContent) {
        input = promptContent.element;
        text = promptContent.text;
        console.log('✅ Found complete prompt content for paste event');
      } else {
        console.log('❌ Could not find complete prompt content after paste');
        return;
      }
    } else {
      // Standard input finding
      input = findActiveInput();
      if (!input) {
        console.log('❌ Prompt Vault: No active input found');
        return;
      }
      text = extractText(input);
    }    // Remove character restrictions - save all prompts regardless of length
    if (!text || text.trim().length === 0) {
      console.log('❌ Prompt Vault: No text found');
      return;
    }
    
    // Filter out tool-related content
    if (isToolRelatedContent(text)) {
      console.log('🚫 Prompt Vault: Filtering out tool-related content');
      return;
    }
    
    const now = Date.now();
    
    // If we already have this exact capture in progress, return the existing promise
    if (state.captureInProgress && state.capturePromise && text === state.lastCapturedText) {
      console.log('⏳ Prompt Vault: Capture already in progress, waiting...');
      return state.capturePromise;
    }
    
    // For paste events, reduce the duplicate timeout
    const duplicateTimeout = source.includes('paste') ? 1000 : 3000;
    
    // Basic time-based duplicate check
    if (text === state.lastCapturedText && (now - state.lastCapturedTime) < duplicateTimeout) {
      console.log('⏭️ Prompt Vault: Recent duplicate, skipping');
      return;
    }
    
    // Set capture state
    state.captureInProgress = true;
    state.lastCapturedText = text;
    state.lastCapturedTime = now;
    
    // Clear paste state if this is a successful capture after paste
    if (source.includes('paste') || (state.awaitingPromptAfterPaste && text.includes(state.pastedContent.substring(0, 50)))) {
      console.log('📋 Clearing paste state after successful capture');
      state.awaitingPromptAfterPaste = false;
      
      // Remove paste notification
      if (state.pastedContentNotification) {
        state.pastedContentNotification.style.opacity = '0';
        state.pastedContentNotification.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          if (state.pastedContentNotification && state.pastedContentNotification.parentNode) {
            state.pastedContentNotification.remove();
          }
          state.pastedContentNotification = null;
        }, 300);
      }
    }
    
    console.log(`✅ Prompt Vault: Starting capture from ${source}`);
    console.log(`📝 Text: ${text.substring(0, 50)}...`);
    
    // Create and store the capture promise
    state.capturePromise = captureWithUrlDetection(text, source)
      .finally(() => {
        // Reset capture state when done
        state.captureInProgress = false;
        state.capturePromise = null;
      });
    
    return state.capturePromise;
  }
    // Wait for URL to stabilize, then capture with final URL
  async function captureWithUrlDetection(text, source) {
    const initialUrl = window.location.href;
    let finalUrl = initialUrl;
    let attempts = 0;
    const maxAttempts = 50; // Wait up to 5 seconds for URL change (increased for Gemini)
    
    console.log(`🔍 Prompt Vault: Initial URL: ${initialUrl}`);
    
    // Special handling for different platforms
    const isGemini = initialUrl.includes('gemini.google.com');
    const isChatGPT = initialUrl.includes('openai.com') || initialUrl.includes('chatgpt.com');
    const isClaude = initialUrl.includes('claude.ai');
    
    // Wait for URL to change (for new chats) or stabilize (for existing chats)
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentUrl = window.location.href;
      
      if (currentUrl !== finalUrl) {
        finalUrl = currentUrl;
        console.log(`🔄 Prompt Vault: URL updated to: ${finalUrl}`);
        updatePlatformInfo(); // Update our platform info
      }
      
      attempts++;
      
      // Platform-specific URL change detection
      if (isGemini) {
        // Gemini URLs change from /app to /app/[chat-id]
        if (currentUrl !== initialUrl && currentUrl.includes('/app/') && attempts >= 5) {
          // Wait longer for Gemini to ensure URL is stable
          let stable = true;
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            if (window.location.href !== currentUrl) {
              stable = false;
              break;
            }
          }
          if (stable) {
            console.log('✅ Gemini URL stabilized');
            break;
          }
        }
      } else if (isChatGPT || isClaude) {
        // ChatGPT/Claude URL changes are usually faster
        if (currentUrl !== initialUrl && attempts >= 3) {
          let stable = true;
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.location.href !== currentUrl) {
              stable = false;
              break;
            }
          }
          if (stable) {
            console.log('✅ ChatGPT/Claude URL stabilized');
            break;
          }
        }
      } else {
        // Generic handling for other platforms
        if (currentUrl !== initialUrl && attempts >= 3) {
          let stable = true;
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.location.href !== currentUrl) {
              stable = false;
              break;
            }
          }
          if (stable) break;
        }
      }
    }
      console.log(`🔗 Prompt Vault: Final URL: ${finalUrl}`);
    
    // Log capture summary for debugging
    console.log('📊 Prompt Vault: Capture Summary:');
    console.log(`  - Text length: ${text.length} chars`);
    console.log(`  - Word count: ${text.split(/\s+/).filter(w => w).length}`);
    console.log(`  - Platform: ${state.platform.name}`);
    console.log(`  - Source: ${source}`);
    console.log(`  - Initial URL: ${initialUrl}`);
    console.log(`  - Final URL: ${finalUrl}`);
    
    // Save to storage with final URL
    await savePrompt({
      id: `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      url: finalUrl,
      platform: state.platform.name,
      platformIcon: state.platform.icon,
      platformColor: state.platform.color,
      timestamp: new Date().toISOString(),
      wordCount: text.split(/\s+/).filter(w => w).length,
      charCount: text.length,
      source: source
    });
  }
    // Save prompt to storage with enhanced deduplication
  async function savePrompt(promptData) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        
        // Enhanced duplicate detection
        const isDuplicate = prompts.some(p => {
          // Check for exact text match
          if (p.text === promptData.text) return true;
          
          // Check for near-identical text (first 200 chars) + same platform within last 5 minutes
          const textMatch = p.text.substring(0, 200) === promptData.text.substring(0, 200);
          const platformMatch = p.platform === promptData.platform;
          const timeMatch = Math.abs(new Date(p.timestamp) - new Date(promptData.timestamp)) < 5 * 60 * 1000; // 5 minutes
          
          return textMatch && platformMatch && timeMatch;
        });
        
        if (isDuplicate) {
          console.log('⏭️ Prompt Vault: Enhanced duplicate detection - skipping save');
          resolve(false);
          return;
        }
        
        // Add new prompt
        prompts.unshift(promptData);
        
        // Keep only last 1000 prompts
        if (prompts.length > 1000) {
          prompts.splice(1000);
        }        // Save
        chrome.storage.local.set({ 
          prompts: prompts,
          totalPrompts: prompts.length 
        }, () => {
          console.log('💾 Prompt Vault: Saved successfully!');
          showNotification();
          resolve(true);
        });
      });
    });
  }
  
  // Show paste detection notification
  function showPasteNotification(pastedText) {
    // Remove existing paste notification
    if (state.pastedContentNotification) {
      state.pastedContentNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'pv-paste-notification';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">📋</span>
        <span>Pasted content detected! Will capture when sent.</span>
      </div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
        ${pastedText.substring(0, 60)}${pastedText.length > 60 ? '...' : ''}
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: #2563eb;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
      max-width: 300px;
      border-left: 4px solid #60a5fa;
    `;
    
    document.body.appendChild(notification);
    state.pastedContentNotification = notification;
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (state.pastedContentNotification === notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(10px)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
          if (state.pastedContentNotification === notification) {
            state.pastedContentNotification = null;
          }
        }, 300);
      }
    }, 8000);
  }


  function showNotification() {
    // Remove existing
    const existing = document.querySelector('.pv-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'pv-notification';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${state.platform.icon}</span>
        <span>Prompt saved!</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${state.platform.color};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    

    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });
    

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }  
  function findCompletePromptContent() {
    if (!state.awaitingPromptAfterPaste) {
      return null;
    }

    console.log('🔍 Looking for complete prompt content after paste...');
    
    // Strategy 1: Use the tracked paste element (most reliable)
    if (state.pastedElement) {
      const elementText = extractText(state.pastedElement);
      if (elementText && elementText.includes(state.pastedContent.substring(0, 50))) {
        console.log('✅ Found content in tracked paste element');
        return {
          element: state.pastedElement,
          text: elementText
        };
      }
    }
    
    // Strategy 2: Search platform-specific input elements
    const platformSelectors = getPlatformSpecificSelectors();
    
    for (const selector of platformSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Skip if element is not visible
        if (el.offsetParent === null && !el.closest('[contenteditable="true"]')) continue;
        
        const text = extractText(el);
        if (text && text.includes(state.pastedContent.substring(0, 50))) {
          console.log('✅ Found input with pasted content:', selector);
          
          // Prefer elements with more complete content
          if (text.length >= state.pastedContent.length) {
            return {
              element: el,
              text: text
            };
          }
        }
      }
    }
    
    // Strategy 3: Search all standard input elements
    const inputSelectors = [
      'textarea', 
      '[contenteditable="true"]', 
      '.ProseMirror',
      '[role="textbox"]',
      '[data-testid*="message"]',
      '[data-testid*="composer"]',
      '[data-testid*="input"]',
      '.composer-input',
      '.input-area',
      '.message-input'
    ];
    
    let bestMatch = null;
    let bestMatchLength = 0;
    
    for (const selector of inputSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Skip if element is not visible
        if (el.offsetParent === null && !el.closest('[contenteditable="true"]')) continue;
        
        const text = extractText(el);
        if (text && text.includes(state.pastedContent.substring(0, 50))) {
          if (text.length > bestMatchLength) {
            bestMatch = el;
            bestMatchLength = text.length;
          }
        }
      }
    }
    
    if (bestMatch) {
      console.log('✅ Found best matching input with pasted content, length:', bestMatchLength);
      return {
        element: bestMatch,
        text: extractText(bestMatch)
      };
    }
    
    // Strategy 4: Look up the DOM tree from the pasted element to find a container
    if (state.pastedElement) {
      let currentElement = state.pastedElement;
      for (let i = 0; i < 10; i++) { // Look up to 10 levels
        if (!currentElement || !currentElement.parentElement) break;
        
        currentElement = currentElement.parentElement;
        const elementText = extractText(currentElement);
        
        // Check if this element contains our pasted content and potentially more
        if (elementText && elementText.includes(state.pastedContent.substring(0, 50))) {
          console.log(`🎯 Found content at DOM level ${i}:`, elementText.substring(0, 100));
          
          // If this container has significantly more content than just the paste, use it
          if (elementText.length > state.pastedContent.length * 1.1) {
            return {
              element: currentElement,
              text: elementText
            };
          }
        }
      }
    }
    
    // Strategy 5: Last resort - search for any element containing the pasted content
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.offsetParent === null) continue;
      
      const text = extractText(element);
      if (text && text.includes(state.pastedContent.substring(0, 50)) && text.length > state.pastedContent.length) {
        console.log('✅ Found content in fallback search');
        return {
          element: element,
          text: text
        };
      }
    }
    
    console.log('❌ Could not find complete prompt content');
    return null;
  }
  
  // Get platform-specific selectors for better targeting
  function getPlatformSpecificSelectors() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('claude.ai')) {
      return [
        '.ProseMirror',
        '[contenteditable="true"]',
        '.bg-bg-000',
        '.whitespace-pre-wrap.font-mono',
        '[data-testid*="composer"]'
      ];
    } else if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      return [
        '[data-testid="message-composer"]',
        '#prompt-textarea',
        '.composer-input',
        '[contenteditable="true"]',
        'textarea[placeholder*="message"]'
      ];
    } else if (hostname.includes('gemini.google.com')) {
      return [
        '.ql-editor',
        '[contenteditable="true"]',
        '.composer-input',
        '[data-testid*="input"]',
        '.input-area'
      ];
    } else if (hostname.includes('poe.com')) {
      return [
        '.ChatMessageInputContainer_textArea',
        'textarea',
        '[contenteditable="true"]',
        '.composer-input'
      ];
    }
    
    // Default selectors for unknown platforms
    return [
      'textarea',
      '[contenteditable="true"]',
      '.ProseMirror',
      '[role="textbox"]'
    ];
  }// NEW: Fixed paste detection that stages content instead of immediate capture
function setupFixedPasteDetection() {
  console.log('📋 Setting up FIXED paste detection (staging system)...');
  
  // Listen for paste events globally
  document.addEventListener('paste', (e) => {
    console.log('📋 FIXED: Paste event detected!');
    
    const target = e.target;
    const clipboardData = e.clipboardData || window.clipboardData;
    
    if (clipboardData) {
      // Get multiple clipboard formats
      let pastedText = '';
      let pastedHtml = '';
      let pastedRtf = '';
      
      try {
        pastedText = clipboardData.getData('text/plain') || '';
        pastedHtml = clipboardData.getData('text/html') || '';
        pastedRtf = clipboardData.getData('text/rtf') || '';
      } catch (err) {
        console.log('📋 Error reading clipboard data:', err);
      }
      
      // Use the best available format
      let finalContent = pastedText;
      if (!finalContent && pastedHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pastedHtml;
        finalContent = tempDiv.textContent || tempDiv.innerText || '';
      }
      
      if (finalContent && finalContent.length > 10) {
        console.log('📋 FIXED: Staging pasted content (NO TRUNCATION):', finalContent.length, 'characters');
        
        // STAGE the content (don't capture yet)
        stagedPasteState.hasStaged = true;
        stagedPasteState.fullContent = finalContent; // Store FULL content
        stagedPasteState.stagedTime = Date.now();
        stagedPasteState.targetElement = target;
        stagedPasteState.formats = {
          text: pastedText,
          html: pastedHtml,
          rtf: pastedRtf
        };
        
        // Show "staged" notification (purple)
        showStagedContentNotification(finalContent);
        
        console.log('📋 ✅ Content STAGED. Will capture when user sends.');
      }
    }
  }, true);
}

// NEW: Show staged content notification (purple, not blue)
function showStagedContentNotification(stagedText) {
  // Remove existing notification
  if (stagedPasteState.notification) {
    stagedPasteState.notification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'pv-staged-notification';
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">📋</span>
      <span>Content Staged! Add your prompt and send.</span>
    </div>
    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
      ${stagedText.length} characters staged: "${stagedText.substring(0, 50)}${stagedText.length > 50 ? '...' : ''}"
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 24px;
    background: #7c3aed;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
    max-width: 350px;
    border-left: 4px solid #a855f7;
  `;
  
  document.body.appendChild(notification);
  stagedPasteState.notification = notification;
  
  // Animate in
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });
}

// NEW: Capture function that works with staged content
async function captureWithStagedContent(source) {
  if (!state.isRecording || !state.platform) return;
  
  console.log(`🎯 FIXED: Attempting to capture with staged content from: ${source}`);
    let input = findActiveInput();
  if (!input) {
    console.log('❌ FIXED: No active input found - clearing staged state...');
    
    // Clear staged notification with error message
    if (stagedPasteState.notification) {
      stagedPasteState.notification.style.background = '#ef4444';
      stagedPasteState.notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">❌</span>
          <span>Could not find input field</span>
        </div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
          Please try clicking in the text area first
        </div>
      `;
      
      setTimeout(() => {
        if (stagedPasteState.notification) {
          stagedPasteState.notification.style.opacity = '0';
          setTimeout(() => {
            if (stagedPasteState.notification && stagedPasteState.notification.parentNode) {
              stagedPasteState.notification.remove();
            }
            stagedPasteState.notification = null;
          }, 300);
        }
      }, 4000); // Show error longer
    }
    
    // Reset staged state but keep content for retry
    stagedPasteState.hasStaged = false;
    return;
  }
  
  console.log('✅ FIXED: Active input found, proceeding with capture...');
  
  // Get the current text from the input
  let currentText = extractCompleteText(input); // Use FIXED extraction
  
  // If we have staged content, combine it
  let finalText = currentText;
  if (stagedPasteState.hasStaged && stagedPasteState.fullContent) {
    console.log('📋 FIXED: Combining staged content with current input...');
    console.log(`  - Staged content: ${stagedPasteState.fullContent.length} chars`);
    console.log(`  - Current input: ${currentText.length} chars`);
      // Check if current text already contains the staged content
    if (!currentText.includes(stagedPasteState.fullContent.substring(0, 100))) {
      // Staged content not found in current text, combine them
      finalText = stagedPasteState.fullContent + (currentText ? '\n\n' + currentText : '');
      console.log('📋 FIXED: Combined staged + current text');
    } else {
      // Current text already contains staged content, use current
      finalText = currentText;
      console.log('📋 FIXED: Current text already contains staged content');
    }
    
    console.log(`  - Final combined: ${finalText.length} chars`);
      // Clear staged state
    stagedPasteState.hasStaged = false;
    stagedPasteState.fullContent = '';
    
    // Remove staged notification with success transition
    if (stagedPasteState.notification) {
      stagedPasteState.notification.style.background = '#10b981';
      stagedPasteState.notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">✅</span>
          <span>Complete Prompt Captured!</span>
        </div>
        <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
          ${finalText.length} total characters saved
        </div>
      `;
      
      setTimeout(() => {
        if (stagedPasteState.notification) {
          stagedPasteState.notification.style.opacity = '0';
          setTimeout(() => {
            if (stagedPasteState.notification && stagedPasteState.notification.parentNode) {
              stagedPasteState.notification.remove();
            }
            stagedPasteState.notification = null;
          }, 300);
        }
      }, 3000);
    }
  } else if (!stagedPasteState.hasStaged && stagedPasteState.notification) {
    // No staged content but notification exists - capture current input only
    console.log('📋 FIXED: No staged content, capturing current input only');
    
    // Clear notification
    if (stagedPasteState.notification) {
      stagedPasteState.notification.style.opacity = '0';
      setTimeout(() => {
        if (stagedPasteState.notification && stagedPasteState.notification.parentNode) {
          stagedPasteState.notification.remove();
        }
        stagedPasteState.notification = null;
      }, 300);
    }
  }
  
  // Filter out tool-related content
  if (isToolRelatedContent(finalText)) {
    console.log('🚫 Filtering out tool-related content');
    return;
  }
  
  if (!finalText || finalText.trim().length === 0) {
    console.log('❌ No text found');
    return;
  }
  
  console.log(`✅ FIXED: Capturing complete prompt (${finalText.length} chars)`);
  
  // Use existing capture system
  state.captureInProgress = true;
  state.lastCapturedText = finalText;
  state.lastCapturedTime = Date.now();
  
  return captureWithUrlDetection(finalText, source + '-with-staged-content')
    .finally(() => {
      state.captureInProgress = false;
      state.capturePromise = null;
    });
}

// Enhanced paste detection with multi-format support
  function setupPasteDetection() {
    console.log('📋 Setting up enhanced paste detection...');
    
    // Listen for paste events globally with enhanced multi-format detection
    document.addEventListener('paste', (e) => {
      console.log('📋 Paste event detected!');
      
      const target = e.target;
      const clipboardData = e.clipboardData || window.clipboardData;
      
      if (clipboardData) {
        // Try multiple formats for more robust detection
        let pastedText = '';
        let pastedHtml = '';
        let pastedRtf = '';
        
        // Get different clipboard formats
        try {
          pastedText = clipboardData.getData('text/plain') || '';
          pastedHtml = clipboardData.getData('text/html') || '';
          pastedRtf = clipboardData.getData('text/rtf') || '';
        } catch (err) {
          console.log('📋 Error reading clipboard data:', err);
        }
        
        // Use the best available format
        let finalContent = pastedText;
        if (!finalContent && pastedHtml) {
          // Extract text from HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = pastedHtml;
          finalContent = tempDiv.textContent || tempDiv.innerText || '';
        }
        
        if (finalContent && finalContent.length > 10) {
          console.log('📋 Pasted content detected:', finalContent.substring(0, 100));
          
          // Store paste information with enhanced tracking
          state.pastedContent = finalContent;
          state.pastedElement = target;
          state.recentPasteTime = Date.now();
          state.awaitingPromptAfterPaste = true;
          state.pastedHtml = pastedHtml;
          state.pastedFormats = {
            text: pastedText,
            html: pastedHtml,
            rtf: pastedRtf
          };
          
          // Show notification immediately
          showPasteNotification(finalContent);
          
          // Platform-specific enhanced monitoring
          setTimeout(() => {
            enhancedPlatformMonitoring(finalContent, target);
          }, 100);
          
          // Progressive monitoring strategy
          setTimeout(() => {
            progressiveContentMonitoring(finalContent);
          }, 500);
          
          // Final check after UI stabilization
          setTimeout(() => {
            finalContentCheck(finalContent);
          }, 1000);
        }
      }
    }, true);
    
    // Enhanced input event monitoring for paste content
    document.addEventListener('input', (e) => {
      if (state.awaitingPromptAfterPaste && state.pastedContent) {
        const target = e.target;
        const currentText = extractText(target);
        
        // Check if the input contains our pasted content
        if (currentText && currentText.includes(state.pastedContent.substring(0, 50))) {
          console.log('📋 Input event detected with pasted content');
          state.pastedElement = target;
          
          // Update our tracking for the complete content
          if (currentText.length > state.pastedContent.length) {
            console.log('📋 Found enhanced content via input event');
          }
        }
      }
    }, true);
  }
  
  // Enhanced platform-specific monitoring
  function enhancedPlatformMonitoring(pastedContent, target) {
    const hostname = window.location.hostname;
    
    if (hostname.includes('claude.ai')) {
      monitorClaudeSpecific(pastedContent, target);
    } else if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      monitorChatGPTSpecific(pastedContent, target);
    } else if (hostname.includes('gemini.google.com')) {
      monitorGeminiSpecific(pastedContent, target);
    } else if (hostname.includes('poe.com')) {
      monitorPoeSpecific(pastedContent, target);
    }
  }
  
  // Claude-specific monitoring
  function monitorClaudeSpecific(pastedContent, target) {
    console.log('📋 Monitoring Claude-specific paste containers...');
    
    const selectors = [
      '.bg-bg-000',
      '.whitespace-pre-wrap.font-mono',
      '[contenteditable="true"]',
      '.ProseMirror',
      '.composer-input',
      '[data-testid*="composer"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const elementText = extractText(element);
        if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
          console.log('📋 Found Claude container with pasted content:', selector);
          state.pastedElement = element.closest('[contenteditable], .ProseMirror, [role="textbox"]') || element;
        }
      });
    });
  }
  
  // ChatGPT-specific monitoring
  function monitorChatGPTSpecific(pastedContent, target) {
    console.log('📋 Monitoring ChatGPT-specific paste containers...');
    
    const selectors = [
      '[data-testid="message-composer"]',
      '#prompt-textarea',
      '.composer-input',
      '[contenteditable="true"]',
      'textarea[placeholder*="message"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const elementText = extractText(element);
        if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
          console.log('📋 Found ChatGPT container with pasted content:', selector);
          state.pastedElement = element;
        }
      });
    });
  }
  
  // Gemini-specific monitoring
  function monitorGeminiSpecific(pastedContent, target) {
    console.log('📋 Monitoring Gemini-specific paste containers...');
    
    const selectors = [
      '.ql-editor',
      '[contenteditable="true"]',
      '.composer-input',
      '[data-testid*="input"]',
      '.input-area'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const elementText = extractText(element);
        if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
          console.log('📋 Found Gemini container with pasted content:', selector);
          state.pastedElement = element;
        }
      });
    });
  }
  
  // Poe-specific monitoring
  function monitorPoeSpecific(pastedContent, target) {
    console.log('📋 Monitoring Poe-specific paste containers...');
    
    const selectors = [
      '.ChatMessageInputContainer_textArea',
      'textarea',
      '[contenteditable="true"]',
      '.composer-input'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const elementText = extractText(element);
        if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
          console.log('📋 Found Poe container with pasted content:', selector);
          state.pastedElement = element;
        }
      });
    });
  }
  
  // Progressive content monitoring with multiple strategies
  function progressiveContentMonitoring(pastedContent) {
    console.log('📋 Starting progressive content monitoring...');
    
    // Strategy 1: Monitor all contenteditable elements
    const editableElements = document.querySelectorAll('[contenteditable="true"], .ProseMirror, textarea, [role="textbox"]');
    editableElements.forEach(element => {
      const elementText = extractText(element);
      if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
        console.log('📋 Progressive monitoring found content in editable element');
        state.pastedElement = element;
      }
    });
    
    // Strategy 2: Monitor for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.nodeType === Node.TEXT_NODE) {
            const parentElement = target.parentElement;
            if (parentElement) {
              const elementText = extractText(parentElement);
              if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
                console.log('📋 Progressive monitoring found content via mutation');
                state.pastedElement = parentElement.closest('[contenteditable], .ProseMirror, textarea, [role="textbox"]') || parentElement;
              }
            }
          }
        }
      });
    });
    
    // Observe for 2 seconds then disconnect
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    setTimeout(() => {
      observer.disconnect();
    }, 2000);
  }
  
  // Final content check after UI stabilization
  function finalContentCheck(pastedContent) {
    console.log('📋 Performing final content check...');
    
    // Check all possible input containers one more time
    const allSelectors = [
      'textarea',
      '[contenteditable="true"]',
      '.ProseMirror',
      '[role="textbox"]',
      '[data-testid*="composer"]',
      '[data-testid*="input"]',
      '.composer-input',
      '.input-area',
      '.message-input',
      '.ql-editor',
      '.ChatMessageInputContainer_textArea',
      '#prompt-textarea'
    ];
    
    let bestMatch = null;
    let bestMatchLength = 0;
    
    allSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.offsetParent !== null || element.closest('[contenteditable="true"]')) {
          const elementText = extractText(element);
          if (elementText && elementText.includes(pastedContent.substring(0, 50))) {
            if (elementText.length > bestMatchLength) {
              bestMatch = element;
              bestMatchLength = elementText.length;
            }
          }
        }
      });
    });
    
    if (bestMatch) {
      console.log('📋 Final check found best match with length:', bestMatchLength);
      state.pastedElement = bestMatch;
    }
  }
  
  // NEW: Fixed event listeners that work with staged system
  function setupFixedListeners() {
    console.log('👂 Setting up FIXED event listeners with staging support...');
    
    // Method 1: Send button clicks with staged content support
    document.addEventListener('click', async (e) => {
      const target = e.target;
      const button = target.closest('button, [role="button"]');
      
      if (button) {
        const buttonText = button.textContent.toLowerCase().trim();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        const buttonHTML = button.innerHTML.toLowerCase();
        
        // Enhanced filter for tool buttons (same as before)
        const toolKeywords = [
          'deepsearch', 'canvas', 'tool', 'search', 'analyze', 'web search',
          'generate', 'create', 'draw', 'sketch', 'diagram', 'chart',
          'code', 'run', 'execute', 'debug', 'test', 'compile',
          'translate', 'summarize', 'explain', 'rewrite',
          'math', 'calculate', 'solve', 'compute'
        ];
        
        const isToolButton = toolKeywords.some(keyword => 
          buttonText.includes(keyword) || 
          ariaLabel.includes(keyword) ||
          buttonHTML.includes(keyword)
        ) ||
        button.closest('[data-testid*="tool"]') ||
        button.closest('[class*="tool"]') ||
        button.closest('.tool-button') ||
        button.closest('[data-tool]') ||
        button.closest('.gemini-tool') ||
        button.dataset.tool ||
        button.classList.contains('tool-btn') ||
        button.closest('.toolbar') ||
        button.closest('.tool-panel') ||
        button.closest('[role="toolbar"]') ||
        button.closest('[data-testid*="extension"]') ||
        button.closest('[data-testid*="plugin"]') ||
        (buttonText.length > 0 && buttonText.length < 15 && 
         !buttonText.includes('send') && 
         !ariaLabel.includes('send') &&
         button.type !== 'submit');
        
        // Only process actual send buttons
        const sendKeywords = ['send', 'submit', 'post', 'reply'];
        const isSendButton = !isToolButton && (
          sendKeywords.some(keyword => 
            buttonText.includes(keyword) || 
            ariaLabel.includes(keyword)
          ) ||
          (button.querySelector('svg') && 
           !toolKeywords.some(keyword => buttonText.includes(keyword)) &&
           !buttonText.includes('search')) ||
          button.type === 'submit' ||
          button.matches('[data-testid*="send"]') ||
          button.matches('[aria-label*="Send"]') ||
          button.matches('[title*="Send"]')
        );
        
        if (isSendButton) {
          console.log('🔘 FIXED: Send button clicked:', buttonText || ariaLabel || 'submit');
          
          // Check for staged content first
          if (stagedPasteState.hasStaged) {
            console.log('🔘 FIXED: Capturing with staged content');
            await captureWithStagedContent('send-button');
          } else {
            console.log('🔘 FIXED: Standard capture (no staged content)');
            await capturePrompt('send-button');
          }
        } else if (isToolButton) {
          console.log('🚫 Tool button ignored:', buttonText || ariaLabel || 'tool button');
        }
      }
    }, true);

    // Method 2: Enter key with staged content support
    let lastEnterTime = 0;
    document.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const now = Date.now();
        if (now - lastEnterTime < 500) return; // Prevent rapid-fire
        lastEnterTime = now;
        
        const activeElement = document.activeElement;
        if (activeElement && extractCompleteText(activeElement)) {
          console.log('⌨️ FIXED: Enter key pressed');
          
          // Check for staged content first
          if (stagedPasteState.hasStaged) {
            console.log('⌨️ FIXED: Capturing with staged content');
            await captureWithStagedContent('enter-key');
          } else {
            console.log('⌨️ FIXED: Standard capture (no staged content)');
            await capturePrompt('enter-key');
          }
        }
      }
    }, true);

    // Method 3: Form submissions with staged content support
    document.addEventListener('submit', async (e) => {
      console.log('📋 FIXED: Form submitted');
      
      // Check for staged content first
      if (stagedPasteState.hasStaged) {
        console.log('📋 FIXED: Form submit with staged content');
        await captureWithStagedContent('form-submit');
      } else {
        console.log('📋 FIXED: Standard form submit');
        await capturePrompt('form-submit');
      }
    }, true);
    
    // Method 4: Clean up old staged content after timeout
    setInterval(() => {
      if (stagedPasteState.hasStaged && stagedPasteState.stagedTime) {
        const timeSinceStaged = Date.now() - stagedPasteState.stagedTime;
        
        // Clear after 2 minutes of inactivity
        if (timeSinceStaged > 120000) {
          console.log('📋 FIXED: Clearing old staged content');
          stagedPasteState.hasStaged = false;
          stagedPasteState.fullContent = '';
          
          if (stagedPasteState.notification) {
            stagedPasteState.notification.style.opacity = '0';
            setTimeout(() => {
              if (stagedPasteState.notification && stagedPasteState.notification.parentNode) {
                stagedPasteState.notification.remove();
              }
              stagedPasteState.notification = null;
            }, 300);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Setup event listeners
  function setupListeners() {
    console.log('👂 Setting up enhanced event listeners...');    // Method 1: Send button clicks - highest priority with paste awareness
    document.addEventListener('click', async (e) => {
      const target = e.target;
      const button = target.closest('button, [role="button"]');
      
      if (button) {
        // Check if it might be a send button
        const buttonText = button.textContent.toLowerCase().trim();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        const buttonHTML = button.innerHTML.toLowerCase();
        
        // Enhanced filter for Gemini tool buttons and other non-send interactions
        const toolKeywords = [
          'deepsearch', 'canvas', 'tool', 'search', 'analyze', 'web search',
          'generate', 'create', 'draw', 'sketch', 'diagram', 'chart',
          'code', 'run', 'execute', 'debug', 'test', 'compile',
          'translate', 'summarize', 'explain', 'rewrite',
          'math', 'calculate', 'solve', 'compute'
        ];
        
        const isToolButton = toolKeywords.some(keyword => 
          buttonText.includes(keyword) || 
          ariaLabel.includes(keyword) ||
          buttonHTML.includes(keyword)
        ) ||
        // Check for tool-related containers and attributes
        button.closest('[data-testid*="tool"]') ||
        button.closest('[class*="tool"]') ||
        button.closest('.tool-button') ||
        button.closest('[data-tool]') ||
        button.closest('.gemini-tool') ||
        button.dataset.tool ||
        button.classList.contains('tool-btn') ||
        // Check if button is inside a tool panel or toolbar
        button.closest('.toolbar') ||
        button.closest('.tool-panel') ||
        button.closest('[role="toolbar"]') ||
        // Check for specific Gemini tool selectors
        button.closest('[data-testid*="extension"]') ||
        button.closest('[data-testid*="plugin"]') ||
        // Filter very short button text that might be tool names
        (buttonText.length > 0 && buttonText.length < 15 && 
         !buttonText.includes('send') && 
         !ariaLabel.includes('send') &&
         button.type !== 'submit');
        
        // Only process actual send buttons
        const sendKeywords = ['send', 'submit', 'post', 'reply'];
        const isSendButton = !isToolButton && (
          sendKeywords.some(keyword => 
            buttonText.includes(keyword) || 
            ariaLabel.includes(keyword)
          ) ||
          (button.querySelector('svg') && 
           !toolKeywords.some(keyword => buttonText.includes(keyword)) &&
           !buttonText.includes('search')) ||
          button.type === 'submit' ||
          // Common send button patterns
          button.matches('[data-testid*="send"]') ||
          button.matches('[aria-label*="Send"]') ||
          button.matches('[title*="Send"]')
        );
        
        if (isSendButton) {
          console.log('🔘 Send button clicked:', buttonText || ariaLabel || 'submit');
          
          // If we're waiting for paste content, capture immediately
          if (state.awaitingPromptAfterPaste) {
            console.log('🔘 Capturing pasted content on send');
            await capturePrompt('send-after-paste');
          } else {
            await capturePrompt('send-button');
          }
        } else if (isToolButton) {
          console.log('🚫 Tool button clicked, ignoring:', buttonText || ariaLabel || 'tool button');
        }
      }
    }, true);

    // Method 2: Enter key with paste awareness
    let lastEnterTime = 0;
    document.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const now = Date.now();
        if (now - lastEnterTime < 500) return; // Prevent rapid-fire
        lastEnterTime = now;
          const activeElement = document.activeElement;
        if (activeElement && extractCompleteText(activeElement)) {
          console.log('⌨️ Enter key pressed');
          
          if (state.awaitingPromptAfterPaste) {
            console.log('⌨️ Capturing pasted content on Enter');
            await capturePrompt('enter-after-paste');
          } else {
            await capturePrompt('enter-key');
          }
        }
      }
    }, true);

    // Method 3: Enhanced MutationObserver for Claude containers
    const claudeObserver = new MutationObserver((mutations) => {
      if (state.awaitingPromptAfterPaste) {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              // Check for Claude's paste containers
              if (node.matches && (
                node.matches('.bg-bg-000') || 
                node.matches('.whitespace-pre-wrap') || 
                node.matches('.font-mono') ||
                node.querySelector('.bg-bg-000, .whitespace-pre-wrap, .font-mono')
              )) {
                console.log('📋 Claude paste container appeared in DOM');
                // Update our paste element reference
                const parentInput = node.closest('[contenteditable], .ProseMirror, [role="textbox"]');
                if (parentInput) {
                  state.pastedElement = parentInput;
                  console.log('📋 Updated paste element reference');
                }
              }
            }
          }
        }
      }
    });
    
    claudeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    state.observers.push(claudeObserver);

    // Method 4: Form submissions
    document.addEventListener('submit', async (e) => {
      console.log('📋 Form submitted');
      if (state.awaitingPromptAfterPaste) {
        await capturePrompt('form-submit-after-paste');
      } else {
        await capturePrompt('form-submit');
      }
    }, true);

    // Method 5: Fallback - periodic check for missed pasted content
    setInterval(() => {
      if (state.awaitingPromptAfterPaste && state.pastedContent) {
        // Check if paste content is still awaiting capture after 10 seconds
        const timeSincePaste = Date.now() - state.recentPasteTime;
        if (timeSincePaste > 10000 && timeSincePaste < 60000) {
          console.log('🔄 Checking for missed pasted content...');
          
          // Look for elements containing our pasted content
          const allInputs = document.querySelectorAll('textarea, [contenteditable], .ProseMirror, [role="textbox"]');
          for (const input of allInputs) {
            const text = extractText(input);
            if (text && text.includes(state.pastedContent.substring(0, 100))) {
              console.log('🔄 Found missed pasted content, capturing...');
              capturePrompt('periodic-paste-check');
              break;
            }
          }
        }
        
        // Clear paste state after 60 seconds
        if (timeSincePaste > 60000) {
          console.log('📋 Clearing old paste state');
          state.awaitingPromptAfterPaste = false;
          state.pastedContent = '';
          if (state.pastedContentNotification) {
            state.pastedContentNotification.remove();
            state.pastedContentNotification = null;
          }
        }
      }      }, 5000); // Check every 5 seconds
  
    // Method 6: Mutation observer for dynamic content - throttled
    let lastMutationCaptureTime = 0;
    const observer = new MutationObserver((mutations) => {
      const now = Date.now();
      // Only process mutations if at least 2 seconds have passed
      if (now - lastMutationCaptureTime < 2000) return;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            // Check if it's a user message element
            const userSelectors = [
              '[data-message-author-role="user"]',
              '.user-message',
              '.human-message',
              '[class*="user"]',
              '[class*="human"]'
            ];
            for (const selector of userSelectors) {
              if (node.matches?.(selector) || node.querySelector?.(selector)) {
                console.log('👁️ Prompt Vault: User message detected in DOM');
                lastMutationCaptureTime = now;
                // Add delay to let DOM settle
                setTimeout(() => capturePrompt('dom-mutation'), 500);
                return;
              }
            }
          }
        }
      }
    });
      observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    state.observers.push(observer);
    
    // Method 8.5: Special detection for content changes after paste
    let contentChangeTimer = null;
    const handleContentMutation = (mutations) => {
      clearTimeout(contentChangeTimer);
      contentChangeTimer = setTimeout(() => {
        // Check if any mutation involved text changes that might be from paste
        let hasTextChange = false;
        
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.TEXT_NODE || 
                  (node.nodeType === Node.ELEMENT_NODE && extractText(node))) {
                hasTextChange = true;
                break;
              }
            }
          } else if (mutation.type === 'characterData') {
            hasTextChange = true;
          }
          
          if (hasTextChange) break;
        }
        
        if (hasTextChange && Date.now() - state.recentPasteTime < 5000) {
          console.log('📝 Prompt Vault: Content change detected after recent paste');
          capturePrompt('content-mutation-after-paste');
        }
      }, 200);
    };
    
    const contentObserver = new MutationObserver(handleContentMutation);
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
      state.observers.push(contentObserver);
  }
  
  // Check recording status
  async function checkRecordingStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['recordingEnabled'], (result) => {
        state.isRecording = result.recordingEnabled !== false;
        resolve(state.isRecording);
      });
    });
  }
  // Initialize
  async function initialize() {
    console.log('🚀 Prompt Vault: Starting initialization...');
    
    // Detect platform
    state.platform = detectPlatform();
    if (!state.platform) {
      console.log('❌ Prompt Vault: Not an AI platform');
      return;
    }
    
    console.log(`✅ Platform detected: ${state.platform.name}`);
    
    // Check recording status
    await checkRecordingStatus();
    console.log(`📹 Recording: ${state.isRecording ? 'ON' : 'OFF'}`);
    
    // Setup FIXED listeners and paste detection
    setupFixedListeners();
    setupFixedPasteDetection();
    
    console.log('✅ Prompt Vault: Ready with FIXED staging system!');
  }
    // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.recordingEnabled) {
      state.isRecording = changes.recordingEnabled.newValue;
      console.log(`📹 Recording toggled: ${state.isRecording ? 'ON' : 'OFF'}`);
    }
  });
  
  // Listen for navigation events (for SPAs like Claude)
  window.addEventListener('popstate', () => {
    console.log('🔄 Prompt Vault: Popstate event detected');
    setTimeout(() => updatePlatformInfo(), 100);
  });
  
  // Monitor pushState/replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    console.log('🔄 Prompt Vault: PushState detected');
    setTimeout(() => updatePlatformInfo(), 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    console.log('🔄 Prompt Vault: ReplaceState detected');
    setTimeout(() => updatePlatformInfo(), 100);
  };
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
    // Reinitialize on navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('🔄 Prompt Vault: URL changed to:', url);
      
      // Update platform info with new URL
      if (state.platform) {
        updatePlatformInfo();
      } else {
        // If no platform was detected before, try full initialization
        console.log('🔄 Prompt Vault: No platform detected, trying full initialization...');
        setTimeout(initialize, 500);
      }
    }  }).observe(document, { subtree: true, childList: true });
  
})();
