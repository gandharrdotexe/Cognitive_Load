// // background.js

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.type === "USER_LOG") {
//         let log = message.log;
//         let confusionScore = 0;
        
//         if (log.hoverCount > 100 && log.scrollDepth < 30) confusionScore += 2;
//         if (log.scrollDepth > 90 && log.timeOnPage < 30) confusionScore += 2;
//         if (log.clickCount > 50) confusionScore += 1;

//         log.confusionScore = confusionScore;
//         chrome.storage.local.set({ userLog: log });
        
//         if (log.confusionScore >= 3) {
//             chrome.notifications.create({
//                 type: "basic",
//                 iconUrl: "images/icon48.png",
//                 title: "Cognitive Load Engine",
//                 message: "It looks like you're struggling. Try scanning the headings to find what you're looking for.",
//                 priority: 2
//             });
//         }
//     }

//     if (message.type === "SUMMARIZE_REQUEST") {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//             if (tabs[0]) {
//                 chrome.tabs.sendMessage(tabs[0].id, {
//                     type: "SUMMARIZE_THIS",
//                     text: message.text
//                 });
//             }
//         });
//     }

//     if (message.type === "USER_FEEDBACK") {
//         console.log("User feedback received:", message.feedback);
//         chrome.notifications.create({
//             type: "basic",
//             iconUrl: "images/icon48.png",
//             title: "Thank You!",
//             message: "Your feedback has been received.",
//             priority: 1
//         });
//     }
    
//     // This is the crucial fix for summarization
//     if (message.type === "SUMMARIZE_RESPONSE") {
//         chrome.runtime.sendMessage(message);
//     }
// });
// chrome.runtime.onMessage.addListener((message, sender) => {
//     if (message.type === "INJECT_CHATBOT") {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//             if (tabs[0]) {
//                 chrome.scripting.executeScript({
//                     target: { tabId: tabs[0].id },
//                     files: ["chatbot.js"]
//                 });
//             }
//         });
//     }
// });


// background.js

// Import the ML model
importScripts('ml/ml-model.js');

// Wait for model to initialize
let modelReady = false;

// Initialize model on extension load
(async () => {
  try {
    await cognitiveLoadModel.initialize();
    modelReady = true;
    console.log('✅ ML Model initialized in background');
  } catch (error) {
    console.error('❌ Failed to initialize ML model:', error);
  }
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    // ========== EXISTING FUNCTIONALITY ==========
    
    if (message.type === "USER_LOG") {
        let log = message.log;
        let confusionScore = 0;
        
        if (log.hoverCount > 100 && log.scrollDepth < 30) confusionScore += 2;
        if (log.scrollDepth > 90 && log.timeOnPage < 30) confusionScore += 2;
        if (log.clickCount > 50) confusionScore += 1;

        log.confusionScore = confusionScore;
        chrome.storage.local.set({ userLog: log });
        
        if (log.confusionScore >= 3) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "images/icon48.png",
                title: "Cognitive Load Engine",
                message: "It looks like you're struggling. Try scanning the headings to find what you're looking for.",
                priority: 2
            });
        }
    }

    if (message.type === "SUMMARIZE_REQUEST") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "SUMMARIZE_THIS",
                    text: message.text
                });
            }
        });
    }

    if (message.type === "USER_FEEDBACK") {
        console.log("User feedback received:", message.feedback);
        chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon48.png",
            title: "Thank You!",
            message: "Your feedback has been received.",
            priority: 1
        });
    }
    
    if (message.type === "SUMMARIZE_RESPONSE") {
        chrome.runtime.sendMessage(message);
    }
    
    if (message.type === "INJECT_CHATBOT") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ["chatbot.js"]
                });
            }
        });
    }
    
    // ========== NEW ML FUNCTIONALITY ==========
    
    // Handle ML prediction requests
    if (message.type === 'PREDICT_COGNITIVE_LOAD') {
        if (!modelReady) {
            console.log('⏳ Model not ready yet, returning default score');
            sendResponse({ score: 0.5 });
            return true;
        }
        
        // Make prediction using ML model
        cognitiveLoadModel.predict(message.features)
            .then(score => {
                console.log(`🎯 ML Prediction: ${(score * 100).toFixed(0)}%`);
                sendResponse({ score: score });
            })
            .catch(error => {
                console.error('❌ Prediction error:', error);
                sendResponse({ score: 0.5, error: error.message });
            });
        
        return true; // Keep channel open for async response
    }
    
    // Handle training feedback from user
    if (message.type === 'TRAINING_FEEDBACK') {
        console.log('📝 Training feedback received');
        
        cognitiveLoadModel.collectTrainingData(message.features, message.label);
        
        // Save feedback to storage for analysis
        chrome.storage.local.get(['trainingFeedback'], (result) => {
            const feedback = result.trainingFeedback || [];
            feedback.push({
                features: message.features,
                label: message.label,
                timestamp: message.timestamp || Date.now()
            });
            
            // Keep only last 100 feedbacks
            if (feedback.length > 100) {
                feedback.shift();
            }
            
            chrome.storage.local.set({ trainingFeedback: feedback });
        });
        
        sendResponse({ success: true });
    }
    
    // Handle high cognitive load detection
    if (message.type === 'HIGH_COGNITIVE_LOAD_DETECTED') {
        console.log('🔴 High cognitive load detected:', message.data);
        
        // Log the event
        chrome.storage.local.get(['highLoadEvents'], (result) => {
            const events = result.highLoadEvents || [];
            events.push({
                score: message.data.score,
                level: message.data.level,
                url: message.data.url,
                timestamp: message.data.timestamp
            });
            
            // Keep only last 50 events
            if (events.length > 50) {
                events.shift();
            }
            
            chrome.storage.local.set({ highLoadEvents: events });
        });
        
        // Show notification
        chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon48.png",
            title: "High Cognitive Load Detected",
            message: "The AI assistant is available to help you understand this content better.",
            priority: 2
        });
        
        sendResponse({ success: true });
    }
    
    // Update ML cognitive load score in storage
    if (message.type === 'ML_COGNITIVE_LOAD_UPDATE') {
        chrome.storage.local.get(['userLog'], (result) => {
            const log = result.userLog || {};
            
            // Add ML score to existing log
            log.mlCognitiveLoad = message.data.score;
            log.mlLoadLevel = message.data.level;
            log.mlLoadPercentage = message.data.percentage;
            log.lastMLUpdate = message.data.timestamp;
            
            chrome.storage.local.set({ userLog: log });
        });
        
        sendResponse({ success: true });
    }
    
    // Handle model info request
    if (message.type === 'GET_MODEL_INFO') {
        const info = cognitiveLoadModel.getModelInfo();
        sendResponse(info);
        return true;
    }
    
    // Handle model training status
    if (message.type === 'MODEL_TRAINED') {
        console.log(`✅ Model training complete with ${message.sampleCount} samples`);
        
        chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon48.png",
            title: "ML Model Updated",
            message: `Your cognitive load detection model has been improved with ${message.sampleCount} training samples.`,
            priority: 1
        });
    }
    
    // Handle model reset request
    if (message.type === 'RESET_ML_MODEL') {
        cognitiveLoadModel.resetModel()
            .then(() => {
                console.log('✅ Model reset complete');
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('❌ Model reset error:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
    
    // Handle model export request
    if (message.type === 'EXPORT_ML_MODEL') {
        cognitiveLoadModel.exportModel()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
});

// Log when extension is installed/updated
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🎉 Cognitive Load Engine installed!');
        console.log('📚 ML model will learn from your usage patterns.');
    } else if (details.reason === 'update') {
        console.log('🔄 Cognitive Load Engine updated!');
    }
});

// Clean up old data periodically (every hour)
setInterval(() => {
    chrome.storage.local.get(['highLoadEvents', 'trainingFeedback'], (result) => {
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        // Clean old high load events (keep only last week)
        if (result.highLoadEvents) {
            const filtered = result.highLoadEvents.filter(e => e.timestamp > oneWeekAgo);
            chrome.storage.local.set({ highLoadEvents: filtered });
        }
        
        // Clean old training feedback (keep only last week)
        if (result.trainingFeedback) {
            const filtered = result.trainingFeedback.filter(f => f.timestamp > oneWeekAgo);
            chrome.storage.local.set({ trainingFeedback: filtered });
        }
        
        console.log('🧹 Cleaned up old data');
    });
}, 60 * 60 * 1000); // Every hour