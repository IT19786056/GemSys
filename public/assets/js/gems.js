// --- 1. CONFIGURATION ---
// const API_URL = 'http://localhost:3000/api'; // Localhost
const API_URL = '/api'; // Live Server

// --- 2. GLOBAL VARIABLES ---
let allGems = [];
let iso;
let viewModal;
const gemCache = new Map();

// Fetch and apply branding
fetch(`${API_URL}/company`)
    .then(res => res.json())
    .then(data => {
        const logo = document.getElementById('dynamic-main-logo');
        if (logo && data.logo_url) logo.src = data.logo_url;
        document.title = `${data.name} - Inventory`;
    })
    .catch(err => console.error("Branding error", err));

// --- 3. MAIN INITIALIZATION (Runs when HTML is ready) ---
document.addEventListener('DOMContentLoaded', async () => {
    // A. Init Modal
    const modalEl = document.getElementById('viewGemModal');
    if (modalEl) viewModal = new bootstrap.Modal(modalEl);

    // B. Setup "All Gems" Filter Button
    const allBtn = document.querySelector('[data-filter="*"]');
    if (allBtn) {
        allBtn.addEventListener('click', function() {
            const active = document.querySelector('.portfolio-filters .filter-active');
            if (active) active.classList.remove('filter-active');
            this.classList.add('filter-active');
            if (iso) iso.arrange({ filter: '*' });
        });
    }

    // C. Load Data
    await loadFilters();
    await loadGems();
});

// --- 4. DATA FUNCTIONS ---
async function loadFilters() {
    try {
        const res = await fetch(`${API_URL}/categories`);
        const json = await res.json();
        const container = document.getElementById('category-filters');

        if (container) {
            json.data.forEach(cat => {
                const li = document.createElement('li');
                li.setAttribute('data-filter', `.filter-cat-${cat.id}`);
                li.innerHTML = `
              <div class="p-center">
                <div class="story-icon">
                  <img src="${cat.image_url || 'assets/img/favicon.png'}" alt="${cat.name}" />
                </div>
              </div>
              <span class="mt-2 text-white" style="font-weight:500;">${cat.name}</span> `;

                li.addEventListener('click', function() {
                    const active = document.querySelector('.portfolio-filters .filter-active');
                    if (active) active.classList.remove('filter-active');
                    this.classList.add('filter-active');
                    const filterValue = this.getAttribute('data-filter');
                    if (iso) iso.arrange({ filter: filterValue });
                });
                container.appendChild(li);
            });
        }
    } catch (e) {
        console.error("Error loading categories", e);
    }
}

// 🚀 SKELETON RENDERER
function renderSkeleton() {
    const container = document.getElementById('portfolio-container');
    if (!container) return;
    
    // Clear existing content (like the loading spinner)
    container.innerHTML = ''; 

    // Create 8 skeleton cards (adjust number if needed)
    for(let i=0; i<8; i++) {
        container.innerHTML += `
        <div class="col-lg-3 col-md-4 col-sm-6 portfolio-item">
            <div class="gem-card shadow-sm h-100" style="background: #2a2a2a; border: 1px solid #444;">
                <div class="skeleton skeleton-img"></div>
                <div class="gem-info p-3">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 30%;"></div>
                </div>
            </div>
        </div>`;
    }
}

async function loadGems() {
    try {
        renderSkeleton();
        const res = await fetch(`${API_URL}/gems?limit=500&sort=recent`);
        const json = await res.json();
        if (!json.data) return;

        allGems = json.data;
        const container = document.getElementById('portfolio-container');

        const loader = document.getElementById('loading-msg');
        if (loader) loader.remove();

        if (container) {
            container.innerHTML = '';
            allGems.forEach(g => {
                const displayImg = g.image_url || 'assets/img/favicon.png';

                const div = document.createElement('div');
                div.className = `col-lg-3 col-md-4 col-sm-6 portfolio-item isotope-item filter-cat-${g.category_id}`;
                div.innerHTML = `
              <div class="gem-card shadow-sm h-100" onclick="openGemModal(${g.id})">
                  <div class="position-relative">
                      <img src="${displayImg}" class="img-fluid" alt="${g.name}" loading="lazy">
                      <span class="position-absolute top-0 end-0 badge bg-dark m-2">${g.status || 'Available'}</span>
                  </div>
                  <div class="gem-info">
                      <h4 class="text-truncate">${g.name}</h4>
                      <p class="text-muted mb-1 small">${g.category_name || 'Gem'} • ${g.weight}ct</p>
                      <div class="gem-price">$${g.price || '0'}</div>
                  </div>
              </div>
          `;
                container.appendChild(div);
            });
            // Initialize Isotope AFTER items are added
            initIsotope();
        }

    } catch (e) {
        console.error("Error loading gems:", e);
    }
}

function initIsotope() {
    const grid = document.querySelector('.isotope-container');
    if (grid) {
        imagesLoaded(grid, function() {
            iso = new Isotope(grid, {
                itemSelector: '.isotope-item',
                layoutMode: 'masonry',
                percentPosition: true
            });

            iso.on('arrangeComplete', function(filteredItems) {
                const msg = document.getElementById('no-gems-msg');
                if (msg) {
                    filteredItems.length === 0 ? msg.classList.remove('d-none') : msg.classList.add('d-none');
                }
            });

            if (typeof AOS !== 'undefined') AOS.init();
        });
    }
}

