// // content.js

// let logData = {
//     scrollDepth: 0,
//     hoverCount: 0,
//     clickCount: 0,
//     timeOnPage: 0,
//     confusionScore: 0
// };
// let startTime = Date.now();
// let confusionAlertSent = false;

// chrome.runtime.sendMessage({
//     type: "USER_LOG",
//     log: logData
// });

// const handleScroll = () => {
//     let scrolled = window.scrollY + window.innerHeight;
//     let totalHeight = document.body.scrollHeight;
//     logData.scrollDepth = Math.max(logData.scrollDepth, (scrolled / totalHeight) * 100);
// };

// const handleMouseover = () => {
//     logData.hoverCount++;
// };

// const handleClick = () => {
//     logData.clickCount++;
// };

// window.addEventListener("scroll", handleScroll);
// document.addEventListener("mouseover", handleMouseover);
// document.addEventListener("click", handleClick);

// const logInterval = setInterval(() => {
//     logData.timeOnPage = Math.floor((Date.now() - startTime) / 1000);
//     chrome.runtime.sendMessage({
//         type: "USER_LOG",
//         log: logData
//     });
//    if (logData.timeOnPage > 20 && logData.scrollDepth > 15 && !confusionAlertSent) { 
//     confusionAlertSent = true;

//     const userWantsHelp = confirm("Hey! It looks like you're confused. Would you like to open the help chatbot?");
    
//     if (userWantsHelp) {
//         // Tell background to inject the chatbot file
//         chrome.runtime.sendMessage({ type: "INJECT_CHATBOT" });
//     }
// }

// }, 5000);

// window.addEventListener("beforeunload", () => {
//     clearInterval(logInterval);
//     window.removeEventListener("scroll", handleScroll);
//     document.removeEventListener("mouseover", handleMouseover);
//     document.removeEventListener("click", handleClick);
//     chrome.runtime.sendMessage({
//         type: "USER_LOG",
//         log: logData
//     });
// });

// function summarizeText(text) {
//     const sentences = text.match(/[^.!?]+[.!?]/g) || [];
//     if (sentences.length <= 1) return text;
//     const words = text.toLowerCase().match(/\b\w+\b/g) || [];
//     const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'am', 'are', 'was', 'were', 'be', 'of', 'in', 'at', 'on', 'with', 'for', 'from', 'to', 'as', 'it', 'its', 'he', 'she', 'they', 'you', 'i', 'we', 'my', 'your', 'his', 'her', 'their', 'our']);
//     const wordFrequency = {};
//     words.forEach(word => {
//         if (!stopWords.has(word)) {
//             wordFrequency[word] = (wordFrequency[word] || 0) + 1;
//         }
//     });
//     const sentenceScores = {};
//     sentences.forEach((sentence, index) => {
//         const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
//         let score = 0;
//         sentenceWords.forEach(word => {
//             if (wordFrequency[word]) {
//                 score += wordFrequency[word];
//             }
//         });
//         sentenceScores[index] = score;
//     });
//     const sortedSentences = Object.keys(sentenceScores).sort((a, b) => sentenceScores[b] - sentenceScores[a]);
//     const summarySentences = sortedSentences.slice(0, Math.min(3, sentences.length));
//     summarySentences.sort((a, b) => a - b);
//     const summary = summarySentences.map(index => sentences[index]).join(' ');
//     return summary.trim();
// }

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.type === "SUMMARIZE_THIS") {
//         const text = message.text;
//         const summary = summarizeText(text);
//         chrome.runtime.sendMessage({
//             type: "SUMMARIZE_RESPONSE",
//             summary: summary
//         });
//     }
// });

// content.js

// ========== EXISTING LOGGING FUNCTIONALITY ==========

let logData = {
    scrollDepth: 0,
    hoverCount: 0,
    clickCount: 0,
    timeOnPage: 0,
    confusionScore: 0,
    mlCognitiveLoad: 0,
    mlLoadLevel: 'unknown'
};
let startTime = Date.now();
let confusionAlertSent = false;

chrome.runtime.sendMessage({
    type: "USER_LOG",
    log: logData
});


const handleScroll = () => {
    let scrolled = window.scrollY + window.innerHeight;
    let totalHeight = document.body.scrollHeight;
    logData.scrollDepth = Math.max(logData.scrollDepth, (scrolled / totalHeight) * 100);
};

const handleMouseover = () => {
    logData.hoverCount++;
};

const handleClick = () => {
    logData.clickCount++;
};

window.addEventListener("scroll", handleScroll);
document.addEventListener("mouseover", handleMouseover);
document.addEventListener("click", handleClick);

const safeSendMessage = (payload) => {
    try {
        if (chrome?.runtime?.id) {
            chrome.runtime.sendMessage(payload);
        }
    } catch (err) {
        console.warn('sendMessage failed (extension may be reloading)', err);
        // Stop the interval to avoid spamming errors if the context is invalidated.
        if (logInterval) {
            clearInterval(logInterval);
        }
    }
};

const logInterval = setInterval(() => {
    logData.timeOnPage = Math.floor((Date.now() - startTime) / 1000);
    
    // Get ML cognitive load score if available
    if (window.mlDetector) {
        logData.mlCognitiveLoad = window.mlDetector.getCurrentScore();
        logData.mlLoadLevel = window.mlDetector.getLoadLevel(logData.mlCognitiveLoad);
    }
    
    safeSendMessage({
        type: "USER_LOG",
        log: logData
    });
    
    // ML-driven assistance prompt (replaces scroll/time heuristic)
    if (window.mlDetector && logData.mlCognitiveLoad > 0.65 && !confusionAlertSent) {
        confusionAlertSent = true;

        const userWantsHelp = confirm("Hey! It looks like you're confused. Would you like to open the help chatbot?");
        
        if (userWantsHelp) {
            chrome.runtime.sendMessage({ type: "INJECT_CHATBOT" });
        }
    }

}, 5000);

window.addEventListener("beforeunload", () => {
    clearInterval(logInterval);
    window.removeEventListener("scroll", handleScroll);
    document.removeEventListener("mouseover", handleMouseover);
    document.removeEventListener("click", handleClick);
    
    // Stop ML detector if running
    if (window.mlDetector) {
        window.mlDetector.stopDetection();
    }
    
    safeSendMessage({
        type: "USER_LOG",
        log: logData
    });
});

// ========== SUMMARIZATION FUNCTIONALITY ==========

function summarizeText(text) {
    const sentences = text.match(/[^.!?]+[.!?]/g) || [];
    if (sentences.length <= 1) return text;
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'am', 'are', 'was', 'were', 'be', 'of', 'in', 'at', 'on', 'with', 'for', 'from', 'to', 'as', 'it', 'its', 'he', 'she', 'they', 'you', 'i', 'we', 'my', 'your', 'his', 'her', 'their', 'our']);
    const wordFrequency = {};
    words.forEach(word => {
        if (!stopWords.has(word)) {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        }
    });
    const sentenceScores = {};
    sentences.forEach((sentence, index) => {
        const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
        let score = 0;
        sentenceWords.forEach(word => {
            if (wordFrequency[word]) {
                score += wordFrequency[word];
            }
        });
        sentenceScores[index] = score;
    });
    const sortedSentences = Object.keys(sentenceScores).sort((a, b) => sentenceScores[b] - sentenceScores[a]);
    const summarySentences = sortedSentences.slice(0, Math.min(3, sentences.length));
    summarySentences.sort((a, b) => a - b);
    const summary = summarySentences.map(index => sentences[index]).join(' ');
    return summary.trim();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SUMMARIZE_THIS") {
        const text = message.text;
        const summary = summarizeText(text);
        chrome.runtime.sendMessage({
            type: "SUMMARIZE_RESPONSE",
            summary: summary
        });
    }
});

