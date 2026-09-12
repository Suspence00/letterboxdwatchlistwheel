/**
 * @file Type definitions and data contracts for Letterboxd Watchlist Wheel.
 * Native ES Module JSDoc annotations — 0 build step, 100% IDE & AI type awareness.
 */

/**
 * @typedef {Object} MovieBoosters
 * @property {number} [boosterName] Number of boosts given by this user
 */

/**
 * @typedef {Object} MoviePosters
 * @property {string} [small]
 * @property {string} [medium]
 * @property {string} [large]
 */

/**
 * @typedef {Object} Movie
 * @property {string|number} id Unique identifier for the movie (Letterboxd URI, slug, or custom ID)
 * @property {string} Name Display title of the movie
 * @property {string|number} [Year] Release year
 * @property {string} [LetterboxdURI] Canonical URL to the Letterboxd entry
 * @property {number} [weight=1] Spin weight multiplier (1-5)
 * @property {string} [color] Hex color code for the wheel slice
 * @property {boolean} [isCustom=false] Whether this was manually added rather than imported
 * @property {string} [runtime] Formatted runtime string (e.g., "124 min")
 * @property {string} [synopsis] Overview / synopsis of the movie
 * @property {MoviePosters} [posters] Poster image URLs
 * @property {Object.<string, number>} [boosters] Map of booster names to count of boosts
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {Movie} movie The winning movie
 * @property {string} timestamp ISO timestamp of the spin
 * @property {'knockout'|'one-spin'} [mode] The spin mode used
 * @property {number} [rounds] Number of knockout rounds played
 * @property {string} [runnerUp] Runner-up movie name in knockout mode
 */

/**
 * @typedef {Object} Workspace
 * @property {string} id Unique identifier
 * @property {string} name Display name of the board/workspace
 * @property {Movie[]} movies List of movies in this board
 * @property {string[]} selectedIds IDs of movies enabled for the wheel
 * @property {HistoryEntry[]} history Spin history for this board
 * @property {string|null} [tiedListUrl] Associated Letterboxd list URL if synchronized
 */

/**
 * @typedef {Object} Preferences
 * @property {string} [theme] Visual theme key ('default', 'fantasy', 'retro-95', etc.)
 * @property {'vhs'|'classic'} [wheelStyle] Active wheel visual style
 * @property {number} [vhsCapacity] Max tapes rendered in VHS lineup (10, 24, 50, 100)
 * @property {boolean} [vhsLabels] Whether to show bottom rental labels
 * @property {boolean} [finalistsAlwaysVisible]
 * @property {boolean} [finalistsHideBox]
 * @property {boolean} [showCustoms]
 * @property {string} [discordWebhookUrl]
 * @property {string} [radarrUrl]
 * @property {string} [radarrApiKey]
 * @property {number|null} [radarrQualityProfileId]
 * @property {string|null} [radarrRootFolderPath]
 * @property {boolean} [radarrSearchOnAdd]
 */

/**
 * @typedef {Object} AppState
 * @property {Movie[]} movies Active list of movies
 * @property {Set<string|number>} selectedIds Set of selected movie IDs
 * @property {HistoryEntry[]} history History of winners
 * @property {string} activeWorkspace Currently active workspace ID
 * @property {Object.<string, Workspace>} workspaces Map of workspace ID to Workspace
 * @property {Preferences} preferences User configuration and integration preferences
 * @property {Object} filter Active filter and sorting state
 */

/**
 * @typedef {Object} WinnerContext
 * @property {'knockout'|'one-spin'} [spinMode] Spin mode that produced the winner
 * @property {number} [roundCount] Number of knockout rounds
 * @property {Movie[]} [eliminatedMovies] Movies eliminated during knockout
 * @property {Movie|null} [runnerUp] Final eliminated contender
 */

/**
 * @typedef {Object} OddsMap
 * @property {Object.<string|number, number>} individual Normalized odds per movie ID (0.0 to 1.0)
 * @property {number} totalWeight Sum of weights of all selected movies
 */

export {};
