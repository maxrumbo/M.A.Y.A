# ==============================================================================
# M.A.Y.A. Brand Icon & Splash PNG Generator (Android Resources)
# ==============================================================================
# Menghasilkan ikon launcher PNG (mdpi - xxxhdpi) dan splash screen solid gelap
# dengan logo geometris M.A.Y.A. (#121318 + #F8F9FA + aksen #6366F1).
# ==============================================================================

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$resRoot = Join-Path $repoRoot "maya-client\android\app\src\main\res"

$bgColor = [System.Drawing.Color]::FromArgb(255, 18, 19, 24)      # #121318
$fgColor = [System.Drawing.Color]::FromArgb(255, 248, 249, 250)   # #F8F9FA
$dotColor = [System.Drawing.Color]::FromArgb(255, 99, 102, 241)   # #6366F1

function Draw-MayaMark {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$CenterX,
        [float]$CenterY,
        [float]$MarkSize
    )
    # MarkSize = skala setara 64px viewBox -> M di (17,44)-(17,23)-(32,36)-(47,23)-(47,44), dot di (32,18) r=3.2
    $scale = $MarkSize / 64.0
    $offsetX = $CenterX - (32.0 * $scale)
    $offsetY = $CenterY - (32.0 * $scale)

    $strokeWidth = [float](4.8 * $scale)
    $pen = New-Object System.Drawing.Pen($fgColor, $strokeWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $pts = @(
        (New-Object System.Drawing.PointF(($offsetX + 17 * $scale), ($offsetY + 44 * $scale))),
        (New-Object System.Drawing.PointF(($offsetX + 17 * $scale), ($offsetY + 23 * $scale))),
        (New-Object System.Drawing.PointF(($offsetX + 32 * $scale), ($offsetY + 36 * $scale))),
        (New-Object System.Drawing.PointF(($offsetX + 47 * $scale), ($offsetY + 23 * $scale))),
        (New-Object System.Drawing.PointF(($offsetX + 47 * $scale), ($offsetY + 44 * $scale)))
    )
    $Graphics.DrawLines($pen, $pts)
    $pen.Dispose()

    $dotR = [float](3.3 * $scale)
    $dotX = [float]($offsetX + 32 * $scale - $dotR)
    $dotY = [float]($offsetY + 18 * $scale - $dotR)
    $brush = New-Object System.Drawing.SolidBrush($dotColor)
    $Graphics.FillEllipse($brush, $dotX, $dotY, ($dotR * 2), ($dotR * 2))
    $brush.Dispose()
}

function Save-RoundedTileIcon {
    param([string]$OutPath, [int]$Size, [bool]$IsRound)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($Size * 0.04)
    $rectSize = [float]($Size - ($pad * 2))
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)

    if ($IsRound) {
        $g.FillEllipse($bgBrush, $pad, $pad, $rectSize, $rectSize)
    } else {
        $r = [float]($Size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $r * 2
        $path.AddArc($pad, $pad, $d, $d, 180, 90)
        $path.AddArc(($pad + $rectSize - $d), $pad, $d, $d, 270, 90)
        $path.AddArc(($pad + $rectSize - $d), ($pad + $rectSize - $d), $d, $d, 0, 90)
        $path.AddArc($pad, ($pad + $rectSize - $d), $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
        $path.Dispose()
    }
    $bgBrush.Dispose()

    Draw-MayaMark -Graphics $g -CenterX ($Size / 2.0) -CenterY ($Size / 2.0) -MarkSize ($Size * 0.84)
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Save-ForegroundIcon {
    param([string]$OutPath, [int]$Size)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Adaptive icon safe zone adalah 66/108 (~61%) di tengah
    Draw-MayaMark -Graphics $g -CenterX ($Size / 2.0) -CenterY ($Size / 2.0) -MarkSize ($Size * 0.62)
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Save-SplashPng {
    param([string]$OutPath, [int]$Width, [int]$Height)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bgColor)

    $minDim = [Math]::Min($Width, $Height)
    $markSize = [Math]::Max(72, [Math]::Min(240, $minDim * 0.24))
    Draw-MayaMark -Graphics $g -CenterX ($Width / 2.0) -CenterY ($Height / 2.0) -MarkSize $markSize
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# 1. Generate mipmap densities
$densities = @(
    @{ Dir = "mipmap-mdpi";    Icon = 48;  Fg = 108 },
    @{ Dir = "mipmap-hdpi";    Icon = 72;  Fg = 162 },
    @{ Dir = "mipmap-xhdpi";   Icon = 96;  Fg = 216 },
    @{ Dir = "mipmap-xxhdpi";  Icon = 144; Fg = 324 },
    @{ Dir = "mipmap-xxxhdpi"; Icon = 192; Fg = 432 }
)

foreach ($d in $densities) {
    $dirPath = Join-Path $resRoot $d.Dir
    if (Test-Path $dirPath) {
        Save-RoundedTileIcon -OutPath (Join-Path $dirPath "ic_launcher.png") -Size $d.Icon -IsRound $false
        Save-RoundedTileIcon -OutPath (Join-Path $dirPath "ic_launcher_round.png") -Size $d.Icon -IsRound $true
        Save-ForegroundIcon  -OutPath (Join-Path $dirPath "ic_launcher_foreground.png") -Size $d.Fg
        Write-Host "[OK] Generated launcher PNGs in $($d.Dir)" -ForegroundColor Green
    }
}

# 2. Overwrite all splash.png preserving original dimensions
$splashFiles = Get-ChildItem -Path $resRoot -Recurse -Filter "splash.png"
foreach ($sf in $splashFiles) {
    $img = [System.Drawing.Image]::FromFile($sf.FullName)
    $w = $img.Width
    $h = $img.Height
    $img.Dispose()
    Save-SplashPng -OutPath $sf.FullName -Width $w -Height $h
    Write-Host "[OK] Updated splash: $($sf.Directory.Name)/$($sf.Name) (${w}x${h})" -ForegroundColor Cyan
}

Write-Host "Brand icon & splash generation complete." -ForegroundColor Green
