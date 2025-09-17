// Global variables
// Common API base URL (override by setting window.API_BASE before app.js loads)
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';
let currentGeolocations = {};
let currentSearchResults = [];
let currentSingleSourceResults = [];
let currentProductDetails = null;

// DOM Elements
const searchBtn = document.getElementById('search-btn');
const translateBtn = document.getElementById('translate-btn');
const geolocationSelect = document.getElementById('geolocation-select');
const searchQuery = document.getElementById('search-query');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const productsGrid = document.getElementById('products-grid');
const resultsTitle = document.getElementById('results-title');
const resultsCount = document.getElementById('results-count');
const resultsGeo = document.getElementById('results-geo');

// Tab Elements (will be selected after DOM is loaded)
let tabBtns, multipleSourceTab, singleSourceTab, multipleSourceGrid, singleSourceGrid, multipleSourceCount, singleSourceCount;
const productModal = document.getElementById('product-modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalLoading = document.getElementById('modal-loading');
const modalContent = document.getElementById('modal-content');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');
const excelCount = document.getElementById('excel-count');

// Translation Elements
const translationContainer = document.getElementById('translation-container');
const translationTitle = document.getElementById('translation-title');
const originalQueryText = document.getElementById('original-query-text');
const translatedQueryText = document.getElementById('translated-query-text');
const translationLanguage = document.getElementById('translation-language');
const copyTranslationBtn = document.getElementById('copy-translation-btn');
const toastContainer = document.getElementById('toast-container');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tab elements after DOM is loaded
    tabBtns = document.querySelectorAll('.tab-btn');
    multipleSourceTab = document.getElementById('multiple-source-tab');
    singleSourceTab = document.getElementById('single-source-tab');
    multipleSourceGrid = document.getElementById('multiple-source-grid');
    singleSourceGrid = document.getElementById('single-source-grid');
    multipleSourceCount = document.getElementById('multiple-source-count');
    singleSourceCount = document.getElementById('single-source-count');
    
    loadGeolocations();
    updateExcelStatus();
    setupEventListeners();
});

// Load available geolocations
async function loadGeolocations() {
    try {
        const response = await fetch(`${API_BASE}/api/geolocations`);
        const geolocations = await response.json();
        currentGeolocations = geolocations;
        
        // Populate the select dropdown
        geolocationSelect.innerHTML = '<option value="">Choose a country...</option>';
        
        Object.entries(geolocations).forEach(([code, info]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${info.flag} ${info.name}`;
            geolocationSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading geolocations:', error);
        showToast('Failed to load countries', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    searchBtn.addEventListener('click', performSearch);
    translateBtn.addEventListener('click', handleTranslate);
    searchQuery.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Auto-translate when geolocation changes
    geolocationSelect.addEventListener('change', function() {
        const query = searchQuery.value.trim();
        if (query && geolocationSelect.value) {
            handleTranslate();
        }
    });
    
    copyTranslationBtn.addEventListener('click', handleCopyTranslation);
    
    // Tab functionality
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabType = this.dataset.tab;
            switchTab(tabType);
        });
    });
    
    modalClose.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);
    modalSaveBtn.addEventListener('click', saveCurrentProductToExcel);
    
    exportBtn.addEventListener('click', exportExcel);
    clearBtn.addEventListener('click', clearExcelData);
    
    // Close modal when clicking outside
    productModal.addEventListener('click', function(e) {
        if (e.target === productModal) {
            closeModal();
        }
    });
}

// Handle translation
async function handleTranslate() {
    const query = searchQuery.value.trim();
    const geolocation = geolocationSelect.value;
    
    if (!query) {
        showToast('Please enter a search query', 'error');
        return;
    }
    
    if (!geolocation) {
        showToast('Please select a country', 'error');
        return;
    }
    
    try {
        translateBtn.disabled = true;
        translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
        
        const response = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, geolocation })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayTranslation(data);
            showToast('Translation completed', 'success');
        } else {
            showToast(data.error || 'Translation failed', 'error');
        }
        
    } catch (error) {
        console.error('Translation error:', error);
        showToast('Translation failed. Please try again.', 'error');
    } finally {
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
    }
}

// Display translation results
function displayTranslation(translationData) {
    originalQueryText.textContent = translationData.originalQuery;
    translatedQueryText.textContent = translationData.translatedQuery;
    translationLanguage.textContent = `Translated to ${translationData.geolocation.name} (${translationData.targetLanguage})`;
    
    translationContainer.style.display = 'block';
    translationContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle copy translation
async function handleCopyTranslation() {
    const translatedText = translatedQueryText.textContent;
    
    if (!translatedText) {
        showToast('No translation to copy', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(translatedText);
        showToast('Translation copied to clipboard', 'success');
        
        // Visual feedback
        copyTranslationBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyTranslationBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
        
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy translation', 'error');
    }
}

// Switch between tabs
function switchTab(tabType) {
    // Update tab buttons
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabType) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabType === 'multiple-source') {
        multipleSourceTab.classList.add('active');
    } else if (tabType === 'single-source') {
        singleSourceTab.classList.add('active');
    }
}

// Perform search
async function performSearch() {
    const query = searchQuery.value.trim();
    const geolocation = geolocationSelect.value;
    
    if (!query) {
        showToast('Please enter a search query', 'warning');
        return;
    }
    
    if (!geolocation) {
        showToast('Please select a country', 'warning');
        return;
    }
    
    // Show loading
    loading.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    searchBtn.disabled = true;
    
    try {
        // Search for multiple source products
        const multipleSourceResponse = await fetch(`${API_BASE}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, geolocation })
        });
        
        const multipleSourceData = await multipleSourceResponse.json();
        
        // Search for single source products
        const singleSourceResponse = await fetch(`${API_BASE}/api/search-single-source`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, geolocation })
        });
        
        const singleSourceData = await singleSourceResponse.json();
        
        if (multipleSourceData.success && singleSourceData.success) {
            currentSearchResults = multipleSourceData.results;
            currentSingleSourceResults = singleSourceData.results;
            displaySearchResults(multipleSourceData, singleSourceData);
            
            const totalResults = multipleSourceData.results.length + singleSourceData.results.length;
            showToast(`Found ${totalResults} products (${multipleSourceData.results.length} multiple-source, ${singleSourceData.results.length} single-source)`, 'success');
        } else {
            throw new Error(multipleSourceData.error || singleSourceData.error || 'Search failed');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showToast(`Search failed: ${error.message}`, 'error');
    } finally {
        loading.classList.add('hidden');
        searchBtn.disabled = false;
    }
}

