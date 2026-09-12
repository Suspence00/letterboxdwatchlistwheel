/**
 * Shared runtime data contracts for native ES modules.
 * JSDoc supports editor tooling; it does not perform runtime validation.
 */

/** @typedef {string|number} MovieId */

/**
 * @typedef {Object} MovieBooster
 * @property {string} name Contributor name
 * @property {number} timestamp Unix timestamp in milliseconds
 * @property {string} source Contribution source
 */

/**
 * @typedef {Object} Movie
 * @property {MovieId} id Unique movie identifier
 * @property {string} name Display title, normalized from CSV columns on import
 * @property {string|number} [year] Release year
 * @property {string} [uri] Letterboxd film URL
 * @property {string} [date] Date added to the watchlist
 * @property {number} [initialIndex] Original position before filtering or sorting
 * @property {number} [weight=1] Spin weight multiplier (1-5)
 * @property {string} [color] Hex slice color
 * @property {boolean} [isCustom=false] Whether manually added
 * @property {Array<MovieBooster|string>} [boosters] Contributions; strings are legacy entries
 */

/** @typedef {'knockout'|'one-spin'|'random-boost'} SpinMode */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id Unique history entry ID
 * @property {MovieId} movieId Winning movie ID
 * @property {string} name Winning movie title
 * @property {string|number} [year] Release year
 * @property {string} [uri] Film URL
 * @property {number} timestamp Unix timestamp in milliseconds
 * @property {string} mode Spin mode, or 'unknown' for unspecified history
 */

/**
 * Workspace index metadata. Movie data is saved separately per workspace.
 * @typedef {Object} Workspace
 * @property {string} id Unique board identifier
 * @property {string} name Display name
 * @property {number} created Unix timestamp in milliseconds
 * @property {number} lastModified Unix timestamp in milliseconds
 * @property {string} [letterboxdUrl] Tied list URL, or an empty string
 */

/**
 * @typedef {Object} RadarrPreferences
 * @property {string} url
 * @property {string} apiKey
 * @property {number|null} qualityProfileId
 * @property {string} rootFolderPath
 * @property {boolean} searchOnAdd
 */

/**
 * @typedef {Object} Preferences
 * @property {string} [theme]
 * @property {Object<string, string>} [themeColorOverrides]
 * @property {boolean} [decorationsEnabled]
 * @property {'vhs'|'classic'} [wheelStyle]
 * @property {number} [vhsCapacity]
 * @property {boolean} [vhsShowLabels]
 * @property {boolean} [hideFinalistsBox]
 * @property {boolean} [showFinalistsFromStart]
 * @property {string} [discordWebhookUrl]
 * @property {RadarrPreferences} [radarr]
 */

/**
 * @typedef {Object} MovieFilter
 * @property {string} query
 * @property {string} normalizedQuery
 * @property {boolean} showCustoms
 * @property {string} sortMode
 */

/**
 * @typedef {Object} KnockoutResult
 * @property {number} order
 * @property {'knocked-out'|'champion'} status
 */

/**
 * @typedef {Object} AppState
 * @property {Movie[]} movies Active board's movies
 * @property {Set<MovieId>} selectedIds
 * @property {HistoryEntry[]} history
 * @property {string|null} activeWorkspaceId
 * @property {Workspace[]} workspaces Board index
 * @property {MovieId|null} winnerId
 * @property {SpinMode|null} winnerSpinMode
 * @property {Preferences} preferences
 * @property {MovieFilter} filter
 * @property {Map<MovieId, KnockoutResult>} knockoutResults
 */

/**
 * @typedef {Object} WinnerContext
 * @property {SpinMode} [spinMode]
 * @property {number} [selectionOdds] Winner's normalized probability (0-1)
 * @property {boolean} [isRestore] Reopening a winner without sending another notification
 */

/** @typedef {Map<MovieId, number>} OddsMap Normalized probabilities keyed by movie ID */

export {};
