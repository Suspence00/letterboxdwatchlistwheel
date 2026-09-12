/** Full-list and windowed rendering; scroll bookkeeping stays local to this viewport. */
/**
 * @param {{ movieListEl: HTMLElement, movieListWrapper?: HTMLElement }} elements
 * @param {Function} buildMovieListItem Creates one movie row for the current render context.
 */
export function createMovieListViewport(elements, buildMovieListItem) {
    const VIRTUALIZATION_THRESHOLD = 250;
    const VIRTUAL_OVERSCAN = 6;
    const VIRTUAL_ROW_ESTIMATE = 128;
    const virtualListState = {
        enabled: false,
        rowHeight: 0,
        data: [],
        context: null,
        startIndex: 0,
        endIndex: -1,
        renderScheduled: false,
        forceRender: false
    };

    function initVirtualList() {
        if (!elements.movieListWrapper || !elements.movieListEl) {
            return;
        }

        elements.movieListWrapper.addEventListener(
            'scroll',
            () => {
                if (!virtualListState.enabled) {
                    return;
                }
                requestVirtualRender();
            },
            { passive: true }
        );

        window.addEventListener('resize', () => {
            if (!virtualListState.enabled) {
                return;
            }
            virtualListState.rowHeight = 0;
            requestVirtualRender(true);
        });
    }

    function shouldVirtualize(total) {
        return total >= VIRTUALIZATION_THRESHOLD && Boolean(elements.movieListWrapper);
    }

    function resetVirtualList() {
        virtualListState.enabled = false;
        virtualListState.data = [];
        virtualListState.context = null;
        virtualListState.startIndex = 0;
        virtualListState.endIndex = -1;
        virtualListState.rowHeight = 0;
        virtualListState.renderScheduled = false;
        virtualListState.forceRender = false;
        if (elements.movieListEl) {
            elements.movieListEl.style.paddingBottom = '';
            elements.movieListEl.style.paddingTop = '';
        }
    }

    function getListGap() {
        if (!elements.movieListEl) {
            return 0;
        }
        const styles = window.getComputedStyle(elements.movieListEl);
        const gapValue = styles.rowGap || styles.gap || '0';
        const gap = Number.parseFloat(gapValue);
        return Number.isFinite(gap) ? gap : 0;
    }

    function measureVirtualRowHeight() {
        if (!elements.movieListEl) {
            return;
        }
        const firstItem = elements.movieListEl.querySelector('li[data-id]');
        if (!firstItem) {
            return;
        }
        const rect = firstItem.getBoundingClientRect();
        const gap = getListGap();
        const height = rect.height + gap;
        if (Number.isFinite(height) && height > 0) {
            virtualListState.rowHeight = height;
        }
    }

    function requestVirtualRender(force = false) {
        if (!virtualListState.enabled) {
            return;
        }
        if (force) {
            virtualListState.forceRender = true;
        }
        if (virtualListState.renderScheduled) {
            return;
        }
        virtualListState.renderScheduled = true;
        requestAnimationFrame(() => {
            virtualListState.renderScheduled = false;
            const shouldForce = virtualListState.forceRender;
            virtualListState.forceRender = false;
            renderVirtualWindow(shouldForce);
        });
    }

    function renderVirtualWindow(force = false) {
        if (!virtualListState.enabled || !elements.movieListEl || !elements.movieListWrapper) {
            return;
        }
        const { data, context } = virtualListState;
        const total = data.length;
        if (!total) {
            elements.movieListEl.innerHTML = '';
            elements.movieListEl.style.paddingBottom = '';
            elements.movieListEl.style.paddingTop = '';
            return;
        }

        const rowHeight = virtualListState.rowHeight || VIRTUAL_ROW_ESTIMATE;
        const gap = getListGap();
        const scrollTop = elements.movieListWrapper.scrollTop || 0;
        const viewportHeight = elements.movieListWrapper.clientHeight || 0;
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN);
        const endIndex = Math.min(
            total - 1,
            Math.ceil((scrollTop + viewportHeight) / rowHeight) + VIRTUAL_OVERSCAN
        );

        if (!force && startIndex === virtualListState.startIndex && endIndex === virtualListState.endIndex) {
            return;
        }

        virtualListState.startIndex = startIndex;
        virtualListState.endIndex = endIndex;

        elements.movieListEl.innerHTML = '';
        const beforeCount = startIndex;
        const afterCount = Math.max(0, total - endIndex - 1);
        const topPadding = beforeCount ? Math.max(0, (beforeCount * rowHeight) - gap) : 0;
        const bottomPadding = afterCount ? Math.max(0, (afterCount * rowHeight) - gap) : 0;
        elements.movieListEl.style.paddingTop = `${topPadding}px`;
        elements.movieListEl.style.paddingBottom = `${bottomPadding}px`;

        for (let i = startIndex; i <= endIndex; i += 1) {
            const movie = data[i];
            if (!movie) {
                continue;
            }
            elements.movieListEl.appendChild(buildMovieListItem(movie, i, context));
        }

        measureVirtualRowHeight();
    }

    function renderMovieList(displayMovies, context) {
        if (!elements.movieListEl) {
            return;
        }

        if (!shouldVirtualize(displayMovies.length)) {
            resetVirtualList();
            elements.movieListEl.innerHTML = '';
            displayMovies.forEach((movie, index) => {
                elements.movieListEl.appendChild(buildMovieListItem(movie, index, context));
            });
            measureVirtualRowHeight();
            return;
        }

        const wasEnabled = virtualListState.enabled;
        virtualListState.enabled = true;
        virtualListState.data = displayMovies;
        virtualListState.context = context;

        if (!wasEnabled && elements.movieListWrapper) {
            elements.movieListWrapper.scrollTop = 0;
        }

        requestVirtualRender(true);
    }

    initVirtualList();
    return { renderMovieList, resetVirtualList };
}
