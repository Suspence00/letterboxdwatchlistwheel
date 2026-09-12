/**
 * Knockout mode visualization, contenders display, and launch effects.
 */

import { appState } from "../state.js";
import {
    escapeSelector,
    getDefaultColorForIndex,
    getStoredColor,
    getMovieOriginalIndex
} from "../utils.js";
import {
    getSelectionOdds,
    getIsSpinning,
    getIsLastStandingInProgress
} from "../wheel.js";

// Knockout state
export let knockoutLaunchPrimed = false;
export let knockoutLaunchEngaged = false;
export let lastKnockoutRemaining = [];

export function setKnockoutLaunchEngaged(value) {
    knockoutLaunchEngaged = Boolean(value);
}

// DOM Elements cache / fallback lookups
const elements = {
    get spinButton() { return this._spinButton || document.getElementById("spin-button"); },
    set spinButton(el) { this._spinButton = el; },
    get wheelStage() { return this._wheelStage || document.querySelector(".wheel-stage"); },
    set wheelStage(el) { this._wheelStage = el; },
    get knockoutBox() { return this._knockoutBox || document.getElementById("knockout-remaining"); },
    set knockoutBox(el) { this._knockoutBox = el; },
    get knockoutList() { return this._knockoutList || document.getElementById("knockout-remaining-list"); },
    set knockoutList(el) { this._knockoutList = el; },
    get resultEl() { return this._resultEl || document.getElementById("result"); },
    set resultEl(el) { this._resultEl = el; },
    get movieListEl() { return this._movieListEl || document.getElementById("movie-list"); },
    set movieListEl(el) { this._movieListEl = el; },
};

export function initKnockoutUI(domElements = {}) {
    Object.assign(elements, domElements);
}

// Internal helpers
function formatOddsPercent(value = 0) {
    const numeric = Number(value) * 100;
    const safePercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    if (safePercent === 0 || safePercent === 100 || safePercent >= 10) {
        return `${Math.round(safePercent)}%`;
    }
    return `${safePercent.toFixed(1)}%`;
}

function isThemePaletteLocked() {
    return Boolean(appState.preferences?.theme && appState.preferences.theme !== "default");
}

function getSpinMode() {
    return appState.spinMode || "knockout";
}

function getFilteredSelectedMovies() {
    if (!appState.movies || !appState.selectedIds) return [];
    const filter = appState.filter || {};
    return appState.movies.filter((movie) => {
        if (!appState.selectedIds.has(movie.id)) return false;
        if (filter.showCustoms === false && movie.isCustom) return false;
        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year, movie.date]
                .filter((part) => typeof part === "string" && part.trim())
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(filter.normalizedQuery)) return false;
        }
        return true;
    });
}

function updateWheelAsideLayout() {
    const wheelAside = document.getElementById("wheel-aside") || document.querySelector(".wheel-aside");
    const wheelLayout = document.getElementById("wheel-layout") || document.querySelector(".wheel-layout");
    const knockoutBox = elements.knockoutBox;
    if (!wheelAside || !wheelLayout) {
        return;
    }
    const asideVisible = Boolean(knockoutBox && !knockoutBox.hidden);
    wheelAside.classList.toggle("is-hidden", !asideVisible);
    wheelLayout.classList.toggle("is-centered", !asideVisible);
}

function shouldLaunchKnockoutEffects() {
    const selection = getFilteredSelectedMovies();
    return getSpinMode() === "knockout" && selection.length > 1 && !getIsSpinning() && !getIsLastStandingInProgress();
}

function clearSpinButtonShards() {
    if (!elements.spinButton) {
        return;
    }
    const shards = elements.spinButton.querySelector(".spin-button__shards");
    if (shards) {
        shards.remove();
    }
}

