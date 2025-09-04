/**
 * **********************************************************************************
 * Title: PWA Installation Prompting System (for iOS Safari)
 * **********************************************************************************
 * @author Isaiah Tadrous
 * @version 2.0.0
 * *-------------------------------------------------------------------------------
 * This script provides an  installation prompting system for Progressive
 * Web Apps, specifically targeting Apple users on the Safari browser. It tracks
 * user engagement and presents installation prompts at optimal moments.
 * **********************************************************************************
 */

// ONLY run on iOS Safari - be very specific
const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafariUA = /^((?!chrome|android|crios|fxios|opios).)*safari/i.test(navigator.userAgent);
const isAppleVendor = navigator.vendor && navigator.vendor.indexOf('Apple') > -1;
const isSafariOnIOS2 = isIOSDevice && isSafariUA && isAppleVendor;

// Only execute if on iOS Safari AND not already installed
if (isSafariOnIOS2 && !('standalone' in window.navigator && window.navigator.standalone)) {
    
    console.log('iOS Safari detected - initializing install prompting');
    
    let userInteractions = 0;
    let timeOnSite = 0;
    let promptShown = false;
    const startTime = Date.now();
    
    // Track engagement
    function trackEngagement() {
        // Update time
        setInterval(() => {
            timeOnSite = Date.now() - startTime;
        }, 1000);
        
        // Track interactions
        ['click', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                userInteractions++;
            }, { passive: true });
        });
        
        // Track app-specific interactions
        ['new-puzzle-btn', 'load-puzzle-btn', 'import-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    userInteractions += 2;
                    setTimeout(checkShowPrompt, 1000);
                });
            }
        });
    }
    
    function checkShowPrompt() {
        if (promptShown) return;
        if (timeOnSite >= 3000 && userInteractions >= 1) {
            showIOSPrompt();
        }
    }
    
    function showIOSPrompt() {
        if (promptShown) return;
        promptShown = true;
        
        // Remove any conflicting prompts first
        const existing = document.getElementById('ios-install-prompt');
        if (existing) existing.remove();
        
        const prompt = document.createElement('div');
        prompt.id = 'ios-install-prompt';
        prompt.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9997;
            animation: iosSlideUp 0.4s ease-out;
            max-width: min(500px, calc(100vw - 40px));
            min-width: 320px;
        `;
        
        prompt.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 5px;">Install StarBattle App</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Get instant access and play offline!</div>
                </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="ios-install-yes" style="
                    flex: 1; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                    color: white; padding: 10px 15px; border-radius: 6px; font-weight: 600;
                    cursor: pointer; transition: all 0.2s;
                ">Install</button>
                <button id="ios-install-no" style="
                    background: transparent; border: 1px solid rgba(255,255,255,0.3);
                    color: white; padding: 10px 15px; border-radius: 6px;
                    cursor: pointer; transition: all 0.2s;
                ">Later</button>
            </div>
        `;
        
        // Add animation CSS
        if (!document.getElementById('ios-install-styles')) {
            const style = document.createElement('style');
            style.id = 'ios-install-styles';
            style.textContent = `
                @keyframes iosSlideUp {
                    from {
                        transform: translateX(-50%) translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
                #ios-install-yes:hover, #ios-install-no:hover {
                    background: rgba(255,255,255,0.3) !important;
                    transform: translateY(-1px);
                }
                @media (max-width: 360px) {
                    #ios-install-prompt {
                        left: 10px !important;
                        right: 10px !important;
                        transform: none !important;
                        max-width: none !important;
                        min-width: none !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(prompt);
        
        // Handle buttons
        document.getElementById('ios-install-yes').addEventListener('click', () => {
            prompt.remove();
            showInstructions();
        });
        
        document.getElementById('ios-install-no').addEventListener('click', () => {
            prompt.remove();
        });
    }
    
    function showInstructions() {
        const overlay = document.createElement('div');
        overlay.id = 'ios-install-instructions';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            backdrop-filter: blur(4px);
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: linear-gradient(135deg, #0976ea 0%, #0d47a1 100%);
            color: white;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            width: 100%;
            max-width: 500px;
            animation: modalZoomIn 0.3s ease-out;
        `;
        
        modal.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16,6 12,2 8,6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Install Instructions</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Follow these steps:</div>
                </div>
            </div>
            <ol style="line-height: 1.8; padding-left: 20px; margin: 0 0 20px 0;">
                <li style="margin-bottom: 8px;">Tap the <strong>Share</strong> button at the bottom of Safari</li>
                <li style="margin-bottom: 8px;">Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li>Tap <strong>"Add"</strong> to install the app</li>
            </ol>
            <button id="ios-instructions-close" style="
                width: 100%;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            ">Got it!</button>
        `;
        
        // Add modal animation
        if (!document.getElementById('ios-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'ios-modal-styles';
            style.textContent = `
                @keyframes modalZoomIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                #ios-instructions-close:hover {
                    background: rgba(255,255,255,0.3) !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Handle close
        document.getElementById('ios-instructions-close').addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
    
    // Initialize when DOM is ready
    function init() {
        trackEngagement();
        
        // Check after initial engagement
        setTimeout(() => {
            checkShowPrompt();
        }, 3000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Debug
    window.iOSInstallPrompt = {
        checkShowPrompt,
        showIOSPrompt,
        stats: () => ({ interactions: userInteractions, timeOnSite })
    };
    
} else {
    console.log('Not iOS Safari or already installed - iOS install prompting disabled');
}