// --- 5. MODAL FUNCTIONS ---
window.openGemModal = async function(id) {
    const g = allGems.find(item => item.id === id);
    if (!g) return;

    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val || '';
    };
    safeSet('view-name', g.name);
    safeSet('view-category', g.category_name || 'Gem');
    safeSet('view-price', `$${g.price || 0}`);
    safeSet('view-weight', `${g.weight || 0} ct`);
    safeSet('view-dims', g.dimensions || 'N/A');
    safeSet('view-desc', g.description || '');

    const statusEl = document.getElementById('view-status');
    if (statusEl) {
        statusEl.innerText = g.status || 'Available';
        statusEl.className = g.status === 'Sold' ? 'fw-bold text-danger' : 'fw-bold text-success';
    }

    const carouselInner = document.getElementById('carousel-items');
    if (carouselInner) {
        carouselInner.innerHTML = `
            <div class="carousel-item active">
                <div class="d-block w-100 rounded skeleton" style="height: 275px;"></div>
            </div>`;
    }

    if (viewModal) viewModal.show();

    let fullGemData;
    if (gemCache.has(id)) {
        fullGemData = gemCache.get(id);
    } else {
        try {
            const res = await fetch(`${API_URL}/gems/${id}`);
            if (res.ok) {
                fullGemData = await res.json();
                gemCache.set(id, fullGemData);
            }
        } catch (e) {
            console.error("Error fetching media", e);
        }
    }

    if (fullGemData) {
        renderPublicCarousel(fullGemData);
    }
}

function renderPublicCarousel(g) {
    let media = {
        images: [],
        video: ""
    };
    try {
        media = typeof g.media === 'string' ? JSON.parse(g.media) : (g.media || {});
    } catch (e) {
        if (g.image_url) media.images = [g.image_url];
    }

    const carouselInner = document.getElementById('carousel-items');
    if (!carouselInner) return;

    carouselInner.innerHTML = '';
    let hasSlides = false;

    if (media.images && media.images.length > 0) {
        media.images.forEach((imgSrc, index) => {
            carouselInner.innerHTML += `
                       <div class="carousel-item ${index === 0 ? 'active' : ''}">
                           <img src="${imgSrc}" class="d-block w-100 rounded" style="max-height: 275px; object-fit: contain;">
                       </div>`;
        });
        hasSlides = true;
    }

    if (media.video) {
        const activeClass = !hasSlides ? 'active' : '';
        carouselInner.innerHTML += `
                 <div class="carousel-item ${activeClass}">
                     <div class="d-flex align-items-center justify-content-center bg-black rounded" style="height: 275px;">
                         <video controls class="w-100 h-100" style="object-fit: contain;">
                             <source src="${media.video}" type="video/mp4">
                         </video>
                     </div>
                 </div>`;
        hasSlides = true;
    }

    if (!hasSlides) {
        carouselInner.innerHTML = `
                <div class="carousel-item active">
                    <div class="d-flex align-items-center justify-content-center bg-light rounded text-muted" style="height: 275px;">
                        <div>No Media Available</div>
                    </div>
                </div>`;
    }
}

// --- 6. ANIMATIONS & UI LOGIC (Stars, Slider, Scroll) ---

// A. Star Background
const canvas = document.getElementById("star-bg");
if (canvas) {
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();
    const stars = [];
    const COLORS = [{
        r: 180,
        g: 200,
        b: 255
    }, {
        r: 255,
        g: 215,
        b: 140
    }, {
        r: 255,
        g: 255,
        b: 255
    }];
    for (let i = 0; i < 320; i++) {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.2 + 0.3,
            s: Math.random() * 1.1 + 0.3,
            o: Math.random() * 0.7 + 0.3,
            color: c
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let s of stars) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${s.color.r},${s.color.g},${s.color.b},${s.o})`;
            ctx.fill();
            s.y += s.s;
            if (s.y > canvas.height) {
                s.y = -5;
                s.x = Math.random() * canvas.width;
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}

// B. Drag Slider Logic
const slider = document.querySelector('.story-filters');
if (slider) {
    let isDown = false;
    let startX = 0;
    let currentX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let rafId;

    slider.style.scrollBehavior = 'auto';

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('dragging');
        startX = currentX = e.pageX;
        scrollLeft = slider.scrollLeft;
        velocity = 0;
        cancelAnimationFrame(rafId);
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const dx = e.pageX - currentX;
        currentX = e.pageX;
        velocity = dx * 0.8;
        slider.scrollLeft -= dx;
    });

    const endDrag = () => {
        if (!isDown) return;
        isDown = false;
        slider.classList.remove('dragging');
        applyMomentum();
    };

    slider.addEventListener('mouseup', endDrag);
    slider.addEventListener('mouseleave', endDrag);

    function applyMomentum() {
        slider.scrollLeft -= velocity;
        velocity *= 0.95;
        if (Math.abs(velocity) > 0.5) {
            rafId = requestAnimationFrame(applyMomentum);
        }
    }
}

// C. Scroll Top Logic
(function() {
    "use strict";
    const scrollTop = document.querySelector('#scroll-top');
    if (scrollTop) {
        const toggleScrollTop = () => {
            if (window.scrollY > 300) {
                scrollTop.classList.add('active');
            } else {
                scrollTop.classList.remove('active');
            }
        };
        window.addEventListener('load', toggleScrollTop);
        document.addEventListener('scroll', toggleScrollTop);
        scrollTop.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
})();