function createSpinButtonShards() {
    if (!elements.spinButton) {
        return null;
    }
    const shardCount = 16;
    const burst = document.createElement("span");
    burst.className = "spin-button__shards";
    burst.setAttribute("aria-hidden", "true");

    for (let index = 0; index < shardCount; index += 1) {
        const shard = document.createElement("span");
        shard.className = "spin-button__shard";
        const offsetX = (Math.random() - 0.5) * 220;
        const offsetY = (Math.random() - 0.2) * 160;
        const spin = (Math.random() - 0.5) * 180;
        const delay = Math.random() * 0.12;
        const scale = 0.7 + Math.random() * 0.6;
        shard.style.setProperty("--shard-x", `${offsetX}px`);
        shard.style.setProperty("--shard-y", `${offsetY}px`);
        shard.style.setProperty("--shard-rotate", `${spin}deg`);
        shard.style.setProperty("--shard-delay", `${delay}s`);
        shard.style.setProperty("--shard-scale", scale.toFixed(2));
        burst.appendChild(shard);
    }

    return burst;
}

function boostWheelStage() {
    if (elements.wheelStage) {
        elements.wheelStage.classList.add("wheel-stage--amped");
    }
}

function resetWheelStageBoost() {
    if (elements.wheelStage) {
        elements.wheelStage.classList.remove("wheel-stage--amped");
    }
}

function setKnockoutResultContent(prefix, emphasizedText, suffix) {
    if (!elements.resultEl) return;
    elements.resultEl.replaceChildren();
    const label = document.createElement("span");
    label.className = "result__label";
    label.textContent = prefix;
    const strong = document.createElement("strong");
    strong.className = "result__name";
    strong.textContent = emphasizedText;
    elements.resultEl.append(label, strong);
    if (suffix) {
        const meta = document.createElement("span");
        meta.className = "result__meta";
        meta.textContent = suffix;
        elements.resultEl.append(meta);
    }
}

// Exported functions
export function triggerKnockoutLaunchEffects() {
    if (!shouldLaunchKnockoutEffects() || knockoutLaunchPrimed) {
        return;
    }
    knockoutLaunchPrimed = true;
    knockoutLaunchEngaged = false;

    if (elements.spinButton) {
        elements.spinButton.classList.add("spin-button--obliterated");
        elements.spinButton.disabled = true;
        clearSpinButtonShards();
        const burst = createSpinButtonShards();
        if (burst) {
            elements.spinButton.appendChild(burst);
            requestAnimationFrame(() => burst.classList.add("is-active"));
        }
    }
    boostWheelStage();
}

export function resetKnockoutLaunchEffects() {
    knockoutLaunchPrimed = false;
    knockoutLaunchEngaged = false;
    if (elements.spinButton) {
        elements.spinButton.classList.remove("spin-button--obliterated");
        clearSpinButtonShards();
        elements.spinButton.disabled = getFilteredSelectedMovies().length === 0
            || getIsSpinning()
            || getIsLastStandingInProgress();
    }
    resetWheelStageBoost();
}

export function handleSpinPrep() {
    const sliceEditor = document.getElementById("slice-editor");
    if (sliceEditor) {
        sliceEditor.hidden = true;
    }
    const sliceEditorBody = document.getElementById("slice-editor-body");
    if (sliceEditorBody) {
        sliceEditorBody.hidden = true;
    }
}

export function markMovieKnockedOut(movieId, order) {
    appState.knockoutResults.set(movieId, { order, status: "knocked-out" });
    applyKnockoutStatusToItem(movieId);
    reorderMovieListForKnockout();
}

export function markMovieChampion(movieId, order) {
    appState.knockoutResults.set(movieId, { order, status: "champion" });
    applyKnockoutStatusToItem(movieId);
    reorderMovieListForKnockout();
}

