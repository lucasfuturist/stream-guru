# =================================================================================
#  Stream Guru Prompt Evolver Pipeline (v2 - Real-Time Streaming)
# =================================================================================

# --- CONFIGURATION ---
$targetScore = 4.75
$generation = 1
$highestScore = 0

# Clear the screen for a clean run
Clear-Host

Write-Host "🚀 Starting the Prompt Evolution Pipeline!" -ForegroundColor Green
Write-Host "   - The process will continue until a prompt scores >= $targetScore / 5.00"

# The main evolutionary loop
while ($highestScore -lt $targetScore) {
    Write-Host "`n"
    Write-Host "---🧬 Starting Evolution: GENERATION #$generation 🧬---" -ForegroundColor Yellow

    # --- THIS IS THE FIX ---
    # We create an array to store the output lines.
    $outputLines = @()
    
    # We now execute the Deno script and pipe its output to a loop.
    # This processes each line as it comes in, allowing for real-time display.
    & deno run -A scripts/prompt_optimizer.ts 2>&1 | ForEach-Object {
        # Display the line in the console immediately
        Write-Host $_
        # Add the line to our array to save it for later
        $outputLines += $_
    }
    
    # Re-assemble the full output from the lines we saved.
    $output = $outputLines -join [System.Environment]::NewLine
    # --- END OF FIX ---

    # The rest of the script remains the same, as it now has the full output to analyze.
    $match = $output | Select-String -Pattern '\|\s*#1\s*\|\s*([\d.]+)'

    if ($match) {
        $scoreString = $match.Matches[0].Groups[1].Value
        $highestScore = [double]$scoreString

        Write-Host "`n✅ Generation #$generation Complete. Champion Score: $highestScore" -ForegroundColor Green

        if ($highestScore -ge $targetScore) {
            Write-Host "`n🎉🎉🎉 TARGET SCORE ACHIEVED! 🎉🎉🎉" -ForegroundColor Cyan
            Write-Host "An elite prompt has been discovered. The process is complete."
            break
        } else {
            Write-Host "   - Score is below target. Preparing for the next generation..." -ForegroundColor Magenta
            Start-Sleep -Seconds 3
        }
    } else {
        Write-Host "`n❌ ERROR: Could not find the champion's score in the script output." -ForegroundColor Red
        Write-Host "   - The prompt_optimizer.ts script may have failed. Aborting pipeline."
        break
    }

    $generation++
}

Write-Host "`n🏆 The champion prompt and its evolved children are saved in 'scripts\utils\prompt_population.json'."