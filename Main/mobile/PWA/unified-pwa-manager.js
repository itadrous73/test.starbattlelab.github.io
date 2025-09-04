/**
 * **********************************************************************************
 * Title: Unified PWA Management and Install Prompting System
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 2.0.0
 * *-------------------------------------------------------------------------------
 * This unified script combines both standard PWA functionality and iOS Safari
 * install prompting into a single, conflict-free system. It handles service worker
 * registration, update notifications, and platform-specific install prompts.
 * **********************************************************************************
 */

// --- GLOBAL VARIABLES ---
let deferredPrompt;
let registration;
let updateCheckInterval;
let promptShown = false;
let userInteractions = 0;
let timeOnSite = 0;
let startTime = Date.now();

// --- PLATFORM DETECTION ---
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android|crios|fxios|opios).)*safari/i.test(navigator.userAgent);
const isSafariOnIOS = isIOS && isSafari && navigator.vendor && navigator.vendor.indexOf('Apple') > -1;
const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
};

// --- CONFIGURATION ---
const PROMPT_CONFIG = {
    minTimeOnSite: 3000, // 3 seconds
    minInteractions: 1
};

// --- UTILITY FUNCTIONS ---

/**
 * Add shared CSS styles for all prompts with higher z-index
 */
function addSharedStyles() {
    if (document.getElementById('unified-pwa-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'unified-pwa-styles';
    style.textContent = `
        @keyframes slideInUp {
            from {
                transform: translateX(-50%) translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes modalFadeIn {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .pwa-prompt {
            z-index: 10001 !important; /* Higher than update notifications */
        }
        
        .pwa-update {
            z-index: 10000 !important;
        }
        
        .pwa-overlay {
            z-index: 10002 !important;
        }
        
        .pwa-button:hover {
            background: rgba(255,255,255,0.3) !important;
            transform: translateY(-1px);
        }
        
        @media (max-width: 360px) {
            .pwa-prompt {
                max-width: calc(100vw - 20px) !important;
                min-width: unset !important;
                left: 10px !important;
                right: 10px !important;
                transform: none !important;
                width: calc(100vw - 20px) !important;
            }
            @keyframes slideInUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Remove any existing prompts to prevent conflicts
 */
function removeExistingPrompts() {
    const existingPrompts = [
        'custom-install-prompt',
        'safari-required-prompt',
        'pwa-install-overlay'
    ];
    
    existingPrompts.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
        }
    });
}

// --- ENGAGEMENT TRACKING ---

/**
 * Start tracking user engagement
 */
function startEngagementTracking() {
    // Track time on site
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

    // Track app-specific interactions with higher weight
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
                userInteractions += 2;
                // Check for install prompt after app interaction
                setTimeout(checkAndShowInstallPrompt, 1000);
            });
        }
    });
}

// --- INSTALL PROMPTS ---

/**
 * Check if we should show install prompt based on engagement
 */
function checkAndShowInstallPrompt() {
    if (promptShown || isStandalone()) return;
    
    const hasEnoughTime = timeOnSite >= PROMPT_CONFIG.minTimeOnSite;
    const hasEnoughInteractions = userInteractions >= PROMPT_CONFIG.minInteractions;
    
    if (hasEnoughTime && hasEnoughInteractions) {
        if (isSafariOnIOS) {
            showIOSInstallPrompt();
        } else if (deferredPrompt) {
            showStandardInstallPrompt();
        }
    }
}

/**
 * Show standard PWA install prompt
 */
function showStandardInstallPrompt() {
    removeExistingPrompts();
    promptShown = true;
    addSharedStyles();

    const promptDiv = document.createElement('div');
    promptDiv.id = 'custom-install-prompt';
    promptDiv.className = 'pwa-prompt';
    promptDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: slideInUp 0.4s ease-out;
        max-width: min(550px, calc(100vw - 40px));
        width: auto;
        min-width: 350px;
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
            <button id="standard-install-accept" class="pwa-button" style="
                flex: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px; font-weight: 600;
                cursor: pointer; transition: all 0.2s;
            ">Install</button>
            <button id="standard-install-dismiss" class="pwa-button" style="
                background: transparent; border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px;
                cursor: pointer; transition: all 0.2s;
            ">Later</button>
        </div>
    `;

    document.body.appendChild(promptDiv);

    // Handle interactions
    document.getElementById('standard-install-accept').addEventListener('click', () => {
        promptDiv.remove();
        triggerStandardInstall();
    });

    document.getElementById('standard-install-dismiss').addEventListener('click', () => {
        promptDiv.remove();
    });
}

/**
 * Show iOS Safari install prompt
 */
function showIOSInstallPrompt() {
    removeExistingPrompts();
    promptShown = true;
    addSharedStyles();

    const promptDiv = document.createElement('div');
    promptDiv.id = 'custom-install-prompt';
    promptDiv.className = 'pwa-prompt';
    promptDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: slideInUp 0.4s ease-out;
        max-width: min(550px, calc(100vw - 40px));
        width: auto;
        min-width: 350px;
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
            <button id="ios-install-accept" class="pwa-button" style="
                flex: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px; font-weight: 600;
                cursor: pointer; transition: all 0.2s;
            ">Install</button>
            <button id="ios-install-dismiss" class="pwa-button" style="
                background: transparent; border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px;
                cursor: pointer; transition: all 0.2s;
            ">Later</button>
        </div>
    `;

    document.body.appendChild(promptDiv);

    // Handle interactions
    document.getElementById('ios-install-accept').addEventListener('click', () => {
        promptDiv.remove();
        showInstallInstructions();
    });

    document.getElementById('ios-install-dismiss').addEventListener('click', () => {
        promptDiv.remove();
    });
}

/**
 * Trigger standard install prompt
 */
function triggerStandardInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log('User response to install prompt:', choiceResult.outcome);
            
            if (choiceResult.outcome === 'accepted') {
                showInstallSuccessMessage();
            }
            
            deferredPrompt = null;
        }).catch(error => {
            console.error('Error during install prompt:', error);
        });
    }
}

/**
 * Show iOS install instructions
 */
function showInstallInstructions() {
    addSharedStyles();
    
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'pwa-install-overlay';
    overlayDiv.className = 'pwa-overlay';
    overlayDiv.style.cssText = `
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    `;

    const instructionsDiv = document.createElement('div');
    instructionsDiv.style.cssText = `
        background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
        color: white;
        padding: 24px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        width: 100%;
        max-width: 550px;
        animation: modalFadeIn 0.3s ease-out;
    `;

    instructionsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
            <div style="flex-shrink: 0;">
                <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'></path><polyline points='16 6 12 2 8 6'></polyline><line x1='12' y1='2' x2='12' y2='15'></line></svg>
            </div>
            <div style="flex: 1; text-align: left;">
                <div style="font-weight: 600; margin-bottom: 5px; font-size: 1.1rem;">Install on this Device</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Follow these steps:</div>
            </div>
        </div>
        <ol style="text-align: left; line-height: 1.8; padding-left: 20px; font-size: 0.95rem; margin: 0 0 20px 0;">
            <li style="margin-bottom: 8px;">Tap the <strong>Share</strong> button <span style="opacity: 0.7;">(usually at the bottom of Safari)</span></li>
            <li style="margin-bottom: 8px;">Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> to confirm installation</li>
        </ol>
        <button id="instructions-close" class="pwa-button" style="
            width: 100%;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.2s;
        ">Got it!</button>
    `;

    overlayDiv.appendChild(instructionsDiv);
    document.body.appendChild(overlayDiv);

    // Handle close
    document.getElementById('instructions-close').addEventListener('click', () => {
        overlayDiv.style.animation = 'fadeOut 0.2s ease-in forwards';
        setTimeout(() => overlayDiv.remove(), 200);
    });

    // Close on overlay click
    overlayDiv.addEventListener('click', (e) => {
        if (e.target === overlayDiv) {
            overlayDiv.style.animation = 'fadeOut 0.2s ease-in forwards';
            setTimeout(() => overlayDiv.remove(), 200);
        }
    });
}

/**
 * Show install success message
 */
function showInstallSuccessMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #10b981;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10003;
        font-size: 1rem;
        font-weight: 500;
    `;
    message.textContent = 'App installed successfully! All puzzles are now available offline.';
    document.body.appendChild(message);

    setTimeout(() => message.remove(), 4000);
}

// --- SERVICE WORKER MANAGEMENT ---

/**
 * Register service worker
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './',
                updateViaCache: 'none'
            });

            console.log('Service Worker registered with scope:', registration.scope);

            await checkForUpdates();
            registration.addEventListener('updatefound', handleUpdateFound);

            if (registration.waiting) {
                showUpdateNotification(registration.waiting);
            }

            startPeriodicUpdateChecks();

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

/**
 * Handle service worker update found
 */
function handleUpdateFound() {
    console.log('New service worker version found');
    const newWorker = registration.installing;

    if (newWorker) {
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version ready');
                showUpdateNotification(newWorker);
            }
        });
    }
}

/**
 * Check for updates
 */
async function checkForUpdates() {
    if (registration) {
        try {
            await registration.update();
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
}

/**
 * Start periodic update checks
 */
function startPeriodicUpdateChecks() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    updateCheckInterval = setInterval(() => {
        checkForUpdates();
    }, 1800000); // 30 minutes
}

/**
 * Show update notification with proper z-index
 */
function showUpdateNotification(newWorker) {
    // Remove any existing update notification
    const existingNotification = document.getElementById('update-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    addSharedStyles();

    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.className = 'pwa-update';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 15px;
        font-size: 1rem;
        max-width: min(550px, calc(100vw - 40px));
        animation: slideInUp 0.3s ease-out;
    `;

    notification.innerHTML = `
        <div style="flex: 1;">
            <p style="margin: 0; font-weight: 600;">A new version is available!</p>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Update now to get the latest features.</p>
        </div>
        <button id="reload-button" class="pwa-button" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            transition: all 0.2s;
            white-space: nowrap;
        ">Update Now</button>
        <button id="dismiss-update" style="
            background: transparent;
            color: white;
            border: none;
            opacity: 0.8;
            padding: 5px;
            cursor: pointer;
            font-size: 1.75rem;
            line-height: 1;
        ">&times;</button>
    `;

    document.body.appendChild(notification);

    // Handle update button
    document.getElementById('reload-button').addEventListener('click', () => {
        const button = document.getElementById('reload-button');
        button.textContent = 'Updating...';
        button.disabled = true;
        newWorker.postMessage({ action: 'skipWaiting' });
    });

    // Handle dismiss
    document.getElementById('dismiss-update').addEventListener('click', () => {
        notification.remove();
    });

    // Listen for controller change to reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New service worker activated, reloading page');
        window.location.reload();
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (document.getElementById('update-notification')) {
            notification.remove();
        }
    }, 30000);
}

