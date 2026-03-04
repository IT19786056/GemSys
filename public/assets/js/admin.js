// --- 1. CONFIG ---
    const API_URL = '/api'; 
    let gemModal, viewModal, deleteModal;
    let selectedImages = [];
    let currentGems = []; 
    let deleteTargetId = null;
    let deleteType = ''; 
    let searchTimeout;
    let currentPage = 1;
    let totalPages = 1;
    let currentView = 'grid';
    let progressModal;
    const gemCache = new Map();
    let activeWaPhone = null;
    let orderModal, viewOrderModal;
    let selectedOrderImages = [];
    let currentOrders = [];
    let orderSearchTimeout;
    let waSelectedMediaBase64 = null;
    let waSelectedMediaType = null;

    // --- 2. DISPLAY LOGIC (SAFE VERSION) ---
    function showDashboard() {
        // 1. Hide Login (Safely)
        const loginEl = document.getElementById('login-overlay');
        if (loginEl) {
            loginEl.classList.add('d-none');
            loginEl.style.display = 'none';
        }

        // 2. Hide Loader (Safely)
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.classList.add('d-none'); // Bootstrap hide
            loader.style.display = 'none';  // Force hide
        }
        
        // 3. Show App (Safely)
        const appEl = document.getElementById('main-app');
        if (appEl) {
            appEl.classList.remove('d-none');
            appEl.style.display = 'block';
        }
        
        // Load initial data
        if (typeof loadCategories === 'function') loadCategories(); 
        if (typeof loadUserProfile === 'function') loadUserProfile();
        if (typeof showSection === 'function') showSection('dashboard');
    }

    // 🚀 NEW: Load User Profile Logic
    async function loadUserProfile() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            // Decode token to get username
            const payload = JSON.parse(atob(token.split('.')[1]));
            document.getElementById('current-user-name').innerText = payload.username || 'Admin';

            // Find user image from users list
            const res = await authFetch(`${API_URL}/users`);
            if (res) {
                const json = await res.json();
                const me = json.data.find(u => u.username === payload.username);
                const imgEl = document.getElementById('current-user-img');
                
                if (me && me.image_url) {
                    imgEl.src = me.image_url;
                } else {
                    // Fallback to UI Avatar if no image set
                    imgEl.src = `https://ui-avatars.com/api/?name=${payload.username}&background=0D8ABC&color=fff`;
                }
            }
        } catch (e) { console.error("Error loading profile", e); }
    }

    function showLogin() {
        // 1. Hide App (Safely)
        const appEl = document.getElementById('main-app');
        if (appEl) {
            appEl.classList.add('d-none');
            appEl.style.display = 'none';
        }

        // 2. Hide Loader (Safely)
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.classList.add('d-none'); // Bootstrap hide
            loader.style.display = 'none';  // Force hide
        }
        
        // 3. Show Login (Safely)
        const loginEl = document.getElementById('login-overlay');
        if (loginEl) {
            loginEl.classList.remove('d-none');
            loginEl.style.display = 'flex';
        }
        
        // Reset form (Safely)
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.style.display = 'none';
        
        const userIn = document.getElementById('username');
        if (userIn) userIn.value = '';
        
        const passIn = document.getElementById('password');
        if (passIn) passIn.value = '';
    }

    // --- 3. NAVIGATION ---
    function showCategories() { showSection('categories'); }
    function showUsers() { showSection('users'); }
    function showWhatsApp() { showSection('whatsapp'); }
    
    // Add these trackers for WhatsApp polling
    let waPollInterval = null; 
    let waContactsData = []; 

    function showSection(section) {
        // BULLETPROOF CLEAR: Stop the timer immediately on ANY navigation
        if (waPollInterval !== null) {
            clearInterval(waPollInterval);
            waPollInterval = null;
        }

        ['dashboard-section', 'category-section', 'user-section', 'whatsapp-section','orders-section','company-section'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('d-none');
        });

        if(section === 'dashboard') {
            document.getElementById('dashboard-section').classList.remove('d-none');
            // 🚀 PARALLEL LOADING
            loadData(); 
            loadStats(); 
        } else if (section === 'categories') {
            document.getElementById('category-section').classList.remove('d-none');
            loadCategoryManager();
        } else if (section === 'users') {
            document.getElementById('user-section').classList.remove('d-none');
            loadUserManager();
        } else if (section === 'whatsapp') {
            document.getElementById('whatsapp-section').classList.remove('d-none');
            loadWhatsAppContacts();
            // SLOW DOWN POLLING: 15 seconds
            waPollInterval = setInterval(() => {
                if (!document.getElementById('whatsapp-section').classList.contains('d-none')) {
                    loadWhatsAppContacts(true);
                }
            }, 2500);
        } else if (section === 'orders') {
            document.getElementById('orders-section').classList.remove('d-none');
            loadOrders();
            loadOrderStats();
        } else if (section === 'company') {
            document.getElementById('company-section').classList.remove('d-none');
            loadCompanyProfileForm();
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if(link.getAttribute('onclick') && link.getAttribute('onclick').toLowerCase().includes(section)) {
                link.classList.add('active');
            }
        });
    }

    // ==========================
