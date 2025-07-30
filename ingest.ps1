# ===================================================================
# Stream Guru Data Ingestion Pipeline (v10 - Final Robust Version)
# ===================================================================

param(
    [int]$TotalItems = 2000,
    [switch]$TestMode,
    [switch]$EmbedOnly,
    [switch]$SeedOnly
)

# --- Main Pipeline Logic ---
$Stopwatch = [System.Diagnostics.Stopwatch]::startNew()

if ($EmbedOnly) {
    # --- EMBED ONLY MODE ---
    Write-Host "INITIALIZING PIPELINE IN EMBED ONLY MODE..." -ForegroundColor Yellow
    Write-Host "--- Starting Step: Generating AI embeddings ---" -ForegroundColor Cyan
    npx tsx scripts/embed_all.ts
    if (-not $?) { Write-Host "--- ERROR: Embedding step failed. ---" -ForegroundColor Red; exit 1 }
    Write-Host "--- Success: Embedding step completed. ---" -ForegroundColor Green

} elseif ($SeedOnly) {
    # --- SEED ONLY MODE ---
    $Message = "INITIALIZING PIPELINE IN SEED ONLY MODE to ingest approx. {0} items..." -f $TotalItems
    Write-Host $Message -ForegroundColor Yellow
    Write-Host "--- Starting Step: Fetching rich media data from TMDb ---" -ForegroundColor Cyan
    npx tsx scripts/tmdb_seed.ts $TotalItems
    if (-not $?) { Write-Host "--- ERROR: Seeding step failed. ---" -ForegroundColor Red; exit 1 }
    Write-Host "--- Success: Seeding step completed. ---" -ForegroundColor Green

} elseif ($TestMode) {
    # --- ALTERNATING TEST MODE ---
    $ITEMS_PER_PAGE = 40
    $TotalPages = [Math]::Ceiling($TotalItems / $ITEMS_PER_PAGE)
    Write-Host "INITIALIZING PIPELINE IN TEST MODE. Processing $TotalPages batches..." -ForegroundColor Yellow
    
    foreach ($i in 1..$TotalPages) {
        Write-Host ""
        Write-Host "============================================================"
        Write-Host "Processing Batch $i of $TotalPages" -ForegroundColor Yellow
        Write-Host "============================================================"

        Write-Host "--- Starting Step: Seeding data from page $i ---" -ForegroundColor Cyan
        npx tsx scripts/tmdb_seed.ts --page $i
        if (-not $?) { Write-Host "--- ERROR: Seeding step failed for page $i. ---" -ForegroundColor Red; continue }
        Write-Host "--- Success: Seeding step completed. ---" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "--- Starting Step: Embedding new items from page $i ---" -ForegroundColor Cyan
        npx tsx scripts/embed_all.ts
        if (-not $?) { Write-Host "--- ERROR: Embedding step failed for page $i. ---" -ForegroundColor Red; continue }
        Write-Host "--- Success: Embedding step completed. ---" -ForegroundColor Green
    }

} else {
    # --- DEFAULT PRODUCTION MODE ---
    $Message = "INITIALIZING PIPELINE IN PRODUCTION MODE to ingest approx. {0} items..." -f $TotalItems
    Write-Host $Message -ForegroundColor Yellow

    Write-Host ""
    Write-Host "--- Starting Step: Fetching all rich media data from TMDb ---" -ForegroundColor Cyan
    npx tsx scripts/tmdb_seed.ts $TotalItems
    if (-not $?) { Write-Host "--- ERROR: Seeding step failed. Aborting. ---" -ForegroundColor Red; exit 1 }
    Write-Host "--- Success: Seeding step completed. ---" -ForegroundColor Green

    Write-Host ""
    Write-Host "--- Starting Step: Generating all AI embeddings for new media ---" -ForegroundColor Cyan
    npx tsx scripts/embed_all.ts
    if (-not $?) { Write-Host "--- ERROR: Embedding step failed. Aborting. ---" -ForegroundColor Red; exit 1 }
    Write-Host "--- Success: Embedding step completed. ---" -ForegroundColor Green
}

$Stopwatch.Stop()
$ElapsedTime = $Stopwatch.Elapsed
$TimeOutput = "Total execution time: {0}m {1}s" -f $ElapsedTime.Minutes, $ElapsedTime.Seconds

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "PIPELINE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host $TimeOutput -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green