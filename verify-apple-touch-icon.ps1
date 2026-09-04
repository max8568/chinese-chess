param(
    [string]$IconPath = (Join-Path $PSScriptRoot 'apple-touch-icon.png'),
    [double]$Tolerance = 1.0
)

Add-Type -AssemblyName System.Drawing

$bitmap = [System.Drawing.Bitmap]::FromFile($IconPath)
try {
    if ($bitmap.Width -ne 180 -or $bitmap.Height -ne 180) {
        throw "Expected 180x180, got $($bitmap.Width)x$($bitmap.Height)."
    }

    $minimumX = $bitmap.Width
    $minimumY = $bitmap.Height
    $maximumX = -1
    $maximumY = -1

    for ($y = 0; $y -lt $bitmap.Height; $y++) {
        for ($x = 0; $x -lt $bitmap.Width; $x++) {
            $pixel = $bitmap.GetPixel($x, $y)
            # Isolate the pale honey-wood token from the dark walnut background.
            if ($pixel.R -ge 130 -and $pixel.G -ge 80 -and $pixel.B -ge 35) {
                $minimumX = [math]::Min($minimumX, $x)
                $maximumX = [math]::Max($maximumX, $x)
                $minimumY = [math]::Min($minimumY, $y)
                $maximumY = [math]::Max($maximumY, $y)
            }
        }
    }

    if ($maximumX -lt 0) {
        throw 'Could not detect the chess piece foreground.'
    }

    $foregroundCenterX = ($minimumX + $maximumX) / 2.0
    $foregroundCenterY = ($minimumY + $maximumY) / 2.0
    $canvasCenter = 89.5
    $offsetX = $foregroundCenterX - $canvasCenter
    $offsetY = $foregroundCenterY - $canvasCenter

    Write-Host "Foreground bounds: ($minimumX,$minimumY)-($maximumX,$maximumY)"
    Write-Host "Foreground center: $foregroundCenterX,$foregroundCenterY"
    Write-Host "Canvas center: $canvasCenter,$canvasCenter"

    if ([math]::Abs($offsetX) -gt $Tolerance -or [math]::Abs($offsetY) -gt $Tolerance) {
        throw "Chess piece is off-center by ($offsetX,$offsetY) px; tolerance=$Tolerance px."
    }

    $haloPixels = 0
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
        for ($x = 0; $x -lt $bitmap.Width; $x++) {
            $deltaX = $x - $canvasCenter
            $deltaY = $y - $canvasCenter
            $radius = [math]::Sqrt(($deltaX * $deltaX) + ($deltaY * $deltaY))
            if ($radius -ge 68 -and $radius -le 82) {
                $pixel = $bitmap.GetPixel($x, $y)
                $maximum = [math]::Max($pixel.R, [math]::Max($pixel.G, $pixel.B))
                $minimum = [math]::Min($pixel.R, [math]::Min($pixel.G, $pixel.B))
                if ($minimum -ge 100 -and ($maximum - $minimum) -le 20) {
                    $haloPixels++
                }
            }
        }
    }
    Write-Host "Neutral bright halo pixels: $haloPixels"
    if ($haloPixels -gt 20) {
        throw "Broken gray/white edge detected: $haloPixels halo pixels; maximum allowed=20."
    }

    Write-Host 'PASS: chess piece is centered.'
}
finally {
    $bitmap.Dispose()
}