export function updateKnockoutRemainingBox(remainingMovies = []) {
    if (!elements.knockoutBox || !elements.knockoutList) return;

    lastKnockoutRemaining = Array.isArray(remainingMovies) ? [...remainingMovies] : [];

    const preferences = appState.preferences || {};
    const hideFinalistsBox = Boolean(preferences.hideFinalistsBox);
    const showFromStart = Boolean(preferences.showFinalistsFromStart);

    if (hideFinalistsBox || !Array.isArray(remainingMovies) || !remainingMovies.length) {
        elements.knockoutList.replaceChildren();
        elements.knockoutBox.hidden = true;
        const theaterContenders = document.getElementById("spin-theater-contenders");
        if (theaterContenders) {
            theaterContenders.hidden = true;
            document.querySelector(".spin-theater")?.classList.toggle("has-contenders", false);
        }
        updateWheelAsideLayout();
        return;
    }

    if (!showFromStart && remainingMovies.length > 10) {
        elements.knockoutList.replaceChildren();
        elements.knockoutBox.hidden = true;
        const theaterContenders = document.getElementById("spin-theater-contenders");
        if (theaterContenders) {
            theaterContenders.hidden = true;
            document.querySelector(".spin-theater")?.classList.toggle("has-contenders", false);
        }
        updateWheelAsideLayout();
        return;
    }

    elements.knockoutBox.hidden = false;
    const theaterContenders = document.getElementById("spin-theater-contenders");
    if (theaterContenders) {
        theaterContenders.hidden = false;
        document.querySelector(".spin-theater")?.classList.toggle("has-contenders", true);
    }
    const oddsMap = getSelectionOdds(lastKnockoutRemaining, { inverseModeOverride: true });
    const winOddsMap = getSelectionOdds(lastKnockoutRemaining, { inverseModeOverride: false });
    const themeLocked = isThemePaletteLocked();

    const items = [];
    lastKnockoutRemaining.forEach((movie) => {
        const originalIndex = getMovieOriginalIndex(movie, appState.movies);
        let colorIndex = originalIndex;
        if (!Number.isFinite(colorIndex) || colorIndex < 0) {
            colorIndex = appState.movies.indexOf(movie);
        }
        const defaultColor = getDefaultColorForIndex(colorIndex);
        const resolvedColor = themeLocked ? defaultColor : getStoredColor(movie, defaultColor);
        if (movie.color !== resolvedColor) {
            movie.color = resolvedColor;
        }

        const item = document.createElement("li");
        item.className = "knockout-remaining__item";
        item.dataset.id = movie.id;

        const titleRow = document.createElement("div");
        titleRow.className = "knockout-remaining__line";

        const colorSwatch = document.createElement("span");
        colorSwatch.className = "knockout-remaining__color";
        colorSwatch.style.backgroundColor = resolvedColor;
        colorSwatch.setAttribute("aria-hidden", "true");

        const title = document.createElement("span");
        title.className = "knockout-remaining__name";
        title.textContent = movie.name;

        titleRow.appendChild(colorSwatch);
        titleRow.appendChild(title);
        item.appendChild(titleRow);

        const metaParts = [];
        if (movie.year) metaParts.push(movie.year);
        if (movie.isCustom) metaParts.push("Custom");
        if (metaParts.length) {
            const meta = document.createElement("span");
            meta.className = "knockout-remaining__meta";
            meta.textContent = metaParts.join(" | ");
            item.appendChild(meta);
        }

        const winOddsValue = winOddsMap.get(movie.id) || oddsMap.get(movie.id) || 0;
        const odds = document.createElement("span");
        odds.className = "knockout-remaining__odds";
        odds.textContent = `Odds: ${formatOddsPercent(winOddsValue)}`;
        item.appendChild(odds);

        items.push(item);
    });

    elements.knockoutList.replaceChildren(...items);
    updateWheelAsideLayout();
}

export function refreshKnockoutBoxVisibility() {
    updateKnockoutRemainingBox(lastKnockoutRemaining);
}

export function highlightKnockoutCandidate(movieId) {
    if (!elements.knockoutList) return;
    const items = elements.knockoutList.querySelectorAll(".knockout-remaining__item");
    items.forEach((item) => {
        const isActive = Boolean(movieId && item.dataset.id === movieId);
        item.classList.toggle("is-active", isActive);
        if (isActive) {
            item.setAttribute("aria-current", "true");
        } else {
            item.removeAttribute("aria-current");
        }
    });
}

