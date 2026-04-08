const gallery = document.getElementById('movie-gallery');
const chartSection = document.getElementById('chart-section');

// Fitur: Sticky Navigation Scroll Effect
window.addEventListener('scroll', () => {
    const nav = document.getElementById('topNav');
    if (window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
});

document.addEventListener('DOMContentLoaded', () => {
    loadPopularMovies();
    loadChart();
});

let currentPage = 1;
let currentSearchQuery = '';

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        currentSearchQuery = document.getElementById('search-input').value.trim();
        currentPage = 1;
        searchMovies();
    }
}

function loadMore() {
    currentPage++;
    if (currentSearchQuery) {
        searchMovies(true);
    } else {
        loadPopularMovies(true);
    }
}

// Fitur: Toast Notification (Pengganti pesan error teks merah)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'error' ? 'alert-circle' : 'check-circle';
    toast.innerHTML = `<i data-lucide="${icon}" style="width:18px;height:18px;color:${type==='error'?'#ef4444':'#10b981'}"></i> ${message}`;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Fitur: Skeleton Loading (Pengganti Spinner)
function renderSkeleton(count = 10) {
    gallery.innerHTML = '';
    for(let i=0; i<count; i++) {
        gallery.innerHTML += `<div class="skeleton skeleton-card"></div>`;
    }
}

// Fitur: Premium Empty State
function renderEmptyState(query) {
    gallery.innerHTML = `
        <div class="empty-state">
            <i data-lucide="film"></i>
            <h3>No results found</h3>
            <p>We couldn't find any matches for "${query}". Try checking for typos or using different keywords.</p>
        </div>
    `;
    lucide.createIcons();
}

