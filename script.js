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
    const togglePlaylistBtn = document.getElementById('toggle-playlist-btn'); 

    // NEW CONTROLS
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');

    let playlist = [];
    let currentSongIndex = -1;
    // NEW STATE VARIABLES
    let isShuffling = false;
    let repeatMode = 'none'; // 'none', 'one', 'all'

    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', playNextSong);
    prevBtn.addEventListener('click', playPrevSong);
    volumeSlider.addEventListener('input', (e) => audioPlayer.volume = e.target.value);
    searchBar.addEventListener('keyup', filterPlaylist);
    fileInput.addEventListener('change', loadSongsFromLocal);
    githubLoadBtn.addEventListener('click', promptAndLoadFromGitHub);
    togglePlaylistBtn.addEventListener('click', togglePlaylistExpanded); 
    
    // NEW EVENT LISTENERS
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    document.addEventListener('keydown', handleKeyboardControls);

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
    // UPDATED: Play next song logic now handles repeat/shuffle
    audioPlayer.addEventListener('ended', playNextSong); 
    // UPDATED: Progress container click logic uses getBoundingClientRect
    progressContainer.addEventListener('click', setProgress);

    // Add error logging for audio player
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio Error:', e.target.error.code, e.target.error.message);
        alert('Error playing audio: ' + e.target.error.message);
    });
    audioPlayer.addEventListener('canplaythrough', () => {
        console.log('Can play through audio');
    });

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
        // Clean and split the repoPath
        const cleanedPath = repoPath.replace(/(^\/|\/$)/g, '').replace(/\/tree\/main/, ''); // Remove leading/trailing slashes and /tree/main
        const parts = cleanedPath.split('/').filter(part => part !== ''); // Split and remove empty parts

        if (parts.length < 3) {
            playlistContainer.innerHTML = '<p class="empty-playlist-msg">Invalid path format. Please use user/repo/path/to/songs (e.g., ryyReid/music/likedsongs).</p>';
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
                            // No fileObject for GitHub files, so no jsmediatags for them
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

    // UPDATED: Load local songs and trigger metadata reading
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
                    url: URL.createObjectURL(file),
                    // NEW: Store the File object to read metadata later
                    fileObject: file 
                };
                playlist.push(song);
                
                // NEW: Kick off metadata loading immediately
                loadMetadata(file, playlist.length - 1);
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
    
    // NEW: Function to read and apply metadata (jsmediatags required)
    function loadMetadata(file, index) {
        // Check if jsmediatags is available
        if (typeof jsmediatags === 'undefined') return;

        jsmediatags.read(file, {
            onSuccess: function(tag) {
                // Update playlist with extracted metadata
                const newTitle = tag.tags.title || playlist[index].title;
                const newArtist = tag.tags.artist || 'Local File';
                
                playlist[index].title = newTitle;
                playlist[index].artist = newArtist;
                
                // Update the UI immediately
                const item = playlistContainer.querySelector(`.playlist-item[data-index="${index}"]`);
                if (item) {
                    item.querySelector('h4').textContent = newTitle;
                    item.querySelector('p').textContent = newArtist;
                }

                // If this is the *currently playing* song, update the art
                if (index === currentSongIndex) {
                    applyAlbumArt(tag.tags.picture);
                }
            },
            onError: function(error) {
                console.log("Error reading tags for", file.name, ":", error.type);
            }
        });
    }
    
    // NEW: Function to handle image data and apply it as background
    function applyAlbumArt(picture) {
        if (picture && picture.data) {
            let base64String = "";
            for (let i = 0; i < picture.data.length; i++) {
                base64String += String.fromCharCode(picture.data[i]);
            }
            const base64 = "data:" + picture.format + ";base64," + window.btoa(base64String);
            
            albumArt.style.backgroundImage = `url('${base64}')`;
            albumArt.innerHTML = ''; // Remove the default music icon
        } else {
            albumArt.style.backgroundImage = 'none';
            albumArt.innerHTML = '<i class="fas fa-music"></i>'; // Fallback to icon
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
    // UPDATED: Clears album art for non-local songs and triggers metadata/art update for local files
    function loadSong(index) {
        if (index < 0 || index >= playlist.length) return;
        currentSongIndex = index;
        const song = playlist[currentSongIndex];
        audioPlayer.src = song.url;
        console.log('Loading song:', song.title, 'from URL:', song.url);
        
        songTitle.textContent = song.title;
        songArtist.textContent = song.artist;
        
        if (song.fileObject) {
            loadMetadata(song.fileObject, currentSongIndex); 
        } else {
            // Clear art for GitHub songs (or other external sources)
            albumArt.style.backgroundImage = 'none';
            albumArt.innerHTML = '<i class="fas fa-music"></i>';
        }
        
        updateActivePlaylistItem();
    }

    function playSong(index) {
        loadSong(index);
        console.log('Attempting to play song at index:', index);
        audioPlayer.play();
    }

    function togglePlayPause() {
        if (currentSongIndex === -1) return;
        if (audioPlayer.paused) {
            console.log('Playing audio');
            audioPlayer.play();
        } else {
            console.log('Pausing audio');
            audioPlayer.pause();
        }
    }

    function playPrevSong() {
        if (playlist.length === 0) return;
        currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
        playSong(currentSongIndex);
    }

    // NEW LOGIC: Shuffle and Repeat Handlers
    function toggleShuffle() {
        isShuffling = !isShuffling;
        shuffleBtn.classList.toggle('active', isShuffling);
    }

    function toggleRepeat() {
        if (repeatMode === 'none') {
            repeatMode = 'all';
            repeatBtn.innerHTML = '<i class="fas fa-repeat"></i>';
            repeatBtn.classList.add('active');
        } else if (repeatMode === 'all') {
            repeatMode = 'one';
            repeatBtn.innerHTML = '<i class="fas fa-repeat-1"></i>'; 
        } else {
            repeatMode = 'none';
            repeatBtn.innerHTML = '<i class="fas fa-repeat"></i>';
            repeatBtn.classList.remove('active');
        }
    }

    // UPDATED: Incorporate Shuffle and Repeat logic
    function playNextSong() {
        if (playlist.length === 0) return;

        let nextIndex = currentSongIndex;

        if (repeatMode === 'one') {
            // Stay on current song
        } else if (isShuffling) {
            // Pick a random, non-current song
            let newIndex;
            do {
                newIndex = Math.floor(Math.random() * playlist.length);
            } while (newIndex === currentSongIndex && playlist.length > 1);
            nextIndex = newIndex;
        } else {
            // Normal sequential play
            nextIndex = (currentSongIndex + 1);
        }

        if (nextIndex >= playlist.length) {
            if (repeatMode === 'all') {
                nextIndex = 0; // Loop back to start
            } else {
                // Stop playback
                audioPlayer.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                loadSong(0); // Load first song but stay paused
                return;
            }
        }

        playSong(nextIndex);
    }
    
    // NEW LOGIC: Keyboard Controls
    function handleKeyboardControls(e) {
        // Prevent interfering with search/text input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case ' ': // Spacebar for play/pause
                e.preventDefault(); 
                togglePlayPause();
                break;
            case 'ArrowRight': // Seek forward 5 seconds
                e.preventDefault();
                if (currentSongIndex !== -1) {
                    audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 5, audioPlayer.duration);
                }
                break;
            case 'ArrowLeft': // Seek backward 5 seconds
                e.preventDefault();
                if (currentSongIndex !== -1) {
                    audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 5, 0);
                }
                break;
        }
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

    // UPDATED: Using getBoundingClientRect for accurate seeking
    function setProgress(e) {
        if (currentSongIndex === -1 || !isFinite(audioPlayer.duration)) return;
        
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // X position relative to the element
        const width = rect.width;

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

    // --- Resizer Logic ---
    const horizontalResizer = document.getElementById('horizontal-resizer');
    const verticalResizer = document.getElementById('vertical-resizer');
    const playlistColumn = document.querySelector('.playlist-column');
    const appContainer = document.querySelector('.app-container');
    const playerColumn = document.querySelector('.player-column'); 

    // Function to toggle playlist expanded state
    function togglePlaylistExpanded() {
        if (window.matchMedia('(max-width: 768px)').matches) {
            playlistColumn.classList.toggle('playlist-expanded');
            const icon = togglePlaylistBtn.querySelector('i');
            if (playlistColumn.classList.contains('playlist-expanded')) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                playerColumn.style.opacity = '0';
                playerColumn.style.pointerEvents = 'none';
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                playerColumn.style.opacity = '1';
                playerColumn.style.pointerEvents = 'auto';
            }
        }
    }

    // Horizontal Resizing (Desktop)
    horizontalResizer.addEventListener('mousedown', (e) => {
        if (window.matchMedia('(min-width: 769px)').matches) {
            let isResizing = true;
            document.body.style.cursor = 'ew-resize';
            appContainer.style.userSelect = 'none';
            appContainer.style.pointerEvents = 'none';

            const mouseMoveHandler = (e) => {
                if (!isResizing) return;
                const appContainerRect = appContainer.getBoundingClientRect();
                const newPlaylistWidth = appContainerRect.right - e.clientX;
                const minWidth = 200; 
                const maxWidth = 600; 

                if (newPlaylistWidth >= minWidth && newPlaylistWidth <= maxWidth) {
                    playlistColumn.style.width = `${newPlaylistWidth}px`;
                }
            };

            const mouseUpHandler = () => {
                isResizing = false;
                document.body.style.cursor = 'default';
                appContainer.style.userSelect = '';
                appContainer.style.pointerEvents = '';
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        }
    });

    // Vertical Resizing (Mobile - simplified to toggle)
    verticalResizer.addEventListener('click', togglePlaylistExpanded);

});