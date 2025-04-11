import { writable } from "svelte/store";

// Load preferences from localStorage if available
const loadFromStorage = () => {
  try {
    const storedSettings = localStorage.getItem("displaySettings");
    if (storedSettings) {
      return JSON.parse(storedSettings);
    }
  } catch (e) {
    console.error("Failed to load settings from localStorage", e);
  }
  return {};
};

// Default settings
const defaultSettings = {
  showStats: true,
  preprocessQuery: true,
  sortMode: "last_visit", // Default sort mode
};

// Combine stored settings with defaults
const initialSettings = {
  ...defaultSettings,
  ...loadFromStorage(),
};

// Create the writable store
const settings = writable(initialSettings);

// Subscribe to changes and save to localStorage
settings.subscribe((value) => {
  try {
    localStorage.setItem("displaySettings", JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
});

export const displaySettings = settings;