async function searchMovies(append = false) {
    if (!append) {
        currentSearchQuery = document.getElementById('search-input').value.trim();
        currentPage = 1;
    }
    const query = currentSearchQuery;
    if (!query) {
        currentPage = 1;
        return loadPopularMovies();
    }

    document.getElementById('gallery-title').innerHTML = `<i data-lucide="search" style="margin-right:8px;"></i> Results for "${query}"`;
    lucide.createIcons(); 
    
    if (!append) renderSkeleton(8);
    document.getElementById('load-more-btn').classList.add('hidden');

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${currentPage}`);
        const data = await res.json();
        
        if (!append) gallery.innerHTML = ''; // Hapus skeleton
        
        if (data.results && data.results.length > 0) {
            renderMovies(data.results);
            if (data.page < data.total_pages) {
                document.getElementById('load-more-btn').classList.remove('hidden');
            }
        } else if (!append) {
            renderEmptyState(query);
        }
    } catch (err) {
        if (!append) gallery.innerHTML = '';
        showToast('A connection error occurred while searching.', 'error');
    }
}

async function loadPopularMovies(append = false) {
    if (!append) {
        currentPage = 1;
        currentSearchQuery = '';
        document.getElementById('gallery-title').innerHTML = `<i data-lucide="zap" style="margin-right:8px;"></i> Trending Now`;
        lucide.createIcons();
        renderSkeleton(10);
    }
    document.getElementById('load-more-btn').classList.add('hidden');

    try {
        const res = await fetch(`/api/data?page=${currentPage}`);
        const data = await res.json();
        
        if (!append) gallery.innerHTML = ''; // Hapus skeleton
        
        if (data.results && data.results.length > 0) {
            renderMovies(data.results);
            if (data.page < data.total_pages) {
                document.getElementById('load-more-btn').classList.remove('hidden');
            }
        }
    } catch (err) {
        if (!append) gallery.innerHTML = '';
        showToast('Failed to load popular movies.', 'error');
    }
}

let ratingChartObj = null;

async function loadChart() {
    chartSection.style.display = 'block';
    const loader = document.getElementById('chart-loader');
    
    try {
        const res = await fetch('/api/chart/ratings');
        const data = await res.json();
        loader.classList.add('hidden');
        
        if (data.results && data.results.length > 0) {
            renderChart(data.results);
        } else {
            document.getElementById('ratingChart').style.display = 'none';
            loader.outerHTML = '<p style="color:var(--text-muted)">Failed to load chart data (Empty).</p>';
        }
    } catch (err) {
        loader.classList.add('hidden');
        document.getElementById('ratingChart').style.display = 'none';
        console.error("Failed to load chart:", err);
    }
}

function renderChart(moviesData) {
    const ctx = document.getElementById('ratingChart').getContext('2d');
    
    if (ratingChartObj) {
        ratingChartObj.destroy();
    }

    const labels = moviesData.map(m => m.title);
    const dataScores = moviesData.map(m => m.rating);
    
    // Monochrome Premium Chart Style
    const bgColors = dataScores.map(() => 'rgba(255, 255, 255, 0.9)');
    const hoverBgColors = dataScores.map(() => 'rgba(255, 255, 255, 1)');

    ratingChartObj = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rating',
                data: dataScores,
                backgroundColor: bgColors,
                hoverBackgroundColor: hoverBgColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#18181b',
                    titleColor: '#fff',
                    bodyColor: '#a1a1aa',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) { return ` Score: ${context.parsed.y}`; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 10,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#a1a1aa' }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#a1a1aa', maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
}

function renderMovies(movies) {
    movies.forEach((movie, index) => {
        const posterUrl = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';

        const safeTitle = movie.title.replace(/'/g, "\\'");
        
        // Fitur: Staggered Animation (Delay berdasarkan urutan kartu)
        const animationDelay = (index * 0.05) + 's';

        const html = `
            <div class="movie-card animate-fade-in" style="animation-delay: ${animationDelay};">
                <div style="position:relative; width:100%; aspect-ratio:2/3; overflow:hidden;">
                    <img src="${posterUrl}" alt="${movie.title}">
                    
                    <div class="card-overlay">
                        <button class="btn-action primary" onclick="watchTrailer(${movie.id}, '${safeTitle}')">
                            <i data-lucide="play" style="width: 14px; height: 14px; fill: currentColor;"></i> Trailer
                        </button>
                        <button class="btn-action" onclick="getRecommendations(${movie.id}, '${safeTitle}')">
                            <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Similar
                        </button>
                        <button class="btn-action" onclick="getReviews(${movie.id}, '${safeTitle}')">
                            <i data-lucide="bar-chart-2" style="width: 14px; height: 14px;"></i> Sentiment
                        </button>
                    </div>
                </div>
                <div class="movie-info">
                    <h3>${movie.title}</h3>
                    <p><i data-lucide="star" style="width: 12px; height: 12px; fill: currentColor;"></i> ${movie.vote_average.toFixed(1)}</p>
                </div>
            </div>
        `;
        gallery.innerHTML += html;
    });
    
    lucide.createIcons();
}

// Modal Logic
const modal = document.getElementById('modal');
function openModal(title, content) {
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-body').innerHTML = content;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Kunci scroll background saat modal terbuka
    lucide.createIcons();
}
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    setTimeout(() => { document.getElementById('modal-body').innerHTML = ''; }, 300);
}

// Fitur: Trailer
async function watchTrailer(movieId, title) {
    openModal(`<i data-lucide="film"></i> Trailer: ${title}`, '<div class="loader"></div><p style="text-align:center; color:var(--text-muted)">Loading media...</p>');
    try {
        const res = await fetch(`/api/trailer/${movieId}`);
        const data = await res.json();
        
        if (data.trailer_key) {
            document.getElementById('modal-body').innerHTML = `
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 1px solid var(--border-color); max-width: 100%;">
                    <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/${data.trailer_key}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            `;
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="text-align:center; padding: 20px; color:var(--text-muted)">Sorry, no official trailer found.</p>';
        }
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:var(--danger); text-align:center;">Failed to load trailer.</p>';
    }
}

// Fitur: Recommendation
async function getRecommendations(movieId, title) {
    openModal(`<i data-lucide="sparkles"></i> Recommendations for "${title}"`, '<div class="loader"></div><p style="text-align:center; color:var(--text-muted)">MRMP Brain is analyzing text semantics...</p>');
    
    try {
        const res = await fetch(`/api/recommendations/${movieId}`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            let html = `<div class="movie-gallery" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px;">`;
            data.results.forEach(m => {
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Img';
                html += `
                    <div style="background: var(--bg-card); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color);">
                        <img src="${poster}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; display:block;">
                        <div style="padding: 12px;">
                            <h4 style="margin:0 0 4px 0; font-size: 0.85rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</h4>
                            <p style="margin:0; font-size: 0.75rem; color: var(--text-muted); display:flex; align-items:center; gap:4px;"><i data-lucide="star" style="width:10px;height:10px;fill:currentColor;"></i> ${m.vote_average.toFixed(1)}</p>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            document.getElementById('modal-body').innerHTML = html;
            lucide.createIcons();
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="color:var(--text-muted)">Did not find a similar movie.</p>';
        }
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:var(--danger)">An error occurred while searching for recommendations.</p>';
    }
}

// Fitur: Sentiment
async function getReviews(movieId, title) {
    openModal(`<i data-lucide="bar-chart-2"></i> Sentiment Analysis: "${title}"`, '<div class="loader"></div><p style="text-align:center; color:var(--text-muted)">MRMP is reading and summarizing reviews...</p>');
    
    try {
        const res = await fetch(`/api/reviews/${movieId}`);
        const data = await res.json();
        
        if (data.total === 0) {
            document.getElementById('modal-body').innerHTML = '<p style="color:var(--text-muted)">No reviews found in the database.</p>';
            return;
        }

        let html = `
            <div style="margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size: 0.9rem;">
                    <span style="color:var(--text-muted)">Analyzed <b>${data.total}</b> reviews</span>
                    <span style="color:var(--text-main); font-weight:600;">${data.positive_percentage}% Positive</span>
                </div>
                <div style="width: 100%; height: 8px; background: #3f3f46; border-radius: 999px; overflow: hidden;">
                    <div style="height: 100%; width: ${data.positive_percentage}%; background: #fff; border-radius: 999px;"></div>
                </div>
            </div>
        `;

        if (data.ai_summary && data.ai_summary.ringkasan) {
            let aiHtml = `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 24px; border-radius: 16px; margin: 24px 0;">
                <h4 style="margin: 0 0 12px 0; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 1rem;">
                    <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i> Executive Summary
                </h4>
                <p style="margin: 0 0 20px 0; font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">
                    ${data.ai_summary.ringkasan}
                </p>
            `;
            
            if (data.ai_summary.kelebihan && data.ai_summary.kelebihan.length > 0) {
                aiHtml += `<h5 style="margin: 0 0 8px 0; color: #fff; font-size: 0.9rem;">Pros</h5><ul style="margin: 0 0 16px 0; padding-left: 20px; color: var(--text-muted); font-size: 0.9rem;">`;
                data.ai_summary.kelebihan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            if (data.ai_summary.kekurangan && data.ai_summary.kekurangan.length > 0) {
                aiHtml += `<h5 style="margin: 0 0 8px 0; color: #fff; font-size: 0.9rem;">Cons</h5><ul style="margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 0.9rem;">`;
                data.ai_summary.kekurangan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            
            aiHtml += `</div>`;
            html += aiHtml;
        }

        if (data.reviews.length > 0) {
            html += '<h3 style="margin-top: 32px; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">Review Snippets</h3><div style="display:flex; flex-direction:column; gap:16px; margin-top:20px;">';
            data.reviews.forEach(r => {
                let iconStr = r.sentiment === 'Positive' ? '<i data-lucide="check-circle" style="width:14px;height:14px;"></i>' : '<i data-lucide="x-circle" style="width:14px;height:14px;"></i>';
                html += `
                    <div style="padding: 20px; border-radius: 16px; border: 1px solid var(--border-color); background: transparent;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center;">
                            <span style="font-weight: 600; color: #fff; font-size: 0.95rem;">${r.author}</span>
                            <span style="font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; display: flex; align-items: center; gap: 4px; font-weight: 500; ${r.sentiment === 'Positive' ? 'background: rgba(16, 185, 129, 0.1); color: #34d399;' : 'background: rgba(239, 68, 68, 0.1); color: #f87171;'}">${iconStr} ${r.sentiment}</span>
                        </div>
                        <div style="font-size:0.95rem; color:var(--text-muted); line-height: 1.6;">${r.content}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // RAG Chat
        html += `
            <div style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px;">
                <div style="font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:4px;"><i data-lucide="bot" style="width:18px;height:18px;"></i> Ask MRMP</div>
                <p style="font-size: 0.85rem; color:var(--text-muted); margin-top:0;">Answers derived strictly from audience reviews context.</p>
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <input type="text" id="qa-input-${movieId}" placeholder="e.g. Is the visual effect good?" style="flex:1; padding:14px 16px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); color:white; outline:none; font-family:'Inter', sans-serif;">
                    <button onclick="askAI(${movieId})" style="padding:0 20px; border-radius:12px; background:var(--accent); color:var(--accent-black); border:none; font-weight:600; cursor:pointer; transition:opacity 0.2s;">Ask</button>
                </div>
                <div id="qa-result-${movieId}" style="display:none; padding:16px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-main); font-size:0.95rem; line-height:1.6; margin-top:16px;"></div>
            </div>
        `;
        
        document.getElementById('modal-body').innerHTML = html;
        lucide.createIcons();
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:var(--danger)">An error occurred while processing sentiment.</p>';
    }
}

async function askAI(movieId) {
    const inputField = document.getElementById(`qa-input-${movieId}`);
    const resultBox = document.getElementById(`qa-result-${movieId}`);
    const question = inputField.value.trim();
    
    if (!question) return;
    
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; color:var(--text-muted); font-size:0.85rem;"><i data-lucide="corner-down-right" style="width:14px;height:14px;"></i> Generating response...</div><span id="stream-content-${movieId}"></span><div class="loader" style="width:12px;height:12px;border-width:2px;display:inline-block;margin:0 0 0 8px;"></div>`;
    lucide.createIcons();
    
    const contentBox = document.getElementById(`stream-content-${movieId}`);
    
    try {
        const res = await fetch(`/api/qa/${movieId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        });

        if (!res.ok) {
            resultBox.innerHTML = `<span style="color:var(--danger);">Error: Request failed</span>`;
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    try {
                        const dataStr = line.replace('data: ', '').trim();
                        if (!dataStr) continue;
                        const parsed = JSON.parse(dataStr);
                        if (parsed.error) {
                            aiResponse += `<span style="color:var(--danger);">${parsed.error}</span>`;
                        } else if (parsed.text) {
                            aiResponse += parsed.text;
                            contentBox.innerHTML = aiResponse.replace(/\n/g, '<br/>');
                        }
                    } catch(e) {
                        // pass
                    }
                }
            }
        }
        
        resultBox.querySelectorAll('.loader').forEach(el => el.remove());
        
    } catch (err) {
        resultBox.innerHTML = `<span style="color:var(--danger);">Failed to connect to MRMP brain.</span>`;
    }
}