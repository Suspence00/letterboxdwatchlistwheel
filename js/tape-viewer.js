/** Static VHS cover for the winner dialog. */
export function createTapeViewer(container, movie) {
    const root = document.createElement('div');
    root.className = 'tape-viewer';
    root.setAttribute('role', 'img');
    root.innerHTML = `<div class="tape-viewer__cover" aria-hidden="true">
        <div class="tape-viewer__fallback">
            <small>THE VIDEO STORE</small>
            <strong></strong>
            <em></em>
        </div>
        <div class="tape-viewer__rental"><b>VHS</b><span>BE KIND, REWIND</span></div>
    </div>`;
    container.replaceChildren(root);
    let poster = null;

    function update(updatedMovie, posterUrl) {
        const name = updatedMovie.name || 'Untitled';
        root.setAttribute('aria-label', `${name} VHS cover`);
        root.querySelector('strong').textContent = name;
        root.querySelector('em').textContent = updatedMovie.year || 'HOME VIDEO';
        if (poster?.getAttribute('src') === posterUrl) return;
        poster?.remove();
        poster = null;
        root.classList.remove('has-poster');
        if (!posterUrl) return;
        const nextPoster = new Image();
        poster = nextPoster;
        nextPoster.className = 'tape-viewer__poster';
        nextPoster.alt = '';
        nextPoster.draggable = false;
        nextPoster.referrerPolicy = 'no-referrer';
        nextPoster.addEventListener('load', () => {
            if (poster === nextPoster) root.classList.add('has-poster');
        }, { once: true });
        nextPoster.src = posterUrl;
        root.querySelector('.tape-viewer__cover').prepend(nextPoster);
    }

    update(movie, movie.poster);
    return { root, update, destroy() { root.remove(); } };
}
