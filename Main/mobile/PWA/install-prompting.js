/**
 * **********************************************************************************
 * Title: Enhanced PWA Installation Prompting System (for iOS Safari)
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 1.2.1 
 * *-------------------------------------------------------------------------------
 * This script provides an enhanced installation prompting system for Progressive
 * Web Apps, specifically targeting Apple users on the Safari browser. It tracks
 * user engagement and presents installation prompts at optimal moments.
 * **********************************************************************************
 */


// Enhanced platform detection to ensure this script ONLY runs for Apple users on Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android|crios|fxios|opios).)*safari/i.test(navigator.userAgent);
const isSafariOnIOS = isIOS && isSafari && navigator.vendor && navigator.vendor.indexOf('Apple') > -1;

// Only execute the script's logic if the user is on Safari on an iOS device
if (isSafariOnIOS) {

    // Configuration for installation prompting
    const PROMPT_CONFIG = {
        // Show prompt after user has been on site for X milliseconds
        minTimeOnSite: 0, // 0 seconds for instant prompt

        // Show prompt after user has visited X pages/interactions
        minInteractions: 0,

        // Days to wait before showing prompt again if dismissed
        dismissCooldown: .02,

        // Key for localStorage
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
        if (installPromptData.installed || ('standalone' in window.navigator && window.navigator.standalone)) {
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
            }, {
                once: false,
                passive: true
            });
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
     * Show custom install prompt for iOS Safari
     */
    function showCustomInstallPrompt() {
        promptShown = true;

        // Create custom install prompt
        const promptDiv = document.createElement('div');
        promptDiv.id = 'custom-install-prompt';
        promptDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideInUp 0.4s ease-out;
            max-width: min(400px, calc(100vw - 40px));
            width: auto;
            min-width: 300px;
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

        // Add animation CSS with improved animations
        if (!document.getElementById('install-prompt-styles')) {
            const style = document.createElement('style');
            style.id = 'install-prompt-styles';
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
                #custom-install-prompt {
                    /* Ensure it doesn't interfere with other modals */
                    contain: layout style paint;
                }
                #custom-install-accept:hover {
                    background: rgba(255,255,255,0.3) !important;
                    transform: translateY(-1px);
                }
                #custom-install-dismiss:hover {
                    background: rgba(255,255,255,0.1) !important;
                    transform: translateY(-1px);
                }
                /* Media query for very small screens */
                @media (max-width: 360px) {
                    #custom-install-prompt, #safari-required-prompt {
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

        document.body.appendChild(promptDiv);

        // Handle interactions
        document.getElementById('custom-install-accept').addEventListener('click', () => {
            showInstallInstructions();
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
     * Handle when user dismisses install prompt
     */
    function handleCustomInstallDismiss() {
        installPromptData.lastDismissed = Date.now();
        savePromptData();
    }

    /**
     * Show manual installation instructions inside an isolated overlay
     */
    function showInstallInstructions() {
        // Create the full-screen overlay with higher z-index to avoid conflicts
        const overlayDiv = document.createElement('div');
        overlayDiv.id = 'pwa-install-overlay';
        overlayDiv.style.cssText = `
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        `;
    
        // Create the instructions modal
        const instructionsDiv = document.createElement('div');
        instructionsDiv.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            width: 100%;
            max-width: 420px;
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
            <button id="instructions-close" style="
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

        // Add modal animation styles if not already added
        if (!document.getElementById('modal-animation-styles')) {
            const modalStyle = document.createElement('style');
            modalStyle.id = 'modal-animation-styles';
            modalStyle.textContent = `
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
                #instructions-close:hover {
                    background: rgba(255,255,255,0.3) !important;
                    transform: translateY(-2px);
                }
            `;
            document.head.appendChild(modalStyle);
        }
    
        // Add the modal to the overlay, and the overlay to the page
        overlayDiv.appendChild(instructionsDiv);
        document.body.appendChild(overlayDiv);
    
        // Set up the close button
        document.getElementById('instructions-close').addEventListener('click', () => {
            overlayDiv.style.animation = 'fadeOut 0.2s ease-in forwards';
            setTimeout(() => {
                overlayDiv.remove();
            }, 200);
        });
    
        // Allow closing by clicking the overlay background
        overlayDiv.addEventListener('click', (e) => {
            if (e.target === overlayDiv) {
                overlayDiv.style.animation = 'fadeOut 0.2s ease-in forwards';
                setTimeout(() => {
                    overlayDiv.remove();
                }, 200);
            }
        });

        // Add fade out animation
        const fadeStyle = document.createElement('style');
        fadeStyle.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(fadeStyle);
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

    // Initialize the enhanced prompting system when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        initializeInstallPrompting();
    });

    // Export for debugging
    window.InstallPrompt = {
        checkAndShowInstallPrompt,
        showCustomInstallPrompt,
        showInstallInstructions,
        getPromptData: () => installPromptData,
        getUserEngagement: () => ({
            interactions: userInteractions,
            timeOnSite
        })
    };

} else if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
    // iOS device but not Safari - show a message to use Safari
    
    function showSafariPrompt() {
        const safariPrompt = document.createElement('div');
        safariPrompt.id = 'safari-required-prompt';
        safariPrompt.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideInUp 0.4s ease-out;
            max-width: min(400px, calc(100vw - 40px));
            width: auto;
            min-width: 300px;
            text-align: center;
        `;

        safariPrompt.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="flex-shrink: 0;">
                    <svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><polyline points='12 6 12 12 16 14'></polyline></svg>
                </div>
                <div style="flex: 1; text-align: left;">
                    <div style="font-weight: 600; margin-bottom: 5px;">Safari Required</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Please use Safari to install this app</div>
                </div>
            </div>
            <button id="safari-prompt-dismiss" style="
                width: 100%;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 10px 15px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">Understood</button>
        `;

        // Add the same animation styles if not present
        if (!document.getElementById('install-prompt-styles')) {
            const style = document.createElement('style');
            style.id = 'install-prompt-styles';
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
                @media (max-width: 360px) {
                    #safari-required-prompt {
                        max-width: calc(100vw - 20px) !important;
                        min-width: unset !important;
                        left: 10px !important;
                        right: 10px !important;
                        transform: none !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(safariPrompt);

        document.getElementById('safari-prompt-dismiss').addEventListener('click', () => {
            safariPrompt.remove();
        });
    }

    // Show Safari prompt after a short delay if user interacts with the page
    let hasInteracted = false;
    const showSafariPromptOnce = () => {
        if (!hasInteracted) {
            hasInteracted = true;
            setTimeout(showSafariPrompt, 2000);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        ['click', 'scroll', 'touchstart'].forEach(eventType => {
            document.addEventListener(eventType, showSafariPromptOnce, { once: true });
        });
    });
}
