const gallery = document.getElementById('movie-gallery');
        const chartSection = document.getElementById('chart-section');
        const chartContainer = document.getElementById('chart-container');
        const galleryLoader = document.getElementById('gallery-loader');

        document.addEventListener('DOMContentLoaded', () => {
            loadPopularMovies();
            loadChart();
        });

        // ==========================
        // FITUR 2: Pencarian Film & Pagination
        // ==========================
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

            document.getElementById('gallery-title').innerText = `Search Results: "${query}"`;
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
                    gallery.innerHTML = '<p>No film found.</p>';
                }
            } catch (err) {
                console.error(err);
                galleryLoader.classList.add('hidden');
                if (!append) gallery.innerHTML = '<p style="color:red">A search error occurred.</p>';
            }
        }

        async function loadPopularMovies(append = false) {
            if (!append) {
                currentPage = 1;
                currentSearchQuery = '';
                document.getElementById('gallery-title').innerText = 'The Most Popular Movie Right Now';
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
                if (!append) gallery.innerHTML = '<p style="color:red">Failed to load popular movies..</p>';
            }
        }

        // ==========================
        // FITUR 3: Grafik Analitik Rating (dengan Chart.js)
        // ==========================
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
                    loader.outerHTML = '<p>Gagal memuat data grafik (Kosong).</p>';
                }
            } catch (err) {
                loader.classList.add('hidden');
                document.getElementById('ratingChart').style.display = 'none';
                console.error("Gagal memuat chart:", err);
            }
        }

        function renderChart(moviesData) {
            const ctx = document.getElementById('ratingChart').getContext('2d');
            
            // Hapus chart lama jika ada (agar tidak tumpang tindih)
            if (ratingChartObj) {
                ratingChartObj.destroy();
            }

            const labels = moviesData.map(m => m.title);
            const dataScores = moviesData.map(m => m.rating);
            
            // Buat warna cerah untuk dark theme
            const bgColors = dataScores.map(score => {
                if (score >= 8) return 'rgba(34, 197, 94, 0.7)'; // Hijau
                if (score >= 7) return 'rgba(59, 130, 246, 0.7)'; // Biru
                return 'rgba(234, 179, 8, 0.7)'; // Kuning
            });

            ratingChartObj = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Average Rating',
                        data: dataScores,
                        backgroundColor: bgColors,
                        borderColor: bgColors.map(c => c.replace('0.7', '1')),
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) { return ` Rating: ${context.parsed.y}`; }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 10,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
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

                const html = `
                    <div class="movie-card">
                        <img src="${posterUrl}" alt="${movie.title}">
                        <div class="movie-info">
                            <h3>${movie.title}</h3>
                            <p>⭐ ${movie.vote_average.toFixed(1)} / 10</p>
                            <div class="card-actions">
                                <button class="btn btn-ml" onclick="getRecommendations(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">🔮 Similar Recommendations</button>
                                <button class="btn btn-review" onclick="getReviews(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">💬 Sentiment Analysis</button>
                                <button class="btn btn-ml" style="background:#ef4444; border-color:#ef4444; color:white; margin-top:5px; width:100%;" onclick="watchTrailer(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">🎬 Watch Trailer</button>
                            </div>
                        </div>
                    </div>
                `;
                gallery.innerHTML += html;
            });
        }

        // Modal Logic
        const modal = document.getElementById('modal');
        function openModal(title, content) {
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-body').innerHTML = content;
            modal.classList.add('active');
        }
        function closeModal() {
            modal.classList.remove('active');
            // Matikan video jika ada iframe
            document.getElementById('modal-body').innerHTML = '';
        }
        
        // ==========================
        // FITUR BARU: TONTON TRAILER
        // ==========================
        async function watchTrailer(movieId, title) {
            openModal(`Trailer: ${title}`, '<div class="loader"></div><p style="text-align:center">Memuat trailer...</p>');
            try {
                const res = await fetch(`/api/trailer/${movieId}`);
                const data = await res.json();
                
                if (data.trailer_key) {
                    document.getElementById('modal-body').innerHTML = `
                        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
                            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/${data.trailer_key}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        </div>
                    `;
                } else {
                    document.getElementById('modal-body').innerHTML = '<p style="text-align:center; padding: 20px;">Maaf, trailer resmi tidak ditemukan untuk film ini.</p>';
                }
            } catch (err) {
                document.getElementById('modal-body').innerHTML = '<p style="color:red; text-align:center;">Terjadi kesalahan saat memuat trailer.</p>';
            }
        }

        // ==========================
        // FITUR 4: Rekomendasi ML
        // ==========================
        async function getRecommendations(movieId, title) {
            openModal(`Looking for Recommendations for "${title}"...`, '<div class="loader"></div><p style="text-align:center">MRMP brain (cerebrum/serebrum) is analyzing...</p>');
            
            try {
                const res = await fetch(`/api/recommendations/${movieId}`);
                const data = await res.json();
                
                if (data.results && data.results.length > 0) {
                    let html = `<p>Based on synopsis matching (text analysis), you might like:</p><div class="movie-gallery" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">`;
                    data.results.forEach(m => {
                        const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Img';
                        html += `
                            <div class="movie-card" style="font-size:0.8rem">
                                <img src="${poster}">
                                <div style="padding:10px">
                                    <h4 style="margin:0 0 5px 0">${m.title}</h4>
                                    <p style="margin:0">⭐ ${m.vote_average.toFixed(1)}</p>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                    document.getElementById('modal-body').innerHTML = html;
                } else {
                    document.getElementById('modal-body').innerHTML = '<p>Did not find a similar movie.</p>';
                }
            } catch (err) {
                document.getElementById('modal-body').innerHTML = '<p>An error occurred while searching for recommendations.</p>';
            }
        }

        // ==========================
        // FITUR 5: Analisis Sentimen & AI Groq
        // ==========================
        async function getReviews(movieId, title) {
            // Ubah teks loading untuk memberitahu bahwa AI Groq sedang bekerja
            openModal(`Sentiment Analysis: "${title}"`, '<div class="loader"></div><p style="text-align:center">MRMP is reading all the reviews and summarizing them for you...</p>');
            
            try {
                const res = await fetch(`/api/reviews/${movieId}`);
                const data = await res.json();
                
                if (data.total === 0) {
                    document.getElementById('modal-body').innerHTML = '<p>No reviews found in the database.</p>';
                    return;
                }

                let html = `
                    <p>Total reviews analyzed: <b>${data.total}</b></p>
                    <div class="sentiment-bar">
                        <div class="sentiment-positive" style="width: ${data.positive_percentage}%">${data.positive_percentage}% Positif</div>
                        <div class="sentiment-negative" style="width: ${data.negative_percentage}%">${data.negative_percentage}% Negatif</div>
                    </div>
                `;

                // FITUR BARU: Menampilkan Box Ringkasan AI dari Groq JSON
                if (data.ai_summary && data.ai_summary.ringkasan) {
                    let aiHtml = `
                    <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); padding: 15px; border-radius: 12px; margin: 20px 0;">
                        <h4 style="margin: 0 0 10px 0; color: #60a5fa; display: flex; align-items: center; gap: 8px;">
                            ✨ MRMP Executive Summary
                        </h4>
                        <p style="margin: 0 0 10px 0; font-size: 0.95rem; line-height: 1.5; color: #e2e8f0;">
                            ${data.ai_summary.ringkasan}
                        </p>
                    `;
                    
                    if (data.ai_summary.kelebihan && data.ai_summary.kelebihan.length > 0) {
                        aiHtml += `<h5 style="margin: 10px 0 5px 0; color: #86efac; font-size: 0.9rem;">Kelebihan:</h5><ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 0.85rem; list-style-type: '✅ ';">`;
                        data.ai_summary.kelebihan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                        aiHtml += `</ul>`;
                    }
                    if (data.ai_summary.kekurangan && data.ai_summary.kekurangan.length > 0) {
                        aiHtml += `<h5 style="margin: 10px 0 5px 0; color: #fca5a5; font-size: 0.9rem;">Kekurangan:</h5><ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 0.85rem; list-style-type: '❌ ';">`;
                        data.ai_summary.kekurangan.forEach(item => { aiHtml += `<li style="margin-bottom:4px;">${item}</li>`; });
                        aiHtml += `</ul>`;
                    }
                    
                    aiHtml += `</div>`;
                    html += aiHtml;
                }

                if ((data.top_positive_keywords && data.top_positive_keywords.length > 0) || (data.top_negative_keywords && data.top_negative_keywords.length > 0)) {
                    html += `<div class="keyword-container"><p style="margin:0 0 5px 0;font-weight:bold;font-size:0.9rem">✨ Highlight Words</p>`;
                    if (data.top_positive_keywords.length > 0) {
                        html += `<div class="keyword-row"><span class="keyword-label">Positive:</span>`;
                        data.top_positive_keywords.forEach(word => { html += `<span class="keyword-badge pos">${word}</span>`; });
                        html += `</div>`;
                    }
                    if (data.top_negative_keywords.length > 0) {
                        html += `<div class="keyword-row"><span class="keyword-label">Negative:</span>`;
                        data.top_negative_keywords.forEach(word => { html += `<span class="keyword-badge neg">${word}</span>`; });
                        html += `</div>`;
                    }
                    html += `</div>`;
                }

                if (data.reviews.length > 0) {
                    html += '<h3>Review Snippets:</h3>';
                    data.reviews.forEach(r => {
                        html += `
                            <div class="review-item ${r.sentiment}">
                                <div class="review-header">
                                    <span class="review-author">${r.author}</span>
                                    <span class="review-badge ${r.sentiment}">${r.sentiment} (Pol: ${r.polarity})</span>
                                </div>
                                <div style="font-size:0.9rem; color:#cbd5e1;">${r.content}</div>
                            </div>
                        `;
                    });
                }
                
                // FITUR BARU: Mini-RAG Chat UI
                html += `
                    <div style="margin-top: 30px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                        <h4 style="margin: 0 0 10px 0; color:#38bdf8;">🤖 Ask MRMP (Based on These Reviews)</h4>
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" id="qa-input-${movieId}" placeholder="Example: Is the visual effect good?" style="flex:1; padding:10px; border-radius:4px; border:1px solid #334155; background:#1e293b; color:white;">
                            <button onclick="askAI(${movieId})" style="padding:10px 20px; border-radius:4px; background:#3b82f6; color:white; border:none; cursor:pointer;">Ask</button>
                        </div>
                        <div id="qa-result-${movieId}" style="display:none; padding:15px; border-radius:8px; background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.3); color:#e2e8f0; font-size:0.9rem; line-height:1.5;"></div>
                    </div>
                `;
                
                document.getElementById('modal-body').innerHTML = html;
            } catch (err) {
                document.getElementById('modal-body').innerHTML = '<p>An error occurred while processing sentiment.</p>';
            }
        }

        async function askAI(movieId) {
            const inputField = document.getElementById(`qa-input-${movieId}`);
            const resultBox = document.getElementById(`qa-result-${movieId}`);
            const question = inputField.value.trim();
            
            if (!question) return;
            
            resultBox.style.display = 'block';
            resultBox.innerHTML = `<strong>MRMP Answer:</strong><br/><span id="stream-content-${movieId}"></span><span class="loader" style="width:10px;height:10px;border-width:2px;display:inline-block;margin-left:5px;"></span>`;
            const contentBox = document.getElementById(`stream-content-${movieId}`);
            
            try {
                const res = await fetch(`/api/qa/${movieId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: question })
                });

                if (!res.ok) {
                    resultBox.innerHTML = `<span style="color:#fca5a5;">Error: Request failed</span>`;
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
                                    aiResponse += `<span style="color:#fca5a5;">${parsed.error}</span>`;
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
                resultBox.innerHTML = `<span style="color:#fca5a5;">Failed to connect to MRMP brain.</span>`;
            }
        }