export function updateKnockoutResultText(type, countOrMovie, extra) {
    if (!elements.resultEl) return;

    if (type === "start") {
        elements.resultEl.className = "result result--knockout";
        setKnockoutResultContent(
            "Movie Knockout:",
            `${countOrMovie} movies`,
            " · enter the arena"
        );
    } else if (type === "eliminated") {
        const remainingCount = countOrMovie;
        const eliminatedMovie = extra;
        const remainText = remainingCount === 1 ? "Final showdown!" : `${remainingCount} remain`;
        const eliminatedLabel = `${eliminatedMovie.name}${eliminatedMovie.year ? ` (${eliminatedMovie.year})` : ""}`;
        elements.resultEl.className = "result result--knockout";
        setKnockoutResultContent("Knocked out:", eliminatedLabel, ` · ${remainText}`);
    } else if (type === "winner") {
        const finalMovie = extra;
        elements.resultEl.className = "result result--champion";
        setKnockoutResultContent(
            "Movie Knockout winner:",
            finalMovie.name,
            finalMovie.year ? ` (${finalMovie.year})` : ""
        );
    }
}

export function applyKnockoutStatusToElement(element, status) {
    if (!element) return;

    if (!status) {
        element.classList.remove("is-champion", "is-knocked-out");
        element.removeAttribute("data-knockout-order");
        element.removeAttribute("data-knockout-status");
        const existing = element.querySelector(".knockout-badge");
        if (existing) {
            existing.remove();
        }
        return;
    }

    element.dataset.knockoutOrder = String(status.order);
    element.dataset.knockoutStatus = status.status;

    element.classList.toggle("is-knocked-out", status.status === "knocked-out");
    element.classList.toggle("is-champion", status.status === "champion");

    let badge = element.querySelector(".knockout-badge");
    if (!badge) {
        badge = document.createElement("span");
        badge.className = "knockout-badge";
        const removeButton = element.querySelector(".remove-custom");
        if (removeButton && removeButton.parentElement === element) {
            element.insertBefore(badge, removeButton);
        } else {
            element.appendChild(badge);
        }
    } else {
        const removeButton = element.querySelector(".remove-custom");
        if (removeButton && removeButton.parentElement === element && badge.nextSibling !== removeButton) {
            element.insertBefore(badge, removeButton);
        }
    }

    if (status.status === "champion") {
        badge.textContent = "Knockout champion";
    } else {
        badge.textContent = status.order ? `Knocked out #${status.order}` : "Knocked out";
    }
}

export function applyKnockoutStatusToItem(movieId) {
    if (!elements.movieListEl) return;
    const safeId = escapeSelector(movieId);
    const item = elements.movieListEl.querySelector(`li[data-id="${safeId}"]`);
    if (!item) return;
    const status = appState.knockoutResults.get(movieId);
    applyKnockoutStatusToElement(item, status);
}

export function reorderMovieListForKnockout() {
    if (!elements.movieListEl || !appState.knockoutResults.size) {
        return;
    }
    if (elements.movieListEl.style.paddingTop || elements.movieListEl.style.paddingBottom) {
        return;
    }

    const items = Array.from(elements.movieListEl.children).filter((item) => !item.classList.contains("empty"));
    if (!items.length) {
        return;
    }

    const sorted = items.sort((a, b) => {
        const aOrder = Number.parseInt(a.dataset.knockoutOrder, 10);
        const bOrder = Number.parseInt(b.dataset.knockoutOrder, 10);
        const aHasOrder = Number.isFinite(aOrder);
        const bHasOrder = Number.isFinite(bOrder);

        if (aHasOrder && bHasOrder) {
            return aOrder - bOrder;
        }
        if (aHasOrder) {
            return -1;
        }
        if (bHasOrder) {
            return 1;
        }

        const aIndex = Number.parseInt(a.dataset.originalIndex, 10);
        const bIndex = Number.parseInt(b.dataset.originalIndex, 10);
        if (Number.isFinite(aIndex) && Number.isFinite(bIndex)) {
            return aIndex - bIndex;
        }
        return 0;
    });

    sorted.forEach((item) => {
        elements.movieListEl.appendChild(item);
    });
}
