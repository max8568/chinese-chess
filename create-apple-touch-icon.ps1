param(
    [string]$MasterPath = (Join-Path $PSScriptRoot 'assets/icon/apple-touch-icon-master.png'),
    [string]$OutputPath = (Join-Path $PSScriptRoot 'apple-touch-icon.png'),
    [int]$VerticalOffset = 6
)

Add-Type -AssemblyName System.Drawing

$master = [System.Drawing.Bitmap]::FromFile($MasterPath)
try {
    $scaled = New-Object System.Drawing.Bitmap 180, 180, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $scaled.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($scaled)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($master, [System.Drawing.Rectangle]::new(0, 0, 180, 180))
    $graphics.Dispose()

    $icon = New-Object System.Drawing.Bitmap 180, 180, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $icon.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Keep the clean full-bleed ImageGen background, then shift the complete
    # artwork down by the measured 6 px. The subject does not touch the cropped
    # bottom edge, so this preserves the icon without introducing a cutout halo.
    $graphics.DrawImageUnscaled($scaled, 0, 0)
    $graphics.DrawImage($scaled, [System.Drawing.Rectangle]::new(0, $VerticalOffset, 180, 180))
    $graphics.Dispose()
    $scaled.Dispose()

    $temporaryPath = "$OutputPath.new.png"
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
    $icon.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()
    Move-Item -LiteralPath $temporaryPath -Destination $OutputPath -Force
}
finally {
    $master.Dispose()
}