// --- LOCAL ORDERS LOGIC ---
// ==========================

    async function loadOrders() {
        // 1. Grab filter values safely
        const search = document.getElementById('order-search')?.value || '';
        const status = document.getElementById('order-filter-status')?.value || 'All';
        const sort = document.getElementById('order-sort')?.value || 'newest';

        // 2. Build Query String
        const query = new URLSearchParams({ search, status, sort }).toString();
        
        // 3. Fetch Data
        const res = await authFetch(`${API_URL}/orders?${query}`);
        if (!res) return;
        const json = await res.json();
        currentOrders = json.data;
        
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';
        
        if (currentOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No orders found matching your filters.</td></tr>';
            return;
        }

        currentOrders.forEach(o => {
            let badgeClass = 'bg-secondary';
            if (o.status === 'Available') badgeClass = 'bg-success';
            if (o.status === 'Sold') badgeClass = 'bg-danger';
            if (o.status === 'Intransit') badgeClass = 'bg-warning text-dark';
            if (o.status === 'Delivered') badgeClass = 'bg-info text-dark';

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold text-primary" style="cursor:pointer" onclick="viewOrder(${o.id})">${o.order_id}</td>
                    <td>${o.item_id || '-'}</td>
                    <td>${o.item_name}</td>
                    <td>${o.weight} ct</td>
                    <td class="fw-bold">$${o.price}</td>
                    <td><span class="badge ${badgeClass}">${o.status}</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="viewOrder(${o.id})"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="prepareEditOrder(${o.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder(${o.id})"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
        });
    }

    async function loadOrderStats() {
        const res = await authFetch(`${API_URL}/orders/stats`);
        if(!res) return;
        const data = await res.json();
        
        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        
        // 1. Total Amount
        safeSet('order-stat-amount', '$' + Number(data.totalAmount).toLocaleString());
        
        // 2. Item Counts (Updates the "- 12" text)
        safeSet('order-count-avail', ' -  ' + data.availableOrders);
        safeSet('order-count-sold', ' -  ' + data.soldOrders);
        safeSet('order-count-intransit', ' -  ' + data.intransitOrders);
        
        // 3. Item Values (Updates the large bold text below the counts)
        safeSet('order-stat-avail', '$' + Number(data.availableAmount).toLocaleString());
        safeSet('order-stat-sold', '$' + Number(data.soldAmount).toLocaleString());
        safeSet('order-stat-intransit', '$' + Number(data.intransitAmount).toLocaleString());
    }

    function debouncedOrderSearch() {
        clearTimeout(orderSearchTimeout);
        // Wait 300ms after user stops typing before searching
        orderSearchTimeout = setTimeout(() => { loadOrders(); }, 300); 
    }

    function clearOrderFilters() {
        const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        
        safeSet('order-search', '');
        safeSet('order-filter-status', 'All');
        safeSet('order-sort', 'newest');
        
        loadOrders();
        showToast("Order filters cleared.");
    }

    async function openOrderModal() {
        selectedOrderImages = [];
        document.getElementById('order-media-preview').innerHTML = '';
        document.getElementById('order-db-id').value = '';
        ['order-item-id','order-item-name','order-weight','order-dims','order-price','order-files'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('order-status').value = 'Available';
        document.getElementById('orderModalTitle').innerText = 'Add New Order';
        
        // Fetch Next ID
        const res = await authFetch(`${API_URL}/orders/next-id`);
        if (res && res.ok) {
            const data = await res.json();
            document.getElementById('order-id-disp').value = data.nextId;
        }
        orderModal.show();
    }

    function handleWaMediaSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Meta limit is roughly 16MB for standard media
        if (file.size > 15 * 1024 * 1024) { 
            showToast("File too large. Maximum 15MB allowed.", "error");
            return;
        }

        waSelectedMediaType = file.type;
        const reader = new FileReader();
        
        reader.onload = function(e) {
            waSelectedMediaBase64 = e.target.result;
            document.getElementById('wa-media-preview-container').classList.remove('d-none');
            
            const imgPreview = document.getElementById('wa-media-preview-img');
            const vidPreview = document.getElementById('wa-media-preview-vid');

            if (file.type.startsWith('image/')) {
                imgPreview.src = waSelectedMediaBase64;
                imgPreview.style.display = 'block';
                vidPreview.style.display = 'none';
            } else if (file.type.startsWith('video/')) {
                vidPreview.src = waSelectedMediaBase64;
                vidPreview.style.display = 'block';
                imgPreview.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }

    function clearWaMedia() {
        waSelectedMediaBase64 = null;
        waSelectedMediaType = null;
        document.getElementById('wa-media-input').value = '';
        document.getElementById('wa-media-preview-container').classList.add('d-none');
        document.getElementById('wa-media-preview-img').src = '';
        document.getElementById('wa-media-preview-vid').src = '';
    }

    function prepareEditOrder(id) {
        const o = currentOrders.find(item => item.id === id);
        if (!o) return;

        document.getElementById('order-db-id').value = o.id;
        document.getElementById('order-id-disp').value = o.order_id;
        document.getElementById('order-item-id').value = o.item_id || '';
        document.getElementById('order-item-name').value = o.item_name || '';
        document.getElementById('order-weight').value = o.weight || '';
        document.getElementById('order-dims').value = o.dimensions || '';
        document.getElementById('order-price').value = o.price || '';
        document.getElementById('order-status').value = o.status || 'Available';
        document.getElementById('order-files').value = '';

        selectedOrderImages = [];
        let media = { images: [] };
        try { media = typeof o.media === 'string' ? JSON.parse(o.media) : (o.media || {}); } catch(e){}
        if (media.images) {
            selectedOrderImages = media.images.map((img, idx) => ({ data: img, isNew: false }));
        }
        renderOrderPreviews();
        document.getElementById('orderModalTitle').innerText = 'Edit Order';
        orderModal.show();
    }

    function renderOrderPreviews() {
        const container = document.getElementById('order-media-preview');
        container.innerHTML = '';
        selectedOrderImages.forEach((imgObj, index) => {
            container.innerHTML += `
                <div class="position-relative d-inline-block me-2 mb-2">
                    <img src="${imgObj.data}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;">
                    <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 p-0" style="width:20px; height:20px; line-height:1;" onclick="removeOrderImage(${index})">×</button>
                </div>`;
        });
    }

    function removeOrderImage(index) {
        selectedOrderImages.splice(index, 1);
        renderOrderPreviews();
    }

    async function saveOrder() {
        const dbId = document.getElementById('order-db-id').value;
        const existingImages = selectedOrderImages.filter(img => !img.isNew).map(img => img.data).filter(url => typeof url === 'string' && !url.startsWith('data:'));
        const newImages = selectedOrderImages.filter(img => img.isNew).map(img => img.data);

        const orderData = {
            order_id: document.getElementById('order-id-disp').value,
            item_id: document.getElementById('order-item-id').value,
            item_name: document.getElementById('order-item-name').value,
            weight: document.getElementById('order-weight').value,
            dimensions: document.getElementById('order-dims').value,
            price: document.getElementById('order-price').value,
            status: document.getElementById('order-status').value,
            media: { images: existingImages }
        };

        progressModal.show();
        document.querySelector('#uploadProgressModal h4').innerText = "Saving Order...";

        try {
            const res = await authFetch(dbId ? `${API_URL}/orders/${dbId}` : `${API_URL}/orders`, { 
                method: dbId ? 'PUT' : 'POST', 
                body: JSON.stringify(orderData) 
            });
            
            if (!res.ok) throw new Error("Save failed");
            const data = await res.json();
            const targetId = dbId ? dbId : data.id;

            for (let i = 0; i < newImages.length; i++) {
                document.getElementById('progress-text').innerText = `Uploading image ${i+1}...`;
                await authFetch(`${API_URL}/orders/${targetId}/media`, {
                    method: 'PUT', body: JSON.stringify({ image: newImages[i] })
                });
            }

            progressModal.hide();
            orderModal.hide();
            showToast("Order saved successfully!");
            loadOrders(); // Refresh table
            loadOrderStats();
        } catch (error) {
            progressModal.hide();
            showToast("Error saving order", "error");
        }
    }

    function viewOrder(id) {
        const o = currentOrders.find(item => item.id === id);
        if (!o) return;

        document.getElementById('view-order-name').innerText = o.item_name;
        document.getElementById('view-order-disp-id').innerText = o.order_id;
        document.getElementById('view-order-item-id').innerText = o.item_id || 'N/A';
        document.getElementById('view-order-price').innerText = `$${o.price || 0}`;
        document.getElementById('view-order-weight').innerText = `${o.weight || 0} ct`;
        document.getElementById('view-order-dims').innerText = o.dimensions || 'N/A';
        
        const badge = document.getElementById('view-order-status');
        badge.innerText = o.status;
        badge.className = 'badge text-white';
        if (o.status === 'Available') badge.classList.add('bg-success');
        else if (o.status === 'Sold') badge.classList.add('bg-danger');
        else if (o.status === 'Intransit') badge.classList.add('bg-warning', 'text-dark');
        else if (o.status === 'Delivered') badge.classList.add('bg-info', 'text-dark');
        else badge.classList.add('bg-secondary');

        let media = { images: [] };
        try { media = typeof o.media === 'string' ? JSON.parse(o.media) : (o.media || {}); } catch(e){}
        
        const carouselInner = document.getElementById('order-carousel-items');
        carouselInner.innerHTML = '';
        
        if (media.images && media.images.length > 0) {
            media.images.forEach((imgSrc, index) => {
                carouselInner.innerHTML += `<div class="carousel-item ${index === 0 ? 'active' : ''}"><div class="d-flex align-items-center justify-content-center bg-light rounded" style="height: 300px;"><img src="${imgSrc}" class="d-block w-100 h-100" style="object-fit: contain;"></div></div>`;
            });
        } else {
            carouselInner.innerHTML = `<div class="carousel-item active"><div class="d-flex align-items-center justify-content-center bg-light rounded text-muted" style="height: 300px;"><div>No Images</div></div></div>`;
        }

        viewOrderModal.show();
    }

    // 4. Hook up Delete Functionality
    function deleteOrder(id) { 
        deleteTargetId = id; 
        deleteType = 'order'; 
        document.getElementById('delete-msg-text').innerText = "Delete this local order permanently?"; 
        deleteModal.show(); 
    }

    // --- WHATSAPP LOGIC ---

    // Load the list of people who have messaged you
    async function loadWhatsAppContacts(isSilentPoll = false) {
        const list = document.getElementById('wa-contacts-list');
        
        // Only show "Loading..." if we are opening the tab for the first time
        if (!isSilentPoll) {
            list.innerHTML = '<div class="text-center p-4 text-muted small">Loading chats...</div>';
        }

        // Fetch from our MySQL backend
        const res = await authFetch(`${API_URL}/whatsapp/chats`);
        if (!res) return;
        
        const data = await res.json();
        waContactsData = data.contacts; // Save to global variable
        
        if(waContactsData.length === 0) {
            list.innerHTML = '<div class="text-center p-4 text-muted small">No messages yet.</div>';
            return;
        }

        // Draw the sidebar
        let sidebarHtml = '';
        waContactsData.forEach(c => {
            // Highlight the active chat
            const isActive = (c.phone === activeWaPhone) ? 'bg-light border-start border-primary border-4' : '';
            sidebarHtml += `
                <button class="list-group-item list-group-item-action p-3 ${isActive}" onclick="openWaChat('${c.phone}', '${c.name}')">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="mb-0 fw-bold">${c.name}</h6>
                    </div>
                    <small class="text-muted text-truncate d-block">${c.last_message || 'Media/Attachment'}</small>
                </button>`;
        });
        list.innerHTML = sidebarHtml;

        // If a chat is currently open, silently update its messages too
        if (activeWaPhone) {
            const activeContact = waContactsData.find(c => c.phone === activeWaPhone);
            if (activeContact) renderChatBubbles(activeContact.history, false);
        }
    }

    // Triggered when you click a contact in the sidebar
    function openWaChat(phone, name) {
        activeWaPhone = phone;
        document.getElementById('wa-active-name').innerText = name;
        document.getElementById('wa-active-phone').innerText = phone;
        document.getElementById('wa-chat-input-area').classList.remove('d-none');
        
        // Re-render sidebar instantly to show active highlight
        loadWhatsAppContacts(true); 
        
        // Find the history from our global variable and render it, forcing scroll to bottom
        const activeContact = waContactsData.find(c => c.phone === activeWaPhone);
        if (activeContact) {
            renderChatBubbles(activeContact.history, true); 
        }
    }

    // Handles drawing the actual messages on the screen
    function renderChatBubbles(messages, forceScrollToBottom = false) {
        const historyContainer = document.getElementById('wa-chat-history');
        
        // Smart Scrolling logic: Only auto-scroll to bottom if the user is already at the bottom
        const isAtBottom = historyContainer.scrollHeight - historyContainer.scrollTop <= historyContainer.clientHeight + 50;

        let html = '<div class="d-flex flex-column gap-2 pb-3" id="wa-chat-bubbles">';
        
        messages.forEach(msg => {
            // Bulletproof property extraction
            const rawTime = msg.timestamp || msg.created_at || new Date();
            const time = new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // 🚨 THE FIX: Check for multiple property variations
            const messageText = msg.text || msg.message_text || msg.messageText || '<i class="text-muted small">Media/Attachment</i>'; 
            
            const msgType = msg.type || msg.msg_type || 'outgoing';

            if (msgType === 'incoming') {
                html += `
                    <div class="align-self-start bg-white p-2 rounded shadow-sm border text-dark" style="max-width: 75%;">
                        ${messageText} 
                        <div class="text-end mt-1"><small class="text-muted" style="font-size: 0.7rem;">${time}</small></div>
                    </div>`;
            } else {
                html += `
                    <div class="align-self-end bg-success bg-opacity-25 p-2 rounded shadow-sm border-0 text-dark" style="max-width: 75%;">
                        ${messageText} 
                        <div class="text-end mt-1"><small class="text-muted" style="font-size: 0.7rem;">${time}</small></div>
                    </div>`;
            }
        });
        html += '</div>';
        
        // Update the HTML
        historyContainer.innerHTML = html;

        // Apply scroll position
        if (forceScrollToBottom || isAtBottom) {
            historyContainer.scrollTop = historyContainer.scrollHeight;
        }
    }

    // Send a reply
    async function sendWhatsAppReply() {
        if (!activeWaPhone) return;
        
        const inputEl = document.getElementById('wa-message-input');
        const text = inputEl.value.trim();
        
        // Block sending if there is no text AND no media
        if (!text && !waSelectedMediaBase64) return;

        // 1. Optimistic UI update
        const bubblesWrapper = document.getElementById('wa-chat-bubbles');
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let displayHtml = '';
        if (waSelectedMediaBase64) {
            if (waSelectedMediaType.startsWith('image/')) {
                displayHtml += `<img src="${waSelectedMediaBase64}" class="img-fluid rounded mb-2" style="max-height:200px; display:block;">`;
            } else {
                displayHtml += `<video src="${waSelectedMediaBase64}" class="img-fluid rounded mb-2" style="max-height:200px; display:block;" controls></video>`;
            }
        }
        if (text) displayHtml += `<div>${text}</div>`;

        bubblesWrapper.innerHTML += `
            <div class="align-self-end bg-success bg-opacity-25 p-2 rounded shadow-sm border-0 text-dark" style="max-width: 75%;">
                ${displayHtml}
                <div class="text-end mt-1"><small class="text-muted" style="font-size: 0.7rem;">${now}</small></div>
            </div>
        `;
        
        // Build payload
        const payload = { 
            customerPhone: activeWaPhone, 
            messageText: text,
            mediaBase64: waSelectedMediaBase64,
            mediaType: waSelectedMediaType
        };

        // Clear inputs immediately
        inputEl.value = '';
        clearWaMedia();

        const historyContainer = document.getElementById('wa-chat-history');
        historyContainer.scrollTop = historyContainer.scrollHeight;

        // 2. Send to backend
        try {
            const res = await authFetch(`${API_URL}/whatsapp/reply`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (!res || !res.ok) throw new Error("Delivery failed");
            
            // Silent poll to confirm db update
            loadWhatsAppContacts(true); 
            
        } catch (err) {
            showToast("Failed to send WhatsApp message.", "error");
        }
    }

    function switchView(view) {
        currentView = view;
        document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
        document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
        renderData(currentGems);
    }

    // --- 4. AUTH ---
    async function authFetch(url, options = {}) {
        const token = localStorage.getItem('token');
        if (!token) { showLogin(); return null; }
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers };
        try {
            const res = await fetch(url, { ...options, headers });
            if (res.status === 401 || res.status === 403) { logout(); return null; }
            return res;
        } catch (err) { console.error("Net Err", err); return null; }
    }

    async function login() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/login`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({username: u, password: p}) 
            });
            const data = await res.json();
            if(data.success) {
                localStorage.setItem('token', data.token);
                showDashboard();
            } else { document.getElementById('login-error').style.display = 'block'; }
        } catch (e) { alert("Login Connection Error"); }
    }

    function logout() {
        // 1. Show the Loading Spinner
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('d-none');

        // 2. Simulated Delay (800ms) for smooth UX
        setTimeout(() => {
            localStorage.removeItem('token'); 
            showLogin(); // This function automatically hides the loader when it runs
        }, 800);
    }

    // --- 5. DATA & RENDER ---
    async function loadCategories() {
        const res = await authFetch(`${API_URL}/categories`);
        if(!res) return;
        const data = await res.json();
        const filterSelect = document.getElementById('filter-category');
        const modalSelect = document.getElementById('gem-category');
        if(filterSelect) {
            filterSelect.innerHTML = '<option value="All">All Categories</option>';
            data.data.forEach(cat => filterSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);
        }
        if(modalSelect) {
            modalSelect.innerHTML = '';
            data.data.forEach(cat => modalSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);
        }
    }

    function debouncedSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => { currentPage = 1; loadData(); }, 300); 
    }
    
    function clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('filter-category').value = 'All';
        document.getElementById('filter-status').value = 'All';
        document.getElementById('sort-by').value = 'recent';
        currentPage = 1;
        loadData();
        showToast("Filters cleared.");
    }

    // 🚀 SKELETON RENDERER
    function renderSkeleton() {
        const container = document.getElementById('gems-grid');
        if (!container) return;
        container.innerHTML = '';
        // Create 12 skeleton cards
        for(let i=0; i<12; i++) {
            container.innerHTML += `
            <div class="col-md-3 col-lg-3">
                <div class="card border-0 shadow-sm h-100 p-2">
                    <div class="skeleton skeleton-img"></div>
                    <div class="card-body p-2">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                </div>
            </div>`;
        }
    }

    async function loadData() {
        // 🚀 SHOW SKELETON
        renderSkeleton();

        const search = document.getElementById('search-input').value;
        const cat = document.getElementById('filter-category').value;
        const status = document.getElementById('filter-status').value;
        const sort = document.getElementById('sort-by').value;
        
        // 🚀 CHANGED LIMIT TO 12
        const query = new URLSearchParams({ search, category: cat, status, sort, page: currentPage, limit: 12 }).toString();
        
        const res = await authFetch(`${API_URL}/gems?${query}`);
        if(!res) return;
        
        const result = await res.json();
        currentGems = result.data;
        totalPages = result.pagination.totalPages;
        
        // 🚀 UPDATE DYNAMIC COUNTS
        const countText = `${result.pagination.total} Results found`;
        document.getElementById('res-count-mobile').innerText = countText;
        document.getElementById('res-count-desktop').innerText = countText;

        renderData(currentGems);
        renderPagination(result.pagination);
    }

    function renderData(gems) {
        const container = document.getElementById('gems-grid');
        if (!container) return;
        container.innerHTML = '';
        if(gems.length === 0) { container.innerHTML = '<div class="col-12 text-center text-muted p-5">No gems found.</div>'; return; }

        if (currentView === 'grid') {
            gems.forEach((g, index) => {
                let displayImg = 'https://via.placeholder.com/300x150?text=No+Image';
                try {
                    const media = (typeof g.media === 'string') ? JSON.parse(g.media) : g.media;
                    if (media && media.images && media.images.length > 0) displayImg = media.images[0];
                    else if (g.image_url) displayImg = g.image_url;
                } catch (e) { displayImg = g.image_url || displayImg; }

                const loadingType = index < 4 ? 'eager' : 'lazy'; // First 4 load eager for speed

                container.innerHTML += `
                <div class="col-md-3 col-lg-3">
                    <div class="card gem-card shadow-sm border-0 h-100">
                        <div style="position: relative; cursor: pointer;" onclick="viewGem(${g.id})">
                            <img src="${displayImg}" 
                                 loading="${loadingType}" 
                                 decoding="async" 
                                 class="card-img-top" 
                                 style="height:200px; object-fit:cover; background-color: #f8f9fa;">
                            <span class="badge ${g.status === 'Available' ? 'bg-success' : 'bg-secondary'} status-badge">${g.status || 'Available'}</span>
                        </div>
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h6 class="card-title mb-1 text-truncate">${g.name || 'Unnamed'}</h6>
                                <small class="text-primary fw-bold">$${g.price || 0}</small>
                            </div>
                            <small class="text-muted">${g.category_name || 'Gem'} • ${g.weight || 0}ct</small>
                        </div>
                        <div class="card-footer bg-white border-0 d-flex justify-content-between">
                            <button class="btn btn-sm btn-outline-secondary" onclick="viewGem(${g.id})"><i class="bi bi-eye"></i></button>
                            <button class="btn btn-sm btn-outline-primary" onclick="prepareEdit(${g.id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteGem(${g.id})"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            });
        } else {
            let tableHtml = `
            <div class="col-12"><div class="card border-0 shadow-sm"><div class="table-responsive">
            <table class="table table-hover align-middle mb-0"><thead class="bg-light">
            <tr><th class="ps-4">Name</th><th>Category</th><th>Weight</th><th>Price</th><th>Status</th><th class="text-end pe-4">Actions</th></tr>
            </thead><tbody>`;
            gems.forEach(g => {
                const badgeClass = g.status === 'Available' ? 'bg-success' : 'bg-secondary';
                tableHtml += `
                <tr>
                    <td class="ps-4 fw-bold text-primary" style="cursor:pointer" onclick="viewGem(${g.id})">${g.name}</td>
                    <td>${g.category_name || '-'}</td><td>${g.weight} ct</td><td class="fw-bold">$${g.price}</td>
                    <td><span class="badge ${badgeClass}">${g.status}</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="viewGem(${g.id})"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="prepareEdit(${g.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteGem(${g.id})"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            });
            tableHtml += `</tbody></table></div></div></div>`;
            container.innerHTML = tableHtml;
        }
    }

    function renderPagination(info) {
        document.getElementById('page-num').innerText = info.currentPage;
        document.getElementById('page-info').innerText = `Showing page ${info.currentPage} of ${info.totalPages || 1}`;
        document.getElementById('btn-prev').classList.toggle('disabled', info.currentPage <= 1);
        document.getElementById('btn-next').classList.toggle('disabled', info.currentPage >= info.totalPages);
    }
    
    function changePage(direction) {
        const newPage = currentPage + direction;
        if(newPage < 1 || newPage > totalPages) return;
        currentPage = newPage;
        loadData();
    }

    async function loadStats() {
        const res = await authFetch(`${API_URL}/stats`);
        if(!res) return;
        const data = await res.json();
        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        safeSet('stat-total', data.totalGems);
        safeSet('stat-cats', data.totalCategories);
        safeSet('stat-avail', data.availableGems);
        safeSet('stat-value', '$' + Number(data.totalValue).toLocaleString());
    }

    // --- 6. MANAGERS (Categories & Users) ---
    async function loadCategoryManager() {
        const res = await authFetch(`${API_URL}/categories`);
        if(!res) return;
        const data = await res.json();
        const list = document.getElementById('cat-manager-list');
        list.innerHTML = '';
        if (data.data.length === 0) { list.innerHTML = '<li class=\"list-group-item text-muted\">No categories found.</li>'; return; }
        data.data.forEach(cat => {
            const img = cat.image_url || 'https://via.placeholder.com/40';
            list.innerHTML += `
                <li class=\"list-group-item d-flex justify-content-between align-items-center\">
                    <div class=\"d-flex align-items-center\">
                        <img src=\"${img}\" class=\"rounded-circle me-3\" style=\"width: 40px; height: 40px; object-fit: cover; border: 1px solid #eee;\">
                        <span class=\"fw-bold\">${cat.name}</span>
                    </div>
                    <button class=\"btn btn-sm btn-outline-danger\" onclick=\"deleteCategory(${cat.id})\"><i class=\"bi bi-trash\"></i></button>
                </li>`;
        });
    }

    async function addCategory() {
        const nameInput = document.getElementById('new-cat-name');
        const fileInput = document.getElementById('new-cat-file');
        const name = nameInput.value.trim();
        if(!name) { showToast("Please enter a category name", "error"); return; }
        let imageUrl = "";
        if (fileInput.files.length > 0) {
            try { imageUrl = await compressImage(fileInput.files[0]); } 
            catch (error) { showToast("Error processing image", "error"); return; }
        }
        const res = await authFetch(`${API_URL}/categories`, { method: 'POST', body: JSON.stringify({ name, image_url: imageUrl }) });
        if(res.ok) {
            showToast("Category added successfully!");
            nameInput.value = ''; fileInput.value = '';
            loadCategoryManager();
            loadCategories();
        } else { showToast("Error adding category", "error"); }
    }

    async function loadUserManager() {
        const res = await authFetch(`${API_URL}/users`);
        if(!res) return;
        const data = await res.json();
        const list = document.getElementById('user-manager-list');
        list.innerHTML = '';
        if (data.data.length === 0) { list.innerHTML = '<div class=\"text-center p-3 text-muted\">No users found.</div>'; return; }
        data.data.forEach(u => {
            const avatar = (u.image_url && u.image_url.length > 10) ? u.image_url : `https://ui-avatars.com/api/?name=${u.username}&background=0D8ABC&color=fff`;
            list.innerHTML += `
                <div class=\"list-group-item d-flex justify-content-between align-items-center py-3\">
                    <div class=\"d-flex align-items-center\">
                        <img src=\"${avatar}\" class=\"user-avatar me-3\" style=\"width: 50px; height: 50px; object-fit: cover; border-radius: 50%; border: 2px solid #eee;\">
                        <div><h6 class=\"mb-0 fw-bold\">${u.username}</h6><small class=\"text-muted\">Joined: ${new Date(u.created_at).toLocaleDateString()}</small></div>
                    </div>
                    <button class=\"btn btn-sm btn-outline-danger\" onclick=\"deleteUser(${u.id})\"><i class=\"bi bi-trash-fill\"></i> Remove</button>
                </div>`;
        });
    }

    async function addUser() {
        const u = document.getElementById('new-username').value;
        const p = document.getElementById('new-password').value;
        const fileInput = document.getElementById('new-user-file');
        if(!u || !p) { showToast("Username and Password are required", "error"); return; }
        let imageUrl = "";
        if (fileInput.files.length > 0) imageUrl = await compressImage(fileInput.files[0]);
        const res = await authFetch(`${API_URL}/users`, { method: 'POST', body: JSON.stringify({ username: u, password: p, image_url: imageUrl }) });
        if(res.ok) {
            showToast("User created successfully!");
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            fileInput.value = '';
            loadUserManager(); 
        } else { showToast("Error creating user", "error"); }
    }
    

    // --- 7. UTILS & HELPERS ---
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            if (file.size < 1 * 1024 * 1024) { 
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxWidth = 1920; 
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/webp', 0.85));
                };
            };
            reader.onerror = (error) => reject(error);
        });
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const colorClass = type === 'success' ? 'bg-success' : 'bg-danger';
        const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
        const toastId = 'toast-' + Date.now();
        const html = `
            <div id="${toastId}" class="toast align-items-center text-white ${colorClass} border-0 mb-2 show" role="alert">
                <div class="d-flex"><div class="toast-body d-flex align-items-center">
                <i class="bi ${icon} me-2 fs-5"></i>${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" onclick="this.parentElement.parentElement.remove()"></button></div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
        setTimeout(() => {
            const el = document.getElementById(toastId);
            if(el) { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }
        }, 3000);
    }

    // --- 8. ACTION HANDLERS ---
    function openModal() {
        selectedImages = []; 
        document.getElementById('media-preview').innerHTML = '';
        document.getElementById('gem-id').value = '';
        ['gem-name','gem-weight','gem-dims','gem-price','gem-desc','gem-files','gem-video-file'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        document.getElementById('modalTitle').innerText = 'Add New Gem';
        gemModal.show();
    }

    async function prepareEdit(id) {
        // 1. INSTANT LOAD
        const g = currentGems.find(item => item.id === id);
        if (!g) return;

        // 2. Populate Text Fields
        document.getElementById('gem-id').value = g.id;
        document.getElementById('gem-name').value = g.name || '';
        document.getElementById('gem-category').value = g.category_id || '';
        document.getElementById('gem-weight').value = g.weight || '';
        document.getElementById('gem-dims').value = g.dimensions || '';
        document.getElementById('gem-price').value = g.price || '';
        document.getElementById('gem-status').value = g.status || 'Available';
        document.getElementById('gem-desc').value = g.description || '';
        
        document.getElementById('gem-files').value = '';
        document.getElementById('gem-video-file').value = '';

        selectedImages = []; 
        const previewContainer = document.getElementById('media-preview');
        previewContainer.innerHTML = `
            <div class="d-flex align-items-center text-muted mt-2">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                Loading existing images...
            </div>`;

        document.getElementById('modalTitle').innerText = 'Edit Gem';
        gemModal.show();

        try {
            const res = await authFetch(`${API_URL}/gems/${id}`);
            if (!res || !res.ok) {
                previewContainer.innerHTML = '<div class="text-danger small">Error loading media.</div>';
                return;
            }
            const fullGem = await res.json(); 

            previewContainer.innerHTML = ''; 
            let media = { images: [], video: "" };
            try { 
                media = (typeof fullGem.media === 'string') ? JSON.parse(fullGem.media) : (fullGem.media || {}); 
            } catch(e) { console.error(e); }
            
            if (media.images) {
                selectedImages = media.images.map((img, idx) => ({ data: img, isNew: false, originalIndex: idx }));
            } else if (fullGem.image_url) {
                selectedImages = [{ data: fullGem.image_url, isNew: false, originalIndex: 0 }];
            }

            if (media.video) {
                previewContainer.innerHTML = `
                    <div class="position-relative d-inline-block me-2 mb-2 bg-black rounded" style="width: 80px; height: 80px;">
                        <video src="${media.video}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;"></video>
                        <div class="position-absolute top-50 start-50 translate-middle text-white"><i class="bi bi-play-circle-fill"></i></div>
                        <span class="position-absolute bottom-0 start-0 w-100 text-center text-white bg-dark bg-opacity-75" style="font-size:10px;">Current Video</span>
                    </div>
                `;
                document.getElementById('gem-video-file').setAttribute('data-existing-video', media.video);
            } else {
                document.getElementById('gem-video-file').removeAttribute('data-existing-video');
            }
            renderPreviews();
        } catch (e) { 
            console.error("Media load error", e);
            previewContainer.innerHTML = '<div class="text-warning small">Could not load images.</div>';
        }
    }

    function renderPreviews() {
        const container = document.getElementById('media-preview');
        const videoPreview = container.querySelector('.bg-black');
        container.innerHTML = '';
        if(videoPreview) container.appendChild(videoPreview);

        selectedImages.forEach((imgObj, index) => {
            container.innerHTML += `
                <div class="position-relative d-inline-block me-2 mb-2">
                    <img src="${imgObj.data}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;">
                    <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 p-0" style="width:20px; height:20px; line-height:1;" onclick="removeSelectedImage(${index})">×</button>
                </div>`;
        });
    }

    function removeSelectedImage(index) {
        selectedImages.splice(index, 1);
        renderPreviews();
    }

    

    async function saveGem() {
        const id = document.getElementById('gem-id').value;
        const videoInput = document.getElementById('gem-video-file');
        const videoFile = videoInput.files[0];
        
        // 1. Get existing video path so we don't lose it
        const existingVideo = videoInput.getAttribute('data-existing-video') || "";

        // 2. Separate Images (Safety Logic)
        const existingImages = selectedImages
            .filter(img => !img.isNew)
            .map(img => img.data)
            .filter(url => typeof url === 'string' && !url.startsWith('data:'));

        const newImages = selectedImages.filter(img => img.isNew).map(img => img.data);

        const totalSteps = 1 + newImages.length + (videoFile ? 1 : 0);
        let currentStep = 0;

        const updateProgress = (msg) => {
            currentStep++;
            const percent = Math.round((currentStep / totalSteps) * 100);
            document.getElementById('upload-progress-bar').style.width = `${percent}%`;
            document.getElementById('progress-text').innerText = msg;
        };

        progressModal.show();
        document.querySelector('#uploadProgressModal h4').innerText = "Saving Gem...";
        updateProgress("Saving gem details...");

        const gem = {
            name: document.getElementById('gem-name').value,
            category_id: document.getElementById('gem-category').value,
            weight: document.getElementById('gem-weight').value,
            dimensions: document.getElementById('gem-dims').value,
            price: document.getElementById('gem-price').value,
            status: document.getElementById('gem-status').value,
            description: document.getElementById('gem-desc').value,
            media: { images: existingImages, video: videoFile ? "" : existingVideo } 
        };

        try {
            // STEP 1: Save Text Data
            const res = await authFetch(id ? `${API_URL}/gems/${id}` : `${API_URL}/gems`, { 
                method: id ? 'PUT' : 'POST', 
                body: JSON.stringify(gem) 
            });
            
            if (!res || !res.ok) throw new Error("Failed to save data.");
            const data = await res.json();
            const targetId = id ? id : data.id;

            // STEP 2: Upload New Images (Sequential)
            for (let i = 0; i < newImages.length; i++) {
                document.getElementById('progress-text').innerText = `Uploading image ${i+1} of ${newImages.length}...`;
                await authFetch(`${API_URL}/gems/${targetId}/media`, {
                    method: 'PUT',
                    body: JSON.stringify({ image: newImages[i] })
                });
                updateProgress(`Image ${i+1} uploaded.`);
            }

            // STEP 3: Upload Video
            if (videoFile) {
                document.getElementById('progress-text').innerText = "Processing video...";
                const videoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(videoFile);
                });
                await authFetch(`${API_URL}/gems/${targetId}/media`, {
                    method: 'PUT',
                    body: JSON.stringify({ video: videoBase64 })
                });
                updateProgress("Video uploaded.");
            }

            // --- 🚀 INSTANT UI UPDATE (Optimistic Rendering) ---
            
            const catSelect = document.getElementById('gem-category');
            const catName = catSelect.options[catSelect.selectedIndex].text;

            let displayImage = 'https://via.placeholder.com/300x150?text=No+Image';
            if (selectedImages.length > 0) {
                displayImage = selectedImages[0].data;
            }

            const localGem = {
                id: Number(targetId),
                name: gem.name,
                category_id: gem.category_id,
                category_name: catName,
                weight: gem.weight,
                price: gem.price,
                status: gem.status,
                image_url: displayImage,
                media: { images: [displayImage], video: '' } 
            };

            if (id) {
                const index = currentGems.findIndex(g => g.id == targetId);
                if (index !== -1) currentGems[index] = { ...currentGems[index], ...localGem };
            } else {
                currentGems.unshift(localGem);
            }

            renderData(currentGems);

            progressModal.hide();
            gemModal.hide();
            const numericId = Number(targetId);
            if (gemCache.has(numericId)) gemCache.delete(numericId);
            
            selectedImages = [];
            showToast("Saved successfully!");

            loadData().then(() => {}); 
            loadStats().then(() => {}); 

        } catch (error) {
            console.error(error);
            progressModal.hide();
            showToast("Error occurred: " + error.message, "error");
        }
    }

    function deleteGem(id) { deleteTargetId = id; deleteType = 'gem'; document.getElementById('delete-msg-text').innerText = "Delete this gem permanently?"; deleteModal.show(); }
    function deleteCategory(id) { deleteTargetId = id; deleteType = 'category'; document.getElementById('delete-msg-text').innerText = "Delete this category?"; deleteModal.show(); }
    function deleteUser(id) { deleteTargetId = id; deleteType = 'user'; document.getElementById('delete-msg-text').innerText = "Remove this admin user?"; deleteModal.show(); }
    function showOrders() { showSection('orders'); }
    function showCompanyProfile() { showSection('company'); }

    async function confirmDeleteAction() {
        if (!deleteTargetId || !deleteType) return;
        let url = '';
        if (deleteType === 'gem') url = `${API_URL}/gems/${deleteTargetId}`;
        else if (deleteType === 'category') url = `${API_URL}/categories/${deleteTargetId}`;
        else if (deleteType === 'user') url = `${API_URL}/users/${deleteTargetId}`;
        else if (deleteType === 'order') url = `${API_URL}/orders/${deleteTargetId}`;
        const res = await authFetch(url, { method: 'DELETE' });
        if (res.ok) {
            showToast("Item deleted.");
            deleteModal.hide();
            if (deleteType === 'gem') {
                    // 🚀 1. INSTANT UI UPDATE (Optimistic)
                    currentGems = currentGems.filter(g => g.id !== deleteTargetId);
                    
                    renderData(currentGems);
                    
                    if (gemCache.has(deleteTargetId)) gemCache.delete(deleteTargetId);

                    loadStats(); 
                    loadData();  
            }else if (deleteType === 'category') { loadCategoryManager(); loadCategories(); }
            else if (deleteType === 'user') loadUserManager();
            else if (deleteType === 'order') { loadOrders(); loadOrderStats(); } // 🚀 ADD THIS LINE
        } else {
            const data = await res.json();
            showToast(data.error || "Error deleting item.", "error");
            deleteModal.hide();
        }
        deleteTargetId = null;
    }

    // Fetch and apply branding globally
    async function applyGlobalBranding() {
        try {
            const res = await fetch(`${API_URL}/company`);
            if (!res.ok) return;
            const data = await res.json();
            
            const safeSetText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
            const safeSetImg = (id, val) => { const el = document.getElementById(id); if(el) el.src = val; };

            safeSetText('dynamic-mobile-name', data.name);
            safeSetText('dynamic-sidebar-name1', data.name);
            safeSetText('dynamic-sidebar-name2', data.name);
            safeSetImg('dynamic-login-logo', data.logo_url);
        } catch (e) { console.error("Error loading branding", e); }
    }

    // Load data into the settings form
    async function loadCompanyProfileForm() {
        const res = await authFetch(`${API_URL}/company`);
        if (res && res.ok) {
            const data = await res.json();
            document.getElementById('company-name-input').value = data.name;
            document.getElementById('company-logo-preview').src = data.logo_url;
            document.getElementById('company-logo-input').value = ''; 
        }
    }

    // Save settings
    async function saveCompanyProfile() {
        const name = document.getElementById('company-name-input').value.trim();
        const fileInput = document.getElementById('company-logo-input');
        
        if (!name) { showToast("Company name is required", "error"); return; }

        // 🚀 1. SHOW MODAL & UPDATE TEXT
        const modalTitle = document.querySelector('#uploadProgressModal h4');
        if (modalTitle) modalTitle.innerText = "Saving Company Profile...";
        document.getElementById('progress-text').innerText = "Please wait, saving company information...";
        document.getElementById('upload-progress-bar').style.width = "50%"; // Fake progress jump for UX
        progressModal.show();

        let logoBase64 = null;
        if (fileInput.files.length > 0) {
            try {
                logoBase64 = await compressImage(fileInput.files[0]);
            } catch (err) { 
                progressModal.hide(); // Hide if image processing fails
                showToast("Error processing image", "error"); 
                return; 
            }
        }

        try {
            document.getElementById('upload-progress-bar').style.width = "85%";
            
            const res = await authFetch(`${API_URL}/company`, {
                method: 'PUT',
                body: JSON.stringify({ name, logoBase64 })
            });
            
            document.getElementById('upload-progress-bar').style.width = "100%";
            
            // 🚀 2. HIDE MODAL (With a tiny 500ms delay so the user sees it hit 100%)
            setTimeout(() => {
                progressModal.hide();
                if (res.ok) {
                    showToast("Company profile updated!");
                    applyGlobalBranding(); 
                    loadCompanyProfileForm(); 
                } else {
                    showToast("Failed to update profile", "error");
                }
            }, 500);

        } catch (e) { 
            progressModal.hide();
            showToast("Connection error", "error"); 
        }
    }

    async function viewGem(id) {
        // 1. INSTANT FEEDBACK
        const g = currentGems.find(item => item.id === id);
        if (!g) return;

        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val || ''; };
        safeSet('view-name', g.name);
        safeSet('view-category', g.category_name);
        safeSet('view-price', `$${g.price || 0}`);
        safeSet('view-weight', `${g.weight || 0} ct`);
        safeSet('view-dims', g.dimensions || 'N/A');
        safeSet('view-desc', g.description);
        
        const statusEl = document.getElementById('view-status');
        if(statusEl) {
            statusEl.innerText = g.status || 'Available';
            statusEl.className = g.status === 'Sold' ? 'fw-bold text-danger' : 'fw-bold text-success';
        }

        const carouselInner = document.getElementById('carousel-items');
        carouselInner.innerHTML = `
            <div class="carousel-item active">
                <div class="d-block w-100 rounded skeleton" style="height: 275px;"></div>
            </div>`;

        viewModal.show();

        let fullGemData;
        if (gemCache.has(id)) {
            fullGemData = gemCache.get(id);
        } else {
            try {
                const res = await authFetch(`${API_URL}/gems/${id}`);
                if (res && res.ok) {
                    fullGemData = await res.json();
                    gemCache.set(id, fullGemData);
                }
            } catch (e) { console.error("Background fetch error", e); }
        }

        if (fullGemData) {
            renderViewCarousel(fullGemData);
        }
    }

    function renderViewCarousel(g) {
        let media = { images: [], video: "" };
        try { 
            media = typeof g.media === 'string' ? JSON.parse(g.media) : (g.media || {}); 
        } catch(e) { 
            if(g.image_url) media.images = [g.image_url]; 
        }

        const carouselInner = document.getElementById('carousel-items');
        carouselInner.innerHTML = ''; 
        let hasSlides = false;

        if (media.images && media.images.length > 0) {
            media.images.forEach((imgSrc, index) => {
                carouselInner.innerHTML += `
                    <div class="carousel-item ${index === 0 ? 'active' : ''}">
                        <div class="d-flex align-items-center justify-content-center bg-light rounded" style="height: 300px;">
                            <img src="${imgSrc}" class="d-block w-100 h-100" style="object-fit: contain;">
                        </div>
                    </div>`;
            });
            hasSlides = true;
        } 

        if (media.video) {
            const activeClass = !hasSlides ? 'active' : '';
            carouselInner.innerHTML += `
                <div class="carousel-item ${activeClass}">
                    <div class="d-flex align-items-center justify-content-center bg-black rounded" style="height: 300px;">
                        <video controls class="w-100" style="max-height: 100%; object-fit: contain;">
                            <source src="${media.video}" type="video/mp4">
                        </video>
                    </div>
                </div>`;
            hasSlides = true;
        }

        if (!hasSlides) {
            carouselInner.innerHTML = `
                <div class="carousel-item active">
                    <div class="d-flex align-items-center justify-content-center bg-light rounded text-muted" style="height: 300px;">
                        <div>No Media Available</div>
                    </div>
                </div>`; 
        }
    }

    // --- 9. STARTUP (Run Immediately) ---
async function initApp() {
    applyGlobalBranding();
    // 1. Initialize Modals (🚀 SAFETY CHECK: Only init if element exists)
    const gemModalEl = document.getElementById('gemModal');
    if (gemModalEl) gemModal = new bootstrap.Modal(gemModalEl);

    const viewModalEl = document.getElementById('viewGemModal');
    if (viewModalEl) viewModal = new bootstrap.Modal(viewModalEl);

    const delModalEl = document.getElementById('deleteConfirmModal');
    if (delModalEl) deleteModal = new bootstrap.Modal(delModalEl);

    const progModalEl = document.getElementById('uploadProgressModal');
    if (progModalEl) progressModal = new bootstrap.Modal(progModalEl);

    const ordModalEl = document.getElementById('orderModal');
    if (ordModalEl) orderModal = new bootstrap.Modal(ordModalEl);

    const vOrdModalEl = document.getElementById('viewOrderModal');
    if (vOrdModalEl) viewOrderModal = new bootstrap.Modal(vOrdModalEl);

    // Order File input listener
    const orderFileInput = document.getElementById('order-files');
    if (orderFileInput) {
        orderFileInput.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            if (selectedOrderImages.length + files.length > 5) { 
                showToast("Maximum 5 images allowed.", "error"); return; 
            }
            for (const file of files) {
                try {
                    const base64 = await compressImage(file);
                    selectedOrderImages.push({ data: base64, isNew: true });
                } catch (err) {}
            }
            renderOrderPreviews();
        });
    }


    // 2. Sidebar Logic
    const sidebar = document.getElementById('sidebarMenu');
    if (sidebar) {
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (sidebar.classList.contains('show')) {
                    bootstrap.Offcanvas.getInstance(sidebar).hide();
                }
            });
        });
    }

    // 3. File Input Listener
    const fileInput = document.getElementById('gem-files');
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            if (selectedImages.length + files.length > 10) { 
                showToast("Maximum 10 images allowed.", "error"); 
                return; 
            }
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`Skipped ${file.name}: File too large (Max 10MB)`, "error");
                    continue;
                }
                try {
                    const base64 = await compressImage(file);
                    selectedImages.push({ data: base64, isNew: true });
                } catch (err) { showToast("Error processing image", "error"); }
            }
            renderPreviews();
        });
    }

    // 4. Check Login & Load Data
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const res = await fetch(`${API_URL}/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { showDashboard(); } 
            else { logout(); }
        } catch (e) { console.error(e); showLogin(); }
    } else { showLogin(); }
}

// Call it
initApp();