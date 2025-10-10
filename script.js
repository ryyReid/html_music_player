document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('audio-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const githubLoadBtn = document.getElementById('github-load-btn');
    
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.querySelector('.progress-bar-wrapper');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const songTitle = document.getElementById('song-title');
    const songArtist = document.getElementById('song-artist');
    const albumArt = document.getElementById('album-art');

    const fileInput = document.getElementById('file-input');
    const playlistContainer = document.getElementById('playlist');
    const playlistTitle = document.getElementById('playlist-title');
    const searchBar = document.getElementById('search-bar');
    const volumeSlider = document.getElementById('volume-slider');

    let playlist = [];
    let currentSongIndex = -1;

    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', playNextSong);
    prevBtn.addEventListener('click', playPrevSong);
    volumeSlider.addEventListener('input', (e) => audioPlayer.volume = e.target.value);
    searchBar.addEventListener('keyup', filterPlaylist);
    fileInput.addEventListener('change', loadSongsFromLocal);
    githubLoadBtn.addEventListener('click', promptAndLoadFromGitHub);

    audioPlayer.addEventListener('play', () => playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>');
    audioPlayer.addEventListener('pause', () => playPauseBtn.innerHTML = '<i class="fas fa-play"></i>');
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', () => {
        const duration = audioPlayer.duration;
        totalTimeEl.textContent = formatTime(duration);
        if (currentSongIndex !== -1) {
            const currentPlaylistItem = playlistContainer.querySelector(`[data-index="${currentSongIndex}"]`);
            if (currentPlaylistItem) {
                currentPlaylistItem.querySelector('.playlist-item-duration').textContent = formatTime(duration);
            }
        }
    });
    audioPlayer.addEventListener('ended', playNextSong);
    progressContainer.addEventListener('click', setProgress);

    // --- Main Loading Functions ---
    function promptAndLoadFromGitHub() {
        const currentRepo = localStorage.getItem('githubRepoPath') || 'ryyReid/music/likedsongs';
        const repoPath = prompt('Enter GitHub path (e.g., user/repo/path/to/songs):', currentRepo);

        if (repoPath && repoPath.trim() !== '') {
            const trimmedPath = repoPath.trim();
            localStorage.setItem('githubRepoPath', trimmedPath);
            loadSongsFromGitHub(trimmedPath);
        }
    }

    function loadSongsFromGitHub(repoPath) {
        const parts = repoPath.split('/');
        if (parts.length < 3) {
            playlistContainer.innerHTML = '<p class="empty-playlist-msg">Invalid path format. Please use user/repo/path.</p>';
            return;
        }
        const user = parts[0];
        const repo = parts[1];
        const path = parts.slice(2).join('/');
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

        playlistContainer.innerHTML = '<p class="empty-playlist-msg">Loading from GitHub...</p>';
        playlistTitle.textContent = 'Songs';

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (!Array.isArray(data)) {
                    playlistContainer.innerHTML = `<p class="empty-playlist-msg">Error: ${data.message}</p>`;
                    return;
                }

                playlist = [];
                data.forEach(item => {
                    if (item.type === 'file' && (item.name.endsWith('.mp3') || item.name.endsWith('.wav') || item.name.endsWith('.ogg') || item.name.endsWith('.flac'))) {
                        const song = {
                            title: item.name.replace(/\.mp3|\.wav|\.ogg|\.flac/gi, ''),
                            artist: 'GitHub',
                            url: item.download_url
                        };
                        playlist.push(song);
                    }
                });

                renderPlaylist();
                if (playlist.length > 0) {
                    playlistTitle.textContent = 'Songs (GitHub)';
                    loadSong(0);
                } else {
                    playlistContainer.innerHTML = '<p class="empty-playlist-msg">No songs found in repository.</p>';
                }
            })
            .catch(error => {
                console.error('GitHub Fetch Error:', error);
                playlistContainer.innerHTML = '<p class="empty-playlist-msg">Could not load from GitHub.</p>';
            });
    }

    function loadSongsFromLocal(e) {
        const files = e.target.files;
        if (files.length === 0) return;
        playlist = [];
        currentSongIndex = -1;
        Array.from(files).forEach(file => {
            if (file.type.startsWith('audio/')) {
                const song = {
                    title: file.name.replace(/\.mp3|\.wav|\.ogg|\.flac/gi, ''),
                    artist: 'Local File',
                    url: URL.createObjectURL(file)
                };
                playlist.push(song);
            }
        });
        renderPlaylist();
        if (playlist.length > 0) {
            playlistTitle.textContent = 'Songs (Local)';
            loadSong(0);
        } else {
            playlistTitle.textContent = 'Songs';
            playlistContainer.innerHTML = '<p class="empty-playlist-msg">No audio files found.</p>';
        }
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = '';
        if (playlist.length === 0) {
            playlistTitle.textContent = 'Songs';
            playlistContainer.innerHTML = '<p class="empty-playlist-msg">No songs loaded. Use + or GitHub icon.</p>';
            return;
        }
        playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.classList.add('playlist-item');
            item.dataset.index = index;
            item.innerHTML = `
                <div class="playlist-item-art"><i class="fas fa-music"></i></div>
                <div class="playlist-item-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
                <div class="playlist-item-duration">--:--</div>
            `;
            item.addEventListener('click', () => playSong(index));
            playlistContainer.appendChild(item);
        });
    }

    // --- Player Control Functions ---
    function loadSong(index) {
        if (index < 0 || index >= playlist.length) return;
        currentSongIndex = index;
        const song = playlist[currentSongIndex];
        audioPlayer.src = song.url;
        songTitle.textContent = song.title;
        songArtist.textContent = song.artist;
        albumArt.style.backgroundImage = 'none';
        albumArt.innerHTML = '<i class="fas fa-music"></i>';
        updateActivePlaylistItem();
    }

    function playSong(index) {
        loadSong(index);
        audioPlayer.play();
    }

    function togglePlayPause() {
        if (currentSongIndex === -1) return;
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    }

    function playNextSong() {
        if (playlist.length === 0) return;
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        playSong(currentSongIndex);
    }

    function playPrevSong() {
        if (playlist.length === 0) return;
        currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
        playSong(currentSongIndex);
    }

    // --- UI Update Functions ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return '--:--';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function updateProgress() {
        if (audioPlayer.duration) {
            const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
            currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        }
    }

    function setProgress(e) {
        if (currentSongIndex === -1) return;
        const width = progressContainer.clientWidth;
        const clickX = e.offsetX;
        audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
    }

    function updateActivePlaylistItem() {
        document.querySelectorAll('.playlist-item').forEach(item => {
            if (parseInt(item.dataset.index) === currentSongIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function filterPlaylist() {
        const filter = searchBar.value.toLowerCase();
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            const songTitle = item.querySelector('h4').textContent.toLowerCase();
            const songArtist = item.querySelector('p').textContent.toLowerCase();
            if (songTitle.includes(filter) || songArtist.includes(filter)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // --- Initial Load ---
    function initializePlayer() {
        const savedRepo = localStorage.getItem('githubRepoPath');
        if (savedRepo) {
            loadSongsFromGitHub(savedRepo);
        } else {
            renderPlaylist(); // Render empty playlist with message
        }
    }

    initializePlayer();
});