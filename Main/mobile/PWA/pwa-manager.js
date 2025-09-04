/**
 * **********************************************************************************
 * Title: PWA Management and Update Notification System
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 1.2.0
 * *-------------------------------------------------------------------------------
 * This script handles the registration of the service worker, manages the PWA
 * update lifecycle, and provides a custom install prompt experience. It detects
 * when a new version of the service worker is available, caches it in the
 * background, and then presents a notification to the user with an option to
 * refresh the page to activate the new version. It also manages the custom
 * install prompt and checks for updates every time the app starts.
 * **********************************************************************************
 */

// --- GLOBAL VARIABLES ---

let deferredPrompt; 
let registration; 
let updateCheckInterval; 

// --- PLATFORM DETECTION (FIXED) ---
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android|crios|fxios|opios).)*safari/i.test(navigator.userAgent);
const isSafariOnIOS = isIOS && isSafari && navigator.vendor && navigator.vendor.indexOf('Apple') > -1;

// --- PWA CUSTOM INSTALL PROMPT ---

/**
 * Listen for the beforeinstallprompt event - but ONLY for non-iOS devices
 */
window.addEventListener('beforeinstallprompt', (e) => {
    // FIXED: Only handle this event if NOT on iOS Safari (let install-prompting.js handle iOS)
    if (isSafariOnIOS) {
        return; // Let install-prompting.js handle iOS Safari
    }
    
    console.log('App is installable - showing custom install prompt.');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show prompt after a delay to avoid conflicts
    setTimeout(showCustomInstallPrompt, 1000);
});

/**
 * Creates and displays a custom install prompt (NON-iOS only)
 */
function showCustomInstallPrompt() {
    // FIXED: Don't show if on iOS Safari
    if (isSafariOnIOS) return;
    
    // Avoid showing multiple prompts
    if (document.getElementById('custom-install-prompt')) return;

    const promptDiv = document.createElement('div');
    promptDiv.id = 'custom-install-prompt';
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
        z-index: 100;
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
            <button id="custom-install-accept" style="
                flex: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px; font-weight: 600;
                cursor: pointer; transition: all 0.2s;
            ">Install</button>
            <button id="custom-install-dismiss" style="
                background: transparent; border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 10px 15px; border-radius: 6px;
                cursor: pointer; transition: all 0.2s;
            ">Later</button>
        </div>
    `;

    // Add animation CSS
    if (!document.getElementById('install-prompt-styles')) {
        const style = document.createElement('style');
        style.id = 'install-prompt-styles';
        style.textContent = `
            @keyframes slideInUp {
                from { transform: translateX(-50%) translateY(100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(promptDiv);

    // Handle interactions
    document.getElementById('custom-install-accept').addEventListener('click', () => {
        promptDiv.remove();
        handleInstallClick();
    });

    document.getElementById('custom-install-dismiss').addEventListener('click', () => {
        promptDiv.remove();
    });
}

/**
 * Handle the custom install button click event.
 */
function handleInstallClick() {
    const installButton = document.getElementById('install-pwa-btn');

    if (deferredPrompt) {
        deferredPrompt.prompt();

        deferredPrompt.userChoice.then((choiceResult) => {
            console.log(`User response to the install prompt: ${choiceResult.outcome}`);

            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                showInstallSuccessMessage();
            } else {
                console.log('User dismissed the install prompt');
            }

            deferredPrompt = null;

            if (installButton) {
                installButton.style.display = 'none';
            }
        }).catch((error) => {
            console.error('Error during install prompt:', error);
        });
    } else {
        console.log('No deferred prompt available');
    }
}

/**
 * Show a success message when the app is installed
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
        z-index: 1001;
        font-size: 1rem;
        font-weight: 500;
    `;
    message.textContent = 'App installed successfully! All puzzles are now available offline.';
    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 4000);
}

/**
 * Listen for when the app is successfully installed.
 */
window.addEventListener('appinstalled', (e) => {
    console.log('PWA was successfully installed');

    deferredPrompt = null;

    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.style.display = 'none';
    }

    showInstallSuccessMessage();
    startPeriodicUpdateChecks();
});

// --- PWA SERVICE WORKER REGISTRATION AND UPDATE ---

/**
 * Registers the service worker and sets up the update notification system.
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
                console.log('Service worker is waiting, showing update notification');
                showUpdateNotification(registration.waiting);
            }

            if (registration.active) {
                console.log('Service worker is active');
            }

            startPeriodicUpdateChecks();

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    } else {
        console.log('Service Workers are not supported by this browser');
    }
}

/**
 * Handle when a new service worker is found
 */
function handleUpdateFound() {
    console.log('New service worker version found, installing...');
    const newWorker = registration.installing;

    if (newWorker) {
        newWorker.addEventListener('statechange', () => {
            console.log('New service worker state:', newWorker.state);

            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version ready, showing update notification');
                showUpdateNotification(newWorker);
            }
        });
    }
}

