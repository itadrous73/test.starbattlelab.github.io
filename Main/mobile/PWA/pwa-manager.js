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

let deferredPrompt; // This variable will save the beforeinstallprompt event reference.
let registration; // Store the service worker registration
let updateCheckInterval; // Store the interval for periodic update checks

// --- PWA CUSTOM INSTALL PROMPT ---

/**
 * Listen for the beforeinstallprompt event to capture the install prompt
 * and show our custom install button when the app meets PWA criteria.
 */
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('App is installable - showing custom install prompt.');

    // Prevent the browser's default mini-infobar from appearing.
    e.preventDefault();

    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    // Show the custom install prompt instead of the static button.
    showCustomInstallPrompt();
});

/**
 * NEW: Creates and displays a custom, styled install prompt.
 */
function showCustomInstallPrompt() {
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
        z-index: 9999;
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

    // Add animation CSS with improved animations
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
 * This triggers the browser's native install prompt.
 */
function handleInstallClick() {
    const installButton = document.getElementById('install-pwa-btn');

    if (deferredPrompt) {
        // Show the browser's install prompt.
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt.
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log(`User response to the install prompt: ${choiceResult.outcome}`);

            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                // Show success message
                showInstallSuccessMessage();
            } else {
                console.log('User dismissed the install prompt');
            }

            // The prompt can only be used once, so clear the variable.
            deferredPrompt = null;

            // Hide the button after the prompt is shown.
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

    // Remove the message after 4 seconds
    setTimeout(() => {
        message.remove();
    }, 4000);
}

/**
 * Listen for when the app is successfully installed.
 * This fires when the user installs the app from any source.
 */
window.addEventListener('appinstalled', (e) => {
    console.log('PWA was successfully installed');

    // Clear the deferredPrompt so it can be garbage collected.
    deferredPrompt = null;

    // Hide the install button if it's still visible
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.style.display = 'none';
    }

    // Show success message
    showInstallSuccessMessage();

    // Start periodic update checks now that the app is installed
    startPeriodicUpdateChecks();
});

// --- PWA SERVICE WORKER REGISTRATION AND UPDATE ---

/**
 * Registers the service worker and sets up the update notification system.
 * This function is the entry point for all PWA-related functionality.
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
    // Check if service workers are supported by the browser
    if ('serviceWorker' in navigator) {
        try {
            // Register the service worker using a relative path and scope it to the current directory.
            registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './',
                updateViaCache: 'none' // Always check for updates
            });

            console.log('Service Worker registered with scope:', registration.scope);

            // Check for updates immediately
            await checkForUpdates();

            // Listen for updates to the service worker
            registration.addEventListener('updatefound', handleUpdateFound);

            // Check if there's already a waiting service worker
            if (registration.waiting) {
                console.log('Service worker is waiting, showing update notification');
                showUpdateNotification(registration.waiting);
            }

            // Listen for when the service worker becomes active
            if (registration.active) {
                console.log('Service worker is active');
            }

            // Start periodic update checks
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

            // When the new service worker is installed and waiting, show the update notification
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version ready, showing update notification');
                showUpdateNotification(newWorker);
            }
        });
    }
}

/**
 * Check for service worker updates
 * @returns {Promise<void>}
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
    // Clear any existing interval
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    // Check for updates every 30 minutes (1800000 ms)
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
 * Displays a notification to the user when a new version of the app is ready.
 * The notification includes a button that allows the user to activate the new
 * service worker, which will then reload the page to apply the updates.
 * @param {ServiceWorker} newWorker - The new service worker that is waiting to be activated.
 * @returns {void}
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
        background-color: #1a1a1a;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 20px;
        font-size: 1.1rem;
        max-width: 90vw;
        animation: slideInUp 0.3s ease-out;
    `;

    notification.innerHTML = `
        <div style="flex: 1;">
            <p style="margin: 0; font-weight: 500;">A new version is available!</p>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">Update now to get the latest features and improvements.</p>
        </div>
        <button id="reload-button" style="
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1rem;
            transition: background-color 0.2s;
            white-space: nowrap;
        ">Update Now</button>
        <button id="dismiss-update" style="
            background: transparent;
            color: #9ca3af;
            border: none;
            padding: 5px;
            cursor: pointer;
            font-size: 1.5rem;
            line-height: 1;
        ">&times;</button>
    `;

    // Add CSS animation
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);

    // Add the notification to the page
    document.body.appendChild(notification);

    // Add click listener to the "Update Now" button
    const reloadButton = document.getElementById('reload-button');
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            console.log('User chose to update the app');

            // Show loading state
            reloadButton.textContent = 'Updating...';
            reloadButton.disabled = true;

            // Send a message to the new service worker to skip waiting and activate immediately
            newWorker.postMessage({ action: 'skipWaiting' });

            // Listen for the controlling service worker to change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('New service worker activated, reloading page');
                // Reload the page to apply the update
                window.location.reload();
            });
        });
    }

    // Add click listener to the dismiss button
    const dismissButton = document.getElementById('dismiss-update');
    if (dismissButton) {
        dismissButton.addEventListener('click', () => {
            console.log('User dismissed update notification');
            notification.remove();
        });
    }

    // Auto-dismiss after 30 seconds if user doesn't interact
    setTimeout(() => {
        if (document.getElementById('update-notification')) {
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
 * This ensures all elements are available before we try to interact with them.
 */
async function initializePWA() {
    console.log('Initializing PWA functionality...');

    // Register the service worker
    await registerServiceWorker();

    // Set up the custom install button click handler
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
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
    // DOM is already loaded
    initializePWA();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPeriodicUpdateChecks();
});

// Export functions for debugging (optional)
if (typeof window !== 'undefined') {
    window.PWAManager = {
        checkForUpdates,
        startPeriodicUpdateChecks,
        stopPeriodicUpdateChecks,
        isStandalone
    };
}
