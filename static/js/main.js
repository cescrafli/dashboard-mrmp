const gallery = document.getElementById('movie-gallery');
const chartSection = document.getElementById('chart-section');
const chartContainer = document.getElementById('chart-container');
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

    document.getElementById('gallery-title').innerHTML = `<i data-lucide="search" style="margin-right:8px;"></i> Search Results: "${query}"`;
    lucide.createIcons(); // Re-render icon
    
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
            gallery.innerHTML = '<p style="color:var(--text-muted)">No film found.</p>';
        }
    } catch (err) {
        console.error(err);
        galleryLoader.classList.add('hidden');
        if (!append) gallery.innerHTML = '<p style="color:var(--danger)">A search error occurred.</p>';
    }
}

async function loadPopularMovies(append = false) {
    if (!append) {
        currentPage = 1;
        currentSearchQuery = '';
        document.getElementById('gallery-title').innerHTML = `<i data-lucide="trending-up" style="margin-right:8px;"></i> Trending Now`;
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
        if (!append) gallery.innerHTML = '<p style="color:var(--danger)">Failed to load popular movies.</p>';
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
            loader.outerHTML = '<p>Failed to load chart data (Empty).</p>';
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
    
    const bgColors = dataScores.map(score => {
        if (score >= 8) return 'rgba(16, 185, 129, 0.8)'; 
        if (score >= 7) return 'rgba(59, 130, 246, 0.8)'; 
        return 'rgba(234, 179, 8, 0.8)'; 
    });

    ratingChartObj = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Rating',
                data: dataScores,
                backgroundColor: bgColors,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#a1a1aa',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) { return ` Rating: ${context.parsed.y}`; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 10,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a1a1aa' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a1a1aa', maxRotation: 45, minRotation: 45 }
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
                <img src="${posterUrl}" alt="${movie.title}">
                <div class="card-overlay">
                    <div class="movie-info">
                        <h3>${movie.title}</h3>
                        <p><i data-lucide="star" style="width: 14px; height: 14px; fill: currentColor;"></i> ${movie.vote_average.toFixed(1)} / 10</p>
                        <div class="card-actions">
                            <button class="btn-action" onclick="getRecommendations(${movie.id}, '${safeTitle}')" title="Similar Recommendations">
                                <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i> Similar
                            </button>
                            <button class="btn-action" onclick="getReviews(${movie.id}, '${safeTitle}')" title="Sentiment Analysis">
                                <i data-lucide="message-square-text" style="width: 16px; height: 16px;"></i> Analysis
                            </button>
                            <button class="btn-action full" onclick="watchTrailer(${movie.id}, '${safeTitle}')">
                                <i data-lucide="play" style="width: 16px; height: 16px; fill: currentColor;"></i> Watch Trailer
                            </button>
                        </div>
                    </div>
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
    lucide.createIcons();
}
function closeModal() {
    modal.classList.remove('active');
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
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; max-width: 100%;">
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
            let html = `<p style="color:var(--text-muted); margin-bottom: 20px;">Based on synopsis matching, you might like:</p><div class="movie-gallery" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;">`;
            data.results.forEach(m => {
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Img';
                html += `
                    <div class="movie-card" style="border-radius: 12px;">
                        <img src="${poster}" style="border-radius: 12px;">
                        <div class="card-overlay" style="padding: 10px;">
                            <h4 style="margin:0 0 4px 0; font-size: 0.9rem; color: #fff;">${m.title}</h4>
                            <p style="margin:0; font-size: 0.8rem; color: #eab308; display:flex; align-items:center; gap:4px;"><i data-lucide="star" style="width:12px;height:12px;fill:currentColor;"></i> ${m.vote_average.toFixed(1)}</p>
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                <span style="color:var(--text-muted)">Analyzed <b>${data.total}</b> reviews</span>
                <span style="font-size:0.85rem; color:var(--text-muted)">${data.positive_percentage}% Positive</span>
            </div>
            <div class="sentiment-bar">
                <div class="sentiment-positive" style="width: ${data.positive_percentage}%"></div>
            </div>
        `;

        if (data.ai_summary && data.ai_summary.ringkasan) {
            let aiHtml = `
            <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.3); padding: 20px; border-radius: 16px; margin: 25px 0;">
                <h4 style="margin: 0 0 12px 0; color: #60a5fa; display: flex; align-items: center; gap: 8px; font-size: 1.05rem;">
                    <i data-lucide="zap" style="width: 18px; height: 18px;"></i> AI Executive Summary
                </h4>
                <p style="margin: 0 0 16px 0; font-size: 0.95rem; line-height: 1.6; color: #e2e8f0;">
                    ${data.ai_summary.ringkasan}
                </p>
            `;
            
            if (data.ai_summary.kelebihan && data.ai_summary.kelebihan.length > 0) {
                aiHtml += `<h5 style="margin: 12px 0 8px 0; color: #34d399; font-size: 0.9rem; display:flex; align-items:center; gap:6px;"><i data-lucide="thumbs-up" style="width:14px; height:14px;"></i> Pros</h5><ul style="margin: 0; padding-left: 24px; color: #cbd5e1; font-size: 0.9rem;">`;
                data.ai_summary.kelebihan.forEach(item => { aiHtml += `<li style="margin-bottom:6px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            if (data.ai_summary.kekurangan && data.ai_summary.kekurangan.length > 0) {
                aiHtml += `<h5 style="margin: 16px 0 8px 0; color: #f87171; font-size: 0.9rem; display:flex; align-items:center; gap:6px;"><i data-lucide="thumbs-down" style="width:14px; height:14px;"></i> Cons</h5><ul style="margin: 0; padding-left: 24px; color: #cbd5e1; font-size: 0.9rem;">`;
                data.ai_summary.kekurangan.forEach(item => { aiHtml += `<li style="margin-bottom:6px;">${item}</li>`; });
                aiHtml += `</ul>`;
            }
            
            aiHtml += `</div>`;
            html += aiHtml;
        }

        if ((data.top_positive_keywords && data.top_positive_keywords.length > 0) || (data.top_negative_keywords && data.top_negative_keywords.length > 0)) {
            html += `<div class="keyword-container"><p style="margin:0 0 8px 0; font-weight:600; font-size:0.95rem; display:flex; align-items:center; gap:6px;"><i data-lucide="hash" style="width:16px;height:16px;"></i> Highlight Words</p>`;
            if (data.top_positive_keywords.length > 0) {
                html += `<div class="keyword-row"><span class="keyword-label">Positive:</span>`;
                data.top_positive_keywords.forEach(word => { html += `<span class="keyword-badge pos"><i data-lucide="plus" style="width:12px;height:12px;"></i> ${word}</span>`; });
                html += `</div>`;
            }
            if (data.top_negative_keywords.length > 0) {
                html += `<div class="keyword-row"><span class="keyword-label">Negative:</span>`;
                data.top_negative_keywords.forEach(word => { html += `<span class="keyword-badge neg"><i data-lucide="minus" style="width:12px;height:12px;"></i> ${word}</span>`; });
                html += `</div>`;
            }
            html += `</div>`;
        }

        if (data.reviews.length > 0) {
            html += '<h3 style="margin-top: 30px; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Review Snippets</h3>';
            data.reviews.forEach(r => {
                let iconStr = r.sentiment === 'Positive' ? '<i data-lucide="smile" style="width:14px;height:14px;"></i>' : '<i data-lucide="frown" style="width:14px;height:14px;"></i>';
                html += `
                    <div class="review-item">
                        <div class="review-header">
                            <span class="review-author">${r.author}</span>
                            <span class="review-badge ${r.sentiment}">${iconStr} ${r.sentiment}</span>
                        </div>
                        <div style="font-size:0.95rem; color:#d4d4d8; line-height: 1.6;">${r.content}</div>
                    </div>
                `;
            });
        }
        
        // RAG Chat
        html += `
            <div style="margin-top: 30px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 12px 0; color:#38bdf8; display:flex; align-items:center; gap:8px;"><i data-lucide="bot" style="width:18px;height:18px;"></i> Ask MRMP AI</h4>
                <p style="font-size: 0.85rem; color:var(--text-muted); margin-top:0;">Answers based entirely on user reviews context.</p>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="qa-input-${movieId}" placeholder="e.g. Is the visual effect good?" style="flex:1; padding:12px 16px; border-radius:12px; border:1px solid #334155; background:var(--bg-card); color:white; outline:none; font-family:'Inter', sans-serif;">
                    <button onclick="askAI(${movieId})" style="padding:12px 24px; border-radius:12px; background:var(--accent); color:white; border:none; cursor:pointer; font-weight:600; transition:background 0.2s;">Ask</button>
                </div>
                <div id="qa-result-${movieId}" style="display:none; padding:20px; border-radius:12px; background:rgba(56, 189, 248, 0.05); border:1px solid rgba(56, 189, 248, 0.2); color:#e2e8f0; font-size:0.95rem; line-height:1.6; margin-top:15px;"></div>
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
    resultBox.innerHTML = `<div style="font-weight:600; color:#38bdf8; margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i data-lucide="sparkles" style="width:16px;height:16px;"></i> MRMP Answer:</div><span id="stream-content-${movieId}"></span><span class="loader" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-left:8px;margin-top:0;"></span>`;
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