/**
 * Check for service worker updates
 */
async function checkForUpdates() {
    if (registration) {
        try {
            console.log('Checking for service worker updates...');
            await registration.update();
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }
}

/**
 * Start periodic update checks (every 30 minutes)
 */
function startPeriodicUpdateChecks() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    updateCheckInterval = setInterval(() => {
        console.log('Performing periodic update check...');
        checkForUpdates();
    }, 1800000); // 30 minutes

    console.log('Started periodic update checks (every 30 minutes)');
}

/**
 * Stop periodic update checks
 */
function stopPeriodicUpdateChecks() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
        console.log('Stopped periodic update checks');
    }
}

/**
 * Displays an improved update notification with a better layout.
 */
function showUpdateNotification(newWorker) {
    // Remove any existing update notification
    const existingNotification = document.getElementById('update-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create the update notification element
    const notification = document.createElement('div');
    notification.id = 'update-notification';
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
        z-index: 9999;
        font-size: 1rem;
        max-width: min(500px, calc(100vw - 40px));
        animation: slideInUp 0.3s ease-out;
        text-align: center; /* Center align the text */
    `;

    /* --- UPDATED INNER HTML & STYLES --- */
    notification.innerHTML = `
        <button id="dismiss-update" style="
            position: absolute;
            top: 8px;
            right: 12px;
            background: none;
            border: none;
            color: white;
            opacity: 0.7;
            font-size: 1.75rem;
            line-height: 1;
            padding: 5px;
            cursor: pointer;
        ">&times;</button>

        <div style="margin-bottom: 16px;">
            <p style="margin: 0; font-weight: 600; font-size: 1.1rem;">A new version is available!</p>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.9; margin-top: 4px;">Update now to get the latest features.</p>
        </div>

        <div style="display: flex; justify-content: center;">
            <button id="reload-button" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 12px 25px; /* Increased padding */
                border-radius: 8px; /* Slightly larger radius */
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: background-color 0.2s;
                white-space: nowrap;
                width: 100%; /* Make button responsive */
                max-width: 220px; /* Set a max-width for larger screens */
            ">Update Now</button>
        </div>
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('update-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'update-notification-styles';
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
            #reload-button:hover {
                 background: rgba(255,255,255,0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Add the notification to the page
    document.body.appendChild(notification);

    // Use more specific event handling to prevent conflicts
    const reloadButton = notification.querySelector('#reload-button');
    const dismissButton = notification.querySelector('#dismiss-update');
    
    if (reloadButton) {
        reloadButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('User chose to update the app');
            reloadButton.textContent = 'Updating...';
            reloadButton.disabled = true;
            newWorker.postMessage({ action: 'skipWaiting' });
        });
    }

    if (dismissButton) {
        dismissButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('User dismissed update notification');
            notification.remove();
        });
    }

    // Set up controller change listener only once per notification
    const handleControllerChange = () => {
        console.log('New service worker activated, reloading page');
        window.location.reload();
    };

    // Remove any existing listeners to prevent multiple reloads
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Auto-dismiss after 30 seconds if user doesn't interact
    setTimeout(() => {
        if (document.getElementById('update-notification') === notification) {
            console.log('Auto-dismissing update notification');
            notification.remove();
        }
    }, 30000);
}

/**
 * Check if the app is running in standalone mode (installed as PWA)
 */
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

/**
 * Handle visibility change to check for updates when app becomes visible
 */
function handleVisibilityChange() {
    if (!document.hidden) {
        console.log('App became visible, checking for updates...');
        checkForUpdates();
    }
}

// --- INITIALIZATION ---

/**
 * Initialize PWA functionality when the DOM is loaded.
 */
async function initializePWA() {
    console.log('Initializing PWA functionality...');

    // Register the service worker
    await registerServiceWorker();

    // FIXED: Only set up install button for non-iOS devices
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton && !isSafariOnIOS) {
        installButton.addEventListener('click', handleInstallClick);
    }

    // Listen for app visibility changes to check for updates
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check for updates when the app gains focus
    window.addEventListener('focus', () => {
        console.log('App gained focus, checking for updates...');
        checkForUpdates();
    });

    // If app is running in standalone mode, hide install button
    if (isStandalone()) {
        console.log('App is running in standalone mode');
        if (installButton) {
            installButton.style.display = 'none';
        }
    }

    console.log('PWA initialization complete');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePWA);
} else {
    initializePWA();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPeriodicUpdateChecks();
});

// Export functions for debugging
if (typeof window !== 'undefined') {
    window.PWAManager = {
        checkForUpdates,
        startPeriodicUpdateChecks,
        stopPeriodicUpdateChecks,
        isStandalone,
        showCustomInstallPrompt: !isSafariOnIOS ? showCustomInstallPrompt : null
    };
}
