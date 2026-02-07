// Configuration
const CONFIG = {
    COINGECKO_API: 'https://api.coingecko.com/api/v3',
    CURRENCY: 'usd',
    ITEMS_PER_PAGE: 10,
    REFRESH_INTERVAL: 60000, // 60 seconds
    LOCAL_STORAGE_KEY: 'cryptoWatchlist'
};

// State
let state = {
    cryptocurrencies: [],
    watchlist: [],
    filteredCryptos: [],
    currentPage: 1,
    currentCurrency: CONFIG.CURRENCY,
    marketData: null,
    totalPages: 1
};

// DOM Elements
const elements = {
    cryptoTableBody: document.getElementById('crypto-table-body'),
    watchlistTableBody: document.getElementById('watchlist-table-body'),
    searchInput: document.getElementById('search-crypto'),
    currencySelect: document.getElementById('currency-select'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    currentPageSpan: document.getElementById('current-page'),
    totalPagesSpan: document.getElementById('total-pages'),
    clearWatchlistBtn: document.getElementById('clear-watchlist'),
    loadingOverlay: document.getElementById('loading-overlay'),
    lastUpdatedSpan: document.getElementById('last-updated'),
    emptyWatchlist: document.getElementById('empty-watchlist'),
    watchlistCount: document.getElementById('watchlist-count'),
    watchlistGainers: document.getElementById('watchlist-gainers'),
    watchlistLosers: document.getElementById('watchlist-losers'),
    totalMarketCap: document.getElementById('total-market-cap'),
    totalVolume: document.getElementById('total-volume'),
    btcDominance: document.getElementById('btc-dominance')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadWatchlist();
    fetchMarketData();
    fetchCryptocurrencies();
    setupEventListeners();
    startAutoRefresh();
});

// Load watchlist from localStorage
function loadWatchlist() {
    const saved = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
    if (saved) {
        state.watchlist = JSON.parse(saved);
        updateWatchlistDisplay();
    }
}

// Save watchlist to localStorage
function saveWatchlist() {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(state.watchlist));
}

// Fetch market data
async function fetchMarketData() {
    try {
        const response = await fetch(`${CONFIG.COINGECKO_API}/global`);
        const data = await response.json();
        state.marketData = data.data;
        updateMarketStats();
    } catch (error) {
        console.error('Error fetching market data:', error);
    }
}

// Fetch cryptocurrencies from CoinGecko
async function fetchCryptocurrencies() {
    showLoading(true);
    try {
        const response = await fetch(
            `${CONFIG.COINGECKO_API}/coins/markets?vs_currency=${state.currentCurrency}&order=market_cap_desc&per_page=250&page=1&sparkline=false`
        );
        const data = await response.json();
        state.cryptocurrencies = data;
        state.filteredCryptos = [...data];
        updatePagination();
        renderCryptocurrencies();
        updateLastUpdated();
    } catch (error) {
        console.error('Error fetching cryptocurrencies:', error);
        showError('Failed to fetch cryptocurrency data. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Render cryptocurrencies table
function renderCryptocurrencies() {
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const cryptosToDisplay = state.filteredCryptos.slice(start, end);

    elements.cryptoTableBody.innerHTML = '';

    cryptosToDisplay.forEach((crypto, index) => {
        const isInWatchlist = state.watchlist.some(item => item.id === crypto.id);
        const row = document.createElement('tr');
        
        const priceChange = crypto.price_change_percentage_24h || 0;
        const changeClass = priceChange >= 0 ? 'positive' : 'negative';
        const changeIcon = priceChange >= 0 ? '↗' : '↘';
        
        row.innerHTML = `
            <td>${start + index + 1}</td>
            <td>
                <div class="crypto-name">
                    <img src="${crypto.image}" alt="${crypto.name}" class="crypto-icon">
                    <div>
                        <div>${crypto.name}</div>
                        <div class="crypto-symbol">${crypto.symbol.toUpperCase()}</div>
                    </div>
                </div>
            </td>
            <td class="price">${formatCurrency(crypto.current_price, state.currentCurrency)}</td>
            <td>
                <span class="${changeClass}">
                    ${changeIcon} ${Math.abs(priceChange).toFixed(2)}%
                </span>
            </td>
            <td>${formatCurrency(crypto.market_cap, state.currentCurrency)}</td>
            <td>
                <button class="watchlist-btn ${isInWatchlist ? 'remove-btn' : 'add-btn'}" 
                        data-id="${crypto.id}">
                    <i class="fas ${isInWatchlist ? 'fa-minus' : 'fa-plus'}"></i>
                    ${isInWatchlist ? 'Remove' : 'Add to Watchlist'}
                </button>
            </td>
        `;
        
        elements.cryptoTableBody.appendChild(row);
    });

    // Add event listeners to buttons
    document.querySelectorAll('.watchlist-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const cryptoId = e.target.closest('.watchlist-btn').dataset.id;
            const crypto = state.cryptocurrencies.find(c => c.id === cryptoId);
            if (crypto) {
                toggleWatchlist(crypto);
            }
        });
    });
}