// Display search results
function displaySearchResults(multipleSourceData, singleSourceData) {
    const totalResults = multipleSourceData.results.length + singleSourceData.results.length;
    
    resultsTitle.textContent = `Search Results for "${multipleSourceData.originalQuery}"`;
    resultsCount.textContent = `${totalResults} products found`;
    resultsGeo.textContent = `${multipleSourceData.geoInfo.flag} ${multipleSourceData.geoInfo.name}`;
    
    // Update tab counts
    multipleSourceCount.textContent = multipleSourceData.results.length;
    singleSourceCount.textContent = singleSourceData.results.length;
    
    // Clear previous results
    multipleSourceGrid.innerHTML = '';
    singleSourceGrid.innerHTML = '';
    
    // Display multiple source products
    if (multipleSourceData.results.length === 0) {
        multipleSourceGrid.innerHTML = `
            <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                <i class="fas fa-store" style="font-size: 48px; color: #cbd5e0; margin-bottom: 20px;"></i>
                <h3 style="color: #718096; margin-bottom: 10px;">No multiple-source products found</h3>
                <p style="color: #a0aec0;">Try adjusting your search query or check the single-source tab.</p>
            </div>
        `;
    } else {
        multipleSourceData.results.forEach(product => {
            const productCard = createProductCard(product, multipleSourceData.geoInfo, 'multiple');
            multipleSourceGrid.appendChild(productCard);
        });
    }
    
    // Display single source products
    if (singleSourceData.results.length === 0) {
        singleSourceGrid.innerHTML = `
            <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                <i class="fas fa-shopping-bag" style="font-size: 48px; color: #cbd5e0; margin-bottom: 20px;"></i>
                <h3 style="color: #718096; margin-bottom: 10px;">No single-source products found</h3>
                <p style="color: #a0aec0;">Try adjusting your search query or check the multiple-source tab.</p>
            </div>
        `;
    } else {
        singleSourceData.results.forEach(product => {
            const productCard = createProductCard(product, singleSourceData.geoInfo, 'single');
            singleSourceGrid.appendChild(productCard);
        });
    }
    
    resultsSection.classList.remove('hidden');
}

