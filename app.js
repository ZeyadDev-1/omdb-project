const OMDB_API_KEY = "6771de16";
const OMDB_API_URL = "https://www.omdbapi.com/";
const LAST_SEARCH_KEY = "omdb:lastSuccessfulSearch";

const movieCache = new Map();
let isLoading = false;

const form = document.querySelector("#movie-form");
const input = document.querySelector("#movie-title");
const searchButton = document.querySelector("#search-button");
const messageEl = document.querySelector("#search-message");
const resultEl = document.querySelector("#movie-result");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchMovie(input.value).catch(handleUnexpectedSearchError);
});

document.addEventListener("DOMContentLoaded", () => {
  const lastSearch = loadLastSearch();

  if (lastSearch) {
    input.value = lastSearch;
    searchMovie(lastSearch).catch(handleUnexpectedSearchError);
  }
});

async function searchMovie(rawTitle) {
  const title = String(rawTitle || "").trim();

  if (isLoading) {
    renderMessage("Please wait for the current search to finish.", "error");
    return;
  }

  if (!title) {
    renderError("Please enter a movie name before searching.");
    input.focus();
    return;
  }

  if (!hasApiKey()) {
    renderError("OMDb API key is missing. Add your API key to OMDB_API_KEY in app.js.");
    return;
  }

  const cacheKey = normalizeTitle(title);
  const cachedMovie = movieCache.get(cacheKey);

  if (cachedMovie) {
    renderMovie(cachedMovie);
    saveLastSearch(cachedMovie.Title);
    renderMessage("Loaded from this session's cache.", "success");
    return;
  }

  setLoading(true);
  renderMessage(`Searching for "${title}"...`);

  try {
    const movie = await fetchMovie(title);

    movieCache.set(cacheKey, movie);
    movieCache.set(normalizeTitle(movie.Title), movie);
    renderMovie(movie);
    saveLastSearch(movie.Title);
    renderMessage(`Showing results for "${movie.Title}".`, "success");
  } catch (error) {
    renderError(getFriendlyErrorMessage(error));
  } finally {
    setLoading(false);
  }
}

async function fetchMovie(title) {
  const url = `${OMDB_API_URL}?apikey=${encodeURIComponent(OMDB_API_KEY)}&t=${encodeURIComponent(title)}&plot=full`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("network");
  }

  const data = await response.json();

  if (data.Response === "False") {
    throw new Error(data.Error || "not-found");
  }

  return data;
}

function renderMovie(movie) {
  resultEl.innerHTML = `
    <article class="movie-card">
      <div class="poster-panel">
        ${renderPoster(movie)}
      </div>
      <div class="movie-content">
        <div class="movie-kicker">
          ${renderPill(movie.Year)}
          ${renderPill(movie.Genre)}
          ${renderPill(movie.Runtime)}
          ${renderPill(formatRating(movie.imdbRating))}
        </div>
        <h2 class="movie-title">${escapeHtml(formatValue(movie.Title))}</h2>
        <p class="plot">${escapeHtml(formatValue(movie.Plot, "No plot is available for this movie."))}</p>
        <dl class="details-grid">
          ${renderDetail("Year", movie.Year)}
          ${renderDetail("Genre", movie.Genre)}
          ${renderDetail("Director", movie.Director)}
          ${renderDetail("Actors", movie.Actors)}
          ${renderDetail("Runtime", movie.Runtime)}
          ${renderDetail("IMDb rating", formatRating(movie.imdbRating))}
          ${renderDetail("Language", movie.Language)}
          ${renderDetail("Country", movie.Country)}
        </dl>
      </div>
    </article>
  `;
}

function renderPoster(movie) {
  const title = formatValue(movie.Title, "Movie poster unavailable");

  if (movie.Poster && movie.Poster !== "N/A") {
    return `<img src="${escapeAttribute(movie.Poster)}" alt="${escapeAttribute(title)} poster">`;
  }

  return `
    <div class="poster-fallback" role="img" aria-label="Poster unavailable for ${escapeAttribute(title)}">
      <span>${escapeHtml(title)}</span>
    </div>
  `;
}

function renderDetail(label, value) {
  return `
    <div class="detail-item">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(formatValue(value))}</dd>
    </div>
  `;
}

function renderPill(value) {
  const formattedValue = formatValue(value, "");

  if (!formattedValue) {
    return "";
  }

  return `<span class="pill">${escapeHtml(formattedValue)}</span>`;
}

function renderError(message) {
  resultEl.innerHTML = `
    <div class="empty-state" role="alert">
      <div class="ticket-icon" aria-hidden="true"></div>
      <h2>Nothing to show yet</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  renderMessage(message, "error");
}

function setLoading(loading) {
  isLoading = loading;
  searchButton.disabled = loading;
  input.disabled = loading;
  resultEl.setAttribute("aria-busy", String(loading));

  searchButton.querySelector(".button-text").textContent = loading ? "Searching..." : "Search";

  if (loading) {
    resultEl.innerHTML = `
      <div class="loading-state">
        <div class="loader" aria-hidden="true"></div>
        <div>
          <h2>Checking the archive</h2>
          <p>Fetching movie details from OMDb.</p>
        </div>
      </div>
    `;
  }
}

function saveLastSearch(title) {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, title);
  } catch (error) {
    console.warn("Could not save the last search.", error);
  }
}

function loadLastSearch() {
  try {
    return localStorage.getItem(LAST_SEARCH_KEY) || "";
  } catch (error) {
    console.warn("Could not load the last search.", error);
    return "";
  }
}

function renderMessage(message, type = "info") {
  messageEl.textContent = message;
  messageEl.className = "message";

  if (type === "error") {
    messageEl.classList.add("is-error");
  }

  if (type === "success") {
    messageEl.classList.add("is-success");
  }
}

function hasApiKey() {
  return Boolean(OMDB_API_KEY && OMDB_API_KEY !== "API_KEY");
}

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase();
}

function formatValue(value, fallback = "N/A") {
  if (!value || value === "N/A") {
    return fallback;
  }

  return value;
}

function formatRating(rating) {
  const formattedRating = formatValue(rating, "");
  return formattedRating ? `${formattedRating}/10 IMDb` : "";
}

function getFriendlyErrorMessage(error) {
  if (error.message === "Movie not found!" || error.message === "not-found") {
    return "No movie was found for that title. Try a different or more exact name.";
  }

  if (error.message === "Invalid API key!") {
    return "The OMDb API key is invalid. Please check OMDB_API_KEY in app.js.";
  }

  if (error.message === "network") {
    return "The movie service could not be reached. Check your connection and try again.";
  }

  return "Something went wrong while searching. Please try again.";
}

function handleUnexpectedSearchError(error) {
  console.error("Unexpected search error:", error);
  setLoading(false);
  renderError("Something unexpected happened. Please refresh the page and try again.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
