
// ══════════════════════════════════════════════════
//  MEDIBUDDY SHORTS — YouTube Data API v3
//  Strictly medical content only
// ══════════════════════════════════════════════════
const API_BASE = 'http://127.0.0.1:3000'; // change this when you deploy

const SHORTS_CONFIG = {

    // Strict medical search terms — rotated randomly each session
    QUERIES: [
        'CPR how to first aid short',
        'medical facts health tips short',
        'first aid emergency short',
        'how to stop bleeding first aid',
        'heart attack symptoms first aid',
        'stroke symptoms FAST method',
        'heimlich maneuver choking',
        'wound care first aid',
        'diabetes management tips',
        'blood pressure explained',
        'how vaccines work short',
        'anatomy facts short',
        'NHS health tips',
        'Mayo Clinic health short',
        'WHO health awareness',
    ],

    // Trusted medical channel IDs
    TRUSTED_CHANNELS: [
        'UCsT0YIqwnpJCM-mx7-gSA4Q', // TEDx Health
        'UCEufcs_ZbBKlarFpqYiNXqg', // Mayo Clinic
        'UCUZM4GrufxoJCBBIq6pa8Vg', // WHO
        'UC6107grRI4m0o2-emgoDnAA', // SciShow
    ],

    MAX_RESULTS: 10,
};


// ── State ─────────────────────────────────────────

const shortsState = {
    videos: [],
    currentIndex: 0,
    player: null,
    loading: false,
    touchStartY: 0,
};


// ── Init (called when Shorts tab opens) ──────────

async function initShorts() {

    if (shortsState.videos.length) {
        renderShortsPlayer();
        return;
    }

    await fetchMedicalShorts();
}


// ── Fetch medical shorts through our backend ─────

async function fetchMedicalShorts() {

    shortsState.loading = true;
    renderShortsLoading();

    const query =
        SHORTS_CONFIG.QUERIES[
            Math.floor(Math.random() * SHORTS_CONFIG.QUERIES.length)
        ];

    try {

        // The API key stays safely inside .env on the backend.
        const resp = await fetch(
            `http://127.0.0.1:3000/api/medical-shorts?q=${encodeURIComponent(query)}`
        );

        const data = await resp.json();

        if (!resp.ok || data.error) {
            throw new Error(
                data.error || 'YouTube API request failed'
            );
        }

        shortsState.videos = (data.items || []).map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail:
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.default?.url,
        }));

        if (!shortsState.videos.length) {
            throw new Error('No videos found');
        }

        shortsState.currentIndex = 0;
        shortsState.loading = false;

        renderShortsPlayer();

    } catch (err) {

        shortsState.loading = false;

        renderShortsError(
            'fetch-failed',
            err.message
        );
    }
}


// ── Render: Loading State ─────────────────────────

function renderShortsLoading() {

    document.getElementById('shorts-container').innerHTML = `
        <div class="shorts-loading">
            <div class="shorts-spinner"></div>
            <div class="shorts-loading-text">
                Finding medical content…
            </div>
        </div>
    `;
}


// ── Render: Error State ───────────────────────────

function renderShortsError(type, msg) {

    const container =
        document.getElementById('shorts-container');

    container.innerHTML = `
        <div class="shorts-error">
            <div class="shorts-error-icon">⚠️</div>

            <div class="shorts-error-title">
                Could not load videos
            </div>

            <div class="shorts-error-body">
                ${msg || 'Check your internet connection.'}
            </div>

            <button
                class="btn btn-primary"
                style="margin-top:20px;"
                onclick="fetchMedicalShorts()"
            >
                🔄 Retry
            </button>
        </div>
    `;
}


// ── Render: Main Player ───────────────────────────