// Create product card element
function createProductCard(product, geoInfo, sourceType = 'multiple') {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const price = product.price || 'Price not available';
    const rating = product.rating ? `${product.rating} ⭐` : 'No rating';
    const sellerCount = product.sellers ? `${product.sellers.length} sellers` : 'Multiple sellers';
    
    // Handle multiple images from Google Shopping API
    const images = [];
    
    // Primary thumbnail (most important)
    if (product.thumbnail) images.push(product.thumbnail);
    
    // Thumbnails array - Google Shopping API stores multiple images here as string URLs
    if (product.thumbnails && Array.isArray(product.thumbnails)) {
        product.thumbnails.forEach(thumbUrl => {
            // In Google Shopping API, thumbnails are direct URL strings
            if (typeof thumbUrl === 'string' && thumbUrl.trim() && !images.includes(thumbUrl)) {
                images.push(thumbUrl);
            }
        });
    }
    
    // serpapi_thumbnails array - alternative thumbnails from SerpAPI
    if (product.serpapi_thumbnails && Array.isArray(product.serpapi_thumbnails)) {
        product.serpapi_thumbnails.forEach(thumbUrl => {
            if (typeof thumbUrl === 'string' && thumbUrl.trim() && !images.includes(thumbUrl)) {
                images.push(thumbUrl);
            }
        });
    }
    
    // Fallback: check for images in other locations if we still don't have multiple images
    if (images.length <= 1) {
        // Additional images from various API fields
        if (product.images && Array.isArray(product.images)) {
            product.images.forEach(img => {
                const imgUrl = typeof img === 'string' ? img : img?.url || img?.src;
                if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
            });
        }
        
        // Rich snippet images
        if (product.rich_snippet?.top?.images && Array.isArray(product.rich_snippet.top.images)) {
            product.rich_snippet.top.images.forEach(img => {
                const imgUrl = typeof img === 'string' ? img : img?.url || img?.src;
                if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
            });
        }
        
        // Inline images
        if (product.inline_images && Array.isArray(product.inline_images)) {
            product.inline_images.forEach(img => {
                const imgUrl = typeof img === 'string' ? img : img?.url || img?.src;
                if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
            });
        }
    }
    
    // Debug: Log available images for testing
    console.log(`Product "${product.title}" has ${images.length} images:`, images);
    if (product.thumbnails && product.thumbnails.length > 0) {
        console.log('Raw thumbnails array:', product.thumbnails);
    }
    if (product.serpapi_thumbnails && product.serpapi_thumbnails.length > 0) {
        console.log('SerpAPI thumbnails array:', product.serpapi_thumbnails);
    }
    
    const mainImage = images[0] || '/placeholder-image.png';
    const hasMultipleImages = images.length > 1;
    
    card.innerHTML = `
        <div class="product-image-container">
            <img src="${mainImage}" 
                 alt="${product.title}" 
                 class="product-image"
                 data-images='${JSON.stringify(images)}'
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjdGQUZDIi8+CjxwYXRoIGQ9Ik0xMDAgNzBDMTA4LjI4NCA3MCA5NS4wNzE0IDc3LjE2NDMgOTUuMDcxNCA4NS43MTQzVjExNC4yODZDOTUuMDcxNCAxMjIuODM2IDEwOC4yODQgMTMwIDEwMCAxMzBDOTEuNzE1NyAxMzAgODQuOTI4NiAxMjIuODM2IDg0LjkyODYgMTE0LjI4NlY4NS43MTQzQzg0LjkyODYgNzcuMTY0MyA5MS43MTU3IDcwIDEwMCA3MFoiIGZpbGw9IiNFMkU4RjAiLz4KPHBhdGggZD0iTTEwMCA1MEMxMTYuNTY5IDUwIDEzMCA2My40MzE1IDEzMCA4MFYxMjBDMTMwIDEzNi41NjkgMTE2LjU2OSAxNTAgMTAwIDE1MEM4My40MzE1IDE1MCA3MCAxMzYuNTY5IDcwIDEyMFY4MEM3MCA2My40MzE1IDgzLjQzMTUgNTAgMTAwIDUwWiIgc3Ryb2tlPSIjQ0JENUUwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+'">
            ${hasMultipleImages ? `
                <div class="product-image-gallery">
                    <div class="image-counter">${images.length} images</div>
                    ${images.map((_, index) => `<div class="gallery-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`).join('')}
                </div>
                <div class="image-nav-buttons">
                    <button class="image-nav-btn prev-btn" onclick="changeProductImage(this, -1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="image-nav-btn next-btn" onclick="changeProductImage(this, 1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            ` : ''}
        </div>
        <div class="product-content">
            <h3 class="product-title">${product.title}</h3>
            <div class="product-price">${price}</div>
            <div class="product-meta">
                <div class="product-rating">
                    <span class="stars">${rating}</span>
                </div>
                <div class="product-geo">${geoInfo.flag}</div>
            </div>
            <div class="product-seller-info">
                <i class="fas ${sourceType === 'multiple' ? 'fa-store' : 'fa-shopping-bag'}"></i>
                <span>${sourceType === 'multiple' ? sellerCount : (product.source || 'Single seller')}</span>
                <span style="margin-left: auto; font-size: 11px; color: #a0aec0;">${sourceType === 'multiple' ? 'Multiple sources' : 'Single source'}</span>
            </div>
            <div class="product-actions">
                <button class="btn btn-primary view-details-btn" data-product-id="${product.product_id}">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn btn-success save-excel-btn" data-product='${JSON.stringify({...product, geolocation: geoInfo})}'>
                    <i class="fas fa-save"></i> Save to Excel
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const viewDetailsBtn = card.querySelector('.view-details-btn');
    const saveExcelBtn = card.querySelector('.save-excel-btn');
    const productImage = card.querySelector('.product-image');
    const galleryDots = card.querySelectorAll('.gallery-dot');
    
    // Image gallery functionality
    if (images.length > 1) {
        let currentImageIndex = 0;
        
        galleryDots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                currentImageIndex = index;
                productImage.src = images[index];
                
                // Update active dot
                galleryDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            });
        });
        
        // Auto-rotate images on hover
        card.addEventListener('mouseenter', () => {
            if (images.length > 1) {
                const interval = setInterval(() => {
                    currentImageIndex = (currentImageIndex + 1) % images.length;
                    productImage.src = images[currentImageIndex];
                    
                    galleryDots.forEach(d => d.classList.remove('active'));
                    if (galleryDots[currentImageIndex]) {
                        galleryDots[currentImageIndex].classList.add('active');
                    }
                }, 1500);
                
                card.dataset.interval = interval;
            }
        });
        
        card.addEventListener('mouseleave', () => {
            if (card.dataset.interval) {
                clearInterval(card.dataset.interval);
                delete card.dataset.interval;
                
                // Reset to first image
                currentImageIndex = 0;
                productImage.src = images[0];
                galleryDots.forEach(d => d.classList.remove('active'));
                if (galleryDots[0]) {
                    galleryDots[0].classList.add('active');
                }
            }
        });
    }
    
    viewDetailsBtn.addEventListener('click', () => {
        const currentGeolocation = geolocationSelect.value;
        viewProductDetails(product.product_id, currentGeolocation);
    });
    
    saveExcelBtn.addEventListener('click', () => {
        const productData = JSON.parse(saveExcelBtn.dataset.product);
        saveProductToExcel(productData);
    });
    
    return card;
}

// View product details
async function viewProductDetails(productId, geolocation) {
    openModal();
    modalTitle.textContent = 'Loading Product Details...';
    modalLoading.classList.remove('hidden');
    modalContent.classList.add('hidden');
    modalSaveBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/product-details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                productId: productId, 
                geolocation: geolocation 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentProductDetails = { ...data.productDetails, geoInfo: data.geoInfo };
            displayProductDetails(data.productDetails, data.geoInfo);
            modalSaveBtn.disabled = false;
        } else {
            throw new Error(data.error || 'Failed to load product details');
        }
        
    } catch (error) {
        console.error('Product details error:', error);
        modalContent.innerHTML = `
            <div class="text-center" style="padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f56565; margin-bottom: 20px;"></i>
                <h3 style="color: #e53e3e; margin-bottom: 10px;">Failed to Load Details</h3>
                <p style="color: #718096;">${error.message}</p>
            </div>
        `;
        modalContent.classList.remove('hidden');
    } finally {
        modalLoading.classList.add('hidden');
    }
}

// Display product details in modal
function displayProductDetails(productDetails, geoInfo) {
    modalTitle.textContent = productDetails.title || 'Product Details';
    
    const sellers = productDetails.sellers_results?.online_sellers || [];
    const productInfo = productDetails.product_results || {};
    
    // Collect all available images
    const allImages = [];
    if (productInfo.images && Array.isArray(productInfo.images)) {
        allImages.push(...productInfo.images);
    }
    if (productDetails.images && Array.isArray(productDetails.images)) {
        productDetails.images.forEach(img => {
            if (!allImages.includes(img)) allImages.push(img);
        });
    }
    if (productInfo.thumbnail && !allImages.includes(productInfo.thumbnail)) {
        allImages.unshift(productInfo.thumbnail);
    }
    
    modalContent.innerHTML = `
        <div class="product-details">
            ${allImages.length > 0 ? `
                <div class="detail-section">
                    <h4><i class="fas fa-images"></i> Product Images (${allImages.length})</h4>
                    <div class="product-image-gallery-modal">
                        <div class="main-image-container">
                            <img src="${allImages[0]}" alt="Product Image" class="modal-main-image" id="modal-main-image">
                        </div>
                        ${allImages.length > 1 ? `
                            <div class="image-thumbnails">
                                ${allImages.map((img, index) => `
                                    <img src="${img}" 
                                         alt="Product Image ${index + 1}" 
                                         class="thumbnail-image ${index === 0 ? 'active' : ''}"
                                         data-index="${index}"
                                         onclick="changeModalImage(${index}, '${img}')">
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Product Information</h4>
                <div class="product-info-grid">
                    <div class="info-item">
                        <strong>Title:</strong> 
                        <span>${productInfo.title || productDetails.title || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <strong>Price:</strong> 
                        <span class="price-highlight">${productInfo.price || 'Price not available'}</span>
                    </div>
                    <div class="info-item">
                        <strong>Rating:</strong> 
                        <span>${productInfo.rating ? `${productInfo.rating} ⭐` : 'No rating'}</span>
                    </div>
                    <div class="info-item">
                        <strong>Country:</strong> 
                        <span>${geoInfo.flag} ${geoInfo.name}</span>
                    </div>
                </div>
                ${productInfo.description ? `
                    <div class="product-description">
                        <strong>Description:</strong>
                        <p>${productInfo.description}</p>
                    </div>
                ` : ''}
            </div>
            
            ${sellers.length > 0 ? `
                <div class="detail-section">
                    <h4><i class="fas fa-store"></i> Available Sellers (${sellers.length})</h4>
                    <div class="sellers-grid">
                        ${sellers.map((seller, index) => `
                            <div class="seller-card">
                                <div class="seller-header">
                                    <div class="seller-name">${seller.name || 'Unknown Seller'}</div>
                                    <div class="seller-rank">#${index + 1}</div>
                                </div>
                                <div class="seller-price">${seller.price || 'Price not available'}</div>
                                <div class="seller-details">
                                    ${seller.base_price ? `<div class="price-detail">Base: <span>${seller.base_price}</span></div>` : ''}
                                    ${seller.shipping ? `<div class="price-detail">Shipping: <span>${seller.shipping}</span></div>` : ''}
                                    ${seller.total_price ? `<div class="price-detail total">Total: <span>${seller.total_price}</span></div>` : ''}
                                </div>
                                ${seller.link ? `
                                    <a href="${seller.link}" target="_blank" class="seller-link-btn">
                                        <i class="fas fa-external-link-alt"></i> Visit Store
                                    </a>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '<div class="detail-section"><p>No seller information available</p></div>'}
        </div>
    `;
    
    modalContent.classList.remove('hidden');
}

// Change product image in product card
function changeProductImage(button, direction) {
    const card = button.closest('.product-card');
    const img = card.querySelector('.product-image');
    const images = JSON.parse(img.dataset.images || '[]');
    const dots = card.querySelectorAll('.gallery-dot');
    
    if (images.length <= 1) return;
    
    // Find current active dot
    let currentIndex = 0;
    dots.forEach((dot, index) => {
        if (dot.classList.contains('active')) {
            currentIndex = index;
        }
    });
    
    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex >= images.length) newIndex = 0;
    if (newIndex < 0) newIndex = images.length - 1;
    
    // Update image and dots
    img.src = images[newIndex];
    dots.forEach(dot => dot.classList.remove('active'));
    if (dots[newIndex]) {
        dots[newIndex].classList.add('active');
    }
}

// Change modal image function
function changeModalImage(index, imageSrc) {
    const mainImage = document.getElementById('modal-main-image');
    const thumbnails = document.querySelectorAll('.thumbnail-image');
    
    if (mainImage) {
        mainImage.src = imageSrc;
    }
    
    // Update active thumbnail
    thumbnails.forEach(thumb => thumb.classList.remove('active'));
    if (thumbnails[index]) {
        thumbnails[index].classList.add('active');
    }
}

// Save current product to Excel
function saveCurrentProductToExcel() {
    if (!currentProductDetails) {
        showToast('No product details to save', 'warning');
        return;
    }
    
    const sellers = currentProductDetails.sellers_results?.online_sellers || [];
    const productInfo = currentProductDetails.product_results || {};
    
    // Create separate rows for each seller
    const productDataArray = [];
    
    if (sellers.length > 0) {
        sellers.forEach((seller, index) => {
            const productData = {
                geolocation: currentProductDetails.geoInfo.name,
                translatedQuery: searchQuery.value, // Fixed: use searchQuery instead of searchInput
                title: productInfo.title || currentProductDetails.title || 'N/A',
                productId: currentProductDetails.product_id || 'N/A',
                priceRange: productInfo.price || 'N/A',
                sellerCount: sellers.length,
                productLink: currentProductDetails.link || 'N/A',
                sellerName: seller.name || 'N/A',
                sellerLink: seller.link || 'N/A',
                basePrice: seller.base_price || 'N/A',
                shipping: seller.shipping || 'N/A',
                totalPrice: seller.total_price || seller.price || 'N/A',
                sellerIndex: index + 1
            };
            productDataArray.push(productData);
        });
    } else {
        // If no sellers, create one row with basic product info
        const productData = {
            geolocation: currentProductDetails.geoInfo.name,
            translatedQuery: searchQuery.value, // Fixed: use searchQuery instead of searchInput
            title: productInfo.title || currentProductDetails.title || 'N/A',
            productId: currentProductDetails.product_id || 'N/A',
            priceRange: productInfo.price || 'N/A',
            sellerCount: 0,
            productLink: currentProductDetails.link || 'N/A',
            sellerName: 'N/A',
            sellerLink: 'N/A',
            basePrice: 'N/A',
            shipping: 'N/A',
            totalPrice: 'N/A',
            sellerIndex: 1
        };
        productDataArray.push(productData);
    }
    
    // Save each seller as a separate row
    saveMultipleProductsToExcel(productDataArray);
    closeModal();
}

// Save product to Excel
async function saveProductToExcel(productData) {
    try {
        const response = await fetch(`${API_BASE}/api/save-to-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Product saved to Excel! (${data.totalSaved} items total)`, 'success');
            updateExcelStatus();
        } else {
            throw new Error(data.error || 'Failed to save product');
        }
        
    } catch (error) {
        console.error('Save to Excel error:', error);
        showToast(`Failed to save product: ${error.message}`, 'error');
    }
}

// Save multiple products to Excel (for multiple sellers)
async function saveMultipleProductsToExcel(productDataArray) {
    try {
        const response = await fetch(`${API_BASE}/api/save-multiple-to-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ products: productDataArray })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${productDataArray.length} seller entries saved to Excel! (${data.totalSaved} items total)`, 'success');
            updateExcelStatus();
        } else {
            throw new Error(data.error || 'Failed to save products');
        }
        
    } catch (error) {
        console.error('Save multiple to Excel error:', error);
        showToast(`Failed to save products: ${error.message}`, 'error');
    }
}

// Update Excel status
async function updateExcelStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/excel-data-count`);
        const data = await response.json();
        
        excelCount.textContent = `${data.count} items saved`;
        exportBtn.disabled = data.count === 0;
        clearBtn.disabled = data.count === 0;
        
    } catch (error) {
        console.error('Error updating Excel status:', error);
    }
}

// Export Excel file
async function exportExcel() {
    try {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        
        const response = await fetch(`${API_BASE}/api/export-excel`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shopping-results-${Date.now()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('Excel file exported successfully!', 'success');
        } else {
            throw new Error('Export failed');
        }
        
    } catch (error) {
        console.error('Export error:', error);
        showToast(`Export failed: ${error.message}`, 'error');
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Excel';
        updateExcelStatus();
    }
}

// Clear Excel data
async function clearExcelData() {
    if (!confirm('Are you sure you want to clear all saved data?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/excel-data`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Excel data cleared successfully!', 'success');
            updateExcelStatus();
        } else {
            throw new Error('Failed to clear data');
        }
        
    } catch (error) {
        console.error('Clear data error:', error);
        showToast(`Failed to clear data: ${error.message}`, 'error');
    }
}

// Modal functions
function openModal() {
    productModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    productModal.classList.add('hidden');
    document.body.style.overflow = '';
    currentProductDetails = null;
}

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}
