## Live Demo: https://zeyaddev-1.github.io/omdb-project/

# OMDb Movie Search SPA

## Overview

OMDb Movie Search SPA is a responsive single-page movie search application built with HTML, CSS, and vanilla JavaScript. It uses the OMDb API to search for movies and display detailed movie information in a clean frontend-only interface.

## Features

- Search movies by title
- Optional filters for type, year, and plot length
- Display movie title, year, genre, director, poster, plot, cast, runtime, IMDb rating, language, country, and type
- Error handling for missing titles, not found results, invalid API keys, API response issues, and network failures
- LocalStorage persistence for the last successful search and selected filters
- Responsive design for desktop and mobile screens
- In-memory cache to avoid repeated API calls during the same browser session

## Tech Stack

- HTML
- CSS
- JavaScript
- OMDb API
- GitHub Pages

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/omdb-project.git
   cd omdb-project
   ```

2. Open `index.html` locally in a browser.

3. In `app.js`, replace `YOUR_API_KEY_HERE` with your OMDb API key by updating the `OMDB_API_KEY` constant.

## Project Structure

```text
omdb-project/
|-- index.html
|-- style.css
|-- app.js
`-- README.md
```

## Notes

- This is a frontend-only static project.
- The OMDb API key is used client-side because GitHub Pages hosts static files only.
- For production applications, API keys should normally be protected behind a backend service.
