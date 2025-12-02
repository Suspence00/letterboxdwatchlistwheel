# Feature: Importing

The Letterboxd Watchlist Wheel offers flexible ways to import your movie data.

## Direct Letterboxd Import (Proxy)

This is the easiest method. The application uses a Cloudflare Worker proxy to fetch public lists from Letterboxd.

### Supported Formats
*   **List URL:** `https://letterboxd.com/username/list/list-name/`
*   **Watchlist URL:** `https://letterboxd.com/username/watchlist/`
*   **Username:** Simply entering `username` will attempt to fetch that user's watchlist.

### How it works
1.  The app sends your URL to a proxy server.
2.  The proxy scrapes the public Letterboxd page for movie titles, years, and metadata.
3.  It returns a JSON response to the wheel app.

> [!NOTE]
> This only works for **public** lists. If your watchlist is private, you must use the CSV method.

## CSV Import

For private lists or offline use, you can upload a CSV file.

### File Format
The app expects the standard Letterboxd export format. The critical columns are:
*   `Name` (Movie title)
*   `Year` (Release year)
*   `Letterboxd URI` (Link to the movie page)

### Troubleshooting CSVs
*   **Encoding:** Ensure your CSV is UTF-8 encoded.
*   **Headers:** Do not remove the header row.
*   **Missing Data:** If a row is missing a Name, it will be skipped.

## Custom Entries

You can mix and match! After importing a list (or even without one), you can manually add entries using the "Add a custom entry" form in the "Curate your wheel" section. These are treated exactly like imported movies.

## Using .wheel Backups with Imports

If you regularly refresh a Letterboxd list, you can keep the current movies and reapply saved weights/colors from a backup:

1. Import the latest Letterboxd list or CSV as usual.
2. Open **Advanced options → Export or import your wheel**.
3. Click **Open import popup** and paste/upload your `.wheel` backup.
4. Choose **Apply weights to current list**. Matching movies (by URI/title/year) keep the backup weights and slice colors without re-adding movies. History can also be replaced if you check the option.
