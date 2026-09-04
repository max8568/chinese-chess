param(
    [string]$BoardPath = (Join-Path $PSScriptRoot 'assets/board/board-empty.png'),
    [int]$ExpectedCellSize = 220,
    [int]$Tolerance = 3
)

Add-Type -AssemblyName System.Drawing

$bitmap = [System.Drawing.Bitmap]::FromFile($BoardPath)
try {
    $hits = @()
    $scanTop = [int]($bitmap.Height * 0.08)
    $scanBottom = [int]($bitmap.Height * 0.42)

    for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $darkPixels = 0
        for ($y = $scanTop; $y -le $scanBottom; $y += 3) {
            $pixel = $bitmap.GetPixel($x, $y)
            if ($pixel.R -lt 125 -and $pixel.G -lt 105 -and $pixel.B -lt 85) {
                $darkPixels++
            }
        }

        if ($darkPixels -gt 150) {
            $hits += $x
        }
    }

    $groups = @()
    if ($hits.Count -gt 0) {
        $start = $hits[0]
        $last = $hits[0]
        foreach ($x in $hits[1..($hits.Count - 1)]) {
            if ($x - $last -gt 1) {
                $groups += ,([pscustomobject]@{ Center = [math]::Round(($start + $last) / 2) })
                $start = $x
            }
            $last = $x
        }
        $groups += ,([pscustomobject]@{ Center = [math]::Round(($start + $last) / 2) })
    }

    # Ignore the decorative double frame near the image edges.
    $centers = @($groups | Where-Object {
        $_.Center -gt ($bitmap.Width * 0.06) -and
        $_.Center -lt ($bitmap.Width * 0.94)
    } | Select-Object -ExpandProperty Center)

    if ($centers.Count -ne 9) {
        throw "Expected 9 vertical grid lines, detected $($centers.Count): $($centers -join ', ')"
    }

    $widths = for ($index = 1; $index -lt $centers.Count; $index++) {
        $centers[$index] - $centers[$index - 1]
    }
    Write-Host "Vertical lines: $($centers -join ', ')"
    Write-Host "Cell widths: $($widths -join ', ')"

    $rowHits = @()
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
        $darkPixels = 0
        for ($x = [int]($bitmap.Width * 0.06); $x -le [int]($bitmap.Width * 0.94); $x += 3) {
            $pixel = $bitmap.GetPixel($x, $y)
            if ($pixel.R -lt 125 -and $pixel.G -lt 105 -and $pixel.B -lt 85) {
                $darkPixels++
            }
        }
        if ($darkPixels -gt 450) {
            $rowHits += $y
        }
    }

    $rowGroups = @()
    if ($rowHits.Count -gt 0) {
        $start = $rowHits[0]
        $last = $rowHits[0]
        foreach ($y in $rowHits[1..($rowHits.Count - 1)]) {
            if ($y - $last -gt 1) {
                $rowGroups += ,([pscustomobject]@{ Center = [math]::Round(($start + $last) / 2) })
                $start = $y
            }
            $last = $y
        }
        $rowGroups += ,([pscustomobject]@{ Center = [math]::Round(($start + $last) / 2) })
    }

    $rowCenters = @($rowGroups | Where-Object {
        $_.Center -gt ($bitmap.Height * 0.06) -and
        $_.Center -lt ($bitmap.Height * 0.94)
    } | Select-Object -ExpandProperty Center)

    if ($rowCenters.Count -ne 10) {
        throw "Expected 10 horizontal grid lines, detected $($rowCenters.Count): $($rowCenters -join ', ')"
    }

    $heights = for ($index = 1; $index -lt $rowCenters.Count; $index++) {
        $rowCenters[$index] - $rowCenters[$index - 1]
    }
    Write-Host "Horizontal lines: $($rowCenters -join ', ')"
    Write-Host "Cell heights: $($heights -join ', ')"

    $allDimensions = @($widths) + @($heights)
    $minimum = ($allDimensions | Measure-Object -Minimum).Minimum
    $maximum = ($allDimensions | Measure-Object -Maximum).Maximum
    if (($maximum - $minimum) -gt $Tolerance) {
        throw "Cells are not square: min=$minimum px, max=$maximum px, tolerance=$Tolerance px"
    }
    if ([math]::Abs((($allDimensions | Measure-Object -Average).Average) - $ExpectedCellSize) -gt $Tolerance) {
        throw "Cell size is not $ExpectedCellSize px within tolerance $Tolerance px"
    }

    Write-Host "PASS: all 8 x 9 cells are square at $ExpectedCellSize x $ExpectedCellSize px within $Tolerance px."
}
finally {
    $bitmap.Dispose()
}
