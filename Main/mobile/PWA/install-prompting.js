/**
 * **********************************************************************************
 * Title: Enhanced PWA Installation Prompting System
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 1.1.0
 * *-------------------------------------------------------------------------------
 * This script provides an enhanced installation prompting system for Progressive
 * Web Apps. It intelligently tracks user engagement and presents installation
 * prompts at optimal moments based on time spent on site and user interactions.
 * The system includes custom fallback prompts when browser native prompts aren't
 * available, platform-specific installation instructions, and smart cooldown
 * mechanisms to avoid prompt fatigue. It works alongside the main PWA manager
 * to create a seamless installation experience across all supported platforms.
 * **********************************************************************************
 */

// Configuration for installation prompting
const PROMPT_CONFIG = {
   // Show prompt after user has been on site for X milliseconds
   minTimeOnSite: 0, // 0 seconds for instant prompt
   
   // Show prompt after user has visited X pages/interactions
   minInteractions: 0,
   
   // Days to wait before showing prompt again if dismissed
   dismissCooldown: 2,
   
   // Key for localStorage (but remember we can't use localStorage in artifacts)
   storageKey: 'pwa_install_prompt_data'
};

// Tracking variables
let userInteractions = 0;
let timeOnSite = 0;
let promptShown = false;
let installPromptData = {
   lastDismissed: null,
   timesShown: 0,
   installed: false
};

/**
 * Initialize installation prompting system
 */
function initializeInstallPrompting() {
   // Load previous data from localStorage (if available)
   try {
       const stored = localStorage.getItem(PROMPT_CONFIG.storageKey);
       if (stored) {
           installPromptData = JSON.parse(stored);
       }
   } catch (e) {
       console.log('localStorage not available, using session-only tracking');
   }
   
   // Don't prompt if already installed
   if (installPromptData.installed || isStandalone()) {
       return;
   }
   
   // Start tracking user engagement
   startEngagementTracking();
   
   // Check if we should show prompt based on previous interactions
   checkAndShowInstallPrompt();
}

/**
 * Track user engagement on the site
 */
function startEngagementTracking() {
   // Track time on site
   const startTime = Date.now();
   setInterval(() => {
       timeOnSite = Date.now() - startTime;
   }, 1000);
   
   // Track user interactions
   const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'];
   
   interactionEvents.forEach(eventType => {
       document.addEventListener(eventType, () => {
           userInteractions++;
       }, { once: false, passive: true });
   });
   
   // Track specific app interactions (puzzle-related actions)
   const appInteractions = [
       'new-puzzle-btn',
       'load-puzzle-btn',
       'import-btn',
       'size-select'
   ];
   
   appInteractions.forEach(id => {
       const element = document.getElementById(id);
       if (element) {
           element.addEventListener('click', () => {
               userInteractions += 2; // Weight app-specific interactions more
           });
       }
   });
}

/**
 * Check if we should show the install prompt
 */
function checkAndShowInstallPrompt() {
   // Don't show if already shown this session
   if (promptShown) return;
   
   // Don't show if recently dismissed
   if (installPromptData.lastDismissed) {
       const daysSinceDismissed = (Date.now() - installPromptData.lastDismissed) / (1000 * 60 * 60 * 24);
       if (daysSinceDismissed < PROMPT_CONFIG.dismissCooldown) {
           return;
       }
   }
   
   // Check engagement criteria
   const hasEnoughTime = timeOnSite >= PROMPT_CONFIG.minTimeOnSite;
   const hasEnoughInteractions = userInteractions >= PROMPT_CONFIG.minInteractions;
   
   if (hasEnoughTime && hasEnoughInteractions) {
       showCustomInstallPrompt();
   }
}

/**
 * Show custom install prompt (fallback when browser prompt isn't available)
 */