function renderShortsPlayer() {

    const container =
        document.getElementById('shorts-container');

    const v =
        shortsState.videos[shortsState.currentIndex];

    const total =
        shortsState.videos.length;

    const idx =
        shortsState.currentIndex;


    container.innerHTML = `

        <!-- Progress dots -->

        <div class="shorts-dots">

            ${shortsState.videos.map((_, i) => `
                <div
                    class="shorts-dot ${i === idx ? 'active' : ''}"
                    onclick="goToShort(${i})">
                </div>
            `).join('')}

        </div>


        <!-- Video iframe -->

        <div class="shorts-video-wrap">

            <iframe
                id="shortsIframe"
                src="https://www.youtube.com/embed/${v.id}?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1&controls=1"
                allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                frameborder="0">
            </iframe>

        </div>


        <!-- Info overlay -->

        <div class="shorts-info">

            <div class="shorts-tag">
                🩺 Medical
            </div>

            <div class="shorts-title">
                ${v.title}
            </div>

            <div class="shorts-channel">
                📺 ${v.channel}
            </div>

        </div>


        <!-- Navigation arrows -->

        <button
            class="shorts-nav shorts-nav-up ${idx === 0 ? 'disabled' : ''}"
            onclick="navigateShort(-1)"
            title="Previous">

            ▲

        </button>


        <button
            class="shorts-nav shorts-nav-down ${idx === total - 1 ? 'disabled' : ''}"
            onclick="navigateShort(1)"
            title="Next">

            ▼

        </button>


        <!-- Counter -->

        <div class="shorts-counter">
            ${idx + 1} / ${total}
        </div>


        <!-- Refresh button -->

        <button
            class="shorts-refresh"
            onclick="fetchMedicalShorts()"
            title="Load new videos">

            🔄

        </button>

    `;


    // ── Touch/swipe support ───────────────────────

    const player =
        document.getElementById('shortsPlayer');

    if (player) {

        player.addEventListener(
            'touchstart',
            e => {
                shortsState.touchStartY =
                    e.touches[0].clientY;
            },
            { passive: true }
        );


        player.addEventListener(
            'touchend',
            e => {

                const diff =
                    shortsState.touchStartY -
                    e.changedTouches[0].clientY;

                if (Math.abs(diff) > 50) {
                    navigateShort(
                        diff > 0 ? 1 : -1
                    );
                }

            },
            { passive: true }
        );

    }


    // ── Keyboard support ─────────────────────────

    document.onkeydown = e => {

        if (
            typeof state !== 'undefined' &&
            state.currentPage !== 'shorts'
        ) {
            return;
        }

        if (e.key === 'ArrowDown') {
            navigateShort(1);
        }

        if (e.key === 'ArrowUp') {
            navigateShort(-1);
        }

    };

}


// ── Navigate between shorts ───────────────────────

function navigateShort(dir) {

    const next =
        shortsState.currentIndex + dir;

    if (
        next < 0 ||
        next >= shortsState.videos.length
    ) {
        return;
    }

    shortsState.currentIndex = next;


    const player =
        document.getElementById('shortsPlayer');

    if (player) {

        player.style.transform =
            `translateY(${dir > 0 ? '-60px' : '60px'})`;

        player.style.opacity = '0';

        player.style.transition =
            'transform 0.22s ease, opacity 0.22s ease';


        setTimeout(
            () => renderShortsPlayer(),
            220
        );

    } else {

        renderShortsPlayer();

    }

}


// ── Go directly to a short ────────────────────────

function goToShort(index) {

    if (
        index < 0 ||
        index >= shortsState.videos.length
    ) {
        return;
    }


    const dir =
        index > shortsState.currentIndex
            ? 1
            : -1;

    shortsState.currentIndex = index;


    const player =
        document.getElementById('shortsPlayer');

    if (player) {

        player.style.transform =
            `translateY(${dir > 0 ? '-60px' : '60px'})`;

        player.style.opacity = '0';

        player.style.transition =
            'transform 0.22s ease, opacity 0.22s ease';


        setTimeout(
            () => renderShortsPlayer(),
            220
        );

    } else {

        renderShortsPlayer();

    }

}