// Update watchlist display
function updateWatchlistDisplay() {
    elements.watchlistTableBody.innerHTML = '';
    
    if (state.watchlist.length === 0) {
        elements.emptyWatchlist.style.display = 'block';
        elements.watchlistTableBody.style.display = 'none';
    } else {
        elements.emptyWatchlist.style.display = 'none';
        elements.watchlistTableBody.style.display = 'table-row-group';
        
        let gainers = 0;
        let losers = 0;
        
        state.watchlist.forEach(crypto => {
            const priceChange = crypto.price_change_percentage_24h || 0;
            const changeClass = priceChange >= 0 ? 'positive' : 'negative';
            const changeIcon = priceChange >= 0 ? '↗' : '↘';
            
            if (priceChange >= 0) gainers++;
            else losers++;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="crypto-name">
                        <img src="${crypto.image}" alt="${crypto.name}" class="crypto-icon">
                        <div>
                            <div>${crypto.name}</div>
                            <div class="crypto-symbol">${crypto.symbol.toUpperCase()}</div>
                        </div>
                    </div>
                </td>
                <td class="price">${formatCurrency(crypto.current_price, state.currentCurrency)}</td>
                <td>
                    <span class="${changeClass}">
                        ${changeIcon} ${Math.abs(priceChange).toFixed(2)}%
                    </span>
                </td>
                <td>
                    <button class="watchlist-btn remove-btn" data-id="${crypto.id}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </td>
            `;
            
            elements.watchlistTableBody.appendChild(row);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('#watchlist-table-body .watchlist-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const cryptoId = e.target.closest('.watchlist-btn').dataset.id;
                removeFromWatchlist(cryptoId);
            });
        });

        // Update watchlist stats
        elements.watchlistCount.textContent = state.watchlist.length;
        elements.watchlistGainers.textContent = gainers;
        elements.watchlistLosers.textContent = losers;
    }
}

// Toggle cryptocurrency in watchlist
function toggleWatchlist(crypto) {
    const index = state.watchlist.findIndex(item => item.id === crypto.id);
    
    if (index === -1) {
        // Add to watchlist
        state.watchlist.push(crypto);
        showNotification(`Added ${crypto.name} to watchlist`, 'success');
    } else {
        // Remove from watchlist
        state.watchlist.splice(index, 1);
        showNotification(`Removed ${crypto.name} from watchlist`, 'info');
    }
    
    saveWatchlist();
    updateWatchlistDisplay();
    renderCryptocurrencies(); // Re-render to update button states
}

// Remove from watchlist
function removeFromWatchlist(cryptoId) {
    state.watchlist = state.watchlist.filter(crypto => crypto.id !== cryptoId);
    saveWatchlist();
    updateWatchlistDisplay();
    renderCryptocurrencies(); // Re-render to update button states
    showNotification('Removed from watchlist', 'info');
}

// Clear entire watchlist
function clearWatchlist() {
    if (state.watchlist.length > 0) {
        if (confirm('Are you sure you want to clear your entire watchlist?')) {
            state.watchlist = [];
            saveWatchlist();
            updateWatchlistDisplay();
            renderCryptocurrencies();
            showNotification('Watchlist cleared', 'info');
        }
    }
}

// Update market statistics
function updateMarketStats() {
    if (state.marketData) {
        elements.totalMarketCap.textContent = formatCurrency(
            state.marketData.total_market_cap.usd, 
            'usd'
        );
        elements.totalVolume.textContent = formatCurrency(
            state.marketData.total_volume.usd, 
            'usd'
        );
        elements.btcDominance.textContent = 
            state.marketData.market_cap_percentage.btc.toFixed(2) + '%';
    }
}

// Format currency
function formatCurrency(amount, currency) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: amount < 1 ? 8 : 2
    });
    
    return formatter.format(amount);
}

// Filter cryptocurrencies
function filterCryptocurrencies() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (searchTerm.trim() === '') {
        state.filteredCryptos = [...state.cryptocurrencies];
    } else {
        state.filteredCryptos = state.cryptocurrencies.filter(crypto =>
            crypto.name.toLowerCase().includes(searchTerm) ||
            crypto.symbol.toLowerCase().includes(searchTerm)
        );
    }
    
    state.currentPage = 1;
    updatePagination();
    renderCryptocurrencies();
}

// Update pagination
function updatePagination() {
    state.totalPages = Math.ceil(state.filteredCryptos.length / CONFIG.ITEMS_PER_PAGE);
    
    elements.currentPageSpan.textContent = state.currentPage;
    elements.totalPagesSpan.textContent = state.totalPages;
    
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = state.currentPage === state.totalPages;
}

// Change page
function changePage(direction) {
    const newPage = state.currentPage + direction;
    
    if (newPage >= 1 && newPage <= state.totalPages) {
        state.currentPage = newPage;
        renderCryptocurrencies();
        updatePagination();
    }
}

// Change currency
function changeCurrency() {
    state.currentCurrency = elements.currencySelect.value;
    fetchCryptocurrencies();
    updateMarketStats();
    if (state.watchlist.length > 0) {
        // Update watchlist prices with new currency
        updateWatchlistDisplay();
    }
}

// Update last updated time
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastUpdatedSpan.textContent = `Last updated: ${timeString}`;
}

// Show loading overlay
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(90deg, #ff3333, #ff4d4d);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Show notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(90deg, #00b09b, #96c93d)' : 'linear-gradient(90deg, #2196F3, #21CBF3)'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Auto-refresh data
function startAutoRefresh() {
    setInterval(() => {
        fetchMarketData();
        fetchCryptocurrencies();
    }, CONFIG.REFRESH_INTERVAL);
}

// Set up event listeners
function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', filterCryptocurrencies);
    
    // Currency select
    elements.currencySelect.addEventListener('change', changeCurrency);
    
    // Pagination buttons
    elements.prevPageBtn.addEventListener('click', () => changePage(-1));
    elements.nextPageBtn.addEventListener('click', () => changePage(1));
    
    // Clear watchlist button
    elements.clearWatchlistBtn.addEventListener('click', clearWatchlist);
    
    // Add some CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .error-message {
            animation: slideIn 0.3s ease;
        }
        
        .notification {
            animation: slideIn 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}