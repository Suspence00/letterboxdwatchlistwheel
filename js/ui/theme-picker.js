/** Accessible theme preview cards and decoration preference control. */

/**
 * @param {{ themes: Array<{id:string,name:string,palette:string[]}>, select: HTMLSelectElement|null,
 *   container: HTMLElement|null, decorationsToggle: HTMLInputElement|null, appState: import('../types.js').AppState,
 *   applyTheme: (id:string)=>void, saveState: ()=>void }} options
 */
export function initThemePicker(options) {
    const { themes, select, container, decorationsToggle, appState, applyTheme, saveState } = options;
    if (!container) return { sync: () => {} };

    const themeMeta = (theme) => {
        const palette = theme.palette || [];
        const background = {
            default: '#101827', modern: '#17181c', fantasy: '#211a19', holiday: '#10251e',
            hanukkah: '#101d42', alaska: '#071b3d', cny: '#3a0c12', 'st-patricks': '#0e2c1d',
            america: '#101d46', 'retro-95': '#008080', spooky: '#160b25', forest: '#10251b',
            birthday: '#0f141c'
        }[theme.id] || '#101827';
        const text = { default: '#f5f7fb', modern: '#f5f5f7', fantasy: '#f5e6c8', holiday: '#f4f7f2',
            hanukkah: '#eff6ff', alaska: '#e8f2ff', cny: '#F9C74F', 'st-patricks': '#effff3',
            america: '#f5f8ff', 'retro-95': '#000000', spooky: '#f4ecff', forest: '#f0f5e9',
            birthday: '#f8fafc'
        }[theme.id] || '#f5f5f5';
        const button = { default: '#ff8600', modern: '#0071e3', fantasy: '#c8963e', holiday: '#d1495b',
            hanukkah: '#2563eb', alaska: '#f0b429', cny: '#D8261C', 'st-patricks': '#008000',
            america: '#D2143A', 'retro-95': '#c0c0c0', spooky: '#FF7518', forest: '#e58f24',
            birthday: '#f59e0b'
        }[theme.id] || palette[0] || '#ff8600';
        const font = { default: 'Inter, sans-serif', modern: 'Inter, sans-serif', fantasy: 'Cinzel, serif',
            spooky: 'Georgia, serif', forest: 'Georgia, serif', 'retro-95': 'Arial, sans-serif'
        }[theme.id] || 'Inter, sans-serif';
        return { background, text, button, font };
    };

    container.innerHTML = '';
    container.setAttribute('role', 'radiogroup');
    container.setAttribute('aria-label', 'Visual theme');
    const seasonal = new Set(['holiday', 'hanukkah', 'cny', 'st-patricks', 'america', 'spooky', 'birthday']);
    const groups = new Map([['Everyday', []], ['Seasonal', []]]);
    themes.forEach(theme => {
        const meta = themeMeta(theme);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'theme-card';
        card.dataset.theme = theme.id;
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
        groups.get(seasonal.has(theme.id) ? 'Seasonal' : 'Everyday').push(card);
    });
    groups.forEach((groupCards, label) => {
        const group = document.createElement('section');
        group.className = 'theme-picker__group';
        const heading = document.createElement('h3');
        heading.className = 'theme-picker__group-title';
        heading.textContent = label;
        group.append(heading, ...groupCards);
        container.append(group);
    });

    const cards = () => [...container.querySelectorAll('.theme-card')];
    const sync = (themeId) => cards().forEach(card => {
        const selected = card.dataset.theme === themeId;
        card.setAttribute('aria-checked', String(selected));
        card.tabIndex = selected ? 0 : -1;
    });
    container.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const list = cards();
        const current = Math.max(0, list.indexOf(document.activeElement));
        let next = current;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % list.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + list.length) % list.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = list.length - 1;
        event.preventDefault();
        list[next].focus();
        if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
            list[next].click();
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
    sync(appState.preferences?.theme || 'default');
    return { sync, syncDecorations };
}