function showCustomInstallPrompt() {
   // Don't show if browser's native prompt is available
   if (deferredPrompt) {
       // Just make the install button visible
       const installButton = document.getElementById('install-pwa-btn');
       if (installButton) {
           installButton.style.display = 'block';
           installButton.style.animation = 'pulse 2s infinite';
       }
       return;
   }
   
   promptShown = true;
   
   // Create custom install prompt
   const promptDiv = document.createElement('div');
   promptDiv.id = 'custom-install-prompt';
   promptDiv.style.cssText = `
       position: fixed;
       bottom: 20px;
       background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
       color: white;
       padding: 20px;
       border-radius: 12px;
       box-shadow: 0 8px 32px rgba(0,0,0,0.3);
       z-index: 1002;
       animation: slideInUp 0.4s ease-out;
       width: 80vw;
       left: 50%;
       transform: translateX(-50%);
   `;
   
   promptDiv.innerHTML = `
       <div style="display: flex; align-items: center; gap: 15px;">
           <div style="flex-shrink: 0;">
                <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path><polyline points='7 10 12 15 17 10'></polyline><line x1='12' y1='15' x2='12' y2='3'></line></svg>
           </div>
           <div style="flex: 1;">
               <div style="font-weight: 600; margin-bottom: 5px;">Install StarBattle App</div>
               <div style="font-size: 0.9rem; opacity: 0.9;">Get instant access and play offline!</div>
           </div>
       </div>
       <div style="display: flex; gap: 10px; margin-top: 15px;">
           <button id="custom-install-accept" style="
               flex: 1;
               background: rgba(255,255,255,0.2);
               border: 1px solid rgba(255,255,255,0.3);
               color: white;
               padding: 10px 15px;
               border-radius: 6px;
               font-weight: 600;
               cursor: pointer;
               transition: all 0.2s;
           ">Install</button>
           <button id="custom-install-dismiss" style="
               background: transparent;
               border: 1px solid rgba(255,255,255,0.3);
               color: white;
               padding: 10px 15px;
               border-radius: 6px;
               cursor: pointer;
               transition: all 0.2s;
           ">Later</button>
       </div>
   `;
   
   // Add animation CSS
   if (!document.getElementById('install-prompt-styles')) {
       const style = document.createElement('style');
       style.id = 'install-prompt-styles';
       style.textContent = `
           @keyframes slideInUp {
               from {
                   transform: translate(-50%, 100%);
                   opacity: 0;
               }
               to {
                   transform: translate(-50%, 0);
                   opacity: 1;
               }
           }
           @keyframes pulse {
               0%, 100% { transform: scale(1); }
               50% { transform: scale(1.05); }
           }
           #custom-install-accept:hover {
               background: rgba(255,255,255,0.3) !important;
           }
           #custom-install-dismiss:hover {
               background: rgba(255,255,255,0.1) !important;
           }
       `;
       document.head.appendChild(style);
   }
   
   document.body.appendChild(promptDiv);
   
   // Handle interactions
   document.getElementById('custom-install-accept').addEventListener('click', () => {
       handleCustomInstallAccept();
       promptDiv.remove();
   });
   
   document.getElementById('custom-install-dismiss').addEventListener('click', () => {
       handleCustomInstallDismiss();
       promptDiv.remove();
   });
   
   // Track that we showed the prompt
   installPromptData.timesShown++;
   savePromptData();
}

/**
 * Handle when user accepts custom install prompt
 */
function handleCustomInstallAccept() {
   if (deferredPrompt) {
       // Use browser's native prompt
       deferredPrompt.prompt();
       deferredPrompt.userChoice.then((choiceResult) => {
           if (choiceResult.outcome === 'accepted') {
               installPromptData.installed = true;
               savePromptData();
           }
           deferredPrompt = null;
       });
   } else {
       // Show instructions for manual installation
       showInstallInstructions();
   }
}

/**
 * Handle when user dismisses install prompt
 */
function handleCustomInstallDismiss() {
   installPromptData.lastDismissed = Date.now();
   savePromptData();
}

/**
 * Show manual installation instructions
 */
