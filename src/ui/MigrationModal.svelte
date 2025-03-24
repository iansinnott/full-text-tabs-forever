<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import { rpc } from "./lib/rpc";

  export let open = false;

  let isImporting = false;
  let isMigrated = false;
  let vlcnImportMessage = "";
  let migrationProgress = 0;
  let totalDocuments = 0;
  let showMigrationUI = false;

  // Track if migration was completed successfully
  let migrationComplete = false;
  let autoCloseTimer = null;

  // Define message listener function
  const handleMessage = (message) => {
    if (message.type === "vlcnMigrationStatus") {
      console.log("Migration status update:", message);

      if (message.status === "starting" || message.status === "fetching") {
        vlcnImportMessage = message.message;
      } else if (message.status === "importing") {
        totalDocuments = message.total;
        migrationProgress = message.current;
        vlcnImportMessage = message.message;
      } else if (message.status === "progress") {
        migrationProgress = message.current;
        vlcnImportMessage = `Imported ${message.current} of ${message.total} documents...`;
      } else if (message.status === "complete") {
        isImporting = false;
        vlcnImportMessage = message.message;
        migrationProgress = totalDocuments;
        migrationComplete = true;
        isMigrated = true;

        // Set a timer to close the modal after showing the success message
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        autoCloseTimer = setTimeout(() => {
          open = false;
          setTimeout(() => window.location.reload(), 1000); // This is the simple way to trigger the count to refresh on the main page
          const dispatch = createEventDispatcher();
          dispatch("close");
          dispatch("migrationComplete", { success: true });
        }, 5000); // Show success message for 5 seconds before closing
      } else if (message.status === "error") {
        isImporting = false;
        vlcnImportMessage = message.message;
      } else if (message.status === "empty") {
        isImporting = false;
        vlcnImportMessage = message.message;
      }
    }
    return true;
  };

  // Setup and tear down listener
  const setupMigrationListener = () => {
    chrome.runtime.onMessage.addListener(handleMessage);
  };

  const removeMigrationListener = () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  };

  onMount(async () => {
    setupMigrationListener();
    await checkVLCNMigrationStatus();
  });

  onDestroy(() => {
    removeMigrationListener();
    // Clear any pending timers
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  });

  // Reset state when reused
  const resetState = () => {
    isImporting = false;
    migrationProgress = 0;
    totalDocuments = 0;
    vlcnImportMessage = "";
    migrationComplete = false;

    // Also clear any pending timers
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  };

  // Watch for open prop changes to refresh data
  $: if (open) {
    checkVLCNMigrationStatus();
  }

  const checkVLCNMigrationStatus = async () => {
    // Reset the state to prevent flashing old data
    resetState();

    try {
      // First, check if the VLCN backend is available and has been migrated
      const response = await rpc(["checkVLCNMigrationStatus"]);
      if (response?.migrated) {
        isMigrated = true;
        vlcnImportMessage = "VLCN database has already been migrated to PgLite.";
        showMigrationUI = false;
      } else if (response?.available) {
        showMigrationUI = true;
        isMigrated = false;
        vlcnImportMessage = `Found ${response.documentCount} documents to migrate from VLCN database.`;
      } else {
        showMigrationUI = false;
        vlcnImportMessage = "No VLCN database found. If you're a new user, you can ignore this.";
      }
    } catch (error) {
      console.error("Error checking VLCN migration status", error);
      showMigrationUI = false;
    }
  };

  const dispatch = createEventDispatcher();

  const importVLCNDatabase = async () => {
    // Reset any previous state
    migrationComplete = false;
    isImporting = true;
    migrationProgress = 0;
    vlcnImportMessage = "Initializing VLCN database migration...";

    try {
      await rpc(["importVLCNDocumentsV1"]);
      // Status updates will come through the message listener
      // When complete, the listener will set migrationComplete = true
      // and schedule auto-closing after a delay
    } catch (error) {
      isImporting = false;
      vlcnImportMessage = `Error importing VLCN database: ${error.message}`;
      dispatch("migrationError", { error: error.message });
    }
  };
</script>

<Modal
  open={open && (showMigrationUI || migrationComplete)}
  title={migrationComplete ? "Migration Complete" : "Database Migration Available"}
  wideContent={false}
  on:close
>
  <div class="text-sm text-slate-300">
    {#if migrationComplete}
      <div class="flex flex-col items-center text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 text-green-500 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 class="text-xl font-semibold text-green-400 mb-2">Migration Complete!</h3>
        <p class="mb-4">{vlcnImportMessage}</p>
        <p class="text-sm text-gray-400">
          This dialog will close automatically in a few seconds...
        </p>
      </div>
    {:else}
      <p class="mb-4">
        We detected data from a previous version of Full Text Tabs Forever. Would you like to
        migrate your search index to the new version?
      </p>
      <p class="mb-4">
        The import process may take several minutes depending on the size of your database.
      </p>
      <div class="mt-4">
        <button
          on:click={importVLCNDatabase}
          class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isImporting || isMigrated}
        >
          {#if isImporting}
            Importing...
          {:else if isMigrated}
            Already Migrated
          {:else}
            Import VLCN Database
          {/if}
        </button>
      </div>
      {#if vlcnImportMessage && !migrationComplete}
        <div class="mt-4">
          <p
            class:text-green-500={vlcnImportMessage.includes("successfully")}
            class:text-red-500={vlcnImportMessage.includes("Error") ||
              vlcnImportMessage.includes("failed")}
            class:text-yellow-500={vlcnImportMessage.includes("already been migrated")}
          >
            {vlcnImportMessage}
          </p>

          {#if isImporting && totalDocuments > 0}
            <div class="mt-2">
              <div class="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                <div
                  class="bg-pink-800 h-2.5 rounded-full"
                  style="width: {(migrationProgress / totalDocuments) * 100}%"
                ></div>
              </div>
              <p class="text-xs text-gray-400 text-right">
                {migrationProgress} of {totalDocuments} documents
              </p>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</Modal>
