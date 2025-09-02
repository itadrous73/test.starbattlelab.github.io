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
 * install prompt to give users control over when they install the app.
 * **********************************************************************************
 */

// --- PWA CUSTOM INSTALL PROMPT ---

let deferredPrompt; // This variable will save the beforeinstallprompt event reference.

/**
 * Listen for the beforeinstallprompt event to capture the install prompt
 * and show our custom install button when the app meets PWA criteria.
 */
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('App is installable - showing custom install button');
    
    // Prevent the browser's default mini-infobar from appearing.
    e.preventDefault();
    
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Show your custom install button now that the app is installable.
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.style.display = 'block';
        // Add a subtle animation to draw attention
        installButton.style.animation = 'fadeInUp 0.5s ease-out';
    }
});

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
                // Optionally show a success message or analytics event
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
    
    // Optionally send an analytics event to track successful installs
    // analytics.track('pwa_installed');
});

// --- PWA SERVICE WORKER REGISTRATION AND UPDATE ---

/**
 * Registers the service worker and sets up the update notification system.
 * This function is the entry point for all PWA-related functionality.
 * @returns {void}
 */
function registerServiceWorker() {
    // Check if service workers are supported by the browser
    if ('serviceWorker' in navigator) {
        // Register the service worker using a relative path and scope it to the current directory.
        navigator.serviceWorker.register('service-worker.js', { scope: '.' })
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                
                // Listen for updates to the service worker
                registration.addEventListener('updatefound', () => {
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
                });
                
                // Check if there's already a waiting service worker
                if (registration.waiting) {
                    showUpdateNotification(registration.waiting);
                }
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    } else {
        console.log('Service Workers are not supported by this browser');
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
    notification.innerHTML = `
        <p>A new version is available!</p>
        <button id="reload-button">Update Now</button>
    `;
    
    // Add the notification to the page
    document.body.appendChild(notification);
    
    // Add a click listener to the "Update Now" button
    const reloadButton = document.getElementById('reload-button');
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            console.log('User chose to update the app');
            
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
}

// --- INITIALIZATION ---

/**
 * Initialize PWA functionality when the DOM is loaded.
 * This ensures all elements are available before we try to interact with them.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Register the service worker
    registerServiceWorker();
    
    // Set up the custom install button click handler
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.addEventListener('click', handleInstallClick);
    }
});

// If the DOM is already loaded (script loaded after DOM), initialize immediately
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    // (handled by the event listener above)
} else {
    // DOM is already loaded
    registerServiceWorker();
    
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
        installButton.addEventListener('click', handleInstallClick);
    }
}