// ========== ML DETECTOR INTEGRATION ==========

// The ML detector (ml-detector.js) is loaded before this file via manifest.json
// It automatically starts detection and is available as window.mlDetector

// Add keyboard shortcut to manually provide feedback
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+F (or Cmd+Shift+F on Mac) to provide feedback
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        provideFeedbackDialog();
    }
});

function provideFeedbackDialog() {
    // Create a custom dialog for feedback
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 10000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        min-width: 350px;
    `;
    
    dialog.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #333;">
            How difficult is this content?
        </h2>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
            Your feedback helps improve the AI detection system.
        </p>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="feedback-btn" data-difficulty="easy" style="
                flex: 1;
                padding: 15px;
                border: 2px solid #10b981;
                background: #f0fdf4;
                color: #10b981;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">
                😊 Easy
            </button>
            <button class="feedback-btn" data-difficulty="medium" style="
                flex: 1;
                padding: 15px;
                border: 2px solid #f59e0b;
                background: #fffbeb;
                color: #f59e0b;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">
                😐 Medium
            </button>
            <button class="feedback-btn" data-difficulty="hard" style="
                flex: 1;
                padding: 15px;
                border: 2px solid #ef4444;
                background: #fef2f2;
                color: #ef4444;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">
                😓 Hard
            </button>
        </div>
        <button id="cancel-feedback" style="
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            background: white;
            color: #666;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        ">
            Cancel
        </button>
    `;
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999999;
        backdrop-filter: blur(4px);
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    // Handle feedback buttons
    dialog.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            e.target.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', (e) => {
            e.target.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', (e) => {
            const difficulty = e.target.dataset.difficulty;
            
            if (window.mlDetector) {
                window.mlDetector.provideFeedback(difficulty);
            }
            
            // Show thank you message
            dialog.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                    <h2 style="margin: 0 0 10px 0; color: #333;">Thank You!</h2>
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        Your feedback helps improve the cognitive load detection.
                    </p>
                </div>
            `;
            
            setTimeout(() => {
                overlay.remove();
                dialog.remove();
            }, 2000);
        });
    });
    
    // Handle cancel
    document.getElementById('cancel-feedback').addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });
    
    overlay.addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });
}

// Console info for developers
console.log('%c🧠 Cognitive Load Engine Active', 'background: #667eea; color: white; padding: 8px 12px; border-radius: 4px; font-weight: bold;');
console.log('%cPress Ctrl+Shift+F (Cmd+Shift+F on Mac) to provide feedback', 'color: #667eea; font-size: 12px;');
console.log('%cAccess ML detector: window.mlDetector', 'color: #666; font-size: 11px;');

// Expose useful functions for debugging
window.cognitiveLoadDebug = {
    getCurrentScore: () => window.mlDetector ? window.mlDetector.getCurrentScore() : null,
    getScoreHistory: () => window.mlDetector ? window.mlDetector.getScoreHistory() : null,
    provideFeedback: (difficulty) => window.mlDetector ? window.mlDetector.provideFeedback(difficulty) : null,
    showFeedbackDialog: provideFeedbackDialog,
    getLogData: () => logData
};