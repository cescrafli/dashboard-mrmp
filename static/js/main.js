const gallery = document.getElementById('movie-gallery');
const chartSection = document.getElementById('chart-section');
const galleryLoader = document.getElementById('gallery-loader');

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

    document.getElementById('gallery-title').innerHTML = `<i data-lucide="search"></i> Results for "${query}"`;
    lucide.createIcons();
    
    if (!append) gallery.innerHTML = '';
    galleryLoader.classList.remove('hidden');
    document.getElementById('load-more-btn').classList.add('hidden');

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${currentPage}`);
        const data = await res.json();
        galleryLoader.classList.add('hidden');
        
        if (data.results && data.results.length > 0) {
            renderMovies(data.results);
            if (data.page < data.total_pages) {
                document.getElementById('load-more-btn').classList.remove('hidden');
            }
        } else if (!append) {
            gallery.innerHTML = '<p style="color:var(--text-secondary); padding: 20px 0;">No films found matching your search.</p>';
        }
    } catch (err) {
        galleryLoader.classList.add('hidden');
        if (!append) gallery.innerHTML = '<p style="color:#f87171;">A search error occurred.</p>';
    }
}

async function loadPopularMovies(append = false) {
    if (!append) {
        currentPage = 1;
        currentSearchQuery = '';
        document.getElementById('gallery-title').innerHTML = `<i data-lucide="zap"></i> Trending Now`;
        lucide.createIcons();
        gallery.innerHTML = '';
    }
    galleryLoader.classList.remove('hidden');
    document.getElementById('load-more-btn').classList.add('hidden');

    try {
        const res = await fetch(`/api/data?page=${currentPage}`);
        const data = await res.json();
        galleryLoader.classList.add('hidden');
        if (data.results && data.results.length > 0) {
            renderMovies(data.results);
            if (data.page < data.total_pages) {
                document.getElementById('load-more-btn').classList.remove('hidden');
            }
        }
    } catch (err) {
        galleryLoader.classList.add('hidden');
        if (!append) gallery.innerHTML = '<p style="color:#f87171;">Failed to load popular movies.</p>';
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
            loader.outerHTML = '<p style="color:var(--text-secondary)">No chart data available.</p>';
        }
    } catch (err) {
        loader.classList.add('hidden');
        document.getElementById('ratingChart').style.display = 'none';
    }
}

function renderChart(moviesData) {
    const ctx = document.getElementById('ratingChart').getContext('2d');
    if (ratingChartObj) ratingChartObj.destroy();

    const labels = moviesData.map(m => m.title);
    const dataScores = moviesData.map(m => m.rating);
    
    // Monochrome Elegant Styling for Chart
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
                borderSkipped: false,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#18181b',
                    titleColor: '#fff',
                    bodyColor: '#a1a1aa',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: function(context) { return `Score: ${context.parsed.y}`; } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 10,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#a1a1aa', padding: 10 }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#a1a1aa', maxRotation: 45, minRotation: 45, padding: 10 }
                }
            }
        }
    });
}

function renderMovies(movies) {
    movies.forEach(movie => {
        const posterUrl = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';

        const safeTitle = movie.title.replace(/'/g, "\\'");

        const html = `
            <div class="movie-card">
                <div class="card-image-wrap">
                    <div class="rating-badge">
                        <i data-lucide="star" style="width: 12px; height: 12px; fill: currentColor;"></i> 
                        ${movie.vote_average.toFixed(1)}
                    </div>
                    <img src="${posterUrl}" alt="${movie.title}" loading="lazy">
                    
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
                </div>
            </div>
        `;
        gallery.innerHTML += html;
    });
    lucide.createIcons();
}

// Modal Management
const modal = document.getElementById('modal');
function openModal(title, content) {
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-body').innerHTML = content;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    lucide.createIcons();
}
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    setTimeout(() => { document.getElementById('modal-body').innerHTML = ''; }, 400);
}

// --- Features ---

async function watchTrailer(movieId, title) {
    openModal(`<i data-lucide="film"></i> ${title}`, '<div class="loader"></div>');
    try {
        const res = await fetch(`/api/trailer/${movieId}`);
        const data = await res.json();
        
        if (data.trailer_key) {
            document.getElementById('modal-body').innerHTML = `
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 1px solid var(--border-light);">
                    <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/${data.trailer_key}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            `;
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="color:var(--text-secondary); text-align:center;">Trailer not available.</p>';
        }
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:#f87171; text-align:center;">Failed to load trailer.</p>';
    }
}

async function getRecommendations(movieId, title) {
    openModal(`<i data-lucide="sparkles"></i> Similar to ${title}`, '<div class="loader"></div>');
    
    try {
        const res = await fetch(`/api/recommendations/${movieId}`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            let html = `<div class="movie-gallery" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px;">`;
            data.results.forEach(m => {
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Img';
                html += `
                    <div style="background: var(--bg-surface); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light);">
                        <img src="${poster}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; display:block;">
                        <div style="padding: 12px;">
                            <h4 style="margin:0 0 4px 0; font-size: 0.85rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</h4>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); display:flex; align-items:center; gap:4px;">
                                <i data-lucide="star" style="width:10px;height:10px;"></i> ${m.vote_average.toFixed(1)}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            document.getElementById('modal-body').innerHTML = html;
            lucide.createIcons();
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="color:var(--text-secondary)">No similar movies found.</p>';
        }
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:#f87171">Failed to fetch recommendations.</p>';
    }
}

async function getReviews(movieId, title) {
    openModal(`<i data-lucide="bar-chart-2"></i> Analysis: ${title}`, '<div class="loader"></div>');
    
    try {
        const res = await fetch(`/api/reviews/${movieId}`);
        const data = await res.json();
        
        if (data.total === 0) {
            document.getElementById('modal-body').innerHTML = '<p style="color:var(--text-secondary)">No reviews available for analysis.</p>';
            return;
        }

        let html = `
            <div style="margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-size: 0.9rem;">
                    <span style="color:var(--text-secondary)">Sentiment Distribution</span>
                    <span style="color:var(--text-primary); font-weight:600;">${data.positive_percentage}% Positive</span>
                </div>
                <div style="width: 100%; height: 8px; background: #3f3f46; border-radius: 999px; overflow: hidden;">
                    <div style="height: 100%; width: ${data.positive_percentage}%; background: #fff; border-radius: 999px;"></div>
                </div>
            </div>
        `;

        // AI Summary Box
        if (data.ai_summary && data.ai_summary.ringkasan) {
            let aiHtml = `
            <div class="ai-summary-box">
                <div class="ai-summary-title"><i data-lucide="sparkles" style="width: 16px; height: 16px;"></i> Executive Summary</div>
                <div class="ai-summary-text">${data.ai_summary.ringkasan}</div>
            `;
            
            if (data.ai_summary.kelebihan && data.ai_summary.kelebihan.length > 0) {
                aiHtml += `<div style="font-weight:600; font-size:0.9rem; margin-bottom:8px; color:#fff;">Pros</div><ul style="margin: 0 0 16px 0; padding-left: 20px; color: var(--text-secondary); font-size: 0.9rem;">`;
                data.ai_summary.kelebihan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            if (data.ai_summary.kekurangan && data.ai_summary.kekurangan.length > 0) {
                aiHtml += `<div style="font-weight:600; font-size:0.9rem; margin-bottom:8px; color:#fff;">Cons</div><ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 0.9rem;">`;
                data.ai_summary.kekurangan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            aiHtml += `</div>`;
            html += aiHtml;
        }

        // Snippets
        if (data.reviews.length > 0) {
            html += '<h3 style="font-size: 1.1rem; margin-top: 32px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">Review Snippets</h3><div class="review-list">';
            data.reviews.forEach(r => {
                let iconStr = r.sentiment === 'Positive' ? '<i data-lucide="check-circle" style="width:14px;height:14px;"></i>' : '<i data-lucide="x-circle" style="width:14px;height:14px;"></i>';
                html += `
                    <div class="review-item">
                        <div class="review-header">
                            <span class="review-author">${r.author}</span>
                            <span class="review-badge ${r.sentiment}">${iconStr} ${r.sentiment}</span>
                        </div>
                        <div class="review-content">${r.content}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Chat AI
        html += `
            <div style="margin-top: 32px; border-top: 1px solid var(--border-light); padding-top: 24px;">
                <div style="font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:4px;"><i data-lucide="bot" style="width:18px;height:18px;"></i> Ask MRMP</div>
                <p style="font-size: 0.85rem; color:var(--text-secondary); margin-top:0;">Answers derived strictly from audience reviews context.</p>
                
                <div class="chat-input-wrapper">
                    <input type="text" id="qa-input-${movieId}" placeholder="e.g. How is the CGI?">
                    <button onclick="askAI(${movieId})">Ask</button>
                </div>
                
                <div id="qa-result-${movieId}" style="display:none; padding:16px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid var(--border-light); color:var(--text-primary); font-size:0.95rem; line-height:1.6; margin-top:16px;"></div>
            </div>
        `;
        
        document.getElementById('modal-body').innerHTML = html;
        lucide.createIcons();
    } catch (err) {
        document.getElementById('modal-body').innerHTML = '<p style="color:#f87171;">Processing failed.</p>';
    }
}

async function askAI(movieId) {
    const inputField = document.getElementById(`qa-input-${movieId}`);
    const resultBox = document.getElementById(`qa-result-${movieId}`);
    const question = inputField.value.trim();
    if (!question) return;
    
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; color:var(--text-secondary); font-size:0.85rem;"><i data-lucide="corner-down-right" style="width:14px;height:14px;"></i> Generating response...</div><span id="stream-content-${movieId}"></span><div class="loader" style="width:12px;height:12px;border-width:2px;display:inline-block;margin:0 0 0 8px;"></div>`;
    lucide.createIcons();
    
    const contentBox = document.getElementById(`stream-content-${movieId}`);
    
    try {
        const res = await fetch(`/api/qa/${movieId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        });

        if (!res.ok) { resultBox.innerHTML = `<span style="color:#f87171;">Request failed</span>`; return; }

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
                            aiResponse += `<span style="color:#f87171;">${parsed.error}</span>`;
                        } else if (parsed.text) {
                            aiResponse += parsed.text;
                            contentBox.innerHTML = aiResponse.replace(/\n/g, '<br/>');
                        }
                    } catch(e) {}
                }
            }
        }
        resultBox.querySelectorAll('.loader').forEach(el => el.remove());
    } catch (err) {
        resultBox.innerHTML = `<span style="color:#f87171;">Connection failed.</span>`;
    }
}