// --- EVENT LISTENERS ---

// Listen for beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('App is installable');
    e.preventDefault();
    deferredPrompt = e;
    
    // Don't auto-show, wait for user engagement
    setTimeout(checkAndShowInstallPrompt, 2000);
});

// Listen for app installed
window.addEventListener('appinstalled', () => {
    console.log('PWA was successfully installed');
    deferredPrompt = null;
    
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.style.display = 'none';
    }
    
    showInstallSuccessMessage();
    startPeriodicUpdateChecks();
});

// --- INITIALIZATION ---

/**
 * Initialize unified PWA system
 */
async function initializeUnifiedPWA() {
    console.log('Initializing unified PWA system...');

    // Hide install button if already installed
    if (isStandalone()) {
        const installButton = document.getElementById('install-pwa-btn');
        if (installButton) {
            installButton.style.display = 'none';
        }
    } else {
        // Start engagement tracking for install prompts
        startEngagementTracking();
        
        // Set up install button if it exists
        const installButton = document.getElementById('install-pwa-btn');
        if (installButton) {
            installButton.addEventListener('click', () => {
                if (isSafariOnIOS) {
                    showIOSInstallPrompt();
                } else if (deferredPrompt) {
                    triggerStandardInstall();
                }
            });
        }
    }

    // Register service worker
    await registerServiceWorker();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkForUpdates();
        }
    });

    // Check for updates on focus
    window.addEventListener('focus', checkForUpdates);

    console.log('Unified PWA system initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUnifiedPWA);
} else {
    initializeUnifiedPWA();
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
});

// Debug export
if (typeof window !== 'undefined') {
    window.UnifiedPWA = {
        checkForUpdates,
        checkAndShowInstallPrompt,
        showIOSInstallPrompt,
        showStandardInstallPrompt,
        isStandalone: isStandalone(),
        platform: { isIOS, isSafari, isSafariOnIOS },
        engagement: () => ({ interactions: userInteractions, timeOnSite })
    };
}
