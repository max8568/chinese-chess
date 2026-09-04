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

function Rectify-BoardGrid {
    param([string]$BoardPath)

    $board = [System.Drawing.Bitmap]::FromFile($BoardPath)
    $fixed = New-Object System.Drawing.Bitmap 2048, 2304, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $fixed.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($fixed)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Source coordinates detected from the generated board. Each irregular cell
    # is mapped to a precise 220 x 220 px destination cell. The outer margins are
    # mapped separately so the original wooden frame and lettering are retained.
    $sourceX = @(0, 98, 314, 536, 764, 992, 1216, 1440, 1660, 1951, 2048)
    $destinationX = @(0, 144, 364, 584, 804, 1024, 1244, 1464, 1684, 1904, 2048)
    $sourceY = @(0, 87, 280, 477, 677, 874, 1070, 1264, 1458, 1652, 1853, 1952)
    $destinationY = @(0, 162, 382, 602, 822, 1042, 1262, 1482, 1702, 1922, 2142, 2304)

    for ($row = 0; $row -lt ($sourceY.Count - 1); $row++) {
        for ($column = 0; $column -lt ($sourceX.Count - 1); $column++) {
            $sourceRectangle = [System.Drawing.Rectangle]::new(
                $sourceX[$column],
                $sourceY[$row],
                $sourceX[$column + 1] - $sourceX[$column],
                $sourceY[$row + 1] - $sourceY[$row]
            )
            $destinationRectangle = [System.Drawing.Rectangle]::new(
                $destinationX[$column],
                $destinationY[$row],
                $destinationX[$column + 1] - $destinationX[$column],
                $destinationY[$row + 1] - $destinationY[$row]
            )
            $graphics.DrawImage($board, $destinationRectangle, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
        }
    }

    # Re-ink both axes on the exact mathematical centers so antialiasing cannot
    # leave a visibly shifted line after the source cells are remapped.
    $gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(96, 65, 38)), 4
    for ($index = 0; $index -le 8; $index++) {
        $x = 144 + ($index * 220)
        if ($index -eq 0 -or $index -eq 8) {
            $graphics.DrawLine($gridPen, $x, 162, $x, 2142)
        }
        else {
            $graphics.DrawLine($gridPen, $x, 162, $x, 1042)
            $graphics.DrawLine($gridPen, $x, 1262, $x, 2142)
        }
    }
    for ($index = 0; $index -le 9; $index++) {
        $y = 162 + ($index * 220)
        $graphics.DrawLine($gridPen, 144, $y, 1904, $y)
    }
    $gridPen.Dispose()

    $graphics.Dispose()
    $board.Dispose()

    $temporaryPath = "$BoardPath.rectified.png"
    $fixed.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fixed.Dispose()
    Move-Item -LiteralPath $temporaryPath -Destination $BoardPath -Force
}

function Export-SquareGridOverlay {
    param([string]$RelativePath)

    $targetPath = Join-Path $OutputRoot $RelativePath
    $targetDirectory = Split-Path -Parent $targetPath
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

    $overlay = New-Object System.Drawing.Bitmap 1024, 1152, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $overlay.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($overlay)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 72, 49, 29)), 2

    $x0 = 72
    $y0 = 81
    $cell = 110
    for ($rank = 0; $rank -le 9; $rank++) {
        $y = $y0 + ($rank * $cell)
        $graphics.DrawLine($pen, $x0, $y, $x0 + (8 * $cell), $y)
    }
    for ($file = 0; $file -le 8; $file++) {
        $x = $x0 + ($file * $cell)
        if ($file -eq 0 -or $file -eq 8) {
            $graphics.DrawLine($pen, $x, $y0, $x, $y0 + (9 * $cell))
        }
        else {
            $graphics.DrawLine($pen, $x, $y0, $x, $y0 + (4 * $cell))
            $graphics.DrawLine($pen, $x, $y0 + (5 * $cell), $x, $y0 + (9 * $cell))
        }
    }

    $graphics.DrawLine($pen, $x0 + (3 * $cell), $y0, $x0 + (5 * $cell), $y0 + (2 * $cell))
    $graphics.DrawLine($pen, $x0 + (5 * $cell), $y0, $x0 + (3 * $cell), $y0 + (2 * $cell))
    $graphics.DrawLine($pen, $x0 + (3 * $cell), $y0 + (7 * $cell), $x0 + (5 * $cell), $y0 + (9 * $cell))
    $graphics.DrawLine($pen, $x0 + (5 * $cell), $y0 + (7 * $cell), $x0 + (3 * $cell), $y0 + (9 * $cell))

    $pen.Dispose()
    $graphics.Dispose()
    $overlay.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $overlay.Dispose()
}

try {
    Export-Crop 'board/board-empty.png' ([System.Drawing.Rectangle]::new(50, 21, 780, 744)) 2048 1952
    Rectify-BoardGrid (Join-Path $OutputRoot 'board/board-empty.png')
    Export-Crop 'textures/wood.png' ([System.Drawing.Rectangle]::new(878, 27, 410, 346)) 1024 1024
    Export-SquareGridOverlay 'board/grid-overlay.png'

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
