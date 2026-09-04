param(
    [string]$Source = (Join-Path $PSScriptRoot 'xiangqi-assets-sheet.png'),
    [string]$OutputRoot = (Join-Path $PSScriptRoot 'assets')
)

Add-Type -AssemblyName System.Drawing

$sourceImage = [System.Drawing.Bitmap]::FromFile($Source)

function Export-Crop {
    param(
        [string]$RelativePath,
        [System.Drawing.Rectangle]$Crop,
        [int]$Width,
        [int]$Height,
        [switch]$RemoveCheckerboard
    )

    $targetPath = Join-Path $OutputRoot $RelativePath
    $targetDirectory = Split-Path -Parent $targetPath
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

    $cropped = New-Object System.Drawing.Bitmap $Crop.Width, $Crop.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($cropped)
    $graphics.DrawImage($sourceImage, [System.Drawing.Rectangle]::new(0, 0, $Crop.Width, $Crop.Height), $Crop, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()

    if ($RemoveCheckerboard) {
        for ($y = 0; $y -lt $cropped.Height; $y++) {
            for ($x = 0; $x -lt $cropped.Width; $x++) {
                $pixel = $cropped.GetPixel($x, $y)
                $maximum = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
                $minimum = [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))
                $spread = $maximum - $minimum

                # The generator rendered a neutral checkerboard. Wood and ink are
                # chromatic, so this removes only the neutral backdrop and its soft edge.
                if ($minimum -ge 215 -and $spread -le 16) {
                    $cropped.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
                }
                elseif ($minimum -ge 190 -and $spread -le 13) {
                    $alpha = [int](255 * (215 - $minimum) / 25)
                    $cropped.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $pixel.R, $pixel.G, $pixel.B))
                }
            }
        }
    }

    $output = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $output.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($output)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($cropped, 0, 0, $Width, $Height)
    $graphics.Dispose()

    $output.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $output.Dispose()
    $cropped.Dispose()
}

try {
    Export-Crop 'board/board-empty.png' ([System.Drawing.Rectangle]::new(50, 21, 780, 744)) 2048 1952
    Export-Crop 'textures/wood.png' ([System.Drawing.Rectangle]::new(878, 27, 410, 346)) 1024 1024
    Export-Crop 'board/grid-overlay.png' ([System.Drawing.Rectangle]::new(878, 398, 410, 426)) 1024 1064 -RemoveCheckerboard

    $pieceCenters = @(127, 301, 482, 661, 842, 1023, 1205)
    $blackNames = @('rook', 'knight', 'elephant', 'advisor', 'general', 'cannon', 'soldier')
    $redNames = @('rook', 'knight', 'elephant', 'advisor', 'general', 'cannon', 'soldier')

    for ($index = 0; $index -lt $pieceCenters.Count; $index++) {
        $x = $pieceCenters[$index] - 77
        Export-Crop ("pieces/black/{0}.png" -f $blackNames[$index]) ([System.Drawing.Rectangle]::new($x, 835, 154, 154)) 512 512 -RemoveCheckerboard
        Export-Crop ("pieces/red/{0}.png" -f $redNames[$index]) ([System.Drawing.Rectangle]::new($x, 1004, 154, 154)) 512 512 -RemoveCheckerboard
    }
}
finally {
    $sourceImage.Dispose()
}

Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Sort-Object FullName | Select-Object FullName, Length