function showInstallInstructions() {
    const instructionsDiv = document.createElement('div');
    instructionsDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        color: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        z-index: 1003;
        max-width: 90vw;
        width: 400px;
        text-align: center;
    `;

    // Detect OS and specific browser for the requested logic
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    // This check is now more specific to identify Safari and exclude other browsers on iOS
    const isSafari = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

    let instructions = '';

    // Case 1: User is on iOS and in the Safari browser
    if (isSafari) {
        instructions = `
            <h3 style="margin-bottom: 20px;">Install on this Device</h3>
            <ol style="text-align: left; line-height: 1.6;">
                <li>Tap the Share button <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' style='display: inline-block; vertical-align: text-bottom; margin-bottom: -3px;'><path d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'></path><polyline points='16 6 12 2 8 6'></polyline><line x1='12' y1='2' x2='12' y2='15'></line></svg></li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
            </ol>
        `;
    // Case 2: User is on iOS but NOT in Safari (e.g., Chrome, Firefox)
    } else if (isIOS) {
        instructions = `
            <h3 style="margin-bottom: 20px;">Please Open in Safari</h3>
            <ol style="text-align: left; line-height: 1.6;">
                <li>This app must be installed from the Safari browser.</li>
                <li>Tap the Share or Menu button in your current browser.</li>
                <li>Find and select "Open in Safari".</li>
                <li>Once the site loads in Safari, tap the Share button there to install.</li>
            </ol>
        `;
    // Case 3: User is on Android
    } else if (isAndroid) {
        instructions = `
            <h3 style="margin-bottom: 20px;">Install on Android</h3>
            <ol style="text-align: left; line-height: 1.6;">
                <li>Tap the menu button <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor' style='display: inline-block; vertical-align: middle;'><circle cx='12' cy='5' r='2.5'></circle><circle cx='12' cy='12' r='2.5'></circle><circle cx='12' cy='19' r='2.5'></circle></svg> in your browser</li>
                <li>Look for "Add to Home screen" or "Install app"</li>
                <li>Tap "Add" or "Install" to confirm</li>
            </ol>
        `;
    // Case 4: Any other unsupported device
    } else {
        instructions = `
           <h3 style="margin-bottom: 20px;">Unsupported Device</h3>
           <p style="line-height: 1.6;">
               To install this app, please visit from a mobile device using iOS or Android.
           </p>
        `;
    }

    instructionsDiv.innerHTML = `
        ${instructions}
        <button id="instructions-close" style="
            margin-top: 20px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        ">Got it!</button>
    `;
    
    document.body.appendChild(instructionsDiv);
    
    document.getElementById('instructions-close').addEventListener('click', () => {
        instructionsDiv.remove();
    });
}

/**
 * Save prompt data to localStorage
 */
function savePromptData() {
   try {
       localStorage.setItem(PROMPT_CONFIG.storageKey, JSON.stringify(installPromptData));
   } catch (e) {
       // localStorage not available, continue with session-only tracking
   }
}

/**
 * Enhanced beforeinstallprompt handler
 */
function enhancedBeforeInstallPrompt(e) {
   console.log('App is installable - showing enhanced install options');
   
   e.preventDefault();
   deferredPrompt = e;
   
   // Show the install button with animation
   const installButton = document.getElementById('install-pwa-btn');
   if (installButton) {
       installButton.style.display = 'block';
       installButton.style.animation = 'pulse 2s infinite';
       installButton.textContent = '⬇️ Install App';
   }
   
   // If we haven't shown a prompt yet and user is engaged, show it
   if (!promptShown && userInteractions >= 2) {
       setTimeout(() => {
           if (!promptShown) {
               showCustomInstallPrompt();
           }
       }, 5000);
   }
}

// Replace the existing beforeinstallprompt listener
window.removeEventListener('beforeinstallprompt', window.addEventListener);
window.addEventListener('beforeinstallprompt', enhancedBeforeInstallPrompt);

// Initialize the enhanced prompting system
document.addEventListener('DOMContentLoaded', () => {
   initializeInstallPrompting();
});

// Export for debugging
window.InstallPrompt = {
   checkAndShowInstallPrompt,
   showCustomInstallPrompt,
   showInstallInstructions,
   getPromptData: () => installPromptData,
   getUserEngagement: () => ({ interactions: userInteractions, timeOnSite })
};
