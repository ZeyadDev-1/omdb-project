const OMDB_API_KEY = "6771de16";
const OMDB_API_URL = "https://www.omdbapi.com/";
const SEARCH_STATE_KEY = "omdb:lastSuccessfulSearch";
const DEFAULT_SEARCH_STATE = {
  title: "",
  type: "",
  year: "",
  plot: "full",
};
const VALID_TYPES = ["", "movie", "series", "episode"];
const VALID_PLOTS = ["short", "full"];

const movieCache = new Map();
let isLoading = false;

const form = document.querySelector("#movie-form");
const input = document.querySelector("#movie-title");
const typeSelect = document.querySelector("#movie-type");
const yearInput = document.querySelector("#movie-year");
const plotSelect = document.querySelector("#movie-plot");
const searchButton = document.querySelector("#search-button");
const messageEl = document.querySelector("#search-message");
const resultEl = document.querySelector("#movie-result");
const searchControls = [input, typeSelect, yearInput, plotSelect];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchMovie(input.value, getSearchOptions()).catch(handleUnexpectedSearchError);
});

[typeSelect, plotSelect].forEach((control) => {
  control.addEventListener("change", saveFilterPreferences);
});
yearInput.addEventListener("input", saveFilterPreferences);

document.addEventListener("DOMContentLoaded", () => {
  const savedState = loadSearchState();

  applySearchState(savedState);

  if (savedState.title) {
    searchMovie(savedState.title, getSearchOptions()).catch(handleUnexpectedSearchError);
  }
});

async function searchMovie(rawTitle, options = getSearchOptions()) {
  const title = String(rawTitle || "").trim();
  const searchOptions = normalizeSearchOptions(options);

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

  saveSearchState({ title, ...searchOptions });

  const cacheKey = createCacheKey(title, searchOptions);
  const cachedMovie = movieCache.get(cacheKey);

  if (cachedMovie) {
    renderMovie(cachedMovie);
    renderMessage("Loaded from this session's cache.", "success");
    return;
  }

  setLoading(true);
  renderMessage(`Searching for "${title}"...`);

  try {
    const movie = await fetchMovie(title, searchOptions);

    movieCache.set(cacheKey, movie);
    movieCache.set(createCacheKey(movie.Title, searchOptions), movie);
    renderMovie(movie);
    renderMessage(`Showing results for "${movie.Title}".`, "success");
  } catch (error) {
    renderError(getFriendlyErrorMessage(error));
  } finally {
    setLoading(false);
  }
}

async function fetchMovie(title, options) {
  const params = new URLSearchParams({
    apikey: OMDB_API_KEY,
    t: title,
    plot: options.plot,
  });

  if (options.type) {
    params.set("type", options.type);
  }

  if (options.year) {
    params.set("y", options.year);
  }

  const url = `${OMDB_API_URL}?${params.toString()}`;
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
          ${renderPill("Genre", movie.Genre)}
          ${renderPill("Year", movie.Year)}
          ${renderPill("Type", formatType(movie.Type))}
          ${renderPill("IMDb", formatRating(movie.imdbRating))}
        </div>
        <h2 class="movie-title">${escapeHtml(formatValue(movie.Title))}</h2>
        <p class="plot">${escapeHtml(formatValue(movie.Plot, "No plot is available for this movie."))}</p>
        <dl class="details-grid">
          ${renderDetail("Year", movie.Year)}
          ${renderDetail("Genre", movie.Genre)}
          ${renderDetail("Type", formatType(movie.Type))}
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

function renderPill(label, value) {
  const formattedValue = formatValue(value, "");

  if (!formattedValue) {
    return "";
  }

  return `
    <span class="pill">
      <span class="pill-label">${escapeHtml(label)}</span>
      ${escapeHtml(formattedValue)}
    </span>
  `;
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
  searchControls.forEach((control) => {
    control.disabled = loading;
  });
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

function getSearchOptions() {
  return normalizeSearchOptions({
    type: typeSelect.value,
    year: yearInput.value,
    plot: plotSelect.value,
  });
}

function saveFilterPreferences() {
  const savedState = loadSearchState();
  saveSearchState({
    ...savedState,
    ...getSearchOptions(),
  });
}

function saveSearchState(state) {
  const normalizedState = {
    title: String(state.title || "").trim(),
    ...normalizeSearchOptions(state),
  };

  try {
    localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(normalizedState));
  } catch (error) {
    console.warn("Could not save the search settings.", error);
  }
}

function loadSearchState() {
  try {
    const storedState = localStorage.getItem(SEARCH_STATE_KEY);

    if (!storedState) {
      return { ...DEFAULT_SEARCH_STATE };
    }

    try {
      return normalizeSearchState(JSON.parse(storedState));
    } catch (error) {
      return normalizeSearchState({ title: storedState });
    }
  } catch (error) {
    console.warn("Could not load the search settings.", error);
    return { ...DEFAULT_SEARCH_STATE };
  }
}

function applySearchState(state) {
  const normalizedState = normalizeSearchState(state);
  input.value = normalizedState.title;
  typeSelect.value = normalizedState.type;
  yearInput.value = normalizedState.year;
  plotSelect.value = normalizedState.plot;
}

function normalizeSearchState(state) {
  return {
    title: String(state.title || "").trim(),
    ...normalizeSearchOptions(state),
  };
}

function normalizeSearchOptions(options) {
  const type = String(options.type || "").toLowerCase();
  const plot = String(options.plot || DEFAULT_SEARCH_STATE.plot).toLowerCase();

  return {
    type: VALID_TYPES.includes(type) ? type : DEFAULT_SEARCH_STATE.type,
    year: String(options.year || "").trim(),
    plot: VALID_PLOTS.includes(plot) ? plot : DEFAULT_SEARCH_STATE.plot,
  };
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

function createCacheKey(title, options) {
  const searchOptions = normalizeSearchOptions(options);
  return [
    normalizeTitle(title),
    searchOptions.type || "any",
    searchOptions.year,
    searchOptions.plot,
  ].join("|");
}

function formatValue(value, fallback = "Not available") {
  if (!value || value === "N/A") {
    return fallback;
  }

  return value;
}

function formatType(type) {
  const formattedType = formatValue(type, "");

  if (!formattedType) {
    return "";
  }

  return formattedType.charAt(0).toUpperCase() + formattedType.slice(1);
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
