/** Accessible theme preview cards and decoration preference control. */

/**
 * @param {{ themes: Array<{id:string,name:string,palette:string[]}>, select: HTMLSelectElement|null,
 *   container: HTMLElement|null, decorationsToggle: HTMLInputElement|null, appState: import('../types.js').AppState,
 *   applyTheme: (id:string)=>void, saveState: ()=>void }} options
 */
export function initThemePicker(options) {
    const { themes, select, container, decorationsToggle, appState, applyTheme, saveState } = options;
    if (!container) return { sync: () => {}, syncDecorations: () => {} };

    const themeMeta = (theme) => {
        const palette = theme.palette || [];
        const background = {
            default: '#101827', modern: '#17181c', fantasy: '#211a19', holiday: '#10251e',
            hanukkah: '#101d42', alaska: '#071b3d', cny: '#3a0c12', 'st-patricks': '#0e2c1d',
            america: '#101d46', 'retro-95': '#008080', spooky: '#160b25', forest: '#10251b',
            birthday: '#0f141c', friendslop: '#101116'
        }[theme.id] || '#101827';
        const text = { default: '#f5f7fb', modern: '#f5f5f7', fantasy: '#f5e6c8', holiday: '#f4f7f2',
            hanukkah: '#eff6ff', alaska: '#e8f2ff', cny: '#F9C74F', 'st-patricks': '#effff3',
            america: '#f5f8ff', 'retro-95': '#000000', spooky: '#f4ecff', forest: '#f0f5e9',
            birthday: '#f8fafc', friendslop: '#f1f5f9'
        }[theme.id] || '#f5f5f5';
        const button = { default: '#ff8600', modern: '#0071e3', fantasy: '#c8963e', holiday: '#d1495b',
            hanukkah: '#2563eb', alaska: '#f0b429', cny: '#D8261C', 'st-patricks': '#008000',
            america: '#D2143A', 'retro-95': '#c0c0c0', spooky: '#FF7518', forest: '#e58f24',
            birthday: '#f59e0b', friendslop: '#f97316'
        }[theme.id] || palette[0] || '#ff8600';
        const font = { default: 'Inter, sans-serif', modern: 'Inter, sans-serif', fantasy: 'Cinzel, serif',
            spooky: 'Georgia, serif', forest: 'Georgia, serif', 'retro-95': 'Arial, sans-serif',
            friendslop: 'Inter, sans-serif'
        }[theme.id] || 'Inter, sans-serif';
        return { background, text, button, font };
    };

    container.innerHTML = `
        <details class="theme-picker__browser">
            <summary class="theme-picker__summary">
                <span class="theme-picker__current-preview" aria-hidden="true"></span>
                <span class="theme-picker__current"><span class="theme-picker__label">Visual theme</span><strong class="theme-picker__current-name"></strong></span>
                <span class="theme-picker__action">Browse <span aria-hidden="true">⌄</span></span>
            </summary>
            <div class="theme-picker__content">
                <input type="search" class="text-input theme-picker__search" aria-label="Search themes" placeholder="Search themes…" autocomplete="off">
                <div class="theme-picker__filters" role="group" aria-label="Theme categories"></div>
                <div class="theme-picker__gallery" role="radiogroup" aria-label="Visual theme"></div>
                <p class="theme-picker__status" role="status"></p>
            </div>
        </details>`;
    // Keep the select as the existing change-event bridge and unenhanced fallback.
    if (select) select.closest('.settings-row').hidden = true;
    const browser = container.querySelector('details');
    const summary = container.querySelector('summary');
    const search = container.querySelector('input');
    const filters = container.querySelector('.theme-picker__filters');
    const gallery = container.querySelector('.theme-picker__gallery');
    const status = container.querySelector('.theme-picker__status');
    const seasonal = new Set(['holiday', 'hanukkah', 'cny', 'st-patricks', 'america', 'spooky', 'birthday']);
    let category = 'All';
    themes.forEach(theme => {
        const meta = themeMeta(theme);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'theme-card';
        card.dataset.theme = theme.id;
        card.dataset.category = seasonal.has(theme.id) ? 'Seasonal' : 'Everyday';
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-label', theme.name);
        card.innerHTML = `<span class="theme-card__preview" aria-hidden="true" style="--theme-preview-bg:${meta.background};--theme-preview-text:${meta.text};--theme-preview-button:${meta.button};--theme-preview-font:${meta.font}"><span class="theme-card__preview-title">Aa</span><span class="theme-card__preview-button"></span><span class="theme-card__wheel-swatches"></span></span><span class="theme-card__name"></span>`;
        card.querySelector('.theme-card__name').textContent = theme.name;
        const swatches = card.querySelector('.theme-card__wheel-swatches');
        (theme.palette || []).slice(0, 6).forEach(color => {
            const swatch = document.createElement('i');
            swatch.style.backgroundColor = color;
            swatches.append(swatch);
        });
        card.addEventListener('click', () => {
            if (select) {
                select.value = theme.id;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                applyTheme(theme.id);
            }
        });
        gallery.append(card);
    });

    const cards = [...gallery.querySelectorAll('.theme-card')];
    const visibleCards = () => cards.filter(card => !card.hidden);
    const syncTabStops = () => {
        const visible = visibleCards();
        const target = visible.find(card => card.getAttribute('aria-checked') === 'true') || visible[0];
        cards.forEach(card => { card.tabIndex = card === target ? 0 : -1; });
    };
    const filterCards = () => {
        const query = search.value.trim().toLocaleLowerCase();
        cards.forEach(card => {
            card.hidden = (category !== 'All' && card.dataset.category !== category)
                || !card.getAttribute('aria-label').toLocaleLowerCase().includes(query);
        });
        filters.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-pressed', String(button.textContent === category));
        });
        const count = visibleCards().length;
        status.textContent = count ? `${count} of ${cards.length} themes` : 'No themes found. Try another search or category.';
        gallery.scrollTop = 0;
        syncTabStops();
    };
    ['All', 'Everyday', 'Seasonal'].forEach(label => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-picker__filter';
        button.textContent = label;
        button.addEventListener('click', () => {
            category = label;
            filterCards();
        });
        filters.append(button);
    });
    search.addEventListener('input', filterCards);
    const sync = (themeId) => {
        cards.forEach(card => {
            card.setAttribute('aria-checked', String(card.dataset.theme === themeId));
        });
        const theme = themes.find(theme => theme.id === themeId) || themes[0];
        container.querySelector('.theme-picker__current-name').textContent = theme.name;
        const stops = theme.palette?.length ? [...theme.palette, theme.palette[0]] : ['#ff8600', '#ff8600'];
        container.querySelector('.theme-picker__current-preview').style.background =
            `conic-gradient(${stops.join(', ')})`;
        syncTabStops();
    };
    gallery.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const list = visibleCards();
        if (!list.length) return;
        const current = Math.max(0, list.indexOf(document.activeElement));
        let next = current;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % list.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + list.length) % list.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = list.length - 1;
        event.preventDefault();
        list[next].focus();
        list[next].click();
    });
    container.addEventListener('keydown', event => {
        if (event.key === 'Escape' && browser.open) {
            event.preventDefault();
            event.stopPropagation();
            if (document.activeElement === search && search.value) {
                search.value = '';
                filterCards();
                return;
            }
            browser.open = false;
            summary.focus();
        }
    });
    const syncDecorations = () => {
        const enabled = appState.preferences?.decorationsEnabled !== false;
        if (decorationsToggle) decorationsToggle.checked = enabled;
        document.body.classList.toggle('decorations-disabled', !enabled);
    };
    if (decorationsToggle) {
        syncDecorations();
        decorationsToggle.addEventListener('change', () => {
            appState.preferences.decorationsEnabled = decorationsToggle.checked;
            document.body.classList.toggle('decorations-disabled', !decorationsToggle.checked);
            saveState();
        });
    }
    filterCards();
    sync(appState.preferences?.theme || 'default');
    return { sync, syncDecorations };
}
