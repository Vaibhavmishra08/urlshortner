class URLShortener {
    constructor() {
        this.base62Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        this.urlValidationRegex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
        
        // Storage
        this.urlDatabase = new Map(); // shortCode -> {originalUrl, clickCount, createdAt, id}
        this.nextId = 1;
        this.currentFilter = '';
        
        // Initialize
        this.initializeElements();
        this.attachEventListeners();
        this.handleInitialRoute();
    }

    initializeElements() {
        // Form elements
        this.urlForm = document.getElementById('urlForm');
        this.urlInput = document.getElementById('urlInput');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.querySelector('.error-text');
        
        // Result elements
        this.resultSection = document.getElementById('resultSection');
        this.shortenedUrlDisplay = document.getElementById('shortenedUrlDisplay');
        this.copyButton = document.getElementById('copyButton');
        this.testButton = document.getElementById('testButton');
        this.copySuccess = document.getElementById('copySuccess');
        
        // History elements
        this.historyEmpty = document.getElementById('historyEmpty');
        this.historyTable = document.getElementById('historyTable');
        this.historyList = document.getElementById('historyList');
        this.searchInput = document.getElementById('searchInput');
        
        // Stats elements
        this.totalUrls = document.getElementById('totalUrls');
        this.totalClicks = document.getElementById('totalClicks');
    }

    attachEventListeners() {
        // Form submission
        this.urlForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.shortenURL();
        });

        // Copy button in results section
        this.copyButton.addEventListener('click', () => {
            this.copyToClipboard(this.shortenedUrlDisplay.value);
        });

        // Test button in results section
        this.testButton.addEventListener('click', () => {
            const shortUrl = this.shortenedUrlDisplay.value;
            const shortCode = this.extractShortCode(shortUrl);
            this.redirectToOriginal(shortCode, true);
        });

        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.currentFilter = e.target.value.toLowerCase();
            this.renderHistory();
        });

        // Handle hash changes for direct short URL access
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });
    }

    // Base62 encoding
    encodeBase62(num) {
        if (num === 0) return this.base62Alphabet[0];
        
        let encoded = '';
        while (num > 0) {
            encoded = this.base62Alphabet[num % 62] + encoded;
            num = Math.floor(num / 62);
        }
        return encoded;
    }

    // URL validation
    isValidURL(url) {
        try {
            new URL(url);
            return this.urlValidationRegex.test(url);
        } catch {
            return false;
        }
    }

    normalizeURL(url) {
        // Auto-prepend https:// if protocol is missing
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        return url;
    }

    validateAndNormalizeURL(url) {
        if (!url.trim()) {
            throw new Error('Please enter a URL to shorten');
        }

        const normalizedUrl = this.normalizeURL(url.trim());
        
        if (!this.isValidURL(normalizedUrl)) {
            throw new Error('Please enter a valid URL (e.g., https://example.com)');
        }

        return normalizedUrl;
    }

    // URL shortening
    shortenURL() {
        const submitButton = this.urlForm.querySelector('button[type="submit"]');
        
        try {
            // Clear previous errors
            this.hideError();
            
            // Get and validate URL
            const inputValue = this.urlInput.value;
            const originalUrl = this.validateAndNormalizeURL(inputValue);
            
            // Show loading state
            submitButton.classList.add('loading');
            submitButton.disabled = true;
            
            // Generate short code
            const id = this.nextId++;
            const shortCode = this.encodeBase62(id);
            const shortUrl = `${window.location.origin}/#${shortCode}`;
            
            // Store in database
            this.urlDatabase.set(shortCode, {
                originalUrl,
                clickCount: 0,
                createdAt: new Date(),
                id
            });
            
            // Update UI with a small delay for better UX
            setTimeout(() => {
                this.displayResult(shortUrl, originalUrl);
                this.updateStats();
                this.renderHistory();
                this.urlInput.value = ''; // Clear input
                submitButton.classList.remove('loading');
                submitButton.disabled = false;
            }, 300);
            
        } catch (error) {
            this.showError(error.message);
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    }

    // Error handling
    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.classList.remove('hidden');
        this.resultSection.classList.add('hidden');
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    // Result display
    displayResult(shortUrl, originalUrl) {
        this.shortenedUrlDisplay.value = shortUrl;
        this.resultSection.classList.remove('hidden');
        
        // Scroll to results
        this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Copy functionality
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            
            this.showCopySuccess();
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            this.showCopySuccess('Failed to copy');
            return false;
        }
    }

    showCopySuccess(message = '✓ Copied to clipboard!') {
        const successElement = this.copySuccess;
        const statusSpan = successElement.querySelector('.status');
        statusSpan.textContent = message;
        
        successElement.classList.remove('hidden');
        successElement.classList.add('show');
        
        setTimeout(() => {
            successElement.classList.remove('show');
            setTimeout(() => {
                successElement.classList.add('hidden');
            }, 300);
        }, 2000);
    }

    // URL redirection
    extractShortCode(url) {
        if (url.includes('#')) {
            return url.split('#')[1];
        }
        return url.split('/').pop();
    }

    redirectToOriginal(shortCode, isTest = false) {
        const urlData = this.urlDatabase.get(shortCode);
        
        if (urlData) {
            // Increment click count
            urlData.clickCount++;
            this.updateStats();
            this.renderHistory();
            
            // Open URL in new tab
            try {
                const newWindow = window.open(urlData.originalUrl, '_blank', 'noopener,noreferrer');
                if (!newWindow) {
                    // Fallback if popup blocker prevents opening
                    alert(`Redirecting to: ${urlData.originalUrl}`);
                    window.location.href = urlData.originalUrl;
                }
            } catch (error) {
                console.error('Failed to open URL:', error);
                alert(`Please visit: ${urlData.originalUrl}`);
            }
        } else {
            alert('Short URL not found. It may have been created in a different session.');
        }
    }

    // Handle hash changes for direct short URL access
    handleHashChange() {
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const shortCode = hash.substring(1);
            // Only redirect if the short code exists in our database
            if (this.urlDatabase.has(shortCode)) {
                this.redirectToOriginal(shortCode);
            }
        }
    }

    // Handle initial route (if someone visits a short URL directly)
    handleInitialRoute() {
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const shortCode = hash.substring(1);
            // Wait a moment for the app to fully initialize
            setTimeout(() => {
                if (this.urlDatabase.has(shortCode)) {
                    this.redirectToOriginal(shortCode);
                }
            }, 100);
        }
    }

    // Statistics
    updateStats() {
        const totalUrls = this.urlDatabase.size;
        const totalClicks = Array.from(this.urlDatabase.values())
            .reduce((sum, data) => sum + data.clickCount, 0);
        
        this.totalUrls.textContent = totalUrls;
        this.totalClicks.textContent = totalClicks;
    }

    // History management
    renderHistory() {
        const urls = Array.from(this.urlDatabase.entries());
        
        if (urls.length === 0) {
            this.historyEmpty.classList.remove('hidden');
            this.historyTable.classList.add('hidden');
            return;
        }
        
        this.historyEmpty.classList.add('hidden');
        this.historyTable.classList.remove('hidden');
        
        // Filter URLs based on search
        const filteredUrls = urls.filter(([shortCode, data]) => {
            if (!this.currentFilter) return true;
            
            const searchTerm = this.currentFilter;
            return (
                data.originalUrl.toLowerCase().includes(searchTerm) ||
                shortCode.toLowerCase().includes(searchTerm)
            );
        });
        
        // Sort by creation date (newest first)
        filteredUrls.sort(([, a], [, b]) => b.createdAt - a.createdAt);
        
        // Render rows
        this.historyList.innerHTML = filteredUrls
            .map(([shortCode, data]) => this.createHistoryRow(shortCode, data))
            .join('');
    }

    createHistoryRow(shortCode, data) {
        const shortUrl = `${window.location.origin}/#${shortCode}`;
        const truncatedUrl = this.truncateUrl(data.originalUrl, 50);
        
        return `
            <div class="table-row">
                <div class="table-col table-col--original" data-label="Original URL">
                    <a href="${data.originalUrl}" 
                       class="original-url" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       title="${data.originalUrl}">
                        ${truncatedUrl}
                    </a>
                </div>
                <div class="table-col table-col--short" data-label="Short Code">
                    <span class="short-code">${shortCode}</span>
                </div>
                <div class="table-col table-col--clicks" data-label="Clicks">
                    <span class="click-count">${data.clickCount}</span>
                </div>
                <div class="table-col table-col--actions" data-label="Actions">
                    <div class="table-actions">
                        <button class="btn-icon btn-icon--copy" 
                                data-action="copy" 
                                data-url="${shortUrl}"
                                title="Copy shortened URL">
                            📋
                        </button>
                        <button class="btn-icon btn-icon--test" 
                                data-action="test" 
                                data-short-code="${shortCode}"
                                title="Test link">
                            🔗
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        
        // Try to keep the domain visible
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const path = urlObj.pathname + urlObj.search;
            
            if (domain.length + 10 >= maxLength) {
                return domain.substring(0, maxLength - 3) + '...';
            }
            
            const availableLength = maxLength - domain.length - 6; // 6 for "https://"
            if (path.length > availableLength) {
                return `https://${domain}${path.substring(0, availableLength)}...`;
            }
            
            return url;
        } catch {
            return url.substring(0, maxLength - 3) + '...';
        }
    }

    // Handle button clicks in history table
    handleHistoryAction(button) {
        const action = button.getAttribute('data-action');
        
        if (action === 'copy') {
            const url = button.getAttribute('data-url');
            this.copyToClipboard(url);
        } else if (action === 'test') {
            const shortCode = button.getAttribute('data-short-code');
            this.redirectToOriginal(shortCode, true);
        }
    }
}

// Initialize the application
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new URLShortener();
    
    // Handle history table button clicks using event delegation
    document.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (button) {
            e.preventDefault();
            app.handleHistoryAction(button);
        }
    });
});

// Prevent form submission when pressing Enter in search
document.addEventListener('keydown', (e) => {
    if (e.target.matches('#searchInput') && e.key === 'Enter') {
        e.preventDefault();
    }
});

// Add some sample URLs for testing (for development purposes)
window.addSampleUrls = function() {
    const sampleUrls = [
        'https://www.google.com',
        'https://github.com/microsoft/vscode',
        'https://stackoverflow.com/questions/742013/how-do-i-create-a-url-shortener',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    ];
    
    let index = 0;
    const addNext = () => {
        if (index < sampleUrls.length && app && app.urlInput) {
            app.urlInput.value = sampleUrls[index];
            app.shortenURL();
            index++;
            setTimeout(addNext, 600); // Wait for processing
        }
    };
    
    if (app) {
        addNext();
    }
};

// Export for global access
window.app = app;