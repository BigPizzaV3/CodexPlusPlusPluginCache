param(
    [int]$PetWidth = 84,
    [int]$PetHeight = 92,
    [string]$AtlasPath = '',
    [string]$PetId = '',
    [string]$PetName = '',
    [string]$EnemyAtlasPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$createdNew = $false
$singleInstance = [Threading.Mutex]::new($true, 'Local\WindowispControlPrototype', [ref]$createdNew)
if (-not $createdNew) {
    [Windows.MessageBox]::Show('The controllable desktop pet is already running.', 'Windowisp') | Out-Null
    $singleInstance.Dispose()
    return
}

if (-not ('PetNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class PetNative {
    public const int GWL_EXSTYLE = -20;
    public const int GWL_STYLE = -16;
    public const long WS_EX_TRANSPARENT = 0x20L;
    public const long WS_EX_TOOLWINDOW = 0x80L;
    public const long WS_CAPTION = 0x00C00000L;
    public const int WM_HOTKEY = 0x0312;
    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_NOREPEAT = 0x4000;
    public const int DWMWA_CLOAKED = 14;

    [StructLayout(LayoutKind.Sequential)] public struct RECT {
        public int Left, Top, Right, Bottom;
    }
    [StructLayout(LayoutKind.Sequential)] public struct POINT {
        public int X, Y;
    }
    public struct PLATFORMWINDOW {
        public IntPtr Hwnd;
        public int Left, Top, Right, Bottom;
    }

    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hwnd, int id);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongPtr")] public static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
    [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int value, int size);

    private static bool TryReadPlatformWindow(IntPtr hwnd, uint ownPid, out PLATFORMWINDOW platform) {
        platform = new PLATFORMWINDOW();
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        RECT r;
        int cloaked = 0;
        DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out cloaked, sizeof(int));
        long style = GetWindowLongPtr(hwnd, GWL_STYLE).ToInt64();
        long exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64();
        if (pid == ownPid || !IsWindowVisible(hwnd) || IsIconic(hwnd) || cloaked != 0 ||
            GetWindowTextLength(hwnd) <= 0 || (style & WS_CAPTION) != WS_CAPTION ||
            (exStyle & WS_EX_TOOLWINDOW) != 0 || !GetWindowRect(hwnd, out r) ||
            r.Right - r.Left <= 80 || r.Bottom - r.Top <= 50) return false;
        platform.Hwnd = hwnd;
        platform.Left = r.Left; platform.Top = r.Top; platform.Right = r.Right; platform.Bottom = r.Bottom;
        return true;
    }

    public static bool TryGetPlatformWindow(IntPtr hwnd, uint ownPid, out PLATFORMWINDOW platform) {
        return TryReadPlatformWindow(hwnd, ownPid, out platform);
    }

    public static PLATFORMWINDOW[] GetPlatformWindows(uint ownPid) {
        var result = new List<PLATFORMWINDOW>();
        EnumWindows((hwnd, unused) => {
            PLATFORMWINDOW platform;
            if (TryReadPlatformWindow(hwnd, ownPid, out platform)) result.Add(platform);
            return true;
        }, IntPtr.Zero);
        return result.ToArray();
    }
}
'@
}

$basePetWidth = $PetWidth
$basePetHeight = $PetHeight
$petScalePercent = 85
$petScalePath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\pet-size.json'
if (Test-Path -LiteralPath $petScalePath -PathType Leaf) {
    try {
        $savedPetScale = Get-Content -LiteralPath $petScalePath -Raw | ConvertFrom-Json
        if ([int]$savedPetScale.percent -in @(70,85,100,115)) { $petScalePercent = [int]$savedPetScale.percent }
    } catch {}
}
$PetWidth = [int][Math]::Round($basePetWidth * ($petScalePercent / 100.0))
$PetHeight = [int][Math]::Round($basePetHeight * ($petScalePercent / 100.0))

$window = New-Object Windows.Window
$window.Title = 'Windowisp Player'
$window.Width = $PetWidth
$window.Height = $PetHeight
$window.WindowStyle = [Windows.WindowStyle]::None
$window.AllowsTransparency = $true
$window.Background = [Windows.Media.Brushes]::Transparent
$window.Topmost = $true
$window.ShowInTaskbar = $false
$window.ResizeMode = [Windows.ResizeMode]::NoResize
$window.Left = [Windows.SystemParameters]::VirtualScreenLeft + 80
$window.Top = [Windows.SystemParameters]::VirtualScreenTop + 80

$root = New-Object Windows.Controls.Grid
$pet = New-Object Windows.Controls.Canvas
$pet.Width = $PetWidth
$pet.Height = $PetHeight
$root.Children.Add($pet) | Out-Null
$window.Content = $root

if ([string]::IsNullOrWhiteSpace($AtlasPath)) {
    throw 'No pet atlas was supplied. Start the pet with game-mode.ps1 so it can load your Codex pet.'
}
$script:atlas = $null
if (Test-Path -LiteralPath $AtlasPath) {
    $bitmap = New-Object Windows.Media.Imaging.BitmapImage
    $bitmap.BeginInit()
    $bitmap.CacheOption = [Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $bitmap.UriSource = [Uri](Resolve-Path -LiteralPath $AtlasPath).Path
    $bitmap.EndInit()
    $bitmap.Freeze()
    if ($bitmap.PixelWidth -ne 1536 -or $bitmap.PixelHeight -ne 2288) {
        throw "Pet atlas must be a v2 1536x2288 image; got $($bitmap.PixelWidth)x$($bitmap.PixelHeight)."
    }
    $script:atlas = $bitmap
}

if ([string]::IsNullOrWhiteSpace($EnemyAtlasPath)) {
    $EnemyAtlasPath = Join-Path $PSScriptRoot 'assets\enemy\ember-imp-strip.png'
}
$enemyAtlases = @{}
$enemyFrameCache = @{}
$spriteFrameCache = @{}
$p2Atlas = $script:atlas
$p2SpriteFrameCache = @{}
foreach($enemyAtlasSpec in @(
    @('EmberImp',$EnemyAtlasPath),
    @('CinderMoth',(Join-Path $PSScriptRoot 'assets\enemy\cinder-moth-strip.png')),
    @('MossHopper',(Join-Path $PSScriptRoot 'assets\enemy\moss-hopper-strip.png')),
    @('ShellbackRoller',(Join-Path $PSScriptRoot 'assets\enemy\shellback-roller-strip.png')),
    @('StormJelly',(Join-Path $PSScriptRoot 'assets\enemy\storm-jelly-strip.png')),
    @('GloamGolem',(Join-Path $PSScriptRoot 'assets\enemy\gloam-golem-strip.png'))
)){
    if(-not(Test-Path -LiteralPath $enemyAtlasSpec[1])){continue}
    $enemyBitmap=New-Object Windows.Media.Imaging.BitmapImage
    $enemyBitmap.BeginInit();$enemyBitmap.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $enemyBitmap.UriSource=[Uri](Resolve-Path -LiteralPath $enemyAtlasSpec[1]).Path
    $enemyBitmap.EndInit();$enemyBitmap.Freeze()
    if(($enemyBitmap.PixelWidth%4)-ne0){throw "Enemy animation strip '$($enemyAtlasSpec[0])' must contain four equal-width frames."}
    $enemyAtlases[$enemyAtlasSpec[0]]=$enemyBitmap
}
$enemyTypes=@{
    EmberImp=@{Kind='FlyerShooter';Width=112.0;Height=104.0;Health=3;Speed=4.2;Score=1}
    CinderMoth=@{Kind='FlyerShooter';Width=108.0;Height=100.0;Health=2;Speed=5.0;Score=1}
    MossHopper=@{Kind='Hopper';Width=116.0;Height=92.0;Health=4;Speed=3.2;Score=2}
    ShellbackRoller=@{Kind='Roller';Width=120.0;Height=88.0;Health=6;Speed=7.2;Score=2}
    StormJelly=@{Kind='Swooper';Width=116.0;Height=106.0;Health=4;Speed=6.4;Score=2}
    GloamGolem=@{Kind='Boss';Width=184.0;Height=168.0;Health=24;Speed=2.2;Score=10}
}
$enemyMovementScale=0.8

function Get-PetSpriteFrame([int]$row, [int]$frame) {
    $key = "$row|$frame"
    if (-not $script:spriteFrameCache.ContainsKey($key)) {
        $crop = [Windows.Media.Imaging.CroppedBitmap]::new($script:atlas, [Windows.Int32Rect]::new(($frame * 192), ($row * 208), 192, 208))
        $crop.Freeze()
        $script:spriteFrameCache[$key] = $crop
    }
    return $script:spriteFrameCache[$key]
}

function Get-P2SpriteFrame([int]$row,[int]$frame) {
    $key="$row|$frame"
    if(-not$script:p2SpriteFrameCache.ContainsKey($key)){
        $crop=[Windows.Media.Imaging.CroppedBitmap]::new($script:p2Atlas,[Windows.Int32Rect]::new(($frame*192),($row*208),192,208))
        $crop.Freeze();$script:p2SpriteFrameCache[$key]=$crop
    }
    return $script:p2SpriteFrameCache[$key]
}

function Add-Ellipse([double]$x, [double]$y, [double]$w, [double]$h, $fill, $stroke = $null, [double]$thickness = 0) {
    $shape = New-Object Windows.Shapes.Ellipse
    $shape.Width = $w; $shape.Height = $h; $shape.Fill = $fill
    if ($stroke) { $shape.Stroke = $stroke; $shape.StrokeThickness = $thickness }
    [Windows.Controls.Canvas]::SetLeft($shape, $x)
    [Windows.Controls.Canvas]::SetTop($shape, $y)
    $pet.Children.Add($shape) | Out-Null
}

function Draw-Pet([bool]$active, [string]$state, [int]$facing, [int]$frame) {
    $renderKey = "$active|$state|$facing|$frame"
    if ($script:lastRenderKey -eq $renderKey) { return }
    $script:lastRenderKey = $renderKey
    $pet.Children.Clear()
    if ($null -ne $atlas) {
        $row = if ($state -eq 'attack') { 3 } elseif ($state -eq 'jump') { 4 } elseif ($state -eq 'run' -and $facing -lt 0) { 2 } elseif ($state -eq 'run') { 1 } else { 0 }
        $sprite = New-Object Windows.Controls.Image
        $sprite.Width = $PetWidth; $sprite.Height = $PetHeight
        $sprite.Stretch = [Windows.Media.Stretch]::Uniform
        $sprite.Source = Get-PetSpriteFrame $row $frame
        $pet.Children.Add($sprite) | Out-Null
    } else {
        $outline = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(48, 37, 70))
        $body = if ($active) { New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(130, 230, 255)) } else { New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(164, 148, 222)) }
        $belly = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(241, 238, 255))
        Add-Ellipse 13 18 58 66 $body $outline 3
        Add-Ellipse 23 46 38 33 $belly
        Add-Ellipse 25 35 9 12 ([Windows.Media.Brushes]::White) $outline 2
        Add-Ellipse 50 35 9 12 ([Windows.Media.Brushes]::White) $outline 2
        $pupilShift = if ($facing -lt 0) { -2 } elseif ($facing -gt 0) { 2 } else { 0 }
        Add-Ellipse (28 + $pupilShift) 39 4 6 $outline
        Add-Ellipse (53 + $pupilShift) 39 4 6 $outline
        Add-Ellipse 18 76 24 12 $body $outline 3
        Add-Ellipse 43 76 24 12 $body $outline 3
    }

    if ($state -eq 'attack') {
        $charge = New-Object Windows.Shapes.Ellipse
        $charge.Width = 16 + ($frame * 2); $charge.Height = $charge.Width
        $charge.Fill = [Windows.Media.RadialGradientBrush]::new(
            [Windows.Media.Colors]::White,
            [Windows.Media.Color]::FromRgb(255, 72, 8)
        )
        [Windows.Controls.Canvas]::SetLeft($charge, $(if ($facing -lt 0) { 2 } else { $PetWidth - $charge.Width - 2 }))
        [Windows.Controls.Canvas]::SetTop($charge, 32)
        $pet.Children.Add($charge) | Out-Null
    }
    if ($script:twoPlayerActive) {
        $badge = New-Object Windows.Controls.Border
        $badge.Width = 25; $badge.Height = 18; $badge.CornerRadius = [Windows.CornerRadius]::new(8)
        $badge.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(50, 151, 238))
        $label = New-Object Windows.Controls.TextBlock
        $label.Text = 'P1'; $label.Foreground = [Windows.Media.Brushes]::White; $label.FontSize = 10
        $label.FontWeight = [Windows.FontWeights]::Bold; $label.HorizontalAlignment = 'Center'; $label.VerticalAlignment = 'Center'
        $badge.Child = $label; [Windows.Controls.Canvas]::SetLeft($badge, $PetWidth - 28); [Windows.Controls.Canvas]::SetTop($badge, 2)
        $pet.Children.Add($badge) | Out-Null
    }

}

function Draw-Player2([string]$state, [int]$facing, [int]$frame) {
    if ($null -eq $script:player2Canvas) { return }
    $key = "$state|$facing|$frame"
    if ($script:p2LastRenderKey -eq $key) { return }
    $script:p2LastRenderKey = $key; $script:player2Canvas.Children.Clear()
    $row = if ($state -eq 'attack') { 3 } elseif ($state -eq 'jump') { 4 } elseif ($state -eq 'run' -and $facing -lt 0) { 2 } elseif ($state -eq 'run') { 1 } else { 0 }
    $sprite = New-Object Windows.Controls.Image
    $sprite.Width = $PetWidth; $sprite.Height = $PetHeight; $sprite.Stretch = [Windows.Media.Stretch]::Uniform
    $sprite.Source = Get-P2SpriteFrame $row $frame
    if($null-eq$script:p2GlowEffect){
        $script:p2GlowEffect=New-Object Windows.Media.Effects.DropShadowEffect
        $script:p2GlowEffect.Color=[Windows.Media.Color]::FromRgb(236,67,190)
        $script:p2GlowEffect.BlurRadius=18;$script:p2GlowEffect.ShadowDepth=0;$script:p2GlowEffect.Opacity=.95
        if($script:p2GlowEffect.CanFreeze){$script:p2GlowEffect.Freeze()}
    }
    $sprite.Effect=$script:p2GlowEffect
    $script:player2Canvas.Children.Add($sprite) | Out-Null
    $badge = New-Object Windows.Controls.Border
    $badge.Width = 25; $badge.Height = 18; $badge.CornerRadius = [Windows.CornerRadius]::new(8)
    $badge.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(216, 48, 165))
    $label = New-Object Windows.Controls.TextBlock
    $label.Text = 'P2'; $label.Foreground = [Windows.Media.Brushes]::White; $label.FontSize = 10
    $label.FontWeight = [Windows.FontWeights]::Bold; $label.HorizontalAlignment = 'Center'; $label.VerticalAlignment = 'Center'
    $badge.Child = $label; [Windows.Controls.Canvas]::SetLeft($badge, $PetWidth - 28); [Windows.Controls.Canvas]::SetTop($badge, 2)
    $script:player2Canvas.Children.Add($badge) | Out-Null
}

function Set-TwoPlayerMode([bool]$enabled) {
    if ($script:twoPlayerActive -eq $enabled) { return }
    $script:twoPlayerActive = $enabled
    $script:p2GroundPlatformHwnd = [IntPtr]::Zero
    $script:p2GroundPlatformRect = $null
    $script:lastRenderKey = ''
    if ($enabled) {
        $script:player2Window = New-Object Windows.Window
        $script:player2Window.Title = 'Windowisp Player 2'
        $script:player2Window.Width = $PetWidth; $script:player2Window.Height = $PetHeight
        $script:player2Window.WindowStyle = [Windows.WindowStyle]::None
        $script:player2Window.AllowsTransparency = $true; $script:player2Window.Background = [Windows.Media.Brushes]::Transparent
        $script:player2Window.ShowInTaskbar = $false; $script:player2Window.Topmost = $script:alwaysOnTop
        $script:player2Window.ShowActivated = $false; $script:player2Window.ResizeMode = [Windows.ResizeMode]::NoResize
        $script:player2Canvas = New-Object Windows.Controls.Canvas
        $script:player2Window.Content = $script:player2Canvas
        $script:p2X = $script:x + 110; $script:p2Y = $script:y
        $script:p2VX = 0; $script:p2VY = 0; $script:p2Grounded = $false; $script:p2DropTicks = 0; $script:p2LastRenderKey = ''
        $script:p2WallContact = 0; $script:p2WallGraceTicks = 0
        $script:p2Hearts = 3; $script:p2InvulnerableTicks = 0
        $script:player2Window.Left = $script:p2X; $script:player2Window.Top = $script:p2Y
        $script:player2Window.Show(); Set-OverlayClickThrough $script:player2Window
        Draw-Player2 'idle' 1 0
    } else {
        foreach ($ball in @($script:playroomBalls)) {
            if ($ball.CarriedBy -eq 'Player2') { $ball.CarriedBy = ''; $ball.VX = 0; $ball.VY = 2 }
        }
        if ($null -ne $script:player2Window) { $script:player2Window.Close() }
        $script:player2Window = $null; $script:player2Canvas = $null
    }
    Update-Menu
    if ($null -ne $script:petSelectorWindow -and $script:petSelectorWindow.IsVisible) { Show-PetSelector }
}

function Set-Player2PresetBindings([string]$preset) {
    if ($preset -eq 'Laptop') {
        $script:controlBindings.P2Left=0x4A; $script:controlBindings.P2Right=0x4C
        $script:controlBindings.P2Drop=0x4B; $script:controlBindings.P2Jump=0x49
        $script:controlBindings.P2Attack=0x4F; $script:controlBindings.P2Interact=0x55
    } else {
        $script:controlBindings.P2Left=0x25; $script:controlBindings.P2Right=0x27
        $script:controlBindings.P2Drop=0x28; $script:controlBindings.P2Jump=0x60
        $script:controlBindings.P2Attack=0x6B; $script:controlBindings.P2Interact=0x61
    }
    Save-ControlBindings
    Update-ControlBindingButtons
}

function Set-Player2Controller([string]$mode) {
    if($mode-notin@('Human','Opponent','Friend')){$mode='Human'}
    $script:p2ControllerMode=$mode
    $script:p2AIIntent=[pscustomobject]@{Left=$false;Right=$false;Drop=$false;Jump=$false;Attack=$false;Interact=$false;Label='Waiting'}
    $script:p2AIThinkTicks=0;$script:p2AIStuckTicks=0;$script:p2AILastX=$script:p2X;$script:p2AIStealCooldown=0
    if($mode-ne'Human'-and-not$script:twoPlayerActive){Set-TwoPlayerMode $true}
    Update-Menu
}

function Set-Player2AIDifficulty([string]$difficulty) {
    if($difficulty-notin@('Friendly','Normal','Tricky')){$difficulty='Normal'}
    $script:p2AIDifficulty=$difficulty
    $script:p2AIThinkTicks=0
    Update-Menu
}

function Try-Player2Steal($ball) {
    if($null-eq$ball-or$ball.CarriedBy-ne'Player1'-or$script:p2AIStealCooldown-gt0){return $false}
    $p1CentreX=$script:x+($PetWidth/2);$p1CentreY=$script:y+($PetHeight/2)
    $p2CentreX=$script:p2X+($PetWidth/2);$p2CentreY=$script:p2Y+($PetHeight/2)
    $distance=[Math]::Sqrt([Math]::Pow($p1CentreX-$p2CentreX,2)+[Math]::Pow($p1CentreY-$p2CentreY,2))
    $settings=switch($script:p2AIDifficulty){
        'Friendly'{[pscustomobject]@{Range=76.0;Chance=.28;Cooldown=110}}
        'Tricky'{[pscustomobject]@{Range=105.0;Chance=.82;Cooldown=48}}
        default{[pscustomobject]@{Range=90.0;Chance=.55;Cooldown=72}}
    }
    if($distance-gt$settings.Range){return $false}
    $script:p2AIStealCooldown=$settings.Cooldown
    if($script:random.NextDouble()-gt$settings.Chance){return $false}
    $ball.CarriedBy='Player2';$ball.VX=0;$ball.VY=0;$ball.PetHitCooldown=18
    $script:p2AIIntent.Label='Stole ball'
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:p2-steal difficulty=$($script:p2AIDifficulty) distance=$([Math]::Round($distance,1))")}
    return $true
}

function Update-Player2AIIntent {
    if($script:p2ControllerMode-eq'Human'){return}
    if($script:p2AIThinkTicks-gt0){$script:p2AIThinkTicks--;return}
    $script:p2AIThinkTicks=$(if($script:p2ControllerMode-eq'Friend'){7}else{switch($script:p2AIDifficulty){'Friendly'{8}'Tricky'{2}default{4}}})
    $intent=[pscustomobject]@{Left=$false;Right=$false;Drop=$false;Jump=$false;Attack=$false;Interact=$false;Label='Waiting'}
    $centreX=$script:p2X+($PetWidth/2);$centreY=$script:p2Y+($PetHeight/2)
    $p1CarriedBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'-and$_.CarriedBy-eq'Player1'}|Select-Object -First 1)
    $p2CarriedBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'-and$_.CarriedBy-eq'Player2'}|Select-Object -First 1)
    $balls=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'-and-not$_.CarriedBy})
    $ball=$null
    if($balls.Count-gt0){$ball=@($balls|Sort-Object{[Math]::Abs(($_.X+$_.Radius)-$centreX)+[Math]::Abs(($_.Y+$_.Radius)-$centreY)}|Select-Object -First 1)[0]}
    $targetX=$script:x+($PetWidth/2);$targetY=$script:y+($PetHeight/2);$deadZone=24.0
    if($script:p2ControllerMode-eq'Opponent'-and$p2CarriedBall.Count-gt0){
        $targetX=[Windows.SystemParameters]::VirtualScreenLeft+55;$targetY=$centreY;$deadZone=18;$intent.Label='Drive to goal'
        if($centreX-lt[Windows.SystemParameters]::VirtualScreenLeft+150){$intent.Interact=$true;$intent.Label='Shoot'}
    }elseif($script:p2ControllerMode-eq'Opponent'-and$p1CarriedBall.Count-gt0){
        $targetX=$script:x+($PetWidth/2);$targetY=$script:y+($PetHeight/2);$deadZone=10;$intent.Label='Challenge P1'
        Try-Player2Steal $p1CarriedBall[0]|Out-Null
    }elseif($script:p2ControllerMode-eq'Opponent'-and$null-ne$ball){
        # P2 attacks left. Approach from the ball's right, then keep driving through it.
        $ballX=$ball.X+$ball.Radius;$ballY=$ball.Y+$ball.Radius
        $behindX=$ballX+$ball.Radius+28
        $targetX=$(if($centreX-ge$ballX-8){$ballX-70}else{$behindX})
        $targetY=$ballY;$deadZone=14;$intent.Label=$(if($centreX-ge$ballX-8){'Attack goal'}else{'Get behind ball'})
    }elseif($script:p2ControllerMode-eq'Friend'){
        $followOffset=$(if($script:facing-lt0){70}else{-70})
        $targetX=$script:x+($PetWidth/2)+$followOffset;$targetY=$script:y+($PetHeight/2);$deadZone=38;$intent.Label='Follow P1'
        if($null-ne$ball-and[Math]::Abs(($ball.X+$ball.Radius)-($script:x+$PetWidth/2))-lt230){
            $targetX=$ball.X+$ball.Radius;$targetY=$ball.Y+$ball.Radius;$deadZone=20;$intent.Label='Help with ball'
        }
    }
    $dx=$targetX-$centreX
    if($dx-lt-$deadZone){$intent.Left=$true}elseif($dx-gt$deadZone){$intent.Right=$true}
    if([Math]::Abs($script:p2X-$script:p2AILastX)-lt1.2-and($intent.Left-or$intent.Right)){$script:p2AIStuckTicks++}else{$script:p2AIStuckTicks=0}
    $script:p2AILastX=$script:p2X
    $targetAbove=$targetY-lt($centreY-45)
    $moveDirection=$(if($intent.Left){-1}elseif($intent.Right){1}else{0})
    $obstacleAhead=$false
    if($moveDirection-ne0){
        $probeX=$(if($moveDirection-lt0){$script:p2X-34}else{$script:p2X+$PetWidth+34})
        foreach($block in @($script:playroomBlocks|Where-Object{$_.Type-ne'Ladder'})){
            if($probeX-ge$block.X-8-and$probeX-le$block.X+$block.Width+8-and$centreY-gt$block.Y-and$script:p2Y+8-lt$block.Y+$block.Height){$obstacleAhead=$true;break}
        }
    }
    if($script:p2Grounded-and($targetAbove-or$obstacleAhead-or$script:p2AIStuckTicks-ge5)){
        $intent.Jump=$true;$script:p2AIStuckTicks=0
        if($obstacleAhead){$intent.Label='Jump obstacle'}
    }elseif(-not$script:p2Grounded-and$script:p2AirJumps-gt0-and$script:p2VY-gt-6-and($targetY-lt$centreY-75-or$obstacleAhead)){
        $doubleJumpChance=$(switch($script:p2AIDifficulty){'Friendly'{.45}'Tricky'{.95}default{.75}})
        if($script:p2ControllerMode-eq'Friend'){$doubleJumpChance=.65}
        if($script:random.NextDouble()-le$doubleJumpChance){$intent.Jump=$true;$intent.Label='Double jump'}
    }
    $script:p2AIIntent=$intent
}

function Get-LadderContact([double]$playerX,[double]$playerY) {
    $centreX=$playerX+($PetWidth/2);$centreY=$playerY+($PetHeight/2)
    foreach($ladder in @($script:playroomBlocks|Where-Object{$_.Type-eq'Ladder'})){
        $ladderCentreX=$ladder.X+($ladder.Width/2);$ladderCentreY=$ladder.Y+($ladder.Height/2)
        $r=-$ladder.Angle*[Math]::PI/180
        $dx=$centreX-$ladderCentreX;$dy=$centreY-$ladderCentreY
        $localX=($dx*[Math]::Cos($r))-($dy*[Math]::Sin($r))
        $localY=($dx*[Math]::Sin($r))+($dy*[Math]::Cos($r))
        # Keep hold of the ladder above its final rung long enough to clear the
        # platform lip.  The larger top/bottom envelope also makes short ladders
        # forgiving without widening their sideways grab area.
        if([Math]::Abs($localX)-le($ladder.Width/2+10)-and$localY-ge(-$ladder.Height/2-($PetHeight*.62))-and$localY-le($ladder.Height/2+($PetHeight*.28))){
            $angle=$ladder.Angle*[Math]::PI/180
            return [pscustomobject]@{Block=$ladder;UpX=[Math]::Sin($angle);UpY=-[Math]::Cos($angle)}
        }
    }
    return $null
}

function Test-LadderBlockPassThrough($ladderContact,$block) {
    # A ladder may open a corridor through an explicit one-way platform, but it
    # must never turn a nearby solid block intangible while the player climbs.
    if($null-eq$ladderContact-or$null-eq$block-or$block.Type-notin@('Wooden','Cloud')){return $false}
    $ladder=$ladderContact.Block
    # Keep the opening narrow so the rest of the one-way platform remains usable.
    $corridorLeft=$ladder.X-8;$corridorRight=$ladder.X+$ladder.Width+8
    $blockLeft=$block.X;$blockRight=$block.X+$block.Width
    $ladderTop=$ladder.Y-($PetHeight*.62);$ladderBottom=$ladder.Y+$ladder.Height+($PetHeight*.28)
    return $blockRight-gt$corridorLeft-and$blockLeft-lt$corridorRight-and($block.Y+$block.Height)-gt$ladderTop-and$block.Y-lt$ladderBottom
}

function Test-PlatformTopExposed([int]$platformIndex,[double]$bodyLeft,[double]$bodyRight,[double]$platformTop) {
    $sampleX=($bodyLeft+$bodyRight)/2
    for($frontIndex=0;$frontIndex-lt$platformIndex;$frontIndex++){
        $front=$script:platforms[$frontIndex]
        if($sampleX-gt$front.Left-and$sampleX-lt$front.Right-and$platformTop-gt$front.Top-and$platformTop-lt$front.Bottom){return $false}
    }
    return $true
}

function Update-RidingApplicationWindow([string]$player) {
    $isP2=$player-eq'P2'
    $grounded=$(if($isP2){$script:p2Grounded}else{$script:grounded})
    $hwnd=$(if($isP2){$script:p2GroundPlatformHwnd}else{$script:groundPlatformHwnd})
    $previous=$(if($isP2){$script:p2GroundPlatformRect}else{$script:groundPlatformRect})
    if(-not$grounded-or$hwnd-eq[IntPtr]::Zero-or$null-eq$previous){return}
    try{
        $current=[PetNative+PLATFORMWINDOW]::new()
        if(-not[PetNative]::TryGetPlatformWindow($hwnd,[uint32]$PID,[ref]$current)){throw 'Application window is no longer rideable.'}
        $dx=[double]$current.Left-[double]$previous.Left;$dy=[double]$current.Top-[double]$previous.Top
        $maxWindowStep=[Math]::Max([Windows.SystemParameters]::VirtualScreenWidth,[Windows.SystemParameters]::VirtualScreenHeight)
        if([double]::IsNaN($dx)-or[double]::IsNaN($dy)-or[Math]::Abs($dx)-gt$maxWindowStep-or[Math]::Abs($dy)-gt$maxWindowStep){throw 'Application window moved outside the desktop.'}
        if($isP2){$script:p2X+=$dx;$script:p2Y+=$dy;$script:p2GroundPlatformRect=$current}
        else{$script:x+=$dx;$script:y+=$dy;$script:groundPlatformRect=$current}
        # The platform list can be replaced by the periodic desktop scan during a
        # window drag. Updating it is only a cache optimisation, so never let a
        # stale index interrupt movement input.
        for($platformIndex=0;$platformIndex-lt@($script:platforms).Count;$platformIndex++){
            if($script:platforms[$platformIndex].Hwnd-eq$hwnd){$script:platforms[$platformIndex]=$current;break}
        }
    }catch{
        if($isP2){$script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null;$script:p2Grounded=$false}
        else{$script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null;$script:grounded=$false}
        try{$script:platforms=[PetNative]::GetPlatformWindows([uint32]$PID)}catch{$script:platforms=@()}
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output "diagnostic:window-ride-detached player=$player reason=$($_.Exception.Message)"}
        return
    }
}

function Update-Player2 {
    if (-not $script:twoPlayerActive -or $null -eq $script:player2Window -or -not $script:active -or $script:p2Hearts -le 0) { return }
    Update-RidingApplicationWindow 'P2'
    if($script:p2AIStealCooldown-gt0){$script:p2AIStealCooldown--}
    Update-Player2AIIntent
    if($script:p2ControllerMode-eq'Human'){
        $leftDown=Test-KeyDown $script:controlBindings.P2Left;$rightDown=Test-KeyDown $script:controlBindings.P2Right
        $dropDown=Test-KeyDown $script:controlBindings.P2Drop;$jumpDown=Test-Player2JumpDown
        $attackDown=Test-KeyDown $script:controlBindings.P2Attack;$interactDown=Test-KeyDown $script:controlBindings.P2Interact
    }else{
        $leftDown=$script:p2AIIntent.Left;$rightDown=$script:p2AIIntent.Right;$dropDown=$script:p2AIIntent.Drop
        $jumpDown=$script:p2AIIntent.Jump;$attackDown=$script:p2AIIntent.Attack;$interactDown=$script:p2AIIntent.Interact
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_P2_JUMP-eq'1'-and-not$script:p2JumpTestTriggered){
        $script:p2JumpTestTriggered=$true;$script:p2Grounded=$true;$script:p2CoyoteTicks=6;$script:p2Previous.Jump=$false;$jumpDown=$true
    }
    $p2Ladder=Get-LadderContact $script:p2X $script:p2Y
    $p2Climbing=$null-ne$p2Ladder
    $p2ClimbUpDown=(Test-KeyDown $vk.Up)-or$jumpDown
    $horizontal = if ($leftDown -and -not $rightDown) { -1 } elseif ($rightDown -and -not $leftDown) { 1 } else { 0 }
    if ($horizontal -ne 0) {
        $p2MaxSpeed=9.5*$script:baseMovementScale
        $p2Acceleration=$(if($script:p2Grounded){1.35}else{.72})*$script:baseMovementScale
        $script:p2VX=[Math]::Max(-$p2MaxSpeed,[Math]::Min($p2MaxSpeed,$script:p2VX+($horizontal*$p2Acceleration)))
        $script:p2Facing = $horizontal
    } elseif ($script:p2Grounded) { $script:p2VX *= 0.78 } else { $script:p2VX *= 0.985 }
    $p2LadderJump=$p2Climbing-and$jumpDown-and-not$script:p2Previous.Jump-and$horizontal-ne0
    if($p2LadderJump){
        $script:p2VY=-15.5*$script:baseMovementScale;$script:p2VX=$horizontal*11.5*$script:baseMovementScale
        $script:p2Grounded=$false;$p2Climbing=$false;$p2Ladder=$null
    }elseif ($jumpDown -and -not $script:p2Previous.Jump -and -not$p2Climbing) {
        if ($script:p2Grounded -or $script:p2CoyoteTicks -gt 0) { $script:p2VY = -18.5*$script:baseMovementScale; $script:p2Grounded = $false; $script:p2AirJumps = 1 }
        elseif ($script:p2WallGraceTicks -gt 0 -and $script:p2WallContact -ne 0) {
            $script:p2VY = -17.5*$script:baseMovementScale; $script:p2VX = -$script:p2WallContact * 13.5*$script:baseMovementScale
            $script:p2Facing = -$script:p2WallContact; $script:p2WallGraceTicks = 0
        }
        elseif ($script:p2AirJumps -gt 0) { $script:p2VY = -17*$script:baseMovementScale; $script:p2AirJumps-- }
    }
    if($script:p2JumpTestTriggered-and-not$script:p2JumpTestReported){
        $script:p2JumpTestReported=$true
        [Console]::Out.WriteLine("diagnostic:p2-jump controller=$($script:p2ControllerMode) binding=$($script:controlBindings.P2Jump) vy=$([Math]::Round($script:p2VY,2)) grounded=$($script:p2Grounded)")
    }
    if($p2Climbing){
        $climbDirection=$(if($p2ClimbUpDown){1}elseif($dropDown){-1}else{0})
        $axisVelocity=($script:p2VX*$p2Ladder.UpX)+($script:p2VY*$p2Ladder.UpY)
        $targetAxisVelocity=$climbDirection*5.5*$script:baseMovementScale
        $script:p2VX+=($targetAxisVelocity-$axisVelocity)*$p2Ladder.UpX
        $script:p2VY+=($targetAxisVelocity-$axisVelocity)*$p2Ladder.UpY
        $script:p2Grounded=$false
    }
    if ($dropDown -and -not $script:p2Previous.Drop) {
        $script:p2DropTicks=18;$script:p2VY=[Math]::Max(4,$script:p2VY);$script:p2Grounded=$false
        $script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null
    }
    if ($attackDown -and -not $script:p2Previous.Attack -and $script:p2AttackCooldown -le 0) {
        if(-not(Start-BatCharge 'Player2')){
            New-Fireball -owner 'Player2' -originX ($script:p2X + $(if ($script:p2Facing -lt 0) { -30 } else { $PetWidth - 8 })) -originY ($script:p2Y + 28) -velocityX (15 * $script:p2Facing)
            $script:p2AttackTicks = 18; $script:p2AttackCooldown = 24
        }
    }
    if($attackDown){Update-BatCharge 'Player2'}
    if(-not$attackDown-and$script:p2Previous.Attack-and(Release-BatSwing 'Player2')){$script:p2AttackTicks=18;$script:p2AttackCooldown=22}
    if ($interactDown -and -not $script:p2Previous.Interact) { Toggle-BallCarry 'Player2' }
    $script:p2Previous.Jump=$jumpDown; $script:p2Previous.Drop=$dropDown; $script:p2Previous.Attack=$attackDown; $script:p2Previous.Interact=$interactDown
    # AI actions are pulses, not held keys. Releasing after one physics tick
    # allows a later airborne decision to trigger the real second-jump path.
    if($script:p2ControllerMode-ne'Human'-and$jumpDown){$script:p2AIIntent.Jump=$false}
    if ($script:p2AttackCooldown -gt 0) { $script:p2AttackCooldown-- }; if ($script:p2AttackTicks -gt 0) { $script:p2AttackTicks-- }
    $oldX = $script:p2X; $oldY = $script:p2Y; $oldBottom = $script:p2Y + $PetHeight
    $script:p2VY = [Math]::Min(24, $script:p2VY + $(if($p2Climbing){0}else{1.05})); $script:p2X += $script:p2VX; $script:p2Y += $script:p2VY
    if($script:p2DropTicks-gt0){$script:p2DropTicks--}
    $left=[Windows.SystemParameters]::VirtualScreenLeft; $top=[Windows.SystemParameters]::VirtualScreenTop
    $right=$left+[Windows.SystemParameters]::VirtualScreenWidth-$PetWidth; $floor=$top+[Windows.SystemParameters]::VirtualScreenHeight
    if ($script:p2WallGraceTicks -gt 0) { $script:p2WallGraceTicks-- } else { $script:p2WallContact = 0 }
    if ($script:p2X -le $left -and $script:p2VX -lt 0) {
        $script:p2X=$left;$script:p2VX=0;$script:p2WallContact=-1;$script:p2WallGraceTicks=6
        if($script:p2VY-gt4.5){$script:p2VY=4.5}
    } elseif ($script:p2X -ge $right -and $script:p2VX -gt 0) {
        $script:p2X=$right;$script:p2VX=0;$script:p2WallContact=1;$script:p2WallGraceTicks=6
        if($script:p2VY-gt4.5){$script:p2VY=4.5}
    }
    $script:p2X=[Math]::Max($left,[Math]::Min($right,$script:p2X)); $script:p2Y=[Math]::Max($top,$script:p2Y)
    foreach ($b in @($script:playroomBlocks)) {
        if($b.Type-in@('Ladder','Wooden','Cloud')-or$b.TemporaryState-eq'Gone'){continue}
        if(Test-LadderBlockPassThrough $p2Ladder $b){continue}
        if([Math]::Abs($b.Angle)-gt.01){continue}
        $oldBodyTop=$oldY+8;$newBodyTop=$script:p2Y+8
        $newLeft=$script:p2X+12;$newRight=$script:p2X+$PetWidth-12
        $horizontalOverlap=$newRight-gt$b.X -and $newLeft-lt$b.X+$b.Width
        if($script:p2VY-lt0-and$horizontalOverlap-and$oldBodyTop-ge$b.Y+$b.Height-6-and$newBodyTop-le$b.Y+$b.Height){
            $script:p2Y=$b.Y+$b.Height-8;$script:p2VY=0;continue
        }
        $bodyTop=$script:p2Y+8;$bodyBottom=$script:p2Y+$PetHeight-5
        if($bodyBottom-le$b.Y -or $bodyTop-ge$b.Y+$b.Height){continue}
        $oldLeft=$oldX+12;$oldRight=$oldX+$PetWidth-12
        if($script:p2VX-gt0 -and $oldRight-le$b.X+5 -and $newRight-ge$b.X){
            $script:p2X=$b.X-($PetWidth-12);$script:p2VX=0;$script:p2WallContact=1;$script:p2WallGraceTicks=6
            if($script:p2VY-gt4.5){$script:p2VY=4.5}
        }elseif($script:p2VX-lt0 -and $oldLeft-ge$b.X+$b.Width-5 -and $newLeft-le$b.X+$b.Width){
            $script:p2X=$b.X+$b.Width-12;$script:p2VX=0;$script:p2WallContact=-1;$script:p2WallGraceTicks=6
            if($script:p2VY-gt4.5){$script:p2VY=4.5}
        }
    }
    $landing=$floor;$p2LandingBlock=$null;$p2LandingPlatform=$null
    if ($script:p2VY -ge 0) {
        if($script:p2DropTicks-le0){for($platformIndex=0;$platformIndex-lt$script:platforms.Count;$platformIndex++){$r=$script:platforms[$platformIndex];$bodyLeft=$script:p2X+12;$bodyRight=$script:p2X+$PetWidth-12;if($bodyRight-gt$r.Left-and$bodyLeft-lt$r.Right-and$oldBottom-le$r.Top+5-and$script:p2Y+$PetHeight-ge$r.Top-and$r.Top-lt$landing-and(Test-PlatformTopExposed $platformIndex $bodyLeft $bodyRight $r.Top)){$landing=$r.Top;$p2LandingPlatform=$r}}}
        foreach($b in @($script:playroomBlocks)){if($b.TemporaryState-ne'Gone'-and$b.Type-notin@('Ladder','Wooden','Cloud')-and-not(Test-LadderBlockPassThrough $p2Ladder $b)-and[Math]::Abs($b.Angle)-le.01-and$script:p2X+$PetWidth-12-gt$b.X -and $script:p2X+12-lt$b.X+$b.Width -and $oldBottom-le$b.Y+6 -and $script:p2Y+$PetHeight-ge$b.Y -and $b.Y-lt$landing){$landing=$b.Y;$p2LandingBlock=$b;$p2LandingPlatform=$null}}
    }
    $script:p2Grounded=$false
    if($script:p2Y+$PetHeight-ge$landing){
        $script:p2Y=$landing-$PetHeight;$script:p2VY=0;$script:p2Grounded=$true
        if($null-ne$p2LandingPlatform){$script:p2GroundPlatformHwnd=$p2LandingPlatform.Hwnd;$script:p2GroundPlatformRect=$p2LandingPlatform}else{$script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null}
        if($null-ne$p2LandingBlock){Trigger-TemporaryBlock $p2LandingBlock 'Player2'}
        if($null-ne$p2LandingBlock-and$p2LandingBlock.Type-eq'Conveyor'){$script:p2VX=[Math]::Max(-13,[Math]::Min(13,$script:p2VX+($p2LandingBlock.Direction*.72)))}
    }else{$script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null}
    foreach($b in @($script:playroomBlocks|Where-Object{$_.Type-notin@('Ladder','Wooden','Cloud')-and[Math]::Abs($_.Angle)-gt.01-and-not(Test-LadderBlockPassThrough $p2Ladder $_)})){
        $resolved=Resolve-PlayerRotatedBlock $b $script:p2X $script:p2Y $script:p2VX $script:p2VY
        if($null-ne$resolved){
            $script:p2X=$resolved.X;$script:p2Y=$resolved.Y;$script:p2VX=$resolved.VX;$script:p2VY=$resolved.VY
            if($resolved.Grounded){
                $script:p2Grounded=$true;$script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null
                if($b.Type-in@('Bouncy','Fire')){
                    $launch=$(if($b.Type-eq'Bouncy'){20.5}else{13.0});$angle=$b.Angle*[Math]::PI/180
                    $script:p2VX+=[Math]::Sin($angle)*$launch;$script:p2VY-=[Math]::Cos($angle)*$launch;$script:p2Grounded=$false
                }elseif($b.Type-eq'Conveyor'){
                    $angle=$b.Angle*[Math]::PI/180
                    $script:p2VX=[Math]::Max(-13,[Math]::Min(13,$script:p2VX+([Math]::Cos($angle)*$b.Direction*.72)))
                    $script:p2VY+=[Math]::Sin($angle)*$b.Direction*.72
                }
            }
            if($resolved.Wall-ne0){$script:p2WallContact=$resolved.Wall;$script:p2WallGraceTicks=6}
        }
    }
    foreach($wood in @($script:playroomBlocks|Where-Object{$_.Type-in@('Wooden','Cloud')})){
        $woodLanding=Resolve-PlayerWoodenPlatform $wood $oldX $oldY $script:p2X $script:p2Y $script:p2VX $script:p2VY $script:p2DropTicks
        if($null-ne$woodLanding){$script:p2X=$woodLanding.X;$script:p2Y=$woodLanding.Y;$script:p2VX=$woodLanding.VX;$script:p2VY=$woodLanding.VY;if($woodLanding.Grounded){$script:p2Grounded=$true;$script:p2GroundPlatformHwnd=[IntPtr]::Zero;$script:p2GroundPlatformRect=$null;if($wood.Type-eq'Cloud'){Trigger-TemporaryBlock $wood 'Player2'}}}
    }
    if($script:p2Grounded){$script:p2CoyoteTicks=6;$script:p2AirJumps=1}elseif($script:p2CoyoteTicks-gt0){$script:p2CoyoteTicks--}
    $script:player2Window.Left=$script:p2X; $script:player2Window.Top=$script:p2Y
    $state=if($script:p2AttackTicks-gt0){'attack'}elseif(-not$script:p2Grounded){'jump'}elseif([Math]::Abs($script:p2VX)-gt0.5){'run'}else{'idle'}
    if($state-ne$script:p2LastState){$script:p2AnimationTick=0;$script:p2LastState=$state}else{$script:p2AnimationTick++}
    $frame=if($state-eq'run'){[Math]::Floor($script:p2AnimationTick/7)%8}elseif($state-eq'jump'){if($script:p2VY-lt-8){1}elseif($script:p2VY-lt2){2}elseif($script:p2VY-lt12){3}else{4}}elseif($state-eq'attack'){[Math]::Min(3,[Math]::Floor($script:p2AnimationTick/3))}else{[Math]::Floor($script:p2AnimationTick/10)%6}
    Draw-Player2 $state $script:p2Facing ([int]$frame)
}

$active = $false
$x = [double]$window.Left
$y = [double]$window.Top
$vx = 0.0; $vy = 0.0
$facing = 0
$grounded = $false
$dropTicks = 0
$wallContact = 0
$wallGraceTicks = 0
$platforms = @()
$platformRefresh = 0
$groundPlatformHwnd = [IntPtr]::Zero
$groundPlatformRect = $null
$p2GroundPlatformHwnd = [IntPtr]::Zero
$p2GroundPlatformRect = $null
$animationTick = 0
$lastState = 'idle'
$lastRenderKey = ''
$hotkeyIds = @{ Toggle = 1; Left = 2; Right = 3; JumpW = 4; Drop = 5; JumpSpace = 6; Exit = 7; Attack = 8; Reset = 9; Close = 10; Menu = 11; Freeze = 12 }
$vk = @{ F7 = 0x76; F8 = 0x77; F9 = 0x78; F10 = 0x79; A = 0x41; D = 0x44; W = 0x57; S = 0x53; E = 0x45; U = 0x55; Space = 0x20; Escape = 0x1B; J = 0x4A; P = 0x50; Left = 0x25; Up = 0x26; Right = 0x27; Down = 0x28; Num0 = 0x60; Num1 = 0x61; NumAdd = 0x6B; I = 0x49; K = 0x4B; L = 0x4C; O = 0x4F }
$previousKeys = @{ Jump = $false; Drop = $false; Attack = $false; Interact = $false; Left = $false; Right = $false }
$coyoteTicks = 0
$attackTicks = 0
$attackCooldown = 0
$chargeTicks = 0
$charging = $false
$airJumpsRemaining = 1
$inputTick = 0
$lastLeftTapTick = -100
$lastRightTapTick = -100
$dashTicks = 0
$dashCooldown = 0
$projectiles = New-Object Collections.ArrayList
$enemies = New-Object Collections.ArrayList
$enemySpawnTicks = 210
$enemyNextSpawnAt = [DateTime]::UtcNow.AddSeconds(5)
$enemiesDefeated = 0
$lastBossWave = 0
$score = 0
$hearts = 3
$elapsedTicks = 0
$invulnerableTicks = 0
$hudWindow = $null
$hudText = $null
$hudRefreshTick = 0
$heartWindow = $null
$heartText = $null
$p1StatusWindow = $null; $p1StatusText = $null
$p2StatusWindow = $null; $p2StatusText = $null; $p2StatusPortrait = $null; $p1StatusPortrait = $null
$menuButtonWindow = $null
$menuWindow = $null
$petSelectorButton = $null
$petSelectorWindow = $null
$petSelectorPanel = $null
$petSizeButtons = @()
$petSelectorTarget = 'P1'
$activePetId = $PetId
$activePetName = $(if([string]::IsNullOrWhiteSpace($PetName)){$PetId}else{$PetName})
$p2PetId = $PetId
$p2PetName = $(if([string]::IsNullOrWhiteSpace($PetName)){$PetId}else{$PetName})
$controlsWindow = $null
$controlsOverlay = $null
$controlsBindingButtons = @{}
$capturingBinding = $null
$menuTitle = $null
$menuActionButton = $null
$menuRestartButton = $null
$gameModePanel = $null
$menuFreezeButton = $null
$menuSpeedButton = $null
$menuWanderButton = $null
$menuTopmostButton = $null
$menuFamiliarButton = $null
$settingsPanel = $null
$recoveryPanel = $null
$tutorialWindow = $null
$startupModeChosen = $false
$tutorialSeenPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\tutorial-v1.seen'
$playroomPanel = $null
$playroomButton = $null
$sandboxToolButton = $null
$sandboxHotbarWindow = $null
$sandboxTrayWindow = $null
$sandboxTrayPanel = $null
$sandboxTrayTitle = $null
$sandboxPhysicsLabel = $null
$sandboxPhysicsSlider = $null
$sandboxCategory = ''
$sandboxToolboxHasCustomPosition = $false
$eraserMode = $false
$eraserButton = $null
$eraserEscapeWasDown = $false
$eraserExitGuardTicks = 0
$gridSnapEnabled = $false
$gridButton = $null
$gridOverlayWindow = $null
$gridSize = 40.0
$ropeToolMode = $false
$ropeToolButton = $null
$wiringMode = $false
$wiringButton = $null
$wireConnectFirst = $null
$wireChannelIndex = 0
$autoWander = $false
$soundEnabled = $true
$petSpeedIndex = 1
$petSpeedNames = @('Slow', 'Normal', 'Fast')
$petSpeedScales = @(0.75, 1.0, 1.25)
$baseMovementScale = 0.85
$alwaysOnTop = $true
$frozen = $false
$familiarBubbleWindow=$null;$familiarBubbleText=$null;$familiarBubbleTicks=0;$familiarBubblePersistent=$false
$familiarLastEvent='';$familiarLastEventAt=[DateTime]::MinValue;$familiarMode='Normal'
$familiarSettingsPath=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\familiar-settings.json'
if(Test-Path -LiteralPath $familiarSettingsPath){try{$savedFamiliar=Get-Content -LiteralPath $familiarSettingsPath -Raw|ConvertFrom-Json;if($savedFamiliar.mode-in@('Quiet','Normal','Chatty')){$familiarMode=[string]$savedFamiliar.mode}}catch{}}
$twoPlayerActive = $false
$player2Window = $null
$player2Canvas = $null
$p2X = 0.0; $p2Y = 0.0; $p2VX = 0.0; $p2VY = 0.0
$p2Facing = 1; $p2Grounded = $false; $p2CoyoteTicks = 0; $p2AirJumps = 1; $p2DropTicks = 0
$p2WallContact = 0; $p2WallGraceTicks = 0
$p2AnimationTick = 0; $p2LastState = 'idle'; $p2LastRenderKey = ''
$p2AttackCooldown = 0; $p2AttackTicks = 0
$p2Hearts = 3; $p2InvulnerableTicks = 0
$p2Previous = @{ Jump=$false; Drop=$false; Attack=$false; Interact=$false }
$p2JumpTestTriggered = $false; $p2JumpTestReported = $false
$springAllP1Reported = $false; $springAllP2Reported = $false
$p2Preset = 'Numpad'
$p2MenuButton = $null
$p2PresetButton = $null
$p2ControllerMode = 'Human'
$p2ControllerButton = $null
$p2AIDifficulty = 'Normal'
$p2AIDifficultyButton = $null
$p2AIStealCooldown = 0
$p2AIIntent = [pscustomobject]@{Left=$false;Right=$false;Drop=$false;Jump=$false;Attack=$false;Interact=$false;Label='Waiting'}
$p2AIThinkTicks = 0; $p2AIStuckTicks = 0; $p2AILastX = 0.0
$p2AITestInitialized = $false
$enemyRosterTestInitialized = $false
$p2GlowEffect = $null
$playroomActive = $false
$playroomBlocks = New-Object Collections.ArrayList
$playroomBalls = New-Object Collections.ArrayList
$playroomGadgets = New-Object Collections.ArrayList
$playroomWires = New-Object Collections.ArrayList
$ropeConnectFirst = $null
$ropeConnectSource = $null
$ropeOverlayWindow = $null
$ropeOverlayCanvas = $null
$activeRotationHandleWindow = $null
$activeRotationData = $null
$teleportCooldown = 0
$p2TeleportCooldown = 0
$hazardTick = 0
$diagnosticSupportCases = @()
$gameType = 'Survival'
$footballActive = $false
$footballBall = $null
$footballLeftGoal = $null; $footballRightGoal = $null
$footballModeObjects = @()
$footballP1Score = 0; $footballP2Score = 0
$footballCountdownTicks = 0; $footballKickoffTextTicks = 0; $footballGoalCooldown = 0
$footballMessage = ''; $footballMatchOver = $false
$footballTestInitialized = $false
$wispfallActive=$false;$wispfallLavaWindow=$null;$wispfallLavaTop=0.0;$wispfallTicks=0;$wispfallScore=0
$wispfallSpawnTicks=0;$wispfallLastX=0.0;$wispfallLastLane=2;$wispfallLaneDirection=-1;$wispfallHighestY=0.0;$wispfallGameOver=$false;$wispfallTestInitialized=$false
$wispfallStoredBlocks=@();$wispfallStoredGadgets=@();$wispfallStoredWires=@();$wispfallPreviousScalePercent=$null
$crumbleTestBlock=$null;$crumbleTestStartTick=0
$dodgeballs = New-Object Collections.ArrayList
$dodgeballNextSpawnAt = [DateTime]::UtcNow.AddSeconds(5)
$dodgeballFromRight = $false
$ballPhysicsValue = 50.0
$ballPhysicsSlider = $null
$ballPhysicsLabel = $null
$surfaceEffect = 'Normal'
$surfaceEffectTicks = 0
$star = $null
$starSpawnTicks = 150
$starsCollected = 0
$shieldTicks = 0
$shieldWindow = $null
$shieldRing = $null
$shieldElement = $null
$shieldRotate = $null
$shieldAngle = 0.0
$shieldPickup = $null
$shieldPickupSpawnTicks = 45
$random = New-Object Random
$controlDefaults = @{ P1Left=0x41; P1Right=0x44; P1Jump=0x20; P1Drop=0x53; P1Attack=0x4A; P1Interact=0x45; P2Left=0x25; P2Right=0x27; P2Drop=0x28; P2Jump=0x60; P2Attack=0x6B; P2Interact=0x61 }
$controlBindings = $controlDefaults.Clone()
$controlsConfigPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\controls.json'
if (Test-Path -LiteralPath $controlsConfigPath -PathType Leaf) {
    try {
        $savedControls = Get-Content -LiteralPath $controlsConfigPath -Raw | ConvertFrom-Json
        foreach ($bindingName in @($controlDefaults.Keys)) {
            if ($null -ne $savedControls.$bindingName) { $controlBindings[$bindingName] = [int]$savedControls.$bindingName }
        }
    } catch {}
}
if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_RESET_CONTROLS -eq '1') {
    $controlBindings = $controlDefaults.Clone()
    try {
        $controlsDirectory = Split-Path -Parent $controlsConfigPath
        if (-not (Test-Path -LiteralPath $controlsDirectory -PathType Container)) { New-Item -ItemType Directory -Path $controlsDirectory -Force | Out-Null }
        $controlBindings | ConvertTo-Json | Set-Content -LiteralPath $controlsConfigPath -Encoding UTF8
    } catch {}
}
$platformHighlights = @{}
$frameClock = $(if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { [Diagnostics.Stopwatch]::StartNew() } else { $null })
$lastFrameMs = 0.0; $frameGapMax = 0.0; $frameGapSum = 0.0; $frameGapSamples = 0
$gadgetBenchmarkPhase='';$gadgetBenchmarkCpuStartMs=0.0;$gadgetBenchmarkWallStartMs=0.0;$gadgetBenchmarkStartHandles=0;$gadgetBenchmarkStartWindows=0
$diagnosticTickCount = 0
$diagnosticMainMarker = $false
$diagnosticLaserSegmentMarker = $false
$diagnosticLaserHitMarker = $false
$rotatorUpdateMarker = $false
$ropeVisualTick = 0
$ropeVisualDivisor = 1
if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_DEFEATS) {
    $parsedDefeats = 0
    if ([int]::TryParse($env:WINDOWISP_TEST_DEFEATS, [ref]$parsedDefeats)) {
        $enemiesDefeated = [Math]::Max(0, $parsedDefeats)
    }
}
if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:initial-defeats=$enemiesDefeated" }
$source = $null
$hwnd = [IntPtr]::Zero
$gameOnEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispGameModeOn')
$gameOffEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispGameModeOff')
$gameToggleEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispGameModeToggle')
$gameExitEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispGameModeExit')
$playroomEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispPlayroom')
$petSwitchEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, 'Local\WindowispSwitch')
$familiarEventSignal=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::AutoReset,'Local\WindowispFamiliarEvent')

function Set-ClickThrough([bool]$enabled) {
    $style = [PetNative]::GetWindowLongPtr($hwnd, [PetNative]::GWL_EXSTYLE).ToInt64()
    if ($enabled) { $style = $style -bor [PetNative]::WS_EX_TRANSPARENT }
    else { $style = $style -band (-bnot [PetNative]::WS_EX_TRANSPARENT) }
    [PetNative]::SetWindowLongPtr($hwnd, [PetNative]::GWL_EXSTYLE, [IntPtr]$style) | Out-Null
}

function Register-ControlKeys([bool]$enabled) {
    foreach ($id in 2..8) { [PetNative]::UnregisterHotKey($hwnd, $id) | Out-Null }
    if (-not $enabled) { return }
    # Movement and attack are sampled with GetAsyncKeyState each frame. Registering
    # repeating hotkeys as well floods WPF's dispatcher during combined key holds.
    [PetNative]::RegisterHotKey($hwnd, $hotkeyIds.Exit, [PetNative]::MOD_NOREPEAT, $vk.Escape) | Out-Null
}

function Test-KeyDown([int]$key) {
    return (([int][PetNative]::GetAsyncKeyState($key) -band 0x8000) -ne 0)
}

function Test-Player2JumpDown {
    $binding=[int]$script:controlBindings.P2Jump
    if(Test-KeyDown $binding){return $true}
    # The physical Numpad 0 key reports as Insert while Num Lock is off.
    # Treat both virtual-key values as the same default P2 jump button.
    return $binding-eq0x60-and(Test-KeyDown 0x2D)
}

function New-Fireball(
    [string]$owner = 'Player',
    [double]$originX = [double]::NaN,
    [double]$originY = [double]::NaN,
    [double]$velocityX = [double]::NaN,
    [double]$velocityY = 0,
    [double]$power = 0
) {
    $power = [Math]::Max(0, [Math]::Min(1, $power))
    $scale = 1 + ($power * 0.8)
    $direction = $(if (-not [double]::IsNaN($velocityX)) { [Math]::Sign($velocityX) } elseif ($script:facing -lt 0) { -1 } else { 1 })
    $fireball = New-Object Windows.Window
    $fireball.Title = "Windowisp $owner Fireball"
    $fireball.Width = 54 * $scale; $fireball.Height = 38 * $scale
    $fireball.WindowStyle = [Windows.WindowStyle]::None
    $fireball.AllowsTransparency = $true
    $fireball.Background = [Windows.Media.Brushes]::Transparent
    $fireball.Topmost = $true; $fireball.ShowInTaskbar = $false
    $fireball.ShowActivated = $false; $fireball.ResizeMode = [Windows.ResizeMode]::NoResize

    $canvas = New-Object Windows.Controls.Canvas
    $canvas.Width=54*$scale;$canvas.Height=38*$scale;$canvas.IsHitTestVisible=$false
    $tail = New-Object Windows.Shapes.Ellipse
    $tail.Width = 34 * $scale; $tail.Height = 17 * $scale
    $tail.Fill = [Windows.Media.LinearGradientBrush]::new(
        [Windows.Media.Color]::FromArgb(0, 255, 40, 0),
        [Windows.Media.Color]::FromArgb(230, 255, 120, 0),
        0
    )
    $core = New-Object Windows.Shapes.Ellipse
    $core.Width = 31 * $scale; $core.Height = 31 * $scale
    $outerColor = $(if ($owner -eq 'Enemy') { [Windows.Media.Color]::FromRgb(175, 35, 255) } else { [Windows.Media.Color]::FromRgb(255, 45, 0) })
    $core.Fill = [Windows.Media.RadialGradientBrush]::new([Windows.Media.Colors]::White, $outerColor)
    $core.Effect = New-Object Windows.Media.Effects.DropShadowEffect
    $core.Effect.Color = [Windows.Media.Color]::FromRgb(255, 75, 0)
    $core.Effect.BlurRadius = 16; $core.Effect.ShadowDepth = 0; $core.Effect.Opacity = 0.9

    if ($direction -lt 0) {
        [Windows.Controls.Canvas]::SetLeft($tail, 20 * $scale); [Windows.Controls.Canvas]::SetLeft($core, 1)
    } else {
        [Windows.Controls.Canvas]::SetLeft($tail, 0); [Windows.Controls.Canvas]::SetLeft($core, 22 * $scale)
    }
    [Windows.Controls.Canvas]::SetTop($tail, 10 * $scale); [Windows.Controls.Canvas]::SetTop($core, 3 * $scale)
    $canvas.Children.Add($tail) | Out-Null; $canvas.Children.Add($core) | Out-Null

    if ([double]::IsNaN($originX)) { $originX = $script:x + $(if ($direction -lt 0) { -38 } else { $PetWidth - 10 }) }
    if ([double]::IsNaN($originY)) { $originY = $script:y + 28 }
    if ([double]::IsNaN($velocityX)) { $velocityX = 15 * $direction }
    $startX = $originX; $startY = $originY
    Add-SharedGameplayElement $canvas $startX $startY

    $script:projectiles.Add([pscustomobject]@{
        Window = $null;Element=$canvas; X = [double]$startX; Y = [double]$startY
        VX = [double]$velocityX; VY = [double]$velocityY; Life = 125; Owner = $owner
        Width = [double](54*$scale); Height = [double](38*$scale)
        Damage = $(if ($owner -eq 'Player') { 1 + [Math]::Floor($power * 2) } else { 1 })
    }) | Out-Null
}

function Set-OverlayClickThrough($overlayWindow) {
    $overlayHwnd = (New-Object Windows.Interop.WindowInteropHelper($overlayWindow)).Handle
    $overlayStyle = [PetNative]::GetWindowLongPtr($overlayHwnd, [PetNative]::GWL_EXSTYLE).ToInt64() -bor [PetNative]::WS_EX_TRANSPARENT
    [PetNative]::SetWindowLongPtr($overlayHwnd, [PetNative]::GWL_EXSTYLE, [IntPtr]$overlayStyle) | Out-Null
}

function Set-OverlayClickThroughState($overlayWindow, [bool]$enabled) {
    $overlayHwnd = (New-Object Windows.Interop.WindowInteropHelper($overlayWindow)).Handle
    $overlayStyle = [PetNative]::GetWindowLongPtr($overlayHwnd, [PetNative]::GWL_EXSTYLE).ToInt64()
    if ($enabled) { $overlayStyle = $overlayStyle -bor [PetNative]::WS_EX_TRANSPARENT }
    else { $overlayStyle = $overlayStyle -band (-bnot [PetNative]::WS_EX_TRANSPARENT) }
    [PetNative]::SetWindowLongPtr($overlayHwnd, [PetNative]::GWL_EXSTYLE, [IntPtr]$overlayStyle) | Out-Null
}

function New-PlatformHighlight($rect) {
    $virtualLeft = [Windows.SystemParameters]::VirtualScreenLeft
    $virtualRight = $virtualLeft + [Windows.SystemParameters]::VirtualScreenWidth
    $highlightLeft = [Math]::Max($virtualLeft, $rect.Left)
    $highlightRight = [Math]::Min($virtualRight, $rect.Right)
    $highlightWidth = $highlightRight - $highlightLeft
    if ($highlightWidth -lt 40) { return $null }

    $highlight = New-Object Windows.Window
    $highlight.Title = 'Windowisp Platform Highlight'
    $highlight.Width = $highlightWidth; $highlight.Height = 12
    $highlight.Left = $highlightLeft; $highlight.Top = $rect.Top - 6
    $highlight.WindowStyle = [Windows.WindowStyle]::None; $highlight.AllowsTransparency = $true
    $highlight.Background = [Windows.Media.Brushes]::Transparent; $highlight.Topmost = $true
    $highlight.ShowInTaskbar = $false; $highlight.ShowActivated = $false
    $highlight.ResizeMode = [Windows.ResizeMode]::NoResize

    $line = New-Object Windows.Controls.Border
    $line.Height = 3; $line.VerticalAlignment = [Windows.VerticalAlignment]::Center
    $line.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(175, 72, 220, 255))
    $line.CornerRadius = 2
    $line.Effect = New-Object Windows.Media.Effects.DropShadowEffect
    $line.Effect.Color = [Windows.Media.Color]::FromRgb(45, 210, 255)
    $line.Effect.BlurRadius = 9; $line.Effect.ShadowDepth = 0; $line.Effect.Opacity = 0.8
    $highlight.Content = $line
    $highlight.Show(); Set-OverlayClickThrough $highlight
    return $highlight
}

function Update-PlatformHighlights {
    if (-not $script:active) {
        foreach ($entry in $script:platformHighlights.Values) {
            $entry.Visibility = [Windows.Visibility]::Hidden
        }
        return
    }

    $desired = @{}
    foreach ($rect in $script:platforms) {
        $key = "$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
        $desired[$key] = $rect
        if (-not $script:platformHighlights.ContainsKey($key)) {
            $overlay = New-PlatformHighlight $rect
            if ($null -ne $overlay) { $script:platformHighlights[$key] = $overlay }
        } else {
            $script:platformHighlights[$key].Visibility = [Windows.Visibility]::Visible
        }
    }

    foreach ($key in @($script:platformHighlights.Keys)) {
        if (-not $desired.ContainsKey($key)) {
            $script:platformHighlights[$key].Close()
            $script:platformHighlights.Remove($key)
        }
    }
}

function Remove-PlatformHighlights {
    foreach ($entry in @($script:platformHighlights.Values)) { $entry.Close() }
    $script:platformHighlights.Clear()
}

function Save-FamiliarSettings {
    try{$directory=Split-Path -Parent $script:familiarSettingsPath;if(-not(Test-Path -LiteralPath $directory)){New-Item -ItemType Directory -Path $directory -Force|Out-Null};@{mode=$script:familiarMode}|ConvertTo-Json|Set-Content -LiteralPath $script:familiarSettingsPath -Encoding UTF8}catch{}
}

function Set-FamiliarMode([string]$mode) {
    if($mode-notin@('Quiet','Normal','Chatty')){$mode='Normal'}
    $script:familiarMode=$mode;Save-FamiliarSettings;Update-Menu
}

function Get-FamiliarPhrase([string]$eventName) {
    $phrases=@{
        'idle'=@('I am right here.');'user-active'=@('Welcome back!');'codex-working'=@('I am keeping watch.','Working on it...')
        'completed'=@('All done!');'needs-input'=@('I need your input.');'permission-required'=@('A permission needs your attention.')
        'succeeded'=@('That worked!','Success!');'failed'=@('That did not work.','Something went wrong.')
        'returning-user'=@('Welcome back!');'celebrate'=@('We did it!');'wait'=@('I will wait here.');'sleep'=@('Time for a tiny rest.');'greet'=@('Hello!')
    }
    if(-not$phrases.ContainsKey($eventName)){return $null}
    $options=@($phrases[$eventName]);return $options[$script:random.Next(0,$options.Count)]
}

function Ensure-FamiliarBubble {
    if($null-ne$script:familiarBubbleWindow){return}
    $bubbleWindow=New-Object Windows.Window;$bubbleWindow.Title='Windowisp Familiar Bubble';$bubbleWindow.Width=250;$bubbleWindow.Height=78
    $bubbleWindow.WindowStyle='None';$bubbleWindow.AllowsTransparency=$true;$bubbleWindow.Background=[Windows.Media.Brushes]::Transparent
    $bubbleWindow.Topmost=$script:alwaysOnTop;$bubbleWindow.ShowInTaskbar=$false;$bubbleWindow.ShowActivated=$false;$bubbleWindow.ResizeMode='NoResize'
    $canvas=New-Object Windows.Controls.Canvas
    $card=New-Object Windows.Controls.Border;$card.Width=242;$card.MinHeight=58;$card.Padding=[Windows.Thickness]::new(14,9,14,9)
    $card.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(244,24,55,82));$card.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(116,201,242));$card.BorderThickness=[Windows.Thickness]::new(2);$card.CornerRadius=[Windows.CornerRadius]::new(15)
    $text=New-Object Windows.Controls.TextBlock;$text.Foreground=[Windows.Media.Brushes]::White;$text.FontSize=13;$text.FontWeight='SemiBold';$text.TextWrapping='Wrap';$text.TextAlignment='Center';$card.Child=$text
    $tail=New-Object Windows.Shapes.Polygon;$tail.Points=[Windows.Media.PointCollection]::Parse('108,57 130,57 119,74');$tail.Fill=$card.Background;$tail.Stroke=$card.BorderBrush;$tail.StrokeThickness=2
    $canvas.Children.Add($tail)|Out-Null;$canvas.Children.Add($card)|Out-Null;$bubbleWindow.Content=$canvas
    $bubbleWindow.Show();Set-OverlayClickThrough $bubbleWindow;$bubbleWindow.Hide()
    $script:familiarBubbleWindow=$bubbleWindow;$script:familiarBubbleText=$text
}

function Update-FamiliarBubblePosition {
    if($null-eq$script:familiarBubbleWindow-or-not$script:familiarBubbleWindow.IsVisible){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $right=$left+[Windows.SystemParameters]::VirtualScreenWidth;$bottom=$top+[Windows.SystemParameters]::VirtualScreenHeight
    $desiredX=$script:x+($PetWidth/2)-($script:familiarBubbleWindow.Width/2)
    $desiredY=$script:y-$script:familiarBubbleWindow.Height-8
    if($desiredY-lt$top+6){$desiredY=$script:y+$PetHeight+8}
    $script:familiarBubbleWindow.Left=[Math]::Max($left+6,[Math]::Min($right-$script:familiarBubbleWindow.Width-6,$desiredX))
    $script:familiarBubbleWindow.Top=[Math]::Max($top+6,[Math]::Min($bottom-$script:familiarBubbleWindow.Height-6,$desiredY))
}

function Show-FamiliarBubble([string]$eventName) {
    $critical=$eventName-in@('needs-input','permission-required','failed')
    if($script:familiarMode-eq'Quiet'-and-not$critical){return}
    if($script:familiarMode-eq'Normal'-and$eventName-in@('idle','user-active','codex-working','wait')){return}
    $now=[DateTime]::UtcNow
    if($eventName-eq$script:familiarLastEvent-and($now-$script:familiarLastEventAt).TotalSeconds-lt8){return}
    if(($now-$script:familiarLastEventAt).TotalSeconds-lt1){return}
    $phrase=Get-FamiliarPhrase $eventName;if([string]::IsNullOrWhiteSpace($phrase)){return}
    Ensure-FamiliarBubble;$script:familiarBubbleText.Text=$phrase;$script:familiarBubblePersistent=$eventName-in@('needs-input','permission-required')
    $script:familiarBubbleTicks=$(if($script:familiarBubblePersistent){-1}else{360});$script:familiarLastEvent=$eventName;$script:familiarLastEventAt=$now
    $script:familiarBubbleWindow.Topmost=$script:alwaysOnTop;$script:familiarBubbleWindow.Show();Update-FamiliarBubblePosition
}

function Receive-FamiliarEvent {
    $path=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\familiar-event.json'
    if(-not(Test-Path -LiteralPath $path)){return}
    try{$request=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json;$eventName=[string]$request.event;if($eventName-in@('idle','user-active','codex-working','completed','needs-input','permission-required','succeeded','failed','returning-user','celebrate','wait','sleep','greet')){Show-FamiliarBubble $eventName}}catch{}
}

function Update-FamiliarBubble {
    if($null-eq$script:familiarBubbleWindow-or-not$script:familiarBubbleWindow.IsVisible){return}
    Update-FamiliarBubblePosition
    if(-not$script:familiarBubblePersistent-and$script:familiarBubbleTicks-gt0){$script:familiarBubbleTicks--;if($script:familiarBubbleTicks-le0){$script:familiarBubbleWindow.Hide()}}
}

function New-MenuButton([string]$text, [scriptblock]$action, [string]$shortcut = '') {
    $button = New-Object Windows.Controls.Button
    $button.Height = 36; $button.Margin = [Windows.Thickness]::new(8, 3, 8, 3)
    # Gameplay uses raw keyboard state. Menu and hotbar buttons are mouse-only so
    # Space/WASD can never activate or navigate a control left focused behind play.
    $button.Focusable = $false
    $button.IsTabStop = $false
    $button.HorizontalContentAlignment = [Windows.HorizontalAlignment]::Stretch
    $button.Background = New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(34, 70, 101),[Windows.Media.Color]::FromRgb(21, 43, 67),90)
    $button.Foreground = [Windows.Media.Brushes]::White
    $button.BorderBrush = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(104, 168, 211))
    $button.BorderThickness = [Windows.Thickness]::new(1)
    $button.Cursor = [Windows.Input.Cursors]::Hand

    $content = New-Object Windows.Controls.Grid
    $label = New-Object Windows.Controls.TextBlock
    $label.Text = $text; $label.FontSize = 14; $label.Margin = [Windows.Thickness]::new(8, 0, 8, 0)
    $label.VerticalAlignment = [Windows.VerticalAlignment]::Center
    $hint = New-Object Windows.Controls.TextBlock
    $hint.Text = $shortcut; $hint.FontSize = 12; $hint.Opacity = 0.68
    $hint.HorizontalAlignment = [Windows.HorizontalAlignment]::Right
    $hint.VerticalAlignment = [Windows.VerticalAlignment]::Center
    $hint.Margin = [Windows.Thickness]::new(8, 0, 8, 0)
    $content.Children.Add($label) | Out-Null; $content.Children.Add($hint) | Out-Null
    $button.Content = $content
    $button.Add_Click($action)
    return $button
}

function Reset-PetPosition {
    $script:x = [Windows.SystemParameters]::VirtualScreenLeft + 80
    $script:y = [Windows.SystemParameters]::VirtualScreenTop + 80
    $script:vx = 0; $script:vy = 0; $script:grounded = $false
    $script:groundPlatformHwnd = [IntPtr]::Zero; $script:groundPlatformRect = $null
    $script:wallContact = 0; $script:wallGraceTicks = 0
    $script:lastRenderKey = ''
}

function Reset-WindowispRuntime {
    # Clear transient interaction state without deleting the player's sandbox.
    try { [Windows.Input.Mouse]::Capture($null) | Out-Null } catch {}
    Close-FreeRotationHandle
    Set-EraserMode $false
    Set-RopeToolMode $false
    Set-WiringMode $false
    $script:capturingBinding = $null
    $script:previousKeys = @{ Jump=$false; Drop=$false; Attack=$false; Interact=$false; Left=$false; Right=$false }
    $script:p2Previous = @{ Jump=$false; Drop=$false; Attack=$false; Interact=$false }
    $script:charging = $false; $script:chargeTicks = 0; $script:attackTicks = 0; $script:attackCooldown = 0
    $script:dropTicks = 0; $script:dashTicks = 0; $script:dashCooldown = 0
    $script:coyoteTicks = 0; $script:airJumpsRemaining = 1
    $script:p2AttackTicks = 0; $script:p2AttackCooldown = 0; $script:p2DropTicks = 0
    $script:p2WallContact = 0; $script:p2WallGraceTicks = 0; $script:p2AirJumps = 1
    foreach ($placement in @($script:playroomBlocks) + @($script:playroomBalls) + @($script:playroomGadgets)) {
        if ($null -ne $placement.PSObject.Properties['Dragging']) { $placement.Dragging = $false }
        if ($null -ne $placement.PSObject.Properties['CarriedBy'] -and $placement.CarriedBy) {
            $placement.CarriedBy = ''; $placement.VX = 0.0; $placement.VY = 2.0
        }
    }
    Reset-PetPosition
    if ($script:twoPlayerActive) {
        $script:p2X = $script:x + 110; $script:p2Y = $script:y
        $script:p2VX = 0.0; $script:p2VY = 0.0; $script:p2Grounded = $false
        $script:p2GroundPlatformHwnd = [IntPtr]::Zero; $script:p2GroundPlatformRect = $null
    }
    $window.Opacity = 1.0
    if ($null -ne $script:player2Window) { $script:player2Window.Opacity = 1.0 }
    Set-GameMode $false
    Set-Frozen $false
    Set-GameMode $true
    [Windows.Input.Keyboard]::ClearFocus()
    Update-Hud; Update-Menu
}

function Restart-WindowispRuntime {
    $launcher = Join-Path $PSScriptRoot 'game-mode.ps1'
    $action = $(if ($script:playroomActive) { 'Playroom' } else { 'On' })
    $escapedLauncher = $launcher.Replace("'", "''")
    $restartCommand = "Start-Sleep -Milliseconds 900; & '$escapedLauncher' -Action $action"
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($restartCommand))
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encodedCommand) -WindowStyle Hidden | Out-Null
    $window.Close()
}

$toyboxAssetRoot = Join-Path $PSScriptRoot 'assets\toybox-v1'
$toyboxAssetFiles = @{
    Normal='block-normal.png'; Bouncy='block-bouncy.png'; Fire='block-fire.png'
    Ice='block-ice.png'; Mirror='block-mirror.png'; Ball='toy-ball.png'
    NormalTile='block-normal-tile.png'; Wooden='block-wooden-tile.png'; WoodenTile='block-wooden-tile.png'
    Conveyor='block-conveyor-tile.png'; ConveyorTile='block-conveyor-tile.png'; BouncyTile='block-bouncy-tile.png'
    FireTile='block-fire-tile.png'; IceTile='block-ice-tile.png'; GrassTile='block-grass-tile.png'; MirrorTile='block-mirror-tile.png'
    NormalMaterial='material-normal-v2.png'; BouncyMaterial='material-bouncy-v2.png'; FireMaterial='material-fire-v2.png'; IceMaterial='material-ice-v2.png'; GrassMaterial='material-grass-dirt-v2.png'
    CloudMaterial='material-cloud-v1.png'; CrumblingMaterial='material-crumbling-v1.png'; WispfallLava='material-wispfall-lava-v1.png'
    Bat='toy-bat.png'; Bone='toy-bone.png'; Spring='gadget-spring.png'
    Teleporter='gadget-teleporter.png'; TeleporterA='gadget-teleporter.png'
    TeleporterB='gadget-teleporter.png'; Fan='gadget-fan-v2.png'; Rotator='gadget-rotator.png'; RopeCoil='gadget-rope-coil.png'
    Switch='gadget-switch.png'; Button='gadget-button.png'; PressurePlate='gadget-pressureplate.png'; Timer='gadget-timer.png'
    WiringSpool='gadget-wiring-spool.png'; WireSegment='gadget-wire-segment.png'
    Spikes='hazard-spikes.png'; FireJet='hazard-firejet.png'; Laser='hazard-laser.png'
    ShieldPickup='pickup-shield-v2.png'; StarPickup='pickup-star-v2.png'
    ChestCommon='treasure-chest-common-v1.png'; ChestRare='treasure-chest-rare-v1.png'; ChestLegendary='treasure-chest-legendary-v1.png'
    ChestCommonOpen='treasure-chest-common-open-v1.png'; ChestRareOpen='treasure-chest-rare-open-v1.png'; ChestLegendaryOpen='treasure-chest-legendary-open-v1.png'
}
# Future game modes can roll a rarity first, then resolve artwork and contents
# independently. No chest is spawned by Survival yet.
$treasureChestRarities=[ordered]@{
    Common=[pscustomobject]@{ClosedAsset='ChestCommon';OpenAsset='ChestCommonOpen';Weight=70;RewardTier=1;Colour='#7890A6';OpenTicks=16;CloseTicks=12;Lift=3;BurstParticles=3;EffectScale=.55}
    Rare=[pscustomobject]@{ClosedAsset='ChestRare';OpenAsset='ChestRareOpen';Weight=25;RewardTier=2;Colour='#42C9F5';OpenTicks=19;CloseTicks=14;Lift=5;BurstParticles=7;EffectScale=1.0}
    Legendary=[pscustomobject]@{ClosedAsset='ChestLegendary';OpenAsset='ChestLegendaryOpen';Weight=5;RewardTier=3;Colour='#F6B83F';OpenTicks=23;CloseTicks=16;Lift=8;BurstParticles=12;EffectScale=1.65}
}

function Get-ToyboxImageSource([string]$kind) {
    if(-not$script:toyboxAssetFiles.ContainsKey($kind)){return $null}
    $path=Join-Path $script:toyboxAssetRoot $script:toyboxAssetFiles[$kind]
    if(-not(Test-Path -LiteralPath $path)){return $null}
    $bitmap=New-Object Windows.Media.Imaging.BitmapImage
    $bitmap.BeginInit()
    $bitmap.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $bitmap.UriSource=[Uri]::new((Resolve-Path -LiteralPath $path).Path)
    $bitmap.EndInit()
    $bitmap.Freeze()
    return $bitmap
}

function New-ToyboxImage([string]$kind) {
    $source=Get-ToyboxImageSource $kind
    if($null-eq$source){return $null}
    $image=New-Object Windows.Controls.Image
    $image.Source=$source
    $image.Stretch=[Windows.Media.Stretch]::Uniform
    $image.SnapsToDevicePixels=$true
    $image.IsHitTestVisible=$false
    return $image
}

function Get-BlockBrush([string]$type) {
    if($type-eq'Mirror'){
        $mirrorBrush=New-Object Windows.Media.LinearGradientBrush
        $mirrorBrush.StartPoint=[Windows.Point]::new(0,0);$mirrorBrush.EndPoint=[Windows.Point]::new(1,1)
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(225,250,255),0.0)))
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(104,194,232),0.24)))
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(245,253,255),0.36)))
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(61,117,172),0.58)))
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(189,239,250),0.78)))
        $mirrorBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(48,85,135),1.0)))
        return $mirrorBrush
    }
    $materialSource=Get-ToyboxImageSource "$($type)Material"
    if($null-ne$materialSource){
        $materialBrush=New-Object Windows.Media.ImageBrush $materialSource
        $materialBrush.TileMode=[Windows.Media.TileMode]::FlipXY
        $materialBrush.ViewportUnits=[Windows.Media.BrushMappingMode]::Absolute
        $materialSize=$(if($type-eq'Normal'){176}elseif($type-in@('Bouncy','Fire')){210}elseif($type-eq'Ice'){230}elseif($type-eq'Cloud'){330}elseif($type-eq'Crumbling'){260}else{280})
        $materialBrush.Viewport=[Windows.Rect]::new(0,0,$materialSize,$materialSize)
        $materialBrush.ViewboxUnits=[Windows.Media.BrushMappingMode]::RelativeToBoundingBox;$materialBrush.Viewbox=[Windows.Rect]::new(0,0,1,1)
        $materialBrush.Stretch=[Windows.Media.Stretch]::Fill;$materialBrush.AlignmentX='Left';$materialBrush.AlignmentY='Top'
        return $materialBrush
    }
    $source=Get-ToyboxImageSource "$($type)Tile"
    if($null-ne$source){
        $artBrush=New-Object Windows.Media.ImageBrush $source
        $singleSurface=$type-in@('Bouncy','Fire','Ice','Mirror')
        $artBrush.TileMode=$(if($type-in@('Normal','Grass')){[Windows.Media.TileMode]::FlipXY}elseif($singleSurface){[Windows.Media.TileMode]::None}else{[Windows.Media.TileMode]::Tile})
        $artBrush.ViewportUnits=$(if($singleSurface){[Windows.Media.BrushMappingMode]::RelativeToBoundingBox}else{[Windows.Media.BrushMappingMode]::Absolute})
        $artBrush.Viewport=$(if($singleSurface){[Windows.Rect]::new(0,0,1,1)}elseif($type-eq'Grass'){[Windows.Rect]::new(0,0,320,96)}elseif($type-eq'Conveyor'){[Windows.Rect]::new(0,0,58,32)}else{[Windows.Rect]::new(0,0,72,34)})
        # The generated tile PNGs are complete rounded platform silhouettes.
        # Repeat only their filled interior so transparent outer gutters and
        # pointed end-caps do not turn a resized block into separate mini-blocks.
        $artBrush.ViewboxUnits=[Windows.Media.BrushMappingMode]::RelativeToBoundingBox
        $artBrush.Viewbox=$(if($type-eq'Conveyor'){[Windows.Rect]::new(.36,.11,.28,.78)}elseif($type-eq'Grass'){[Windows.Rect]::new(.08,.54,.84,.34)}else{[Windows.Rect]::new(.09,.11,.82,.78)})
        $artBrush.Stretch=[Windows.Media.Stretch]::Fill
        $artBrush.AlignmentX=[Windows.Media.AlignmentX]::Left
        $artBrush.AlignmentY=[Windows.Media.AlignmentY]::Top
        return $artBrush
    }
    $xaml = switch ($type) {
        'Bouncy' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,52,34" ViewportUnits="Absolute" Viewbox="0,0,52,34" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H52 V34 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFFF8BCB" Offset="0"/><GradientStop Color="#FFE94399" Offset="0.52"/><GradientStop Color="#FF9E247D" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M5,25 C9,7 20,4 26,17 C32,4 43,7 47,25"><GeometryDrawing.Pen><Pen Brush="#99FFFFFF" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M10,8 C15,4 19,4 22,7"><GeometryDrawing.Pen><Pen Brush="#CCFFFFFF" Thickness="2.4" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Fire' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,64,34" ViewportUnits="Absolute" Viewbox="0,0,64,34" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H64 V34 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFFFC928" Offset="0"/><GradientStop Color="#FFFF5A1F" Offset="0.5"/><GradientStop Color="#FF9D1524" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,23 L10,15 L18,25 L30,8 L41,22 L51,12 L64,22 V34 H0 Z" Brush="#FFD92720"/><GeometryDrawing Geometry="M0,28 L12,20 L20,29 L30,16 L42,27 L53,19 L64,27"><GeometryDrawing.Pen><Pen Brush="#FFFFE45B" Thickness="2.4" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Ice' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,64,34" ViewportUnits="Absolute" Viewbox="0,0,64,34" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H64 V34 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFE9FCFF" Offset="0"/><GradientStop Color="#FF71DDF5" Offset="0.55"/><GradientStop Color="#FF218BBE" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,0 L18,0 L8,34 L0,34 Z" Brush="#668CFAFF"/><GeometryDrawing Geometry="M18,0 L42,0 L31,34 L8,34 Z" Brush="#55FFFFFF"/><GeometryDrawing Geometry="M42,0 L64,0 L64,34 L31,34 Z" Brush="#554BBDE8"/><GeometryDrawing Geometry="M18,0 L8,34 M42,0 L31,34"><GeometryDrawing.Pen><Pen Brush="#AAFFFFFF" Thickness="1.2"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Grass' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,64,34" ViewportUnits="Absolute" Viewbox="0,0,64,34" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H64 V34 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FF8B552B" Offset="0"/><GradientStop Color="#FF61361F" Offset="0.62"/><GradientStop Color="#FF3E241B" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,0 H64 V8 L59,12 L53,9 L47,14 L40,9 L34,13 L27,9 L21,14 L15,9 L9,12 L4,8 L0,11 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFC2ED72" Offset="0"/><GradientStop Color="#FF70C64F" Offset="0.48"/><GradientStop Color="#FF31823C" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,1 H64"><GeometryDrawing.Pen><Pen Brush="#FFE1F99B" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M0,10 L5,7 L9,12 L15,9 L21,14 L27,9 L34,13 L40,9 L47,14 L53,9 L59,12 L64,8"><GeometryDrawing.Pen><Pen Brush="#FF285F35" Thickness="1.5"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M7,4 L9,0 M15,6 L17,1 M29,5 L31,0 M43,6 L46,1 M56,5 L58,0"><GeometryDrawing.Pen><Pen Brush="#FFD5F58A" Thickness="1.4" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M12,17 L17,22 L15,29 M38,16 L34,22 L37,28 M55,15 L51,20"><GeometryDrawing.Pen><Pen Brush="#FFC38A50" Thickness="1.5" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M5,25 L10,22 L14,25 L10,28 Z" Brush="#FF9A7048"/><GeometryDrawing Geometry="M45,25 L50,22 L55,25 L52,29 L47,29 Z" Brush="#FF3F6B69"/><GeometryDrawing Geometry="M0,33 H64"><GeometryDrawing.Pen><Pen Brush="#FF2B1B17" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Cloud' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,240,104" ViewportUnits="Absolute" Viewbox="0,0,240,104" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H240 V104 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FF72CFF4" Offset="0"/><GradientStop Color="#FFBDEBFA" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M-12,37 C-9,24 2,20 14,24 C18,9 37,5 48,19 C57,10 75,15 77,29 C91,26 102,35 99,47 H-5 Z M116,28 C119,18 128,15 138,18 C143,4 161,2 169,16 C180,8 194,15 195,27 C210,24 220,33 217,44 H111 Z M48,84 C48,70 60,64 72,68 C78,49 101,45 113,62 C123,50 143,55 146,70 C160,67 173,77 169,91 H42 Z M176,92 C174,81 183,73 194,75 C198,61 215,58 224,71 C234,66 245,74 247,87 V103 H177 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFFFFFFF" Offset="0"/><GradientStop Color="#FFE5F8FF" Offset=".45"/><GradientStop Color="#FF92CFE8" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush><GeometryDrawing.Pen><Pen Brush="#EEFFFFFF" Thickness="2.4"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M7,37 C30,27 65,29 88,39 M126,31 C149,22 188,24 207,35 M58,82 C84,68 132,69 158,84 M190,90 C208,81 229,82 242,92"><GeometryDrawing.Pen><Pen Brush="#77FFFFFF" Thickness="3" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M0,101 C35,95 53,99 78,96 C112,91 143,102 177,96 C202,92 220,98 240,94 V104 H0 Z" Brush="#5586C7E4"/></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Crumbling' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,180,82" ViewportUnits="Absolute" Viewbox="0,0,180,82" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H180 V82 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FFC8874B" Offset="0"/><GradientStop Color="#FF87502F" Offset=".5"/><GradientStop Color="#FF4A2B22" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,0 H180 V8 C165,5 151,11 136,7 C119,3 103,12 87,7 C68,2 55,11 37,7 C23,4 12,10 0,6 Z" Brush="#FFE7B86C"/><GeometryDrawing Geometry="M0,8 C28,13 49,5 74,10 C100,15 123,5 148,10 C160,13 171,8 180,10"><GeometryDrawing.Pen><Pen Brush="#FF633722" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M24,8 L31,19 L27,31 L39,41 L34,57 L44,68 M111,0 L106,13 L115,25 L108,39 L121,52 L116,70 L123,82 M158,9 L150,22 L156,34 L148,48"><GeometryDrawing.Pen><Pen Brush="#FF3E211C" Thickness="2.5" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M13,27 L20,23 L27,28 L21,33 L14,32 Z M66,54 L74,48 L83,53 L79,61 L69,62 Z M139,24 L146,20 L153,25 L149,31 L141,31 Z" Brush="#FFB2946C"><GeometryDrawing.Pen><Pen Brush="#FF4A3529" Thickness="1.3"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M52,16 C56,25 49,31 53,41 M92,42 C83,47 87,59 79,66 M163,49 C154,57 161,66 152,75"><GeometryDrawing.Pen><Pen Brush="#FFB67A42" Thickness="2" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M126,65 C131,59 140,61 141,67 C147,64 152,69 149,74 C143,78 131,76 126,71 Z M124,68 L119,65 M150,71 L156,74"><GeometryDrawing.Pen><Pen Brush="#FFE7D6AE" Thickness="2.5" StartLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M0,80 H180"><GeometryDrawing.Pen><Pen Brush="#FF2C1918" Thickness="3"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Ladder' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,56,40" ViewportUnits="Absolute" Viewbox="0,0,56,40" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H56 V40 H0 Z" Brush="#4423150C"/><GeometryDrawing Geometry="M7,-2 V42 M49,-2 V42"><GeometryDrawing.Pen><Pen Brush="#FF6F371B" Thickness="10" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M7,-2 V42 M49,-2 V42"><GeometryDrawing.Pen><Pen Brush="#FFD7964D" Thickness="5" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M8,10 H48 M8,32 H48"><GeometryDrawing.Pen><Pen Brush="#FFB86D31" Thickness="8" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M10,8 H46 M10,30 H46"><GeometryDrawing.Pen><Pen Brush="#FFFFC875" Thickness="2.2" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Conveyor' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,58,32" ViewportUnits="Absolute" Viewbox="0,0,58,32" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H58 V32 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="0,1"><GradientStop Color="#FF495467" Offset="0"/><GradientStop Color="#FF202735" Offset="0.48"/><GradientStop Color="#FF111721" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M0,3 H58 M0,27 H58"><GeometryDrawing.Pen><Pen Brush="#FFA9C3D8" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M7,16 A7,7 0 1 0 21,16 A7,7 0 1 0 7,16 M37,16 A7,7 0 1 0 51,16 A7,7 0 1 0 37,16"><GeometryDrawing.Pen><Pen Brush="#FF8296AA" Thickness="3"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M11,16 H47"><GeometryDrawing.Pen><Pen Brush="#FF61D4E8" Thickness="2" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        'Mirror' {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,64,32" ViewportUnits="Absolute" Viewbox="0,0,64,32" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H64 V32 H0 Z"><GeometryDrawing.Brush><LinearGradientBrush StartPoint="0,0" EndPoint="1,1"><GradientStop Color="#FFF8FFFF" Offset="0"/><GradientStop Color="#FF85D7EF" Offset="0.45"/><GradientStop Color="#FF376DA5" Offset="1"/></LinearGradientBrush></GeometryDrawing.Brush></GeometryDrawing><GeometryDrawing Geometry="M7,27 L29,5 M34,27 L56,5"><GeometryDrawing.Pen><Pen Brush="#CCFFFFFF" Thickness="3" StartLineCap="Round" EndLineCap="Round"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M0,1 H64 V31 H0 Z"><GeometryDrawing.Pen><Pen Brush="#FFE5F7FF" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
        default {
            '<DrawingBrush xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" TileMode="Tile" Viewport="0,0,64,32" ViewportUnits="Absolute" Viewbox="0,0,64,32" ViewboxUnits="Absolute"><DrawingBrush.Drawing><DrawingGroup><GeometryDrawing Geometry="M0,0 H64 V32 H0 Z" Brush="#FF626777"/><GeometryDrawing Geometry="M0,0 H64 M0,16 H64 M0,32 H64 M16,0 V16 M48,16 V32"><GeometryDrawing.Pen><Pen Brush="#FFD8D1C4" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing><GeometryDrawing Geometry="M1,2 H63 M1,18 H63"><GeometryDrawing.Pen><Pen Brush="#557A8294" Thickness="2"/></GeometryDrawing.Pen></GeometryDrawing></DrawingGroup></DrawingBrush.Drawing></DrawingBrush>'
        }
    }
    return [Windows.Markup.XamlReader]::Parse($xaml)
}

function Set-BlockGameplayVisual($blockData, [bool]$gameplay) {
    $blockData.Label.Visibility = $(if ($gameplay) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
    foreach ($handle in @($blockData.Handles)) {
        $handle.Visibility = $(if ($gameplay) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
    }
    $blockData.Element.Cursor = $(if ($gameplay) { [Windows.Input.Cursors]::Arrow } else { [Windows.Input.Cursors]::SizeAll })
    $blockData.Element.BorderThickness = [Windows.Thickness]::new($(if ($gameplay) { 1.25 } else { 2 }))
    Set-OverlayClickThroughState $blockData.Window $gameplay
}

function Set-BlockTint($blockData, [int]$tintIndex) {
    $colors = @(
        [Windows.Media.Color]::FromArgb(0,255,255,255),
        [Windows.Media.Color]::FromArgb(82,152,84,255),
        [Windows.Media.Color]::FromArgb(82,30,132,255),
        [Windows.Media.Color]::FromArgb(82,44,190,103),
        [Windows.Media.Color]::FromArgb(82,255,178,42),
        [Windows.Media.Color]::FromArgb(82,255,67,128)
    )
    $safeIndex=[Math]::Max(0,[Math]::Min($colors.Count-1,$tintIndex))
    $blockData.TintIndex=$safeIndex
    $blockData.Tint.Background=New-Object Windows.Media.SolidColorBrush $colors[$safeIndex]
}

function Remove-PlayroomBlock($blockData) {
    if ($null -eq $blockData) { return }
    if($script:activeRotationData-eq$blockData){Close-FreeRotationHandle}
    Remove-RopesForPlacement $blockData
    $script:playroomBlocks.Remove($blockData)
    $blockData.Window.Close()
}

function Trigger-TemporaryBlock($blockData,[string]$sourceKey='Player1') {
    if($null-eq$blockData-or$null-eq$blockData.PSObject.Properties['Type']-or$null-eq$blockData.PSObject.Properties['TemporaryState']){return}
    if($blockData.TemporaryState-ne'Stable'-or$blockData.Type-notin@('Cloud','Crumbling')){return}
    if([string]::IsNullOrWhiteSpace($sourceKey)){$sourceKey='Unknown'}
    $contactTick=[int]$script:hazardTick
    $lastContact=$(if($blockData.ContactTicks.ContainsKey($sourceKey)){[int]$blockData.ContactTicks[$sourceKey]}else{-999999})
    $newLanding=($contactTick-$lastContact)-gt8
    $blockData.ContactTicks[$sourceKey]=$contactTick
    if(-not$newLanding){return}
    if($blockData.Type-eq'Cloud'){
        $blockData.TemporaryState='Warning';$blockData.TemporaryTicks=75;$blockData.Label.Text='PUFF!'
    }elseif($blockData.Type-eq'Crumbling'){
        $blockData.Landings++
        $blockData.CrumbleShakeTicks=12
        $blockData.CrumbleOverlay.Opacity=[Math]::Min(1,.24+($blockData.Landings*.25))
        $blockData.Label.Text="CRACK $($blockData.Landings)/3"
        if($blockData.Landings-ge3){$blockData.TemporaryState='Warning';$blockData.TemporaryTicks=35}
    }
}

function Update-TemporaryBlocks {
    foreach($blockData in @($script:playroomBlocks|Where-Object{$_.Type-in@('Cloud','Crumbling')})){
        if($blockData.Type-eq'Crumbling'){
            if($blockData.CrumbleShakeTicks-gt0){
                $blockData.CrumbleShakeTicks--
                $blockData.CrumbleTranslate.X=$(if(($blockData.CrumbleShakeTicks%2)-eq0){-2.4}else{2.4})
                $blockData.CrumbleTranslate.Y=$(if(($blockData.CrumbleShakeTicks%3)-eq0){1.5}else{0})
                $pieceIndex=0
                foreach($piece in @($blockData.CrumblePieces)){
                    $piece.Opacity=[Math]::Min(1,.25+($blockData.Landings*.22))
                    [Windows.Controls.Canvas]::SetTop($piece,4+(($pieceIndex*7+$blockData.CrumbleShakeTicks*2)%22));$pieceIndex++
                }
            }else{$blockData.CrumbleTranslate.X=0;$blockData.CrumbleTranslate.Y=0}
        }
        if($blockData.TemporaryState-eq'Warning'){
            $blockData.TemporaryTicks--
            if($blockData.Type-eq'Crumbling'){
                $collapse=[Math]::Max(.05,$blockData.TemporaryTicks/35.0)
                $blockData.CrumbleScale.ScaleY=$collapse;$blockData.CrumbleTranslate.Y=(1-$collapse)*$blockData.Height
                $blockData.Element.Opacity=[Math]::Max(.18,$collapse)
            }else{$blockData.Element.Opacity=$(if(($blockData.TemporaryTicks%12)-lt6){.3}else{.82})}
            if($blockData.TemporaryTicks-le0){
                $blockData.TemporaryState='Gone';$blockData.TemporaryTicks=$(if($script:wispfallActive){999999}else{240})
                $blockData.Window.Hide()
            }
        }elseif($blockData.TemporaryState-eq'Gone'-and-not$script:wispfallActive){
            $blockData.TemporaryTicks--
            if($blockData.TemporaryTicks-le0){
                $blockData.TemporaryState='Stable';$blockData.Landings=0;$blockData.Element.Opacity=1;$blockData.Label.Text=$blockData.Type.ToUpperInvariant();$blockData.ContactTicks.Clear()
                if($blockData.Type-eq'Crumbling'){$blockData.CrumbleScale.ScaleY=1;$blockData.CrumbleTranslate.X=0;$blockData.CrumbleTranslate.Y=0;$blockData.CrumbleOverlay.Opacity=.12}
                $blockData.Window.Show()
            }
        }
    }
}

function Get-GrassCapBrush {
    $source=Get-ToyboxImageSource 'GrassTile'
    if($null-eq$source){return New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(83,170,66))}
    $brush=New-Object Windows.Media.ImageBrush $source
    $brush.TileMode=[Windows.Media.TileMode]::Tile;$brush.ViewportUnits=[Windows.Media.BrushMappingMode]::Absolute;$brush.Viewport=[Windows.Rect]::new(0,0,96,14)
    $brush.ViewboxUnits=[Windows.Media.BrushMappingMode]::RelativeToBoundingBox;$brush.Viewbox=[Windows.Rect]::new(.08,.08,.84,.48)
    $brush.Stretch=[Windows.Media.Stretch]::Fill;$brush.AlignmentX='Left';$brush.AlignmentY='Top'
    return $brush
}

function Set-ConveyorDirection($blockData,[int]$direction) {
    if($null-eq$blockData-or$blockData.Type-ne'Conveyor'){return}
    $blockData.Direction=$(if($direction-lt0){-1}else{1})
    if($null-ne$blockData.ConveyorArrows){$blockData.ConveyorArrows.Text=$(if($blockData.Direction-lt0){'<   <   <   <'}else{'>   >   >   >'})}
    $blockData.Label.Text=$(if($blockData.Direction-lt0){'CONVEYOR  <'}else{'CONVEYOR  >'})
}

function Update-ConveyorVisuals {
    foreach($conveyor in @($script:playroomBlocks|Where-Object{$_.Type-eq'Conveyor'})){
        $conveyor.VisualPhase=($conveyor.VisualPhase+($conveyor.Direction*.75))%58
        if($conveyor.VisualPhase-lt0){$conveyor.VisualPhase+=58}
        if($null-ne$conveyor.ConveyorBeltTransform){$conveyor.ConveyorBeltTransform.X=$conveyor.VisualPhase}
        if($null-ne$conveyor.ConveyorArrowTransform){$conveyor.ConveyorArrowTransform.X=($conveyor.VisualPhase%29)-14.5}
    }
    foreach($mirror in @($script:playroomBlocks|Where-Object{$_.Type-eq'Mirror'-and$null-ne$_.MirrorShine})){
        $mirror.MirrorShine.Opacity=.18+(.14*[Math]::Sin($script:inputTick*.035))
    }
}

function Copy-PlayroomBlock($sourceBlock) {
    if ($null -eq $sourceBlock -or -not $script:playroomActive) { return }
    $beforeCount=$script:playroomBlocks.Count
    Add-PlayroomBlock $sourceBlock.Type
    if ($script:playroomBlocks.Count -le $beforeCount) { return }
    $copy=$script:playroomBlocks[$script:playroomBlocks.Count-1]
    $screenLeft=[Windows.SystemParameters]::VirtualScreenLeft
    $screenTop=[Windows.SystemParameters]::VirtualScreenTop
    $screenRight=$screenLeft+[Windows.SystemParameters]::VirtualScreenWidth
    $screenBottom=$screenTop+[Windows.SystemParameters]::VirtualScreenHeight
    $copy.Width=$sourceBlock.Width;$copy.Height=$sourceBlock.Height
    $copy.X=[Math]::Min($screenRight-$copy.Width,[Math]::Max($screenLeft,$sourceBlock.X+24))
    $copy.Y=[Math]::Min($screenBottom-$copy.Height,[Math]::Max($screenTop,$sourceBlock.Y+24))
    $copy.Window.Width=$copy.Width;$copy.Window.Height=$copy.Height
    $copy.Window.Left=$copy.X;$copy.Window.Top=$copy.Y
    Set-BlockTint $copy $sourceBlock.TintIndex
    Set-PlacementAngle $copy $sourceBlock.Angle
    if($sourceBlock.Type-eq'Conveyor'){Set-ConveyorDirection $copy $sourceBlock.Direction}
}

function Close-FreeRotationHandle {
    if($null-ne$script:activeRotationHandleWindow){try{$script:activeRotationHandleWindow.Close()}catch{}}
    $script:activeRotationHandleWindow=$null;$script:activeRotationData=$null
}

function Update-FreeRotationHandlePosition {
    if($null-eq$script:activeRotationHandleWindow-or$null-eq$script:activeRotationData){return}
    $data=$script:activeRotationData
    if($null-eq$data.Window-or-not$data.Window.IsVisible){Close-FreeRotationHandle;return}
    $centreX=$data.X+($data.Width/2)
    $script:activeRotationHandleWindow.Left=$centreX-19
    $script:activeRotationHandleWindow.Top=$data.Window.Top-42
}

function Update-FreeRotationFromCursor($rotationState) {
    if($null-eq$rotationState-or$null-eq$rotationState.Data){return}
    $cursor=New-Object PetNative+POINT
    if(-not[PetNative]::GetCursorPos([ref]$cursor)){return}
    $centreX=$rotationState.Data.X+($rotationState.Data.Width/2)
    $centreY=$rotationState.Data.Y+($rotationState.Data.Height/2)
    $pointerAngle=[Math]::Atan2($cursor.Y-$centreY,$cursor.X-$centreX)*180/[Math]::PI
    Set-PlacementAngle $rotationState.Data ($pointerAngle-$rotationState.Offset)
}

function Show-FreeRotationHandle($data) {
    if($null-eq$data){return}
    if($script:activeRotationData-eq$data-and$null-ne$script:activeRotationHandleWindow){Close-FreeRotationHandle;return}
    Close-FreeRotationHandle
    $handleWindow=New-Object Windows.Window
    $handleWindow.Title='Windowisp Free Rotate';$handleWindow.Width=38;$handleWindow.Height=38
    $handleWindow.WindowStyle=[Windows.WindowStyle]::None;$handleWindow.AllowsTransparency=$true
    $handleWindow.Background=[Windows.Media.Brushes]::Transparent;$handleWindow.ShowInTaskbar=$false
    $handleWindow.ShowActivated=$false;$handleWindow.Topmost=$true;$handleWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $circle=New-Object Windows.Controls.Border
    $circle.Width=34;$circle.Height=34;$circle.CornerRadius=[Windows.CornerRadius]::new(17)
    $circle.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(238,38,34,56))
    $circle.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(121,211,255))
    $circle.BorderThickness=[Windows.Thickness]::new(2);$circle.Cursor=[Windows.Input.Cursors]::Hand
    $arrow=New-Object Windows.Controls.TextBlock
    $arrow.Text=[string][char]0x21BB;$arrow.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Symbol')
    $arrow.FontSize=24;$arrow.FontWeight=[Windows.FontWeights]::Bold
    $arrow.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(164,229,255))
    $arrow.HorizontalAlignment='Center';$arrow.VerticalAlignment='Center';$arrow.Margin=[Windows.Thickness]::new(0,-3,0,0)
    $circle.Child=$arrow
    $state=[pscustomobject]@{Data=$data;Dragging=$false;Offset=0.0}
    $circle.Tag=$state
    $circle.Add_MouseLeftButtonDown({
        param($sender,$eventArgs)
        $cursor=New-Object PetNative+POINT
        if([PetNative]::GetCursorPos([ref]$cursor)){
            $centreX=$sender.Tag.Data.X+($sender.Tag.Data.Width/2);$centreY=$sender.Tag.Data.Y+($sender.Tag.Data.Height/2)
            $pointerAngle=[Math]::Atan2($cursor.Y-$centreY,$cursor.X-$centreX)*180/[Math]::PI
            $sender.Tag.Offset=$pointerAngle-$sender.Tag.Data.Angle
        }
        $sender.Tag.Dragging=$true;$sender.CaptureMouse()|Out-Null;$eventArgs.Handled=$true
    })
    $circle.Add_MouseMove({param($sender,$eventArgs);if($sender.Tag.Dragging-and$eventArgs.LeftButton-eq[Windows.Input.MouseButtonState]::Pressed){Update-FreeRotationFromCursor $sender.Tag}})
    $circle.Add_MouseLeftButtonUp({param($sender,$eventArgs);if($sender.Tag.Dragging){Update-FreeRotationFromCursor $sender.Tag};$sender.Tag.Dragging=$false;$sender.ReleaseMouseCapture();$eventArgs.Handled=$true})
    $handleWindow.Content=$circle
    $script:activeRotationHandleWindow=$handleWindow;$script:activeRotationData=$data
    Update-FreeRotationHandlePosition
    $handleWindow.Show()
}

function Set-PlacementAngle($data,[double]$angle) {
    if($null-eq$data){return}
    $data.Angle=(($angle%360)+360)%360
    if($data.Kind-eq'Laser'){
        if($null-eq$data.PSObject.Properties['EmitterRotation']){
            $data|Add-Member -NotePropertyName EmitterRotation -NotePropertyValue ([Windows.Media.RotateTransform]::new($data.Angle))
            $data.Emitter.RenderTransformOrigin=[Windows.Point]::new(.5,.5)
            $data.Emitter.RenderTransform=$data.EmitterRotation
        }else{$data.EmitterRotation.Angle=$data.Angle}
        Update-FreeRotationHandlePosition
        return
    }
    if($data.Kind-eq'Fan'){
        $data.Label.Text="FAN  $([Math]::Round($data.Angle)) deg"
    }
    if($null-eq$data.PSObject.Properties['RotationRoot']){
        $root=$data.Window.Content
        $data.Window.Content=$null
        $rotationCanvas=New-Object Windows.Controls.Canvas
        $rotationCanvas.ClipToBounds=$false
        $rotationCanvas.Children.Add($root)|Out-Null
        $data|Add-Member -NotePropertyName RotationRoot -NotePropertyValue $root
        $data|Add-Member -NotePropertyName RotationHost -NotePropertyValue $rotationCanvas
        $data.Window.Content=$rotationCanvas
    }
    if($null-eq$data.PSObject.Properties['RotationTransform']){
        $data|Add-Member -NotePropertyName RotationTransform -NotePropertyValue (New-Object Windows.Media.RotateTransform $data.Angle)
        $data.RotationRoot.RenderTransformOrigin=[Windows.Point]::new(.5,.5)
        $data.RotationRoot.RenderTransform=$data.RotationTransform
    }else{$data.RotationTransform.Angle=$data.Angle}
    $continuous=$null-ne$data.PSObject.Properties['ContinuousRotation']-and$data.ContinuousRotation
    $radians=$data.Angle*[Math]::PI/180
    if($continuous){
        $diagonal=[Math]::Ceiling([Math]::Sqrt(($data.Width*$data.Width)+($data.Height*$data.Height)))+4
        $boundWidth=$diagonal;$boundHeight=$diagonal
    }else{
        $cos=[Math]::Abs([Math]::Cos($radians));$sin=[Math]::Abs([Math]::Sin($radians))
        $boundWidth=[Math]::Max(1,($data.Width*$cos)+($data.Height*$sin))
        $boundHeight=[Math]::Max(1,($data.Width*$sin)+($data.Height*$cos))
    }
    if($continuous-and-not[double]::IsNaN($data.RotationHost.Width)-and[Math]::Abs($data.Window.Width-$boundWidth)-le.25-and[Math]::Abs($data.Window.Height-$boundHeight)-le.25){Update-FreeRotationHandlePosition;return}
    $centreX=$data.X+($data.Width/2);$centreY=$data.Y+($data.Height/2)
    $data.RotationRoot.Width=$data.Width;$data.RotationRoot.Height=$data.Height
    [Windows.Controls.Canvas]::SetLeft($data.RotationRoot,($boundWidth-$data.Width)/2)
    [Windows.Controls.Canvas]::SetTop($data.RotationRoot,($boundHeight-$data.Height)/2)
    if([double]::IsNaN($data.RotationHost.Width)-or[double]::IsNaN($data.RotationHost.Height)-or[Math]::Abs($data.Window.Width-$boundWidth)-gt.25-or[Math]::Abs($data.Window.Height-$boundHeight)-gt.25){
        $data.RotationHost.Width=$boundWidth;$data.RotationHost.Height=$boundHeight
        $data.Window.Width=$boundWidth;$data.Window.Height=$boundHeight
        $data.Window.Left=$centreX-($boundWidth/2);$data.Window.Top=$centreY-($boundHeight/2)
    }
    Update-FreeRotationHandlePosition
}

function Resolve-PlayerRotatedBlock($block,[double]$playerX,[double]$playerY,[double]$velocityX,[double]$velocityY) {
    if([Math]::Abs($block.Angle)-lt.01){return $null}
    $r=$block.Angle*[Math]::PI/180
    $ux=[Math]::Cos($r);$uy=[Math]::Sin($r);$vx=-[Math]::Sin($r);$vy=[Math]::Cos($r)
    $blockCenterX=$block.X+$block.Width/2;$blockCenterY=$block.Y+$block.Height/2
    $playerCenterX=$playerX+$PetWidth/2;$playerCenterY=$playerY+$PetHeight/2
    $playerHalfWidth=$PetWidth/2-12;$playerHalfHeight=$PetHeight/2-5
    $deltaX=$playerCenterX-$blockCenterX;$deltaY=$playerCenterY-$blockCenterY
    $minimumOverlap=[double]::PositiveInfinity;$normalX=0.0;$normalY=0.0
    foreach($axis in @(@(1.0,0.0),@(0.0,1.0),@($ux,$uy),@($vx,$vy))){
        $axisX=[double]$axis[0];$axisY=[double]$axis[1]
        $distance=($deltaX*$axisX)+($deltaY*$axisY)
        $playerRadius=($playerHalfWidth*[Math]::Abs($axisX))+($playerHalfHeight*[Math]::Abs($axisY))
        $blockRadius=($block.Width/2*[Math]::Abs(($ux*$axisX)+($uy*$axisY)))+($block.Height/2*[Math]::Abs(($vx*$axisX)+($vy*$axisY)))
        $overlap=$playerRadius+$blockRadius-[Math]::Abs($distance)
        if($overlap-le0){return $null}
        if($overlap-lt$minimumOverlap){
            $minimumOverlap=$overlap
            $sign=$(if($distance-ge0){1.0}else{-1.0})
            $normalX=$axisX*$sign;$normalY=$axisY*$sign
        }
    }
    $playerCenterX+=$normalX*($minimumOverlap+.25);$playerCenterY+=$normalY*($minimumOverlap+.25)
    $inwardVelocity=($velocityX*$normalX)+($velocityY*$normalY)
    if($inwardVelocity-lt0){$velocityX-=$inwardVelocity*$normalX;$velocityY-=$inwardVelocity*$normalY}
    $topNormalX=$vx*-1;$topNormalY=$vy*-1
    $topFacing=(($normalX*$topNormalX)+($normalY*$topNormalY))-gt.62
    return [pscustomobject]@{
        X=$playerCenterX-$PetWidth/2;Y=$playerCenterY-$PetHeight/2;VX=$velocityX;VY=$velocityY
        Grounded=($topFacing-and$normalY-lt-.25);Wall=if([Math]::Abs($normalX)-gt.55){[Math]::Sign($normalX)*-1}else{0}
        Block=$block
    }
}

function Resolve-PlayerWoodenPlatform($block,[double]$oldX,[double]$oldY,[double]$playerX,[double]$playerY,[double]$velocityX,[double]$velocityY,[int]$dropTicks) {
    # Clouds share the one-way top-face behaviour of wooden platforms, while
    # retaining their own temporary puff/fade lifecycle after a landing.
    if($block.Type-notin@('Wooden','Cloud')-or$block.TemporaryState-eq'Gone'-or$dropTicks-gt0){return $null}
    $r=$block.Angle*[Math]::PI/180
    $alongX=[Math]::Cos($r);$alongY=[Math]::Sin($r)
    $topX=[Math]::Sin($r);$topY=-[Math]::Cos($r)
    $topCentreX=$block.X+($block.Width/2)+($topX*$block.Height/2)
    $topCentreY=$block.Y+($block.Height/2)+($topY*$block.Height/2)
    $oldFootX=$oldX+($PetWidth/2);$oldFootY=$oldY+$PetHeight
    $newFootX=$playerX+($PetWidth/2);$newFootY=$playerY+$PetHeight
    $oldDistance=(($oldFootX-$topCentreX)*$topX)+(($oldFootY-$topCentreY)*$topY)
    $newDistance=(($newFootX-$topCentreX)*$topX)+(($newFootY-$topCentreY)*$topY)
    $alongDistance=(($newFootX-$topCentreX)*$alongX)+(($newFootY-$topCentreY)*$alongY)
    $approach=($velocityX*$topX)+($velocityY*$topY)
    if($approach-ge.1-or$oldDistance-lt-6-or$newDistance-gt0-or[Math]::Abs($alongDistance)-gt($block.Width/2+($PetWidth*.25))){return $null}
    $correction=-$newDistance
    $playerX+=$topX*$correction;$playerY+=$topY*$correction
    if($approach-lt0){$velocityX-=$approach*$topX;$velocityY-=$approach*$topY}
    return [pscustomobject]@{X=$playerX;Y=$playerY;VX=$velocityX;VY=$velocityY;Grounded=($topY-lt-.25);Block=$block}
}

function Resolve-BallRotatedBlock($ball,$block,[double]$restitution) {
    if([Math]::Abs($block.Angle)-lt.01){return $false}
    $r=$block.Angle*[Math]::PI/180
    $ux=[Math]::Cos($r);$uy=[Math]::Sin($r);$vx=-[Math]::Sin($r);$vy=[Math]::Cos($r)
    $blockCenterX=$block.X+$block.Width/2;$blockCenterY=$block.Y+$block.Height/2
    $ballCenterX=$ball.X+$ball.Radius;$ballCenterY=$ball.Y+$ball.Radius
    $dx=$ballCenterX-$blockCenterX;$dy=$ballCenterY-$blockCenterY
    $localX=($dx*$ux)+($dy*$uy);$localY=($dx*$vx)+($dy*$vy)
    $halfWidth=$block.Width/2;$halfHeight=$block.Height/2
    $closestX=[Math]::Max(-$halfWidth,[Math]::Min($halfWidth,$localX))
    $closestY=[Math]::Max(-$halfHeight,[Math]::Min($halfHeight,$localY))
    $normalLocalX=$localX-$closestX;$normalLocalY=$localY-$closestY
    $distanceSquared=($normalLocalX*$normalLocalX)+($normalLocalY*$normalLocalY)
    if($distanceSquared-ge($ball.Radius*$ball.Radius)){return $false}
    if($distanceSquared-lt.0001){
        $edgeX=$halfWidth-[Math]::Abs($localX);$edgeY=$halfHeight-[Math]::Abs($localY)
        if($edgeX-lt$edgeY){$normalLocalX=$(if($localX-ge0){1.0}else{-1.0});$normalLocalY=0;$penetration=$ball.Radius+$edgeX}
        else{$normalLocalX=0;$normalLocalY=$(if($localY-ge0){1.0}else{-1.0});$penetration=$ball.Radius+$edgeY}
    }else{
        $distance=[Math]::Sqrt($distanceSquared);$normalLocalX/=$distance;$normalLocalY/=$distance;$penetration=$ball.Radius-$distance
    }
    $normalX=($normalLocalX*$ux)+($normalLocalY*$vx);$normalY=($normalLocalX*$uy)+($normalLocalY*$vy)
    $ballCenterX+=$normalX*($penetration+.2);$ballCenterY+=$normalY*($penetration+.2)
    $ball.X=$ballCenterX-$ball.Radius;$ball.Y=$ballCenterY-$ball.Radius
    $inward=($ball.VX*$normalX)+($ball.VY*$normalY)
    if($inward-lt0){$ball.VX-=(1+$restitution)*$inward*$normalX;$ball.VY-=(1+$restitution)*$inward*$normalY}
    $topNormalX=$vx*-1;$topNormalY=$vy*-1
    $topFacing=(($normalX*$topNormalX)+($normalY*$topNormalY))-gt.62
    if($topFacing-and$block.Type-eq'Bouncy'){$ball.VX+=$topNormalX*8;$ball.VY+=$topNormalY*8}
    elseif($topFacing-and$block.Type-eq'Fire'){$ball.VX+=$topNormalX*5;$ball.VY+=$topNormalY*5}
    elseif($topFacing-and$block.Type-eq'Ice'){$ball.VX*=1.06;$ball.VY*=1.06}
    elseif($topFacing-and$block.Type-eq'Conveyor'){
        $ball.VX=[Math]::Max(-16,[Math]::Min(16,$ball.VX+($ux*$block.Direction*.85)))
        $ball.VY=[Math]::Max(-16,[Math]::Min(16,$ball.VY+($uy*$block.Direction*.85)))
    }
    return $true
}

function Resolve-DynamicPlacementRotatedBlock($placement,$block,[double]$restitution) {
    # Hazards have transparent artwork around a smaller physical body. Reuse the
    # proven swept-circle rotated-block solver against that real body, then map
    # the corrected centre back to the placement window.
    $bodyW=[double]$placement.BodyWidth;$bodyH=[double]$placement.BodyHeight
    $offX=[double]$placement.BodyOffsetX;$offY=[double]$placement.BodyOffsetY
    $radius=[Math]::Max(5.0,[Math]::Min($bodyW,$bodyH)*.5)
    $proxy=[pscustomobject]@{
        X=[double]($placement.X+$offX+($bodyW/2)-$radius)
        Y=[double]($placement.Y+$offY+($bodyH/2)-$radius)
        VX=[double]$placement.VX;VY=[double]$placement.VY;Radius=[double]$radius
    }
    if(-not(Resolve-BallRotatedBlock $proxy $block $restitution)){return $false}
    $placement.X=$proxy.X+$radius-($bodyW/2)-$offX
    $placement.Y=$proxy.Y+$radius-($bodyH/2)-$offY
    $placement.VX=$proxy.VX;$placement.VY=$proxy.VY
    return $true
}

function New-BlockMenuIcon([string]$kind, $colour = $null) {
    $canvas=New-Object Windows.Controls.Canvas
    $canvas.Width=16;$canvas.Height=16
    $stroke=$(if($null-ne$colour){$colour}else{New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(225,220,239))})
    if($kind-eq'Copy'){
        $back=New-Object Windows.Shapes.Rectangle;$back.Width=8;$back.Height=8;$back.RadiusX=1;$back.RadiusY=1
        $back.Stroke=$stroke;$back.StrokeThickness=1.5
        [Windows.Controls.Canvas]::SetLeft($back,2);[Windows.Controls.Canvas]::SetTop($back,2);$canvas.Children.Add($back)|Out-Null
        $front=New-Object Windows.Shapes.Rectangle;$front.Width=8;$front.Height=8;$front.RadiusX=1;$front.RadiusY=1
        $front.Fill=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(31,28,45))
        $front.Stroke=$stroke;$front.StrokeThickness=1.5
        [Windows.Controls.Canvas]::SetLeft($front,6);[Windows.Controls.Canvas]::SetTop($front,6);$canvas.Children.Add($front)|Out-Null
    }elseif($kind-eq'Colour'){
        foreach($dot in @(@(3,3,([Windows.Media.Color]::FromRgb(91,143,249))),@(9,3,([Windows.Media.Color]::FromRgb(236,79,132))),@(6,9,([Windows.Media.Color]::FromRgb(242,186,73))))){
            $circle=New-Object Windows.Shapes.Ellipse;$circle.Width=5;$circle.Height=5
            $circle.Fill=New-Object Windows.Media.SolidColorBrush $dot[2]
            [Windows.Controls.Canvas]::SetLeft($circle,$dot[0]);[Windows.Controls.Canvas]::SetTop($circle,$dot[1]);$canvas.Children.Add($circle)|Out-Null
        }
    }elseif($kind-eq'Delete'){
        foreach($coords in @(@(4,4,12,12),@(12,4,4,12))){
            $line=New-Object Windows.Shapes.Line
            $line.X1=$coords[0];$line.Y1=$coords[1];$line.X2=$coords[2];$line.Y2=$coords[3]
            $line.Stroke=$stroke;$line.StrokeThickness=2;$line.StrokeStartLineCap='Round';$line.StrokeEndLineCap='Round'
            $canvas.Children.Add($line)|Out-Null
        }
    }elseif($kind-eq'Swatch'){
        $swatch=New-Object Windows.Shapes.Ellipse;$swatch.Width=10;$swatch.Height=10
        $swatch.Fill=$stroke;$swatch.Stroke=[Windows.Media.Brushes]::White;$swatch.StrokeThickness=1
        [Windows.Controls.Canvas]::SetLeft($swatch,3);[Windows.Controls.Canvas]::SetTop($swatch,3);$canvas.Children.Add($swatch)|Out-Null
    }elseif($kind-eq'Rope'){
        $ropeLine=New-Object Windows.Shapes.Path
        $ropeLine.Stroke=$stroke;$ropeLine.StrokeThickness=2
        $ropeLine.Data=[Windows.Media.Geometry]::Parse('M 2,4 C 5,14 11,2 14,12')
        $canvas.Children.Add($ropeLine)|Out-Null
    }elseif($kind-eq'Rotate'){
        $rotatePath=New-Object Windows.Shapes.Path
        $rotatePath.Stroke=$stroke;$rotatePath.StrokeThickness=1.8
        $rotatePath.StrokeStartLineCap='Round';$rotatePath.StrokeEndLineCap='Round'
        $rotatePath.Data=[Windows.Media.Geometry]::Parse('M 4,6 A 5,5 0 1 1 4,11 M 4,6 L 4,2 M 4,6 L 8,6')
        $canvas.Children.Add($rotatePath)|Out-Null
    }
    $iconTile=New-Object Windows.Controls.Border
    # Deliberately overlap the system icon-column boundary so the native
    # white partition can never show through in idle or hover states.
    $iconTile.Width=38;$iconTile.Height=26
    $iconTile.Margin=[Windows.Thickness]::new(-6,-4,-16,-4)
    $iconTile.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(20,43,67))
    $canvas.HorizontalAlignment=[Windows.HorizontalAlignment]::Left
    $canvas.Margin=[Windows.Thickness]::new(6,0,0,0)
    $iconTile.Child=$canvas
    return $iconTile
}

function Set-WindowispContextMenuStyle($menu) {
    $navy=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(20,43,67))
    $menu.Resources[[Windows.SystemColors]::MenuBrushKey]=$navy
    $menu.Resources[[Windows.SystemColors]::ControlBrushKey]=$navy
    $menu.Resources[[Windows.SystemColors]::HighlightBrushKey]=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(43,91,128))
    $menu.Resources[[Windows.SystemColors]::HighlightTextBrushKey]=[Windows.Media.Brushes]::White
    $menu.Background=$navy;$menu.Foreground=[Windows.Media.Brushes]::White
    $menu.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(104,168,211))
    $menu.BorderThickness=[Windows.Thickness]::new(1)
    return $navy
}

function Set-WindowispSubmenuStyle($item,$navy) {
    $item.Background=$navy;$item.Foreground=[Windows.Media.Brushes]::White
    $item.Resources[[Windows.SystemColors]::MenuBrushKey]=$navy
    $item.Resources[[Windows.SystemColors]::ControlBrushKey]=$navy
    $item.Resources[[Windows.SystemColors]::HighlightBrushKey]=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(43,91,128))
    $item.Resources[[Windows.SystemColors]::HighlightTextBrushKey]=[Windows.Media.Brushes]::White
}

function New-BlockContextMenu($blockData) {
    $menu=New-Object Windows.Controls.ContextMenu
    $iconRailBrush=Set-WindowispContextMenuStyle $menu
    $copy=New-Object Windows.Controls.MenuItem
    $copy.Header='Duplicate Block';$copy.Tag=$blockData;$copy.Icon=New-BlockMenuIcon 'Copy'
    $copy.Add_Click({param($sender,$eventArgs) Copy-PlayroomBlock $sender.Tag})
    $menu.Items.Add($copy)|Out-Null
    $recolour=New-Object Windows.Controls.MenuItem
    $recolour.Header='Block Colour';$recolour.Icon=New-BlockMenuIcon 'Colour'
    Set-WindowispSubmenuStyle $recolour $iconRailBrush
    $tintNames=@('Default','Violet','Ocean','Forest','Gold','Rose')
    $tintColours=@(
        [Windows.Media.Color]::FromRgb(172,165,188),
        [Windows.Media.Color]::FromRgb(145,91,219),
        [Windows.Media.Color]::FromRgb(52,143,218),
        [Windows.Media.Color]::FromRgb(54,166,103),
        [Windows.Media.Color]::FromRgb(224,169,55),
        [Windows.Media.Color]::FromRgb(226,91,132)
    )
    for($i=0;$i-lt$tintNames.Count;$i++){
        $tintItem=New-Object Windows.Controls.MenuItem
        $tintItem.Header=$tintNames[$i]
        $tintItem.IsCheckable=$true;$tintItem.IsChecked=([int]$blockData.TintIndex-eq$i)
        Set-WindowispSubmenuStyle $tintItem $iconRailBrush
        $tintItem.Icon=New-BlockMenuIcon 'Swatch' (New-Object Windows.Media.SolidColorBrush $tintColours[$i])
        $tintItem.Tag=[pscustomobject]@{Data=$blockData;Index=$i;Menu=$recolour}
        $tintItem.Add_Click({param($sender,$eventArgs) Set-BlockTint $sender.Tag.Data $sender.Tag.Index;foreach($item in @($sender.Tag.Menu.Items)){if($item.IsCheckable){$item.IsChecked=($item-eq$sender)}}})
        $recolour.Items.Add($tintItem)|Out-Null
    }
    $menu.Items.Add($recolour)|Out-Null
    if($blockData.Type-eq'Conveyor'){
        $reverse=New-Object Windows.Controls.MenuItem
        $reverse.Header='Reverse Direction';$reverse.Icon=New-BlockMenuIcon 'Rotate';$reverse.Tag=$blockData
        $reverse.Add_Click({param($sender,$eventArgs)Set-ConveyorDirection $sender.Tag (-1*$sender.Tag.Direction)})
        $menu.Items.Add($reverse)|Out-Null
    }
    $rotate=New-Object Windows.Controls.MenuItem
    $rotate.Header='Rotate Freely';$rotate.Icon=New-BlockMenuIcon 'Rotate';$rotate.Tag=$blockData
    $rotate.Add_Click({param($sender,$eventArgs)Show-FreeRotationHandle $sender.Tag})
    $menu.Items.Add($rotate)|Out-Null
    $resetRotate=New-Object Windows.Controls.MenuItem
    $resetRotate.Header='Reset Angle';$resetRotate.Icon=New-BlockMenuIcon 'Rotate';$resetRotate.Tag=$blockData
    $resetRotate.Add_Click({param($sender,$eventArgs)Set-PlacementAngle $sender.Tag 0})
    $menu.Items.Add($resetRotate)|Out-Null
    $delete=New-Object Windows.Controls.MenuItem
    $delete.Header='Delete Block';$delete.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,116,126))
    $delete.Icon=New-BlockMenuIcon 'Delete' $delete.Foreground
    $delete.Tag=$blockData
    $delete.Add_Click({param($sender,$eventArgs) Remove-PlayroomBlock $sender.Tag})
    $menu.Items.Add($delete)|Out-Null
    return $menu
}

function Remove-PlayroomPlacement($data) {
    if($null-eq$data){return}
    if($script:activeRotationData-eq$data){Close-FreeRotationHandle}
    if($data.Kind-ne'Rope'){Remove-RopesForPlacement $data}
    foreach($wire in @($script:playroomWires|Where-Object{$_.Source-eq$data-or$_.Target-eq$data})){Remove-PlayroomPlacement $wire}
    foreach($rotator in @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rotator'-and$_.Target-eq$data})){
        $rotator.Target=$null
        if($null-ne$data.PSObject.Properties['ContinuousRotation']){$data.ContinuousRotation=$false;Set-PlacementAngle $data $data.Angle}
    }
    if($data.Kind-eq'Wire'){$script:playroomWires.Remove($data)}
    elseif($data.Kind-eq'Block'){$script:playroomBlocks.Remove($data)}
    elseif($script:playroomBalls.Contains($data)){$script:playroomBalls.Remove($data)}
    else{
        if($data.Kind-eq'Rotator'-and$null-ne$data.Target){
            if($null-ne$data.Target.PSObject.Properties['ContinuousRotation']){$data.Target.ContinuousRotation=$false;Set-PlacementAngle $data.Target $data.Target.Angle}
        }
        $script:playroomGadgets.Remove($data)
    }
    try{$data.Window.Close()}catch{}
    if($null-ne$data.PSObject.Properties['BeamWindow']-and$null-ne$data.BeamWindow){try{$data.BeamWindow.Close()}catch{}}
    if($data.Kind-eq'Rope'-and$null-ne$script:ropeOverlayCanvas){
        # Always release physics ownership from both endpoints. This also repairs
        # an older/stale rope state where FrozenOther was no longer the endpoint
        # carrying the marker, which otherwise left that object floating forever.
        foreach($endpoint in @($data.EndA,$data.EndB,$data.FrozenOther)){
            if($null-ne$endpoint-and$null-ne$endpoint.PSObject.Properties['FrozenRope']-and$endpoint.FrozenRope-eq$data){$endpoint.FrozenRope=$null}
        }
        foreach($ropePath in @($data.VisualPaths)){$script:ropeOverlayCanvas.Children.Remove($ropePath)|Out-Null}
    }
    if($data.Kind-eq'Wire'-and$null-ne$script:ropeOverlayCanvas){foreach($wirePath in @($data.VisualPaths)){$script:ropeOverlayCanvas.Children.Remove($wirePath)|Out-Null}}
    if($null-ne$data.PSObject.Properties['WindLines']-and$null-ne$script:ropeOverlayCanvas){foreach($wind in @($data.WindLines)){$script:ropeOverlayCanvas.Children.Remove($wind.Line)|Out-Null}}
}

function Get-EraserPlacements {
    return @($script:playroomBlocks)+@($script:playroomBalls)+@($script:playroomGadgets)+@($script:playroomWires)
}

function Update-EraserButtonVisual {
    if($null-eq$script:eraserButton){return}
    if($script:eraserMode){
        $script:eraserButton.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(150,43,66))
        $script:eraserButton.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,132,151))
        $script:eraserButton.ToolTip='Eraser active — click items to delete, Esc to exit'
    }else{
        $script:eraserButton.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(27,57,82))
        $script:eraserButton.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(92,79,123))
        $script:eraserButton.ToolTip='Eraser Mode'
    }
}

function Set-EraserMode([bool]$enabled) {
    if($enabled){Set-RopeToolMode $false;Set-WiringMode $false}
    $script:eraserMode=$enabled-and$script:playroomActive
    if($script:eraserMode){
        Close-FreeRotationHandle
        $script:ropeConnectSource=$null;$script:ropeConnectFirst=$null
        if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ERASER ACTIVE  |  CLICK ITEMS TO DELETE  |  ESC TO EXIT'}
    }
    foreach($data in @(Get-EraserPlacements)){
        if($null-eq$data-or$null-eq$data.Window){continue}
        $data.Window.Cursor=$(if($script:eraserMode){[Windows.Input.Cursors]::Cross}else{$null})
        if($null-ne$data.PSObject.Properties['Element']-and$null-ne$data.Element){$data.Element.Opacity=1}
    }
    Update-EraserButtonVisual
}

function Toggle-EraserMode { Set-EraserMode (-not$script:eraserMode) }

function Update-GridButtonVisual {
    if($null-eq$script:gridButton){return}
    $script:gridButton.Background=New-Object Windows.Media.SolidColorBrush $(if($script:gridSnapEnabled){[Windows.Media.Color]::FromRgb(43,139,176)}else{[Windows.Media.Color]::FromRgb(27,57,82)})
    $script:gridButton.BorderBrush=New-Object Windows.Media.SolidColorBrush $(if($script:gridSnapEnabled){[Windows.Media.Color]::FromRgb(107,225,244)}else{[Windows.Media.Color]::FromRgb(92,79,123)})
    $script:gridButton.ToolTip=$(if($script:gridSnapEnabled){'Grid snapping active'}else{'Toggle grid snapping'})
}

function New-GridOverlay {
    if($null-ne$script:gridOverlayWindow){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $width=[Windows.SystemParameters]::VirtualScreenWidth;$height=[Windows.SystemParameters]::VirtualScreenHeight
    $script:gridOverlayWindow=New-Object Windows.Window
    $script:gridOverlayWindow.Title='Windowisp Builder Grid'
    $script:gridOverlayWindow.Left=$left;$script:gridOverlayWindow.Top=$top
    $script:gridOverlayWindow.Width=$width;$script:gridOverlayWindow.Height=$height
    $script:gridOverlayWindow.WindowStyle=[Windows.WindowStyle]::None
    $script:gridOverlayWindow.AllowsTransparency=$true;$script:gridOverlayWindow.Background=[Windows.Media.Brushes]::Transparent
    $script:gridOverlayWindow.ShowInTaskbar=$false;$script:gridOverlayWindow.ShowActivated=$false
    $script:gridOverlayWindow.ResizeMode=[Windows.ResizeMode]::NoResize;$script:gridOverlayWindow.Topmost=$true
    $canvas=New-Object Windows.Controls.Canvas
    $brush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(62,91,205,230))
    for($x=0.0;$x-le$width;$x+=$script:gridSize){$line=New-Object Windows.Shapes.Line;$line.X1=$x;$line.X2=$x;$line.Y1=0;$line.Y2=$height;$line.Stroke=$brush;$line.StrokeThickness=1;$canvas.Children.Add($line)|Out-Null}
    for($y=0.0;$y-le$height;$y+=$script:gridSize){$line=New-Object Windows.Shapes.Line;$line.X1=0;$line.X2=$width;$line.Y1=$y;$line.Y2=$y;$line.Stroke=$brush;$line.StrokeThickness=1;$canvas.Children.Add($line)|Out-Null}
    $script:gridOverlayWindow.Content=$canvas
}

function Set-GridSnap([bool]$enabled) {
    $script:gridSnapEnabled=$enabled-and$script:playroomActive
    if($script:gridSnapEnabled){
        New-GridOverlay
        if($null-ne$script:gridOverlayWindow-and-not$script:gridOverlayWindow.IsVisible){$script:gridOverlayWindow.Show();Set-OverlayClickThroughState $script:gridOverlayWindow $true}
    }elseif($null-ne$script:gridOverlayWindow){$script:gridOverlayWindow.Hide()}
    Update-GridButtonVisual
}

function Toggle-GridSnap { Set-GridSnap (-not$script:gridSnapEnabled) }

function Snap-PlacementToGrid($data,[bool]$snapSize=$false) {
    if(-not$script:gridSnapEnabled-or$null-eq$data){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $data.X=$left+([Math]::Round(($data.X-$left)/$script:gridSize)*$script:gridSize)
    $data.Y=$top+([Math]::Round(($data.Y-$top)/$script:gridSize)*$script:gridSize)
    if($snapSize-and$null-ne$data.PSObject.Properties['Width']){
        $minimumHeight=$(if($data.Type-eq'Wooden'){8.0}else{20.0})
        $data.Width=[Math]::Max(60.0,[Math]::Round($data.Width/$script:gridSize)*$script:gridSize)
        $data.Height=[Math]::Max($minimumHeight,[Math]::Round($data.Height/$script:gridSize)*$script:gridSize)
    }
}

function Update-ConnectionToolVisuals {
    if($null-ne$script:ropeToolButton){$script:ropeToolButton.Background=New-Object Windows.Media.SolidColorBrush $(if($script:ropeToolMode){[Windows.Media.Color]::FromRgb(151,103,46)}else{[Windows.Media.Color]::FromRgb(27,57,82)})}
    if($null-ne$script:wiringButton){$script:wiringButton.Background=New-Object Windows.Media.SolidColorBrush $(if($script:wiringMode){[Windows.Media.Color]::FromRgb(43,139,176)}else{[Windows.Media.Color]::FromRgb(27,57,82)})}
}

function Update-PlacementToolCursors {
    foreach($data in @(Get-EraserPlacements)){
        if($null-ne$data-and$null-ne$data.Window){$data.Window.Cursor=$(if($script:eraserMode-or$script:ropeToolMode-or$script:wiringMode){[Windows.Input.Cursors]::Cross}else{$null})}
    }
}

function Set-RopeToolMode([bool]$enabled) {
    $script:ropeToolMode=$enabled-and$script:playroomActive
    if($script:ropeToolMode){$script:wiringMode=$false;$script:eraserMode=$false;$script:ropeConnectSource=$null;$script:ropeConnectFirst=$null;if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE TOOL: CLICK FIRST ITEM'}}
    elseif($null-ne$script:sandboxTrayTitle-and$script:sandboxTrayTitle.Text-like'ROPE TOOL*'){$script:sandboxTrayTitle.Text='GADGET LAB'}
    Update-ConnectionToolVisuals;Update-EraserButtonVisual;Update-PlacementToolCursors
}

function Set-WiringMode([bool]$enabled) {
    $script:wiringMode=$enabled-and$script:playroomActive
    if($script:wiringMode){$script:ropeToolMode=$false;$script:eraserMode=$false;$script:wireConnectFirst=$null;if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='WIRING: CLICK INPUT OR HAZARD'}}
    elseif($null-ne$script:sandboxTrayTitle-and$script:sandboxTrayTitle.Text-like'WIRING*'){$script:sandboxTrayTitle.Text='GADGET LAB'}
    Update-ConnectionToolVisuals;Update-EraserButtonVisual;Update-PlacementToolCursors
}

function Invoke-ExitControl {
    if($script:wiringMode){Set-WiringMode $false;$script:eraserExitGuardTicks=20;return}
    if($script:ropeToolMode){Set-RopeToolMode $false;$script:eraserExitGuardTicks=20;return}
    if($script:eraserMode){Set-EraserMode $false;$script:eraserExitGuardTicks=20;return}
    if($script:eraserExitGuardTicks-gt0){return}
    if($script:wispfallActive-or$script:footballActive){Return-ToSandbox;return}
    Set-GameMode $false
}

function Copy-PlayroomPlacement($data) {
    if($null-eq$data-or-not$script:playroomActive){return}
    if($data.Kind-eq'Rope'){New-PlayroomRope $data.EndA $data.EndB $data.Length}
    elseif($data.Kind-eq'Block'){Copy-PlayroomBlock $data}
    elseif($data.Kind-eq'Ball'){Add-PlayroomBall}
    elseif($data.Kind-in@('Bat','Bone')){Add-PlayroomToy $data.Kind}
    elseif($data.Kind-in@('Spikes','FireJet','Laser')){Add-PlayroomHazard $data.Kind}
    elseif($data.Kind-eq'RopeCoil'){Add-PlayroomGadget 'RopeCoil'}
    elseif($data.Kind-like'Teleporter*'){Add-PlayroomGadget 'Teleporter'}
    else{Add-PlayroomGadget $data.Kind}
}

function New-PlacementContextMenu($data,[bool]$rotatable=$true) {
    $menu=New-Object Windows.Controls.ContextMenu
    $navy=Set-WindowispContextMenuStyle $menu
    if($data.Kind-ne'Rope'){
        $copy=New-Object Windows.Controls.MenuItem;$copy.Header='Duplicate';$copy.Tag=$data;$copy.Icon=New-BlockMenuIcon 'Copy'
        $copy.Add_Click({param($sender,$e)Copy-PlayroomPlacement $sender.Tag});$menu.Items.Add($copy)|Out-Null
    }
    if($data.Kind-eq'RopeCoil'){
        $attach=New-Object Windows.Controls.MenuItem;$attach.Header='Connect Rope';$attach.Tag=$data;$attach.Icon=New-BlockMenuIcon 'Rope'
        $attach.Add_Click({param($sender,$e)Arm-RopePlacement $sender.Tag});$menu.Items.Add($attach)|Out-Null
    }elseif($data.Kind-eq'Rope'){
        $unattach=New-Object Windows.Controls.MenuItem;$unattach.Header='Detach Rope';$unattach.Tag=$data;$unattach.Icon=New-BlockMenuIcon 'Rope'
        $unattach.Add_Click({param($sender,$e)Unattach-PlayroomRope $sender.Tag});$menu.Items.Add($unattach)|Out-Null
    }
    if($data.Kind-eq'Ball'){
        $currentBounce=[Math]::Max(1,[Math]::Min(100,[Math]::Round($data.Physics)))
        $bounceMenu=New-Object Windows.Controls.MenuItem;$bounceMenu.Header="Bounciness: $currentBounce%";Set-WindowispSubmenuStyle $bounceMenu $navy
        foreach($bounceOption in @(@('Low (25%)',25.0),@('Normal (50%)',50.0),@('High (75%)',75.0),@('Super (100%)',100.0))){
            $bounceItem=New-Object Windows.Controls.MenuItem;$bounceItem.Header=$bounceOption[0];$bounceItem.IsCheckable=$true
            Set-WindowispSubmenuStyle $bounceItem $navy
            $bounceItem.IsChecked=([Math]::Abs([double]$data.Physics-[double]$bounceOption[1])-lt.1)
            $bounceItem.Tag=[pscustomobject]@{Ball=$data;Value=[double]$bounceOption[1];Menu=$bounceMenu}
            $bounceItem.Add_Click({
                param($sender,$e)
                $sender.Tag.Ball.Physics=$sender.Tag.Value
                $sender.Tag.Menu.Header="Bounciness: $([Math]::Round($sender.Tag.Value))%"
                foreach($item in @($sender.Tag.Menu.Items)){if($item.IsCheckable){$item.IsChecked=($item-eq$sender)}}
            })
            $bounceMenu.Items.Add($bounceItem)|Out-Null
        }
        $menu.Items.Add($bounceMenu)|Out-Null
    }
    if($rotatable){
        $rotate=New-Object Windows.Controls.MenuItem;$rotate.Header='Rotate Freely';$rotate.Icon=New-BlockMenuIcon 'Rotate';$rotate.Tag=$data
        $rotate.Add_Click({param($sender,$e)Show-FreeRotationHandle $sender.Tag})
        $menu.Items.Add($rotate)|Out-Null
        $resetRotate=New-Object Windows.Controls.MenuItem;$resetRotate.Header='Reset Angle';$resetRotate.Icon=New-BlockMenuIcon 'Rotate';$resetRotate.Tag=$data
        $resetRotate.Add_Click({param($sender,$e)Set-PlacementAngle $sender.Tag 0})
        $menu.Items.Add($resetRotate)|Out-Null
    }
    if($data.Kind-in@('Spikes','FireJet','Laser','Fan','Rotator','TeleporterA','TeleporterB')){
        $powerMenu=New-Object Windows.Controls.MenuItem;$powerMenu.Header='Power';Set-WindowispSubmenuStyle $powerMenu $navy
        $powerOptions=$(if(Test-WireTarget $data){@(@('Always On',$true),@('Always Off',$false),@('Follow Wiring',$null))}else{@(@('On',$true),@('Off',$false))})
        foreach($powerOption in $powerOptions){
            $powerItem=New-Object Windows.Controls.MenuItem;$powerItem.Header=$powerOption[0]
            Set-WindowispSubmenuStyle $powerItem $navy
            $powerItem.IsCheckable=$true
            $powerItem.IsChecked=$(if($null-eq$powerOption[1]){$null-eq$data.ManualPower}else{if($null-eq$data.ManualPower){(-not(Test-WireTarget $data))-and[bool]$powerOption[1]}else{[bool]$data.ManualPower-eq[bool]$powerOption[1]}})
            $powerItem.Tag=[pscustomobject]@{Placement=$data;ManualPower=$powerOption[1];Menu=$powerMenu}
            $powerItem.Add_Click({param($sender,$e)$sender.Tag.Placement.ManualPower=$sender.Tag.ManualPower;foreach($item in @($sender.Tag.Menu.Items)){if($item.IsCheckable){$item.IsChecked=($item-eq$sender)}}})
            $powerMenu.Items.Add($powerItem)|Out-Null
        }
        $menu.Items.Add($powerMenu)|Out-Null
    }
    if($data.Kind-eq'Rotator'){
        $reverse=New-Object Windows.Controls.MenuItem;$reverse.Header=$(if($data.Direction-lt0){'Direction: Counter-clockwise'}else{'Direction: Clockwise'});$reverse.Tag=$data;$reverse.Icon=New-BlockMenuIcon 'Rotate'
        $reverse.Add_Click({param($sender,$e)$sender.Tag.Direction*=-1;$sender.Header=$(if($sender.Tag.Direction-lt0){'Direction: Counter-clockwise'}else{'Direction: Clockwise'})})
        $menu.Items.Add($reverse)|Out-Null
        $currentSpeedName=$(if([double]$data.RotationSpeed-lt.75){'Slow'}elseif([double]$data.RotationSpeed-gt1.5){'Fast'}else{'Normal'})
        $speedMenu=New-Object Windows.Controls.MenuItem;$speedMenu.Header="Rotation Speed: $currentSpeedName";$speedMenu.Icon=New-BlockMenuIcon 'Rotate';Set-WindowispSubmenuStyle $speedMenu $navy
        foreach($speedOption in @(@('Slow (50%)',0.5,'Slow'),@('Normal (100%)',1.0,'Normal'),@('Fast (200%)',2.0,'Fast'))){
            $speedItem=New-Object Windows.Controls.MenuItem;$speedItem.Header=$speedOption[0];$speedItem.IsCheckable=$true
            Set-WindowispSubmenuStyle $speedItem $navy
            $speedItem.IsChecked=([double]$data.RotationSpeed-eq[double]$speedOption[1])
            $speedItem.Tag=[pscustomobject]@{Rotator=$data;Multiplier=[double]$speedOption[1];Name=[string]$speedOption[2];Menu=$speedMenu}
            $speedItem.Add_Click({
                param($sender,$e)
                $sender.Tag.Rotator.RotationSpeed=$sender.Tag.Multiplier
                $sender.Tag.Menu.Header="Rotation Speed: $($sender.Tag.Name)"
                foreach($item in @($sender.Tag.Menu.Items)){if($item.IsCheckable){$item.IsChecked=($item-eq$sender)}}
            })
            $speedMenu.Items.Add($speedItem)|Out-Null
        }
        $menu.Items.Add($speedMenu)|Out-Null
        $release=New-Object Windows.Controls.MenuItem;$release.Header='Detach Object';$release.Tag=$data;$release.Icon=New-BlockMenuIcon 'Rotate'
        $release.Add_Click({param($sender,$e);if($null-ne$sender.Tag.Target-and$null-ne$sender.Tag.Target.PSObject.Properties['ContinuousRotation']){$sender.Tag.Target.ContinuousRotation=$false;Set-PlacementAngle $sender.Tag.Target $sender.Tag.Target.Angle};$sender.Tag.Target=$null})
        $menu.Items.Add($release)|Out-Null
    }
    $delete=New-Object Windows.Controls.MenuItem;$delete.Header="Delete $($data.Kind -creplace '([a-z])([A-Z])','$1 $2')";$delete.Tag=$data
    $delete.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,116,126));$delete.Icon=New-BlockMenuIcon 'Delete' $delete.Foreground
    $delete.Add_Click({param($sender,$e)Remove-PlayroomPlacement $sender.Tag});$menu.Items.Add($delete)|Out-Null
    return $menu
}

function Initialize-RopeOverlay {
    if($null-ne$script:ropeOverlayWindow){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $width=[Windows.SystemParameters]::VirtualScreenWidth;$height=[Windows.SystemParameters]::VirtualScreenHeight
    $script:ropeOverlayWindow=New-Object Windows.Window
    $script:ropeOverlayWindow.Title='Windowisp Ropes'
    $script:ropeOverlayWindow.Left=$left;$script:ropeOverlayWindow.Top=$top
    $script:ropeOverlayWindow.Width=$width;$script:ropeOverlayWindow.Height=$height
    $script:ropeOverlayWindow.WindowStyle=[Windows.WindowStyle]::None
    $script:ropeOverlayWindow.AllowsTransparency=$true
    $script:ropeOverlayWindow.Background=[Windows.Media.Brushes]::Transparent
    $script:ropeOverlayWindow.ShowInTaskbar=$false;$script:ropeOverlayWindow.ShowActivated=$false
    $script:ropeOverlayWindow.Topmost=$true;$script:ropeOverlayWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $script:ropeOverlayCanvas=New-Object Windows.Controls.Canvas
    $script:ropeOverlayCanvas.Width=$width;$script:ropeOverlayCanvas.Height=$height
    $script:ropeOverlayWindow.Content=$script:ropeOverlayCanvas
    $script:ropeOverlayWindow.Show()
    Set-OverlayClickThroughState $script:ropeOverlayWindow $true
}

function Set-SharedOverlayElementPosition($element,[double]$x,[double]$y) {
    if($null-eq$element){return}
    [Windows.Controls.Canvas]::SetLeft($element,$x-[Windows.SystemParameters]::VirtualScreenLeft)
    [Windows.Controls.Canvas]::SetTop($element,$y-[Windows.SystemParameters]::VirtualScreenTop)
}

function Add-SharedGameplayElement($element,[double]$x,[double]$y) {
    Initialize-RopeOverlay
    Set-SharedOverlayElementPosition $element $x $y
    $script:ropeOverlayCanvas.Children.Add($element)|Out-Null
}

function Remove-SharedGameplayElement($element) {
    if($null-ne$element-and$null-ne$script:ropeOverlayCanvas){$script:ropeOverlayCanvas.Children.Remove($element)|Out-Null}
}

function Get-RopeAttachmentPoint($data) {
    if($null-eq$data){return $null}
    $width=$(if($null-ne$data.PSObject.Properties['BodyWidth']){[double]$data.BodyWidth}elseif($null-ne$data.PSObject.Properties['Width']){[double]$data.Width}elseif($null-ne$data.PSObject.Properties['Size']){[double]$data.Size}else{40.0})
    $height=$(if($null-ne$data.PSObject.Properties['BodyHeight']){[double]$data.BodyHeight}elseif($null-ne$data.PSObject.Properties['Height']){[double]$data.Height}elseif($null-ne$data.PSObject.Properties['Size']){[double]$data.Size}else{40.0})
    $offsetX=$(if($null-ne$data.PSObject.Properties['BodyOffsetX']){[double]$data.BodyOffsetX}else{0.0})
    $offsetY=$(if($null-ne$data.PSObject.Properties['BodyOffsetY']){[double]$data.BodyOffsetY}else{0.0})
    $localY=$(if($script:playroomBalls.Contains($data)){0.0}else{-(($height/2)+4)})
    $angle=$(if($null-ne$data.PSObject.Properties['Angle']){[double]$data.Angle}else{0.0})
    $r=$angle*[Math]::PI/180
    return [pscustomobject]@{
        X=[double]$data.X+$offsetX+($width/2)-($localY*[Math]::Sin($r))
        Y=[double]$data.Y+$offsetY+($height/2)+($localY*[Math]::Cos($r))
    }
}

function Test-RopeDynamic($data) {
    if($null-eq$data){return $false}
    if($null-ne$data.PSObject.Properties['Dragging']-and$data.Dragging){return $false}
    if($script:playroomBalls.Contains($data)){return -not$data.CarriedBy}
    return $null-ne$data.PSObject.Properties['IsDynamic']-and$data.IsDynamic
}

function Start-RopePlacement {
    Add-PlayroomGadget 'RopeCoil'
    $script:ropeConnectSource=$null
    $script:ropeConnectFirst=$null
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE PLACED: RIGHT-CLICK THE COIL'}
}

function Arm-RopePlacement($coil) {
    if($null-eq$coil-or$coil.Kind-ne'RopeCoil'){return}
    $script:ropeConnectSource=$coil
    $script:ropeConnectFirst=$null
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE: LEFT-CLICK FIRST ITEM'}
}

function Connect-RopeEndpoint($data) {
    if($null-eq$script:ropeConnectSource-or$null-eq$data-or$data-eq$script:ropeConnectSource-or$data.Kind-in@('Rope','RopeCoil')){return}
    if($null-eq$script:ropeConnectFirst){
        $script:ropeConnectFirst=$data
        if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE: LEFT-CLICK SECOND ITEM'}
        return
    }
    if($script:ropeConnectFirst-eq$data){
        if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE: CHOOSE A DIFFERENT ITEM'}
        return
    }
    New-PlayroomRope $script:ropeConnectFirst $data
    $usedCoil=$script:ropeConnectSource
    $script:ropeConnectSource=$null
    $script:ropeConnectFirst=$null
    Remove-PlayroomPlacement $usedCoil
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='GADGET LAB'}
}

function Connect-RopeToolEndpoint($data) {
    if($null-eq$data-or$data.Kind-in@('Rope','Wire')){return}
    if($null-eq$script:ropeConnectFirst){$script:ropeConnectFirst=$data;if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE TOOL: CLICK SECOND ITEM'};return}
    if($script:ropeConnectFirst-eq$data){return}
    New-PlayroomRope $script:ropeConnectFirst $data
    $script:ropeConnectFirst=$null
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE TOOL: CLICK FIRST ITEM'}
}

function Test-WireInput($data){return $null-ne$data-and$data.Kind-in@('Switch','Button','PressurePlate','Timer')}
function Test-WireTarget($data){return $null-ne$data-and$data.Kind-in@('Spikes','FireJet','Laser','Fan')}

function Connect-WireEndpoint($data) {
    if($null-eq$data-or(-not(Test-WireInput $data)-and-not(Test-WireTarget $data))){if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='WIRING: CHOOSE AN INPUT OR HAZARD'};return}
    if($null-eq$script:wireConnectFirst){$script:wireConnectFirst=$data;if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='WIRING: CLICK THE OTHER END'};return}
    if($script:wireConnectFirst-eq$data){return}
    $source=$(if(Test-WireInput $script:wireConnectFirst){$script:wireConnectFirst}elseif(Test-WireInput $data){$data}else{$null})
    $target=$(if(Test-WireTarget $script:wireConnectFirst){$script:wireConnectFirst}elseif(Test-WireTarget $data){$data}else{$null})
    if($null-eq$source-or$null-eq$target){if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='WIRING NEEDS ONE INPUT + ONE HAZARD'};return}
    New-PlayroomWire $source $target
    $script:wireConnectFirst=$null
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='WIRING: CONNECTED - CLICK NEXT INPUT OR HAZARD'}
}

function Get-WirePalette {
    return @(
        [Windows.Media.Color]::FromRgb(255,76,92),[Windows.Media.Color]::FromRgb(66,176,255),
        [Windows.Media.Color]::FromRgb(80,224,137),[Windows.Media.Color]::FromRgb(255,205,65),
        [Windows.Media.Color]::FromRgb(193,111,255),[Windows.Media.Color]::FromRgb(54,232,221)
    )
}

function Set-WireChannel($wire,[int]$channel) {
    if($null-eq$wire-or$wire.Kind-ne'Wire'){return}
    $palette=Get-WirePalette;$wire.Channel=(($channel%$palette.Count)+$palette.Count)%$palette.Count;$wire.Colour=$palette[$wire.Channel]
    $brush=New-Object Windows.Media.SolidColorBrush $wire.Colour
    foreach($path in @($wire.ColourPaths)){$path.Stroke=$brush}
    if($null-ne$wire.Element){$wire.Element.Background=$brush}
}

function New-PlayroomWire($source,$target) {
    if($null-eq$source-or$null-eq$target){return}
    Initialize-RopeOverlay
    # A newly connected target follows its input immediately. Players can still
    # override this later with Always On or Always Off from the context menu.
    if($null-ne$target.PSObject.Properties['ManualPower']){$target.ManualPower=$null}
    $palette=Get-WirePalette
    $channel=$script:wireChannelIndex%$palette.Count;$script:wireChannelIndex++
    $colour=$palette[$channel]
    $glow=New-Object Windows.Shapes.Polyline;$glow.Stroke=New-Object Windows.Media.SolidColorBrush $colour;$glow.StrokeThickness=8;$glow.Opacity=.2
    $outline=New-Object Windows.Shapes.Polyline;$outline.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(10,25,52));$outline.StrokeThickness=6;$outline.Opacity=.88
    $line=New-Object Windows.Shapes.Polyline;$line.Stroke=New-Object Windows.Media.SolidColorBrush $colour;$line.StrokeThickness=3.2
    $signal=New-Object Windows.Shapes.Polyline;$signal.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(238,252,255));$signal.StrokeThickness=1.5;$signal.Opacity=0
    $signal.StrokeDashArray=New-Object Windows.Media.DoubleCollection;$signal.StrokeDashArray.Add(1.2);$signal.StrokeDashArray.Add(6.2)
    foreach($path in @($glow,$outline,$line,$signal)){$path.StrokeLineJoin=[Windows.Media.PenLineJoin]::Round;$path.StrokeStartLineCap=[Windows.Media.PenLineCap]::Round;$path.StrokeEndLineCap=[Windows.Media.PenLineCap]::Round;$script:ropeOverlayCanvas.Children.Add($path)|Out-Null}
    $handle=New-Object Windows.Window;$handle.Title='Windowisp Wire';$handle.Width=22;$handle.Height=22;$handle.WindowStyle='None';$handle.AllowsTransparency=$true;$handle.Background=[Windows.Media.Brushes]::Transparent;$handle.ShowInTaskbar=$false;$handle.ShowActivated=$false;$handle.Topmost=$true;$handle.ResizeMode='NoResize'
    $dot=New-Object Windows.Controls.Border;$dot.Width=14;$dot.Height=14;$dot.CornerRadius=[Windows.CornerRadius]::new(7);$dot.Background=New-Object Windows.Media.SolidColorBrush $colour;$dot.BorderBrush=[Windows.Media.Brushes]::White;$dot.BorderThickness=[Windows.Thickness]::new(1)
    $wire=[pscustomobject]@{Kind='Wire';Window=$handle;Element=$dot;Source=$source;Target=$target;Channel=$channel;Colour=$colour;VisualPaths=@($glow,$outline,$line,$signal);ColourPaths=@($glow,$line);SignalPath=$signal;Powered=$false;X=0.0;Y=0.0;Width=22.0;Height=22.0}
    $dot.Tag=$wire;$handle.Tag=$wire
    $menu=New-Object Windows.Controls.ContextMenu
    $null=Set-WindowispContextMenuStyle $menu
    $colourMenu=New-Object Windows.Controls.MenuItem;$colourMenu.Header='Wire Colour';$colourMenu.Icon=New-BlockMenuIcon 'Colour';Set-WindowispSubmenuStyle $colourMenu $menu.Background
    $colourNames=@('Red','Blue','Green','Gold','Purple','Cyan')
    for($colourIndex=0;$colourIndex-lt$palette.Count;$colourIndex++){
        $colourItem=New-Object Windows.Controls.MenuItem;$colourItem.Header=$colourNames[$colourIndex]
        Set-WindowispSubmenuStyle $colourItem $menu.Background
        $colourItem.IsCheckable=$true;$colourItem.IsChecked=($wire.Channel-eq$colourIndex)
        $colourItem.Icon=New-BlockMenuIcon 'Swatch' (New-Object Windows.Media.SolidColorBrush $palette[$colourIndex])
        $colourItem.Tag=[pscustomobject]@{Wire=$wire;Channel=$colourIndex;Menu=$colourMenu}
        $colourItem.Add_Click({param($s,$e)Set-WireChannel $s.Tag.Wire $s.Tag.Channel;foreach($item in @($s.Tag.Menu.Items)){if($item.IsCheckable){$item.IsChecked=($item-eq$s)}}})
        $colourMenu.Items.Add($colourItem)|Out-Null
    }
    $menu.Items.Add($colourMenu)|Out-Null
    $delete=New-Object Windows.Controls.MenuItem;$delete.Header='Delete Wire';$delete.Tag=$wire;$delete.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,116,126));$delete.Icon=New-BlockMenuIcon 'Delete' $delete.Foreground;$delete.Add_Click({param($s,$e)Remove-PlayroomPlacement $s.Tag});$menu.Items.Add($delete)|Out-Null;$dot.ContextMenu=$menu
    Register-RopeSelectable $handle $wire
    $handle.Content=$dot;$handle.Show();$script:playroomWires.Add($wire)|Out-Null
    Update-OnePlayroomWire $wire
}

function Update-OnePlayroomWire($wire) {
    if($null-eq$wire.Source-or$null-eq$wire.Target-or-not$wire.Source.Window.IsVisible-or-not$wire.Target.Window.IsVisible){return}
    $a=Get-RopeAttachmentPoint $wire.Source;$b=Get-RopeAttachmentPoint $wire.Target
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $midX=($a.X+$b.X)/2;$midY=($a.Y+$b.Y)/2+18
    $points=New-Object Windows.Media.PointCollection
    $points.Add([Windows.Point]::new($a.X-$left,$a.Y-$top));$points.Add([Windows.Point]::new($midX-$left,$midY-$top));$points.Add([Windows.Point]::new($b.X-$left,$b.Y-$top))
    foreach($path in @($wire.VisualPaths)){$path.Points=$points}
    $wire.VisualPaths[0].Opacity=$(if($wire.Powered){.48}else{.12})
    $wire.VisualPaths[1].Opacity=$(if($wire.Powered){.92}else{.58})
    $wire.VisualPaths[2].Opacity=$(if($wire.Powered){1}else{.42})
    $wire.SignalPath.Opacity=$(if($wire.Powered){.92}else{0});$wire.SignalPath.StrokeDashOffset=-1*($script:inputTick*1.15)
    $wire.X=$midX-11;$wire.Y=$midY-11;$wire.Window.Left=$wire.X;$wire.Window.Top=$wire.Y
}

function Set-WireEditingVisible([bool]$visible) {
    foreach($wire in @($script:playroomWires)){
        foreach($path in @($wire.VisualPaths)){$path.Visibility=$(if($visible){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden})}
        if($visible){$wire.Window.Show()}else{$wire.Window.Hide()}
    }
}

function Set-RopeEditingVisible([bool]$visible) {
    foreach($rope in @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'})){
        foreach($path in @($rope.VisualPaths)){$path.Visibility=$(if($visible){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden})}
        if($visible){$rope.Window.Show()}else{$rope.Window.Hide()}
    }
}

function Update-LogicGadgetVisual($logic) {
    if($null-eq$logic-or$logic.Kind-notin@('Switch','Button','PressurePlate','Timer')){return}
    $changed=[bool]$logic.SignalOn-ne[bool]$logic.PreviousSignalOn
    if($changed){
        $logic.PreviousSignalOn=[bool]$logic.SignalOn;$logic.StateAnimTicks=10
        if($logic.Kind-eq'Switch'-and$null-ne$logic.LogicScale){$logic.LogicScale.ScaleX=$(if($logic.SignalOn){-1}else{1})}
    }
    if($null-ne$logic.LogicScale){
        if($logic.Kind-eq'Button'){
            $targetScale=$(if($logic.SignalOn){.84}else{1.0});$targetY=$(if($logic.SignalOn){4.5}else{0.0})
            $logic.LogicScale.ScaleY+=($targetScale-$logic.LogicScale.ScaleY)*.32;$logic.LogicTranslate.Y+=($targetY-$logic.LogicTranslate.Y)*.32
        }elseif($logic.Kind-eq'PressurePlate'){
            $targetScale=$(if($logic.SignalOn){.68}else{1.0});$targetY=$(if($logic.SignalOn){6.0}else{0.0})
            $logic.LogicScale.ScaleY+=($targetScale-$logic.LogicScale.ScaleY)*.38;$logic.LogicTranslate.Y+=($targetY-$logic.LogicTranslate.Y)*.38
        }elseif($logic.Kind-eq'Switch'){
            if($logic.StateAnimTicks-gt0){$progress=(10-$logic.StateAnimTicks)/10.0;$logic.LogicScale.ScaleY=1-(.055*[Math]::Sin([Math]::PI*$progress));$logic.StateAnimTicks--}
            else{$logic.LogicScale.ScaleY=1}
        }elseif($logic.Kind-eq'Timer'){
            if(($script:inputTick%30)-eq0-and$logic.StateAnimTicks-le0){$logic.StateAnimTicks=10}
            if($logic.StateAnimTicks-gt0){
                $progress=(10-$logic.StateAnimTicks)/10.0;$pulse=[Math]::Sin([Math]::PI*$progress)
                $logic.LogicScale.ScaleX=1+(.035*$pulse);$logic.LogicScale.ScaleY=1-(.075*$pulse);$logic.LogicTranslate.Y=2.2*$pulse;$logic.StateAnimTicks--
            }else{$logic.LogicScale.ScaleX=1;$logic.LogicScale.ScaleY=1;$logic.LogicTranslate.Y=0}
        }
    }
    if($null-ne$logic.Art){$logic.Art.Opacity=$(if($logic.SignalOn){1}else{.78})}
}

function Update-WiringSignals {
    foreach($input in @($script:playroomGadgets|Where-Object{$_.Kind-in@('Switch','Button','PressurePlate','Timer')})){
        if($input.Kind-eq'Button'){if($input.PulseTicks-gt0){$input.PulseTicks--};$input.SignalOn=$input.PulseTicks-gt0}
        elseif($input.Kind-eq'Timer'){$input.SignalOn=(($script:inputTick%240)-lt120)}
        elseif($input.Kind-eq'PressurePlate'){
            $on=$script:x+$PetWidth-gt$input.X-and$script:x-lt$input.X+$input.Width-and$script:y+$PetHeight-gt$input.Y-and$script:y-lt$input.Y+$input.Height
            if(-not$on-and$script:twoPlayerActive){$on=$script:p2X+$PetWidth-gt$input.X-and$script:p2X-lt$input.X+$input.Width-and$script:p2Y+$PetHeight-gt$input.Y-and$script:p2Y-lt$input.Y+$input.Height}
            if(-not$on){foreach($o in @($script:playroomBalls)){if($o.X+$o.Size-gt$input.X-and$o.X-lt$input.X+$input.Width-and$o.Y+$o.Size-gt$input.Y-and$o.Y-lt$input.Y+$input.Height){$on=$true;break}}}
            if(-not$on){
                foreach($placement in @($script:playroomGadgets|Where-Object{$_-ne$input-and$null-ne$_.PSObject.Properties['IsDynamic']-and$_.IsDynamic})){
                    $bodyX=$placement.X+$(if($null-ne$placement.PSObject.Properties['BodyOffsetX']){$placement.BodyOffsetX}else{0})
                    $bodyY=$placement.Y+$(if($null-ne$placement.PSObject.Properties['BodyOffsetY']){$placement.BodyOffsetY}else{0})
                    $bodyW=$(if($null-ne$placement.PSObject.Properties['BodyWidth']){$placement.BodyWidth}else{$placement.Width})
                    $bodyH=$(if($null-ne$placement.PSObject.Properties['BodyHeight']){$placement.BodyHeight}else{$placement.Height})
                    if($bodyX+$bodyW-gt$input.X-and$bodyX-lt$input.X+$input.Width-and$bodyY+$bodyH-gt$input.Y-and$bodyY-lt$input.Y+$input.Height){$on=$true;break}
                }
            }
            $input.SignalOn=$on
        }
        Update-LogicGadgetVisual $input
        $input.Label.Text="$($input.Kind.ToUpperInvariant()) $(if($input.SignalOn){'ON'}else{'OFF'})"
    }
    foreach($wire in @($script:playroomWires)){
        $wire.Powered=[bool]$wire.Source.SignalOn
        # Gameplay keeps the electrical simulation, but its hidden editor wire
        # no longer allocates a new PointCollection every frame.
        if($script:playroomActive){Update-OnePlayroomWire $wire}
    }
}

function Test-HazardWiredOn($hazard) {
    if($null-ne$hazard.PSObject.Properties['ManualPower']-and$null-ne$hazard.ManualPower){return [bool]$hazard.ManualPower}
    $connections=@($script:playroomWires|Where-Object{$_.Target-eq$hazard})
    if($connections.Count-eq0){return $hazard.Kind-notin@('FireJet','Laser','Fan')}
    return @($connections|Where-Object{$_.Powered}).Count-gt0
}

function Register-RopeSelectable($targetWindow,$data) {
    if($null-eq$targetWindow-or$null-eq$data){return}
    $targetWindow.Tag=$data
    $targetWindow.Cursor=$(if($script:eraserMode){[Windows.Input.Cursors]::Cross}else{$null})
    $targetWindow.Add_MouseEnter({
        param($sender,$eventArgs)
        if($script:eraserMode-and$null-ne$sender.Tag-and$null-ne$sender.Tag.PSObject.Properties['Element']){$sender.Tag.Element.Opacity=.48}
    })
    $targetWindow.Add_MouseLeave({
        param($sender,$eventArgs)
        if($null-ne$sender.Tag-and$null-ne$sender.Tag.PSObject.Properties['Element']){$sender.Tag.Element.Opacity=1}
    })
    $targetWindow.Add_PreviewMouseLeftButtonDown({
        param($sender,$eventArgs)
        if($script:eraserMode){
            $target=$sender.Tag
            if($null-ne$target){$target.Element.Opacity=1;Remove-PlayroomPlacement $target}
            $eventArgs.Handled=$true
            return
        }
        if($script:wiringMode){Connect-WireEndpoint $sender.Tag;$eventArgs.Handled=$true;return}
        if($script:ropeToolMode){Connect-RopeToolEndpoint $sender.Tag;$eventArgs.Handled=$true;return}
        if($null-ne$script:ropeConnectSource-and$sender.Tag-ne$script:ropeConnectSource){
            Connect-RopeEndpoint $sender.Tag
            $eventArgs.Handled=$true
        }
    })
}

function New-PlayroomRope($endA,$endB,[double]$requestedLength=0) {
    if($null-eq$endA-or$null-eq$endB-or$endA-eq$endB){return}
    Initialize-RopeOverlay
    $frozenAnchor=$(if($endA.Kind-eq'Block'-and$endA.Type-eq'Ice'){$endA}elseif($endB.Kind-eq'Block'-and$endB.Type-eq'Ice'){$endB}else{$null})
    $frozenOther=$(if($null-eq$frozenAnchor){$null}elseif($frozenAnchor-eq$endA){$endB}else{$endA})
    $frozen=$null-ne$frozenAnchor
    if($frozen-and$null-ne$frozenOther.PSObject.Properties['FrozenRope']-and$null-ne$frozenOther.FrozenRope){
        # One frozen constraint owns an object at a time. Two frozen ropes trying
        # to place the same device every frame causes snapping and can destabilise
        # the WPF window updates.
        Remove-PlayroomPlacement $frozenOther.FrozenRope
    }
    $frozenRadius=0.0;$frozenRelativeAngle=0.0;$frozenOtherAngleOffset=0.0
    if($frozen){
        $anchorCentreX=$frozenAnchor.X+($frozenAnchor.Width/2);$anchorCentreY=$frozenAnchor.Y+($frozenAnchor.Height/2)
        $otherPoint=Get-RopeAttachmentPoint $frozenOther
        $frozenDx=$otherPoint.X-$anchorCentreX;$frozenDy=$otherPoint.Y-$anchorCentreY
        $frozenRadius=[Math]::Sqrt(($frozenDx*$frozenDx)+($frozenDy*$frozenDy))
        $frozenRelativeAngle=([Math]::Atan2($frozenDy,$frozenDx)*180/[Math]::PI)-$frozenAnchor.Angle
        if($null-ne$frozenOther.PSObject.Properties['Angle']){$frozenOtherAngleOffset=$frozenOther.Angle-$frozenAnchor.Angle}
    }
    $pointA=Get-RopeAttachmentPoint $endA;$pointB=Get-RopeAttachmentPoint $endB
    $dx=$pointB.X-$pointA.X;$dy=$pointB.Y-$pointA.Y
    $distance=[Math]::Sqrt(($dx*$dx)+($dy*$dy))
    $ropeLength=$(if($requestedLength-gt0){$requestedLength}else{[Math]::Max(90,$distance*1.12)})
    $ropeShadow=New-Object Windows.Shapes.Polyline
    $ropeShadow.Stroke=New-Object Windows.Media.SolidColorBrush $(if($frozen){[Windows.Media.Color]::FromRgb(30,89,145)}else{[Windows.Media.Color]::FromRgb(66,38,26)})
    $ropeShadow.StrokeThickness=8;$ropeShadow.StrokeLineJoin=[Windows.Media.PenLineJoin]::Round
    # The wide dark stroke already supplies the rope's depth. A live blur on
    # every moving segment forces an expensive off-screen render each update.
    $ropeBody=New-Object Windows.Shapes.Polyline
    $ropeBody.Stroke=New-Object Windows.Media.SolidColorBrush $(if($frozen){[Windows.Media.Color]::FromRgb(111,211,244)}else{[Windows.Media.Color]::FromRgb(213,145,55)})
    $ropeBody.StrokeThickness=6;$ropeBody.StrokeLineJoin=[Windows.Media.PenLineJoin]::Round
    $ropeHighlight=New-Object Windows.Shapes.Polyline
    $ropeHighlight.Stroke=New-Object Windows.Media.SolidColorBrush $(if($frozen){[Windows.Media.Color]::FromRgb(233,253,255)}else{[Windows.Media.Color]::FromRgb(255,216,126)})
    $ropeHighlight.StrokeThickness=2.2;$ropeHighlight.StrokeLineJoin=[Windows.Media.PenLineJoin]::Round
    $ropeHighlight.StrokeDashArray=New-Object Windows.Media.DoubleCollection
    $ropeHighlight.StrokeDashArray.Add(2.2);$ropeHighlight.StrokeDashArray.Add(2.0)
    foreach($ropePath in @($ropeShadow,$ropeBody,$ropeHighlight)){$script:ropeOverlayCanvas.Children.Add($ropePath)|Out-Null}
    $handleWindow=New-Object Windows.Window
    $handleWindow.Title='Windowisp Rope Knot';$handleWindow.Width=26;$handleWindow.Height=26
    $handleWindow.WindowStyle=[Windows.WindowStyle]::None;$handleWindow.AllowsTransparency=$true
    $handleWindow.Background=[Windows.Media.Brushes]::Transparent;$handleWindow.ShowInTaskbar=$false
    $handleWindow.ShowActivated=$false;$handleWindow.Topmost=$true;$handleWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $knot=New-Object Windows.Controls.Border
    $knot.Width=18;$knot.Height=18;$knot.CornerRadius=[Windows.CornerRadius]::new(9)
    $knot.Background=New-Object Windows.Media.SolidColorBrush $(if($frozen){[Windows.Media.Color]::FromRgb(64,166,221)}else{[Windows.Media.Color]::FromRgb(190,126,52)})
    $knot.BorderBrush=New-Object Windows.Media.SolidColorBrush $(if($frozen){[Windows.Media.Color]::FromRgb(225,252,255)}else{[Windows.Media.Color]::FromRgb(248,210,121)})
    $knot.BorderThickness=[Windows.Thickness]::new(2);$knot.Cursor=[Windows.Input.Cursors]::Hand
    $ropePoints=New-Object Windows.Media.PointCollection
    $rope=[pscustomobject]@{Kind='Rope';Window=$handleWindow;Element=$knot;VisualPath=$ropeBody;VisualPaths=@($ropeShadow,$ropeBody,$ropeHighlight);CachedPoints=$ropePoints;EndA=$endA;EndB=$endB;Length=[double]$ropeLength;Frozen=$frozen;FrozenAnchor=$frozenAnchor;FrozenOther=$frozenOther;FrozenRadius=[double]$frozenRadius;FrozenRelativeAngle=[double]$frozenRelativeAngle;FrozenOtherAngleOffset=[double]$frozenOtherAngleOffset;FrozenLastAnchorAngle=$(if($frozen){[double]$frozenAnchor.Angle}else{0.0});VisualPhase=($script:playroomGadgets.Count%2);ShadowVisible=$true;FineHighlightVisible=$true;LastVisualAX=[double]::NaN;LastVisualAY=[double]::NaN;LastVisualBX=[double]::NaN;LastVisualBY=[double]::NaN;LastVisualLength=[double]::NaN;LastVisualTick=-100;LastHandleX=[double]::NaN;LastHandleY=[double]::NaN;X=0.0;Y=0.0;Width=26.0;Height=26.0;Angle=0.0;DebugSeen=$false;Dragging=$false;DragStartLength=0.0;DragStartFrozenRadius=0.0;DragStartX=0.0;DragStartY=0.0}
    foreach($ropePath in @($rope.VisualPaths)){$ropePath.Points=$ropePoints}
    $knot.Tag=$rope;$handleWindow.Tag=$rope
    $knot.ToolTip=$(if($frozen){'Frozen rope handle - drag up/down to change its reach'}else{'Rope handle - drag up/down to change its length'})
    if($frozen){$knot.Width=22;$knot.Height=22;$knot.CornerRadius=[Windows.CornerRadius]::new(11);$knot.Effect=New-Object Windows.Media.Effects.DropShadowEffect;$knot.Effect.Color=[Windows.Media.Color]::FromRgb(116,225,255);$knot.Effect.BlurRadius=12;$knot.Effect.ShadowDepth=0;$knot.Effect.Opacity=.9}
    $knot.ContextMenu=New-PlacementContextMenu $rope $false
    Register-RopeSelectable $handleWindow $rope
    $knot.Add_MouseLeftButtonDown({
        param($sender,$eventArgs)
        if(-not$script:playroomActive){return}
        $sender.Tag.DragStartLength=$sender.Tag.Length
        $sender.Tag.DragStartFrozenRadius=$sender.Tag.FrozenRadius
        $sender.Tag.DragStartX=$sender.Tag.Window.Left+($sender.Tag.Window.Width/2)
        $sender.Tag.DragStartY=$sender.Tag.Window.Top+($sender.Tag.Window.Height/2)
        $sender.Tag.Dragging=$true
        try{$sender.Tag.Window.DragMove()}finally{
            Set-RopeLengthFromHandle $sender.Tag
            $sender.Tag.Dragging=$false
            Update-OnePlayroomRope $sender.Tag $true
        }
        $eventArgs.Handled=$true
    })
    $handleWindow.Add_LocationChanged({
        param($sender,$eventArgs)
        if($null-ne$sender.Tag-and$sender.Tag.Dragging){Set-RopeLengthFromHandle $sender.Tag;Update-OnePlayroomRope $sender.Tag $true}
    })
    $handleWindow.Content=$knot;$handleWindow.Show()
    $script:playroomGadgets.Add($rope)|Out-Null
    if($frozen){
        if($null-eq$frozenOther.PSObject.Properties['FrozenRope']){$frozenOther|Add-Member -NotePropertyName FrozenRope -NotePropertyValue $rope}
        else{$frozenOther.FrozenRope=$rope}
        if($null-ne$frozenOther.PSObject.Properties['CarriedBy']){$frozenOther.CarriedBy=''}
    }
    Update-OnePlayroomRope $rope $true
}

function Set-RopeLengthFromHandle($rope) {
    if($null-eq$rope-or$rope.Kind-ne'Rope'){return}
    $a=Get-RopeAttachmentPoint $rope.EndA;$b=Get-RopeAttachmentPoint $rope.EndB
    if($null-eq$a-or$null-eq$b){return}
    $handleX=$rope.Window.Left+($rope.Window.Width/2);$handleY=$rope.Window.Top+($rope.Window.Height/2)
    $maxLength=[Math]::Sqrt(([Windows.SystemParameters]::VirtualScreenWidth*[Windows.SystemParameters]::VirtualScreenWidth)+([Windows.SystemParameters]::VirtualScreenHeight*[Windows.SystemParameters]::VirtualScreenHeight))*2
    if($rope.Frozen-and$rope.DragStartFrozenRadius-gt0){
        $verticalChange=$handleY-$rope.DragStartY
        $sideChange=[Math]::Abs($handleX-$rope.DragStartX)
        $rope.FrozenRadius=[Math]::Min($maxLength,[Math]::Max(28,$rope.DragStartFrozenRadius+($verticalChange*2)+($sideChange*.25)))
        return
    }
    if($rope.DragStartLength-gt0){
        $verticalChange=$handleY-$rope.DragStartY
        $sideChange=[Math]::Abs($handleX-$rope.DragStartX)
        $rope.Length=[Math]::Min($maxLength,[Math]::Max(40,$rope.DragStartLength+($verticalChange*2)+($sideChange*.25)))
    }else{
        $aDx=$handleX-$a.X;$aDy=$handleY-$a.Y;$bDx=$b.X-$handleX;$bDy=$b.Y-$handleY
        $throughHandle=[Math]::Sqrt(($aDx*$aDx)+($aDy*$aDy))+[Math]::Sqrt(($bDx*$bDx)+($bDy*$bDy))
        $rope.Length=[Math]::Min($maxLength,[Math]::Max(40,$throughHandle))
    }
}

function Unattach-PlayroomRope($rope) {
    if($null-eq$rope-or$rope.Kind-ne'Rope'){return}
    $coilCenterX=$rope.X+($rope.Width/2);$coilCenterY=$rope.Y+($rope.Height/2)
    Add-PlayroomGadget 'RopeCoil'
    $coil=@($script:playroomGadgets|Where-Object{$_.Kind-eq'RopeCoil'}|Select-Object -Last 1)[0]
    if($null-ne$coil){
        $coil.X=$coilCenterX-($coil.Width/2);$coil.Y=$coilCenterY-($coil.Height/2)
        $coil.Window.Left=$coil.X;$coil.Window.Top=$coil.Y
    }
    Remove-PlayroomPlacement $rope
    if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='ROPE UNATTACHED'}
}

function Remove-RopesForPlacement($data) {
    foreach($rope in @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'-and($_.EndA-eq$data-or$_.EndB-eq$data)})){
        Remove-PlayroomPlacement $rope
    }
    if($script:ropeConnectFirst-eq$data){$script:ropeConnectFirst=$null}
    if($script:ropeConnectSource-eq$data){
        $script:ropeConnectSource=$null;$script:ropeConnectFirst=$null
        if($null-ne$script:sandboxTrayTitle){$script:sandboxTrayTitle.Text='GADGET LAB'}
    }
}

function Move-RopeDynamicObject($data,[double]$moveX,[double]$moveY,[double]$normalX,[double]$normalY) {
    $data.X+=$moveX;$data.Y+=$moveY
    $outward=($data.VX*$normalX)+($data.VY*$normalY)
    if($outward-gt0){$data.VX-=$outward*$normalX;$data.VY-=$outward*$normalY}
    # Balls and dynamic devices have already drawn once in their own physics
    # pass this tick. Updating their top-level WPF window again here was the
    # dominant multi-rope cost. Keep physics coordinates exact immediately and
    # let the normal object pass present the correction on the following tick.
}

function Set-PlacementWindowPosition($data) {
    if($null-eq$data-or$null-eq$data.Window){return}
    $logicalWidth=$(if($null-ne$data.PSObject.Properties['Width']){[double]$data.Width}else{[double]$data.Window.Width})
    $logicalHeight=$(if($null-ne$data.PSObject.Properties['Height']){[double]$data.Height}else{[double]$data.Window.Height})
    # Capture both coordinates before moving either window axis. WPF raises
    # LocationChanged after Left is assigned; gadget handlers can synchronise
    # X/Y immediately and would otherwise overwrite the pending Y destination.
    $logicalX=[double]$data.X;$logicalY=[double]$data.Y
    $targetLeft=$logicalX-(($data.Window.Width-$logicalWidth)/2)
    $targetTop=$logicalY-(($data.Window.Height-$logicalHeight)/2)
    $data.Window.Left=$targetLeft;$data.Window.Top=$targetTop
    $data.X=$logicalX;$data.Y=$logicalY
}

function Update-DynamicHazards {
    if(-not$script:playroomActive-and-not$script:active){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $right=$left+[Windows.SystemParameters]::VirtualScreenWidth;$floor=$top+[Windows.SystemParameters]::VirtualScreenHeight
    foreach($hazard in @($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['IsDynamic']-and$_.IsDynamic})){
        if($null-ne$hazard.PSObject.Properties['FrozenRope']-and$null-ne$hazard.FrozenRope){continue}
        # A rotator acts as a temporary physical anchor. Without this guard the
        # gravity solver and rotator would compete for ownership every frame.
        $rotatorOwner=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rotator'-and$_.Target-eq$hazard}|Select-Object -First 1)
        if($rotatorOwner.Count-gt0){$hazard.VX=0;$hazard.VY=0;continue}
        if($hazard.Dragging){$hazard.VX=0;$hazard.VY=0;continue}
        if($hazard.SpringCooldown-gt0){$hazard.SpringCooldown--}
        $bodyW=[double]$hazard.BodyWidth;$bodyH=[double]$hazard.BodyHeight
        $offX=[double]$hazard.BodyOffsetX;$offY=[double]$hazard.BodyOffsetY
        $oldBodyX=$hazard.X+$offX;$oldBodyY=$hazard.Y+$offY
        # Gravity is unconditional. A valid surface contact may resolve it below,
        # but no remembered conveyor/rope state can suspend a free hazard.
        $hazard.VY=[Math]::Min(18,$hazard.VY+.82)
        $hazard.VX*=.985
        $hazard.X+=$hazard.VX;$hazard.Y+=$hazard.VY
        $bodyX=$hazard.X+$offX;$bodyY=$hazard.Y+$offY
        if($bodyX-lt$left){$hazard.X=$left-$offX;$hazard.VX=[Math]::Abs($hazard.VX)*.35}
        if($bodyX+$bodyW-gt$right){$hazard.X=$right-$bodyW-$offX;$hazard.VX=-[Math]::Abs($hazard.VX)*.35}
        if($bodyY-lt$top){$hazard.Y=$top-$offY;$hazard.VY=[Math]::Abs($hazard.VY)*.3}
        if($bodyY+$bodyH-gt$floor){
            $impact=[Math]::Abs($hazard.VY);$hazard.Y=$floor-$bodyH-$offY
            $hazard.VY=$(if($impact-lt2.2){0.0}else{-$impact*.22});$hazard.VX*=.88
        }
        foreach($block in @($script:playroomBlocks)){
            if($block.Type-eq'Ladder'-or$block.TemporaryState-eq'Gone'){continue}
            $bodyX=$hazard.X+$offX;$bodyY=$hazard.Y+$offY
            if([Math]::Abs($block.Angle)-gt.01){
                # Sweep along the whole frame path. This is the same anti-tunnel
                # contract used by balls, and is especially important for thin
                # rotating platforms and the compact Fire Jet body.
                $targetX=$hazard.X;$targetY=$hazard.Y
                $travel=[Math]::Max([Math]::Abs(($targetX+$offX)-$oldBodyX),[Math]::Abs(($targetY+$offY)-$oldBodyY))
                $sweepSteps=[Math]::Max(1,[Math]::Min(10,[Math]::Ceiling($travel/4.0)))
                $rotatedHit=$false
                for($sweepStep=1;$sweepStep-le$sweepSteps;$sweepStep++){
                    $sweepT=$sweepStep/[double]$sweepSteps
                    $hazard.X=($oldBodyX-$offX)+(($targetX-($oldBodyX-$offX))*$sweepT)
                    $hazard.Y=($oldBodyY-$offY)+(($targetY-($oldBodyY-$offY))*$sweepT)
                    if(Resolve-DynamicPlacementRotatedBlock $hazard $block .2){$rotatedHit=$true;break}
                }
                if(-not$rotatedHit){$hazard.X=$targetX;$hazard.Y=$targetY}
                else{break}
                continue
            }
            if([Math]::Abs($block.Angle)-le.01-and$null-ne$block.Window-and$block.Window.IsVisible){
                # For a flat block, collide with its real on-screen window. Dragging
                # and resizing can briefly desynchronise stored logical dimensions;
                # using them created invisible conveyor extensions for hazards.
                $blockLeft=[double]$block.Window.Left;$blockTop=[double]$block.Window.Top
                $visibleWidth=$(if($block.Window.ActualWidth-gt0){$block.Window.ActualWidth}else{$block.Window.Width})
                $visibleHeight=$(if($block.Window.ActualHeight-gt0){$block.Window.ActualHeight}else{$block.Window.Height})
                $blockRight=$blockLeft+$visibleWidth;$blockBottom=$blockTop+$visibleHeight
            }else{
                $blockLeft=$block.X;$blockRight=$block.X+$block.Width;$blockTop=$block.Y;$blockBottom=$block.Y+$block.Height
            }
            $overlapX=$bodyX+$bodyW-gt$blockLeft-and$bodyX-lt$blockRight
            $overlapY=$bodyY+$bodyH-gt$blockTop-and$bodyY-lt$blockBottom
            # Use the physical centre as the balance point. The instant it passes
            # a platform edge, support ends and gravity takes over; long hazard art
            # can no longer hang almost entirely in mid-air.
            $bodyCentreX=$bodyX+($bodyW/2)
            $hasTopSupport=$bodyCentreX-ge$blockLeft-and$bodyCentreX-le$blockRight
            if(-not$overlapX-or-not$overlapY){continue}
            if($hasTopSupport-and$oldBodyY+$bodyH-le$blockTop+5-and$hazard.VY-ge0){
                $impact=[Math]::Abs($hazard.VY);$hazard.Y=$blockTop-$bodyH-$offY
                Trigger-TemporaryBlock $block ("Placement:{0}" -f [Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($hazard))
                $hazard.VY=$(if($block.Type-eq'Bouncy'){-[Math]::Max(9,$impact*.75)}elseif($impact-lt2){0}else{-$impact*.2})
                if($block.Type-eq'Ice'){$hazard.VX*=1.04}else{$hazard.VX*=.94}
                if($block.Type-eq'Conveyor'){
                    $angle=$block.Angle*[Math]::PI/180
                    $targetConveyorVX=[Math]::Cos($angle)*$block.Direction*5.5
                    $targetConveyorVY=[Math]::Sin($angle)*$block.Direction*5.5
                    $hazard.VX+=($targetConveyorVX-$hazard.VX)*.22
                    $hazard.VY+=($targetConveyorVY-$hazard.VY)*.22
                }
                # A dynamic device can only be supported by one top surface in a
                # frame. Continuing through overlapping platforms caused competing
                # conveyor impulses and visible left/right oscillation.
                break
            }elseif($block.Type-eq'Cloud'){
                # Cloud bodies have no underside or side walls. Dynamic
                # placements can rise or drift through them and only settle on
                # the top face while descending.
                continue
            }elseif($oldBodyY-ge$blockBottom-5-and$hazard.VY-lt0){
                $hazard.Y=$blockBottom-$offY;$hazard.VY=[Math]::Abs($hazard.VY)*.22
            }elseif($oldBodyX+$bodyW-le$blockLeft+5-and$hazard.VX-gt0){
                $hazard.X=$blockLeft-$bodyW-$offX;$hazard.VX=-[Math]::Abs($hazard.VX)*.3
            }elseif($oldBodyX-ge$blockRight-5-and$hazard.VX-lt0){
                $hazard.X=$blockRight-$offX;$hazard.VX=[Math]::Abs($hazard.VX)*.3
            }
        }
        Set-PlacementWindowPosition $hazard
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_CONVEYOR_HAZARD-eq'1'-and$hazard.Kind-eq'FireJet'-and($script:hazardTick%15)-eq0){
            [Console]::Out.WriteLine("diagnostic:conveyor-hazard x=$([Math]::Round($hazard.X,1)) y=$([Math]::Round($hazard.Y,1)) vx=$([Math]::Round($hazard.VX,2)) vy=$([Math]::Round($hazard.VY,2))")
        }
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_HAZARD_GRAVITY-eq'1'-and-not$hazard.PhysicsDebugSeen-and[Math]::Abs($hazard.Y-$hazard.PhysicsStartY)-gt12){
            [Console]::Out.WriteLine("diagnostic:hazard-gravity kind=$($hazard.Kind) y=$($hazard.Y) vy=$($hazard.VY)")
            $hazard.PhysicsDebugSeen=$true
        }
    }
}

function Resolve-RopePointAgainstBlock([double]$pointX,[double]$pointY,$block) {
    $r=$block.Angle*[Math]::PI/180
    $ux=[Math]::Cos($r);$uy=[Math]::Sin($r);$vx=-[Math]::Sin($r);$vy=[Math]::Cos($r)
    $centreX=$block.X+($block.Width/2);$centreY=$block.Y+($block.Height/2)
    $dx=$pointX-$centreX;$dy=$pointY-$centreY
    $localX=($dx*$ux)+($dy*$uy);$localY=($dx*$vx)+($dy*$vy)
    $halfW=($block.Width/2)+4;$halfH=($block.Height/2)+4
    if([Math]::Abs($localX)-ge$halfW-or[Math]::Abs($localY)-ge$halfH){
        return [pscustomobject]@{X=$pointX;Y=$pointY;Hit=$false}
    }
    $edgeDistances=@(
        [pscustomobject]@{Distance=$localX+$halfW;Edge='Left'},
        [pscustomobject]@{Distance=$halfW-$localX;Edge='Right'},
        [pscustomobject]@{Distance=$localY+$halfH;Edge='Top'},
        [pscustomobject]@{Distance=$halfH-$localY;Edge='Bottom'}
    )
    $nearest=@($edgeDistances|Sort-Object Distance|Select-Object -First 1)[0]
    if($nearest.Edge-eq'Left'){$localX=-$halfW}
    elseif($nearest.Edge-eq'Right'){$localX=$halfW}
    elseif($nearest.Edge-eq'Top'){$localY=-$halfH}
    else{$localY=$halfH}
    return [pscustomobject]@{
        X=$centreX+($localX*$ux)+($localY*$vx)
        Y=$centreY+($localX*$uy)+($localY*$vy)
        Hit=$true
    }
}

function Update-FrozenRope($rope) {
    if($null-eq$rope-or-not$rope.Frozen-or$null-eq$rope.FrozenAnchor-or$null-eq$rope.FrozenOther){return}
    $anchor=$rope.FrozenAnchor;$other=$rope.FrozenOther
    if($null-ne$other.PSObject.Properties['Dragging']-and$other.Dragging){return}
    $anchorCentreX=$anchor.X+($anchor.Width/2);$anchorCentreY=$anchor.Y+($anchor.Height/2)
    $worldAngle=$anchor.Angle+$rope.FrozenRelativeAngle
    $worldRadians=$worldAngle*[Math]::PI/180
    $targetX=$anchorCentreX+([Math]::Cos($worldRadians)*$rope.FrozenRadius)
    $targetY=$anchorCentreY+([Math]::Sin($worldRadians)*$rope.FrozenRadius)
    $desiredOtherAngle=$anchor.Angle+$rope.FrozenOtherAngleOffset
    if($script:playroomBalls.Contains($other)){
        if([Math]::Abs($other.Angle-$desiredOtherAngle)-gt.01){
            $other.Angle=$desiredOtherAngle
            Set-PlayroomObjectVisual $other $other.Angle
        }
    }elseif($null-ne$other.PSObject.Properties['Angle']-and[Math]::Abs($other.Angle-$desiredOtherAngle)-gt.01){
        Set-PlacementAngle $other $desiredOtherAngle
    }
    $currentPoint=Get-RopeAttachmentPoint $other
    $moveX=$targetX-$currentPoint.X;$moveY=$targetY-$currentPoint.Y
    if([Math]::Abs($moveX)-gt.001-or[Math]::Abs($moveY)-gt.001){$other.X+=$moveX;$other.Y+=$moveY}
    if($null-ne$other.PSObject.Properties['VX']){$other.VX=$moveX}
    if($null-ne$other.PSObject.Properties['VY']){$other.VY=$moveY}
    if([Math]::Abs($moveX)-gt.001-or[Math]::Abs($moveY)-gt.001){Set-PlacementWindowPosition $other}
    $rope.FrozenLastAnchorAngle=$anchor.Angle
}

function Rebase-FrozenRopeForPlacement($placement) {
    if($null-eq$placement){return}
    foreach($rope in @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'-and$_.Frozen-and$_.FrozenOther-eq$placement})){
        $anchor=$rope.FrozenAnchor
        if($null-eq$anchor-or$null-eq$anchor.Window-or-not$anchor.Window.IsVisible){continue}
        $anchorCentreX=$anchor.X+($anchor.Width/2);$anchorCentreY=$anchor.Y+($anchor.Height/2)
        $point=Get-RopeAttachmentPoint $placement
        if($null-eq$point){continue}
        $dx=$point.X-$anchorCentreX;$dy=$point.Y-$anchorCentreY
        $radius=[Math]::Sqrt(($dx*$dx)+($dy*$dy))
        if([double]::IsNaN($radius)-or[double]::IsInfinity($radius)){continue}
        $rope.FrozenRadius=[Math]::Max(28,$radius)
        $rope.FrozenRelativeAngle=([Math]::Atan2($dy,$dx)*180/[Math]::PI)-$anchor.Angle
        if($null-ne$placement.PSObject.Properties['Angle']){$rope.FrozenOtherAngleOffset=$placement.Angle-$anchor.Angle}
        $rope.FrozenLastAnchorAngle=$anchor.Angle
        $rope.Length=$rope.FrozenRadius
        Update-OnePlayroomRope $rope $true
    }
}

function Update-OnePlayroomRope($rope,[bool]$forceVisual=$false) {
    if($null-eq$rope.EndA-or$null-eq$rope.EndB-or-not$rope.EndA.Window.IsVisible-or-not$rope.EndB.Window.IsVisible){return}
    if($rope.Frozen){Update-FrozenRope $rope}
    $a=Get-RopeAttachmentPoint $rope.EndA;$b=Get-RopeAttachmentPoint $rope.EndB
    $dx=$b.X-$a.X;$dy=$b.Y-$a.Y;$distance=[Math]::Sqrt(($dx*$dx)+($dy*$dy))
    if($distance-gt$rope.Length-and$distance-gt.001){
        $nx=$dx/$distance;$ny=$dy/$distance;$excess=$distance-$rope.Length
        $dynamicA=Test-RopeDynamic $rope.EndA;$dynamicB=Test-RopeDynamic $rope.EndB
        if($dynamicA-and$dynamicB){
            $moveAX=$nx*$excess*.5;$moveAY=$ny*$excess*.5;$moveBX=-$moveAX;$moveBY=-$moveAY
            Move-RopeDynamicObject $rope.EndA $moveAX $moveAY (-$nx) (-$ny)
            Move-RopeDynamicObject $rope.EndB $moveBX $moveBY $nx $ny
            $a.X+=$moveAX;$a.Y+=$moveAY;$b.X+=$moveBX;$b.Y+=$moveBY
        }elseif($dynamicA){
            $moveAX=$nx*$excess;$moveAY=$ny*$excess
            Move-RopeDynamicObject $rope.EndA $moveAX $moveAY (-$nx) (-$ny)
            $a.X+=$moveAX;$a.Y+=$moveAY
        }elseif($dynamicB){
            $moveBX=-$nx*$excess;$moveBY=-$ny*$excess
            Move-RopeDynamicObject $rope.EndB $moveBX $moveBY $nx $ny
            $b.X+=$moveBX;$b.Y+=$moveBY
        }
        $dx=$b.X-$a.X;$dy=$b.Y-$a.Y;$distance=[Math]::Sqrt(($dx*$dx)+($dy*$dy))
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE-eq'1'-and-not$rope.DebugSeen){
            [Console]::Out.WriteLine("diagnostic:rope-constrained distance=$distance length=$($rope.Length)")
            $rope.DebugSeen=$true
        }
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_HAZARD_GRAVITY-eq'1'-and-not$rope.DebugSeen-and($rope.EndA.Kind-in@('Spikes','Laser','FireJet')-or$rope.EndB.Kind-in@('Spikes','Laser','FireJet'))){
            [Console]::Out.WriteLine("diagnostic:hazard-rope-constrained distance=$distance length=$($rope.Length)")
            $rope.DebugSeen=$true
        }
    }
    # The rope constraint remains active in gameplay, while its hidden editor
    # curve and obstacle-routing geometry are suspended completely.
    if(-not$script:playroomActive-and-not$forceVisual){return}
    # Physics constraints remain full-rate; curve allocation, block routing and
    # WPF PointCollection replacement are staggered across alternating frames.
    if(-not$forceVisual-and-not$rope.Dragging-and(($script:ropeVisualTick+[int]$rope.VisualPhase)%$script:ropeVisualDivisor)-ne0){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    # Tiny endpoint changes do not warrant rebuilding three WPF polylines. A
    # periodic refresh still picks up a block being dragged into a resting rope.
    if(-not$forceVisual-and-not$rope.Dragging-and-not[double]::IsNaN($rope.LastVisualAX)){
        $visualDelta=[Math]::Max([Math]::Max([Math]::Abs($a.X-$rope.LastVisualAX),[Math]::Abs($a.Y-$rope.LastVisualAY)),[Math]::Max([Math]::Abs($b.X-$rope.LastVisualBX),[Math]::Abs($b.Y-$rope.LastVisualBY)))
        if($visualDelta-lt1.25-and[Math]::Abs($rope.Length-$rope.LastVisualLength)-lt.5-and($script:ropeVisualTick-$rope.LastVisualTick)-lt8){return}
    }
    if($rope.Frozen){
        $rope.Length=$distance
        # Frozen ropes are rigid straight links. Three points are visually
        # identical to the old 21+ point curve and avoid needless routing work.
        $points=$rope.CachedPoints;$points.Clear()
        $points.Add([Windows.Point]::new($a.X-$left,$a.Y-$top))
        $points.Add([Windows.Point]::new((($a.X+$b.X)/2)-$left,(($a.Y+$b.Y)/2)-$top))
        $points.Add([Windows.Point]::new($b.X-$left,$b.Y-$top))
        if(-not$rope.Dragging){
            $rope.X=(($a.X+$b.X)/2)-13;$rope.Y=(($a.Y+$b.Y)/2)-13
            if([double]::IsNaN($rope.LastHandleX)-or[Math]::Abs($rope.X-$rope.LastHandleX)-ge1-or[Math]::Abs($rope.Y-$rope.LastHandleY)-ge1){$rope.Window.Left=$rope.X;$rope.Window.Top=$rope.Y;$rope.LastHandleX=$rope.X;$rope.LastHandleY=$rope.Y}
        }
        $rope.LastVisualAX=$a.X;$rope.LastVisualAY=$a.Y;$rope.LastVisualBX=$b.X;$rope.LastVisualBY=$b.Y;$rope.LastVisualLength=$rope.Length;$rope.LastVisualTick=$script:ropeVisualTick
        return
    }else{
        $geometricSag=[Math]::Sqrt([Math]::Max(0,(($rope.Length/2)*($rope.Length/2))-(($distance/2)*($distance/2))))
        $sag=[Math]::Min([Windows.SystemParameters]::VirtualScreenHeight*.42,10+($geometricSag*.75))
    }
    # Twelve to thirty-two segments remain visually smooth at desktop scale,
    # while substantially reducing Point creation and per-block routing work.
    $sampleCount=[Math]::Max(12,[Math]::Min(32,[Math]::Ceiling([Math]::Max($distance,$rope.Length)/28)))
    $routeBlocks=New-Object Collections.ArrayList
    $routeMinX=[Math]::Min($a.X,$b.X)-8;$routeMaxX=[Math]::Max($a.X,$b.X)+8
    $routeMinY=[Math]::Min($a.Y,$b.Y)-8;$routeMaxY=[Math]::Max($a.Y,$b.Y)+$sag+8
    foreach($block in @($script:playroomBlocks)){
        if($block-eq$rope.EndA-or$block-eq$rope.EndB-or$block.Type-eq'Ladder'-or$block.TemporaryState-eq'Gone'){continue}
        # A half-diagonal bound safely covers rotated blocks without invoking
        # the more expensive exact point/rectangle resolver for distant blocks.
        $blockRadius=([Math]::Sqrt(($block.Width*$block.Width)+($block.Height*$block.Height))/2)+4
        $blockCentreX=$block.X+($block.Width/2);$blockCentreY=$block.Y+($block.Height/2)
        if($blockCentreX+$blockRadius-lt$routeMinX-or$blockCentreX-$blockRadius-gt$routeMaxX-or$blockCentreY+$blockRadius-lt$routeMinY-or$blockCentreY-$blockRadius-gt$routeMaxY){continue}
        $routeBlocks.Add($block)|Out-Null
    }
    $absolutePoints=New-Object Collections.ArrayList
    $basePathLength=0.0;$previousBase=$null;$measureRoute=$routeBlocks.Count-gt0
    for($i=0;$i-le$sampleCount;$i++){
        $t=$i/[double]$sampleCount;$curve=4*$t*(1-$t)
        $basePoint=[Windows.Point]::new($a.X+($dx*$t),$a.Y+($dy*$t)+($sag*$curve))
        if($measureRoute-and$null-ne$previousBase){$bdx=$basePoint.X-$previousBase.X;$bdy=$basePoint.Y-$previousBase.Y;$basePathLength+=[Math]::Sqrt(($bdx*$bdx)+($bdy*$bdy))}
        $previousBase=$basePoint
        $absolutePoints.Add($basePoint)|Out-Null
    }
    $ropeTouchesBlock=$false
    for($pointIndex=1;$pointIndex-lt$absolutePoints.Count-1;$pointIndex++){
        $current=$absolutePoints[$pointIndex]
        if($rope.Frozen){$absolutePoints[$pointIndex]=$current;continue}
        foreach($block in @($routeBlocks)){
            $resolvedPoint=Resolve-RopePointAgainstBlock $current.X $current.Y $block
            if($resolvedPoint.Hit){
                $current=[Windows.Point]::new($resolvedPoint.X,$resolvedPoint.Y)
                $ropeTouchesBlock=$true
            }
        }
        $absolutePoints[$pointIndex]=$current
    }
    $points=$rope.CachedPoints;$points.Clear()
    $routedLength=0.0;$previousPoint=$null
    foreach($absolutePoint in @($absolutePoints)){
        if($null-ne$previousPoint){$pdx=$absolutePoint.X-$previousPoint.X;$pdy=$absolutePoint.Y-$previousPoint.Y;$routedLength+=[Math]::Sqrt(($pdx*$pdx)+($pdy*$pdy))}
        $previousPoint=$absolutePoint
        $points.Add([Windows.Point]::new($absolutePoint.X-$left,$absolutePoint.Y-$top))
    }
    if($ropeTouchesBlock-and$env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE_BLOCK_COLLISION-eq'1'-and-not$rope.DebugSeen){
        [Console]::Out.WriteLine("diagnostic:rope-block-contact base=$basePathLength routed=$routedLength length=$($rope.Length)")
        $rope.DebugSeen=$true
    }
    if($ropeTouchesBlock-and$routedLength-gt$rope.Length+1){
        $routeExcess=$routedLength-$rope.Length
        $dynamicA=Test-RopeDynamic $rope.EndA;$dynamicB=Test-RopeDynamic $rope.EndB
        $first=$absolutePoints[0];$next=$absolutePoints[1]
        $last=$absolutePoints[$absolutePoints.Count-1];$prior=$absolutePoints[$absolutePoints.Count-2]
        $aDx=$next.X-$first.X;$aDy=$next.Y-$first.Y;$aDistance=[Math]::Max(.001,[Math]::Sqrt(($aDx*$aDx)+($aDy*$aDy)))
        $bDx=$prior.X-$last.X;$bDy=$prior.Y-$last.Y;$bDistance=[Math]::Max(.001,[Math]::Sqrt(($bDx*$bDx)+($bDy*$bDy)))
        $aNx=$aDx/$aDistance;$aNy=$aDy/$aDistance;$bNx=$bDx/$bDistance;$bNy=$bDy/$bDistance
        if($dynamicA-and$dynamicB){
            Move-RopeDynamicObject $rope.EndA ($aNx*$routeExcess*.5) ($aNy*$routeExcess*.5) (-$aNx) (-$aNy)
            Move-RopeDynamicObject $rope.EndB ($bNx*$routeExcess*.5) ($bNy*$routeExcess*.5) (-$bNx) (-$bNy)
        }elseif($dynamicA){Move-RopeDynamicObject $rope.EndA ($aNx*$routeExcess) ($aNy*$routeExcess) (-$aNx) (-$aNy)}
        elseif($dynamicB){Move-RopeDynamicObject $rope.EndB ($bNx*$routeExcess) ($bNy*$routeExcess) (-$bNx) (-$bNy)}
    }
    $mid=$points[[Math]::Floor($points.Count/2)]
    if(-not$rope.Dragging){
        $rope.X=$left+$mid.X-13;$rope.Y=$top+$mid.Y-13
        if([double]::IsNaN($rope.LastHandleX)-or[Math]::Abs($rope.X-$rope.LastHandleX)-ge1-or[Math]::Abs($rope.Y-$rope.LastHandleY)-ge1){$rope.Window.Left=$rope.X;$rope.Window.Top=$rope.Y;$rope.LastHandleX=$rope.X;$rope.LastHandleY=$rope.Y}
    }
    $rope.LastVisualAX=$a.X;$rope.LastVisualAY=$a.Y;$rope.LastVisualBX=$b.X;$rope.LastVisualBY=$b.Y;$rope.LastVisualLength=$rope.Length;$rope.LastVisualTick=$script:ropeVisualTick
}

function Update-PlayroomRopes {
    $script:ropeVisualTick++
    $ropes=New-Object Collections.ArrayList
    foreach($gadget in @($script:playroomGadgets)){if($gadget.Kind-eq'Rope'){$ropes.Add($gadget)|Out-Null}}
    $script:ropeVisualDivisor=$(if($ropes.Count-ge6){3}elseif($ropes.Count-ge3){2}else{1})
    $showShadow=$ropes.Count-lt5
    $showFineHighlight=$ropes.Count-lt3
    foreach($rope in $ropes){
        if($rope.VisualPaths.Count-ge1-and$rope.ShadowVisible-ne$showShadow){$rope.VisualPaths[0].Visibility=$(if($showShadow){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed});$rope.ShadowVisible=$showShadow}
        if($rope.VisualPaths.Count-ge3-and$rope.FineHighlightVisible-ne$showFineHighlight){$rope.VisualPaths[2].Visibility=$(if($showFineHighlight){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed});$rope.FineHighlightVisible=$showFineHighlight}
        Update-OnePlayroomRope $rope
    }
}

function Add-PlayroomBlock([string]$type) {
    if (-not $script:playroomActive) { return }
    $initialWidth=$(if($type-eq'Ladder'){56.0}else{132.0})
    $initialHeight=$(if($type-eq'Ladder'){180.0}elseif($type-eq'Wooden'){18.0}else{30.0})
    $blockWindow = New-Object Windows.Window
    $blockWindow.Title = "Windowisp $type Block"
    $blockWindow.Width = $initialWidth; $blockWindow.Height = $initialHeight
    $blockWindow.WindowStyle = [Windows.WindowStyle]::None
    $blockWindow.AllowsTransparency = $true; $blockWindow.Background = [Windows.Media.Brushes]::Transparent
    $blockWindow.ShowInTaskbar = $false; $blockWindow.Topmost = $true
    $blockWindow.ResizeMode = [Windows.ResizeMode]::NoResize
    $block = New-Object Windows.Controls.Border
    $block.MinWidth = $(if($type-eq'Ladder'){44}else{60}); $block.MinHeight = $(if($type-eq'Wooden'){8}else{20})
    $block.Background = Get-BlockBrush $type
    $block.ClipToBounds=$true
    $block.BorderBrush = [Windows.Media.Brushes]::White; $block.BorderThickness = [Windows.Thickness]::new(2)
    $block.CornerRadius = [Windows.CornerRadius]::new($(if ($type -eq 'Bouncy') { 12 } else { 4 }))
    $block.Cursor = [Windows.Input.Cursors]::SizeAll
    $label = New-Object Windows.Controls.TextBlock
    $label.Text = $type.ToUpperInvariant(); $label.Foreground = [Windows.Media.Brushes]::White
    $label.FontWeight = [Windows.FontWeights]::Bold; $label.FontSize = 11
    $label.HorizontalAlignment = 'Center'; $label.VerticalAlignment = 'Center'
    $blockContent=New-Object Windows.Controls.Grid
    $blockContent.ClipToBounds=$true
    $crumbleOverlay=New-Object Windows.Controls.Grid;$crumbleOverlay.IsHitTestVisible=$false;$crumbleOverlay.Opacity=0
    $crumblePieces=New-Object Collections.ArrayList
    $crumbleTranslate=New-Object Windows.Media.TranslateTransform
    $crumbleScale=New-Object Windows.Media.ScaleTransform 1,1
    $crumbleTransforms=New-Object Windows.Media.TransformGroup;$crumbleTransforms.Children.Add($crumbleScale);$crumbleTransforms.Children.Add($crumbleTranslate)
    $blockContent.RenderTransformOrigin=[Windows.Point]::new(.5,1);$blockContent.RenderTransform=$crumbleTransforms
    if($type-eq'Crumbling'){
        $crackBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(220,70,38,24))
        foreach($crackData in @('M10,0 L22,9 L17,17 L35,30','M58,0 L52,8 L67,15 L61,30','M99,0 L88,10 L103,19 L94,30','M124,2 L112,12 L121,22 L116,30')){
            $crack=New-Object Windows.Shapes.Path;$crack.Data=[Windows.Media.Geometry]::Parse($crackData);$crack.Stroke=$crackBrush;$crack.StrokeThickness=2.2;$crack.Stretch='Fill';$crumbleOverlay.Children.Add($crack)|Out-Null
        }
        $crumbCanvas=New-Object Windows.Controls.Canvas;$crumbCanvas.ClipToBounds=$true
        foreach($crumbSpec in @(@(12,5,5),@(30,17,4),@(51,8,6),@(76,19,4),@(96,4,5),@(116,14,6))){
            $crumb=New-Object Windows.Shapes.Ellipse;$crumb.Width=$crumbSpec[2];$crumb.Height=[Math]::Max(3,$crumbSpec[2]-1)
            $crumb.Fill=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(111,63,35));$crumb.Stroke=$crackBrush;$crumb.StrokeThickness=.8
            [Windows.Controls.Canvas]::SetLeft($crumb,$crumbSpec[0]);[Windows.Controls.Canvas]::SetTop($crumb,$crumbSpec[1]);$crumbCanvas.Children.Add($crumb)|Out-Null;$crumblePieces.Add($crumb)|Out-Null
        }
        $crumbleOverlay.Children.Add($crumbCanvas)|Out-Null;$crumbleOverlay.Opacity=.12
    }
    $tint=New-Object Windows.Controls.Border
    $tint.IsHitTestVisible=$false
    $grassCap=$null;$mirrorShine=$null
    if($type-eq'Grass'){
        $grassCap=New-Object Windows.Controls.Border;$grassCap.Height=16;$grassCap.VerticalAlignment='Top';$grassCap.HorizontalAlignment='Stretch';$grassCap.Background=Get-GrassCapBrush;$grassCap.IsHitTestVisible=$false
    }elseif($type-eq'Mirror'){
        $mirrorShine=New-Object Windows.Controls.Border;$mirrorShine.HorizontalAlignment='Stretch';$mirrorShine.VerticalAlignment='Stretch';$mirrorShine.Opacity=.3;$mirrorShine.IsHitTestVisible=$false
        $mirrorShine.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromArgb(0,255,255,255),[Windows.Media.Color]::FromArgb(190,205,247,255),0)
    }
    $conveyorArrows=$null;$conveyorBeltTransform=$null;$conveyorArrowTransform=$null
    if($type-eq'Conveyor'){
        $conveyorBeltTransform=New-Object Windows.Media.TranslateTransform
        $block.Background.Transform=$conveyorBeltTransform
        $conveyorArrows=New-Object Windows.Controls.TextBlock
        $conveyorArrows.Text='>   >   >   >';$conveyorArrows.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI')
        $conveyorArrows.FontSize=12;$conveyorArrows.FontWeight=[Windows.FontWeights]::Bold
        $conveyorArrows.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(111,228,244))
        $conveyorArrows.HorizontalAlignment='Center';$conveyorArrows.VerticalAlignment='Center'
        $conveyorArrowTransform=New-Object Windows.Media.TranslateTransform;$conveyorArrows.RenderTransform=$conveyorArrowTransform
        $conveyorArrows.IsHitTestVisible=$false;$conveyorArrows.Effect=New-Object Windows.Media.Effects.DropShadowEffect
        $conveyorArrows.Effect.Color=[Windows.Media.Colors]::Black;$conveyorArrows.Effect.BlurRadius=3;$conveyorArrows.Effect.ShadowDepth=1
    }
    $label.IsHitTestVisible=$false
    if($null-ne$grassCap){$blockContent.Children.Add($grassCap)|Out-Null}
    if($null-ne$mirrorShine){$blockContent.Children.Add($mirrorShine)|Out-Null}
    $blockContent.Children.Add($tint)|Out-Null
    if($null-ne$conveyorArrows){$blockContent.Children.Add($conveyorArrows)|Out-Null}
    if($type-eq'Crumbling'){$blockContent.Children.Add($crumbleOverlay)|Out-Null}
    $blockContent.Children.Add($label)|Out-Null
    $block.Child = $blockContent

    $spawnX = [Windows.SystemParameters]::VirtualScreenLeft + (([Windows.SystemParameters]::VirtualScreenWidth - $initialWidth) / 2)
    $spawnY = [Windows.SystemParameters]::VirtualScreenTop + (([Windows.SystemParameters]::VirtualScreenHeight - $initialHeight) / 2)
    $handles = New-Object Collections.ArrayList
    $blockData = [pscustomobject]@{ Kind='Block'; Window=$blockWindow; Element=$block; Label=$label; Tint=$tint; TintIndex=0; Handles=$handles; ContextMenu=$null; GrassCap=$grassCap; MirrorShine=$mirrorShine; ConveyorArrows=$conveyorArrows; ConveyorBeltTransform=$conveyorBeltTransform; ConveyorArrowTransform=$conveyorArrowTransform; CrumbleOverlay=$crumbleOverlay;CrumblePieces=$crumblePieces;CrumbleTranslate=$crumbleTranslate;CrumbleScale=$crumbleScale;CrumbleShakeTicks=0;ContactTicks=@{};VisualPhase=0.0; Direction=1; Type=$type; X=[double]$spawnX; Y=[double]$spawnY; Width=$initialWidth; Height=$initialHeight; Angle=0.0; TemporaryState='Stable';TemporaryTicks=0;Landings=0;WispfallGenerated=$false }
    if($type-eq'Conveyor'){Set-ConveyorDirection $blockData 1}
    $block.Tag = $blockData
    $blockData.ContextMenu=New-BlockContextMenu $blockData
    $block.ContextMenu=$blockData.ContextMenu
    $blockWindow.Tag=$blockData
    $blockWindow.Add_PreviewMouseRightButtonDown({
        param($sender,$eventArgs)
        if ($script:playroomActive) { $eventArgs.Handled=$true }
    })
    $blockWindow.Add_PreviewMouseRightButtonUp({
        param($sender,$eventArgs)
        if ($script:playroomActive -and $null -ne $sender.Tag.ContextMenu) {
            $eventArgs.Handled=$true
            $sender.Tag.ContextMenu.PlacementTarget=$sender.Tag.Element
            $sender.Tag.ContextMenu.IsOpen=$true
        }
    })
    $block.Add_MouseLeftButtonDown({
        param($sender, $eventArgs)
        $sender.Tag.Window.DragMove()
        $sender.Tag.X = $sender.Tag.Window.Left+(($sender.Tag.Window.Width-$sender.Tag.Width)/2)
        $sender.Tag.Y = $sender.Tag.Window.Top+(($sender.Tag.Window.Height-$sender.Tag.Height)/2)
        Snap-PlacementToGrid $sender.Tag
        Set-PlacementWindowPosition $sender.Tag
        Rebase-FrozenRopeForPlacement $sender.Tag
        $eventArgs.Handled = $true
    })
    $resizeGrid = New-Object Windows.Controls.Grid
    $resizeGrid.Children.Add($block) | Out-Null
    foreach ($direction in @('Left','Right','Top','Bottom','TopLeft','TopRight','BottomLeft','BottomRight')) {
        if($type-in@('Wooden','Conveyor')-and$direction-match'Top|Bottom'){continue}
        $thumb = New-Object Windows.Controls.Primitives.Thumb
        $thumb.Tag = [pscustomobject]@{ Data=$blockData; Direction=$direction }
        $thumb.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(145,255,255,255))
        $thumb.Opacity = $(if ($direction -in @('Left','Right','Top','Bottom')) { 0.38 } else { 0.85 })
        if ($direction -match 'Left') { $thumb.HorizontalAlignment='Left' }
        elseif ($direction -match 'Right') { $thumb.HorizontalAlignment='Right' }
        else { $thumb.HorizontalAlignment='Stretch' }
        if ($direction -match 'Top') { $thumb.VerticalAlignment='Top' }
        elseif ($direction -match 'Bottom') { $thumb.VerticalAlignment='Bottom' }
        else { $thumb.VerticalAlignment='Stretch' }
        if ($direction -in @('Left','Right')) { $thumb.Width=6; $thumb.Cursor=[Windows.Input.Cursors]::SizeWE }
        elseif ($direction -in @('Top','Bottom')) { $thumb.Height=6; $thumb.Cursor=[Windows.Input.Cursors]::SizeNS }
        else {
            $thumb.Width=10; $thumb.Height=10
            $thumb.Cursor=$(if($direction -in @('TopLeft','BottomRight')){[Windows.Input.Cursors]::SizeNWSE}else{[Windows.Input.Cursors]::SizeNESW})
        }
        $thumb.Add_DragDelta({
            param($sender,$eventArgs)
            $d=$sender.Tag.Data;$dir=$sender.Tag.Direction
            $minimumHeight=$(if($d.Type-eq'Wooden'){8.0}else{20.0})
            $newX=$d.X;$newY=$d.Y;$newW=$d.Width;$newH=$d.Height
            $minimumWidth=$(if($d.Type-eq'Ladder'){44.0}else{60.0})
            if($dir -match 'Right'){$newW=[Math]::Max($minimumWidth,$d.Width+$eventArgs.HorizontalChange)}
            if($dir -match 'Bottom'){$newH=[Math]::Max($minimumHeight,$d.Height+$eventArgs.VerticalChange)}
            if($dir -match 'Left'){$delta=[Math]::Min($eventArgs.HorizontalChange,$d.Width-$minimumWidth);$newX=$d.X+$delta;$newW=$d.Width-$delta}
            if($dir -match 'Top'){$delta=[Math]::Min($eventArgs.VerticalChange,$d.Height-$minimumHeight);$newY=$d.Y+$delta;$newH=$d.Height-$delta}
            $d.X=$newX;$d.Y=$newY;$d.Width=$newW;$d.Height=$newH
            Set-PlacementAngle $d $d.Angle
        })
        $thumb.Add_DragCompleted({param($sender,$eventArgs);Snap-PlacementToGrid $sender.Tag.Data $true;Set-PlacementAngle $sender.Tag.Data $sender.Tag.Data.Angle})
        $resizeGrid.Children.Add($thumb)|Out-Null
        $handles.Add($thumb)|Out-Null
    }
    $blockWindow.Content = $resizeGrid
    $blockWindow.Left = $spawnX; $blockWindow.Top = $spawnY
    Register-RopeSelectable $blockWindow $blockData
    $blockWindow.Show()
    $script:playroomBlocks.Add($blockData) | Out-Null
}

function Register-SmoothToyDrag($surface,$data) {
    if($null-eq$surface-or$null-eq$data){return}
    $data|Add-Member -NotePropertyName DragOffsetX -NotePropertyValue 0.0 -Force
    $data|Add-Member -NotePropertyName DragOffsetY -NotePropertyValue 0.0 -Force
    $surface.Tag=$data
    $surface.Add_MouseLeftButtonDown({
        param($sender,$eventArgs)
        if($script:wiringMode-or$script:ropeToolMode-or$script:eraserMode){return}
        $cursor=New-Object PetNative+POINT
        if(-not[PetNative]::GetCursorPos([ref]$cursor)){return}
        $d=$sender.Tag;$d.CarriedBy='';$d.VX=0;$d.VY=0
        if($d.Kind-eq'Bat'){$d.BatCharging=$false;$d.SwingTicks=0}
        $d.DragOffsetX=$cursor.X-$d.X;$d.DragOffsetY=$cursor.Y-$d.Y;$d.Dragging=$true
        $sender.CaptureMouse()|Out-Null;$eventArgs.Handled=$true
    })
    $surface.Add_MouseMove({
        param($sender,$eventArgs)
        $d=$sender.Tag
        if(-not$d.Dragging-or$eventArgs.LeftButton-ne[Windows.Input.MouseButtonState]::Pressed){return}
        $cursor=New-Object PetNative+POINT
        if([PetNative]::GetCursorPos([ref]$cursor)){
            $d.X=[double]$cursor.X-$d.DragOffsetX;$d.Y=[double]$cursor.Y-$d.DragOffsetY
            Set-PlacementWindowPosition $d
        }
        $eventArgs.Handled=$true
    })
    $surface.Add_MouseLeftButtonUp({
        param($sender,$eventArgs)
        $d=$sender.Tag
        if(-not$d.Dragging){return}
        $d.Dragging=$false;$sender.ReleaseMouseCapture()
        Snap-PlacementToGrid $d;Set-PlacementWindowPosition $d;Rebase-FrozenRopeForPlacement $d
        $eventArgs.Handled=$true
    })
    $surface.Add_LostMouseCapture({
        param($sender,$eventArgs)
        if($null-ne$sender.Tag-and$sender.Tag.Dragging){$sender.Tag.Dragging=$false;Snap-PlacementToGrid $sender.Tag;Set-PlacementWindowPosition $sender.Tag;Rebase-FrozenRopeForPlacement $sender.Tag}
    })
}

function Add-PlayroomBall {
    if (-not $script:playroomActive) { return }
    $size = 48.0
    $ballWindow = New-Object Windows.Window
    $ballWindow.Title = 'Windowisp Ball'
    $ballWindow.Width = $size; $ballWindow.Height = $size
    $ballWindow.WindowStyle = [Windows.WindowStyle]::None
    $ballWindow.AllowsTransparency = $true; $ballWindow.Background = [Windows.Media.Brushes]::Transparent
    $ballWindow.ShowInTaskbar = $false; $ballWindow.ShowActivated = $false
    $ballWindow.Topmost = $true; $ballWindow.ResizeMode = [Windows.ResizeMode]::NoResize
    $shape = New-Object Windows.Controls.Grid
    $shape.Width = $size; $shape.Height = $size
    # A transparent brush still participates in WPF hit testing. The artwork is
    # deliberately non-hit-testable, so without this the visible ball cannot
    # receive either drag or context-menu input.
    $shape.Background=[Windows.Media.Brushes]::Transparent
    $ballArt=New-ToyboxImage 'Ball'
    if($null-ne$ballArt){$shape.Children.Add($ballArt)|Out-Null}
    $shape.RenderTransformOrigin = [Windows.Point]::new(0.5,0.5)
    $shape.RenderTransform = New-Object Windows.Media.RotateTransform 0
    $spawnX = [Windows.SystemParameters]::VirtualScreenLeft + (([Windows.SystemParameters]::VirtualScreenWidth - $size) / 2)
    $spawnY = [Windows.SystemParameters]::VirtualScreenTop + 100
    $ball = [pscustomobject]@{ Kind='Ball'; Window=$ballWindow; Element=$shape; X=[double]$spawnX; Y=[double]$spawnY; VX=3.2; VY=0.0; Radius=24.0; Size=$size; Physics=[double]$script:ballPhysicsValue; Angle=0.0; PetHitCooldown=0; TeleportCooldown=0; CarriedBy=''; Dragging=$false }
    Register-SmoothToyDrag $shape $ball
    $shape.ContextMenu=New-PlacementContextMenu $ball $false
    Register-RopeSelectable $ballWindow $ball
    $ballWindow.Content = $shape; $ballWindow.Left = $spawnX; $ballWindow.Top = $spawnY
    $ballWindow.Show()
    $script:playroomBalls.Add($ball) | Out-Null
}

function Add-PlayroomToy([string]$kind) {
    if(-not$script:playroomActive){return}
    $size=54.0
    $toyWindow=New-Object Windows.Window
    $toyWindow.Title="Windowisp $kind";$toyWindow.Width=$size;$toyWindow.Height=$size
    $toyWindow.WindowStyle=[Windows.WindowStyle]::None;$toyWindow.AllowsTransparency=$true
    $toyWindow.Background=[Windows.Media.Brushes]::Transparent;$toyWindow.ShowInTaskbar=$false
    $toyWindow.ShowActivated=$false;$toyWindow.Topmost=$true;$toyWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $canvas=New-Object Windows.Controls.Grid;$canvas.Width=$size;$canvas.Height=$size
    $canvas.Background=[Windows.Media.Brushes]::Transparent
    $toyArt=New-ToyboxImage $kind
    if($null-ne$toyArt){$canvas.Children.Add($toyArt)|Out-Null}
    $canvas.RenderTransformOrigin=[Windows.Point]::new(.5,.5)
    $visualRotate=New-Object Windows.Media.RotateTransform 0;$visualScale=$null
    if($kind-eq'Bat'){
        $visualScale=[Windows.Media.ScaleTransform]::new(1,1)
        $visualTransforms=New-Object Windows.Media.TransformGroup
        $visualTransforms.Children.Add($visualScale)|Out-Null;$visualTransforms.Children.Add($visualRotate)|Out-Null
        $canvas.RenderTransform=$visualTransforms
    }else{$canvas.RenderTransform=$visualRotate}
    $spawnX=[Windows.SystemParameters]::VirtualScreenLeft+(([Windows.SystemParameters]::VirtualScreenWidth-$size)/2)
    $spawnY=[Windows.SystemParameters]::VirtualScreenTop+90
    $toy=[pscustomobject]@{Kind=$kind;Window=$toyWindow;Element=$canvas;VisualRotate=$visualRotate;VisualScale=$visualScale;SwingTicks=0;SwingDuration=18;SwingPower=0.0;SwingHitDone=$false;BatCharging=$false;BatChargeTicks=0;X=[double]$spawnX;Y=[double]$spawnY;VX=1.2;VY=0.0;Radius=27.0;Size=$size;Physics=38.0;Angle=$(if($kind-eq'Bat'){-28.0}else{0.0});PetHitCooldown=0;TeleportCooldown=0;CarriedBy='';Dragging=$false}
    Register-SmoothToyDrag $canvas $toy
    $canvas.ContextMenu=New-PlacementContextMenu $toy $false
    Register-RopeSelectable $toyWindow $toy
    Set-PlayroomObjectVisual $toy $toy.Angle
    $toyWindow.Content=$canvas;$toyWindow.Left=$spawnX;$toyWindow.Top=$spawnY
    $toyWindow.Show();$script:playroomBalls.Add($toy)|Out-Null
}

function Initialize-FanWind($fan) {
    if($null-eq$fan-or$fan.Kind-ne'Fan'-or$fan.WindLines.Count-gt0){return}
    Initialize-RopeOverlay
    foreach($offset in @(-34.0,0.0,34.0)){
        $line=New-Object Windows.Shapes.Polyline
        $line.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(190,239,255))
        $line.StrokeThickness=$(if($offset-eq0){2.4}else{1.7});$line.StrokeStartLineCap='Round';$line.StrokeEndLineCap='Round'
        $line.StrokeDashArray=New-Object Windows.Media.DoubleCollection;$line.StrokeDashArray.Add(7);$line.StrokeDashArray.Add(6)
        $line.Opacity=0;$line.IsHitTestVisible=$false
        $script:ropeOverlayCanvas.Children.Add($line)|Out-Null;$fan.WindLines.Add([pscustomobject]@{Line=$line;Offset=$offset})|Out-Null
    }
}

function Update-FanWind($fan,[bool]$powered) {
    if($null-eq$fan-or$fan.Kind-ne'Fan'){return}
    if($fan.WindLines.Count-eq0){Initialize-FanWind $fan}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $r=$fan.Angle*[Math]::PI/180;$dx=[Math]::Cos($r);$dy=[Math]::Sin($r);$nx=-$dy;$ny=$dx
    $originX=$fan.X+($fan.Width/2)+($dx*30);$originY=$fan.Y+($fan.Height/2)+($dy*30)
    foreach($wind in @($fan.WindLines)){
        $line=$wind.Line
        if(-not$powered){$line.Opacity=0;continue}
        $wave=[Math]::Sin(($script:inputTick*.15)+($wind.Offset*.08))*7
        $points=New-Object Windows.Media.PointCollection
        foreach($distance in @(12.0,105.0,215.0)){
            $fadeOffset=$wind.Offset*($distance/215.0)
            $points.Add([Windows.Point]::new($originX+($dx*$distance)+($nx*($fadeOffset+$wave))-$left,$originY+($dy*$distance)+($ny*($fadeOffset+$wave))-$top))
        }
        $line.Points=$points;$line.StrokeDashOffset=-1*($script:inputTick*.8);$line.Opacity=$(if($wind.Offset-eq0){.72}else{.48})
    }
}

function Add-PlayroomGadget([string]$kind) {
    if(-not$script:playroomActive){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $width=[Windows.SystemParameters]::VirtualScreenWidth;$height=[Windows.SystemParameters]::VirtualScreenHeight
    $kinds=$(if($kind-eq'Teleporter'){@('TeleporterA','TeleporterB')}else{@($kind)})
    $index=0
    foreach($gadgetKind in $kinds){
        $w=$(if($gadgetKind-like'Teleporter*'){92.0}elseif($gadgetKind-eq'Fan'){76.0}elseif($gadgetKind-eq'Rotator'){40.0}elseif($gadgetKind-eq'PressurePlate'){94.0}elseif($gadgetKind-eq'Switch'){62.0}elseif($gadgetKind-in@('Button','Timer')){66.0}elseif($gadgetKind-eq'RopeCoil'){68.0}else{78.0})
        $h=$(if($gadgetKind-like'Teleporter*'){72.0}elseif($gadgetKind-eq'Fan'){76.0}elseif($gadgetKind-eq'Rotator'){40.0}elseif($gadgetKind-eq'PressurePlate'){44.0}elseif($gadgetKind-eq'Switch'){84.0}elseif($gadgetKind-eq'Button'){58.0}elseif($gadgetKind-eq'Timer'){72.0}elseif($gadgetKind-eq'RopeCoil'){68.0}else{66.0})
        $gadgetWindow=New-Object Windows.Window
        $gadgetWindow.Title="Windowisp $gadgetKind";$gadgetWindow.Width=$w;$gadgetWindow.Height=$h
        $gadgetWindow.WindowStyle=[Windows.WindowStyle]::None;$gadgetWindow.AllowsTransparency=$true
        $gadgetWindow.Background=[Windows.Media.Brushes]::Transparent;$gadgetWindow.ShowInTaskbar=$false
        $gadgetWindow.Topmost=$true;$gadgetWindow.ResizeMode=[Windows.ResizeMode]::NoResize
        $border=New-Object Windows.Controls.Border;$border.CornerRadius=[Windows.CornerRadius]::new($(if($gadgetKind-eq'Rotator'){20}else{9}))
        $colour=$(if($gadgetKind-eq'Spring'){[Windows.Media.Color]::FromRgb(72,194,104)}elseif($gadgetKind-like'Teleporter*'){[Windows.Media.Color]::FromRgb($(if($gadgetKind-eq'TeleporterA'){74}else{210}),91,$(if($gadgetKind-eq'TeleporterA'){220}else{157}))}elseif($gadgetKind-eq'Rotator'){[Windows.Media.Color]::FromRgb(179,91,215)}else{[Windows.Media.Color]::FromRgb(55,155,205)})
        $border.Background=[Windows.Media.Brushes]::Transparent
        $border.BorderThickness=[Windows.Thickness]::new(0)
        $label=New-Object Windows.Controls.TextBlock
        $label.Text=$(if($gadgetKind-eq'Spring'){'^^  SPRING'}elseif($gadgetKind-like'Teleporter*'){'O  PORTAL'}elseif($gadgetKind-eq'Rotator'){[string][char]0x21BB}elseif($gadgetKind-eq'RopeCoil'){'ROPE'}elseif($gadgetKind-in@('Switch','Button','PressurePlate','Timer')){"$($gadgetKind.ToUpperInvariant()) OFF"}else{'FAN  0 deg'})
        $label.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Emoji');$label.FontSize=$(if($gadgetKind-eq'Fan'){13}else{11})
        $label.FontWeight=[Windows.FontWeights]::Bold;$label.Foreground=[Windows.Media.Brushes]::White
        $label.HorizontalAlignment='Center';$label.VerticalAlignment='Bottom';$label.Visibility=[Windows.Visibility]::Collapsed
        if($gadgetKind-in@('Switch','Button','PressurePlate','Timer')){$label.Visibility=[Windows.Visibility]::Visible;$label.FontSize=9;$label.Margin=[Windows.Thickness]::new(2)}
        $gadgetContent=New-Object Windows.Controls.Grid
        $gadgetArt=New-ToyboxImage $(if($gadgetKind-like'Teleporter*'){'Teleporter'}else{$gadgetKind})
        if($gadgetKind-in@('Switch','Button','PressurePlate','Timer')-and$null-eq$gadgetArt){
            $gadgetArt=New-Object Windows.Controls.Border;$gadgetArt.CornerRadius=[Windows.CornerRadius]::new($(if($gadgetKind-eq'PressurePlate'){5}else{12}))
            $logicColours=@{Switch=[Windows.Media.Color]::FromRgb(70,134,205);Button=[Windows.Media.Color]::FromRgb(218,74,91);PressurePlate=[Windows.Media.Color]::FromRgb(222,170,54);Timer=[Windows.Media.Color]::FromRgb(145,87,208)}
            $gadgetArt.Background=New-Object Windows.Media.SolidColorBrush $logicColours[$gadgetKind];$gadgetArt.BorderBrush=[Windows.Media.Brushes]::White;$gadgetArt.BorderThickness=[Windows.Thickness]::new(2)
        }
        $springScale=$null;$springBase=$null
        if($gadgetKind-eq'Spring'-and$null-ne$gadgetArt){
            $springBase=New-Object Windows.Controls.Border;$springBase.Width=$w*.82;$springBase.Height=10;$springBase.VerticalAlignment='Bottom';$springBase.HorizontalAlignment='Center'
            $springBase.CornerRadius=[Windows.CornerRadius]::new(5);$springBase.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(20,48,75),[Windows.Media.Color]::FromRgb(7,18,35),90)
            $springBase.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(73,211,235));$springBase.BorderThickness=[Windows.Thickness]::new(1.3);$springBase.IsHitTestVisible=$false
            $springScale=[Windows.Media.ScaleTransform]::new(1,1)
            $gadgetArt.RenderTransformOrigin=[Windows.Point]::new(.5,1)
            $gadgetArt.RenderTransform=$springScale
        }
        $logicScale=$null;$logicRotate=$null;$logicTranslate=$null;$timerDial=$null;$timerDialTransform=$null
        if($gadgetKind-in@('Switch','Button','PressurePlate','Timer')-and$null-ne$gadgetArt){
            $logicScale=[Windows.Media.ScaleTransform]::new(1,1);$logicRotate=[Windows.Media.RotateTransform]::new(0);$logicTranslate=[Windows.Media.TranslateTransform]::new(0,0)
            $logicGroup=New-Object Windows.Media.TransformGroup;$logicGroup.Children.Add($logicScale)|Out-Null;$logicGroup.Children.Add($logicRotate)|Out-Null;$logicGroup.Children.Add($logicTranslate)|Out-Null
            $gadgetArt.RenderTransformOrigin=[Windows.Point]::new(.5,1);$gadgetArt.RenderTransform=$logicGroup
        }
        if($null-ne$springBase){$gadgetContent.Children.Add($springBase)|Out-Null}
        if($null-ne$gadgetArt){$gadgetContent.Children.Add($gadgetArt)|Out-Null}
        $gadgetContent.Children.Add($label)|Out-Null
        $border.Child=$gadgetContent
        $spawnX=$(if($gadgetKind-eq'TeleporterA'){$left+100}elseif($gadgetKind-eq'TeleporterB'){$left+$width-$w-100}else{$left+(($width-$w)/2)+($index*100)})
        $spawnY=$top+$height-$h-80
        $gadget=[pscustomobject]@{Kind=$gadgetKind;Window=$gadgetWindow;Element=$border;Label=$label;Art=$gadgetArt;WindLines=(New-Object Collections.ArrayList);SpringScale=$springScale;SpringBase=$springBase;CompressionTicks=0;LogicScale=$logicScale;LogicRotate=$logicRotate;LogicTranslate=$logicTranslate;TimerDial=$timerDial;TimerDialTransform=$timerDialTransform;PreviousSignalOn=$false;StateAnimTicks=0;SignalOn=$false;PulseTicks=0;ManualPower=$(if($gadgetKind-in@('Fan','Rotator','TeleporterA','TeleporterB')){$true}else{$null});X=[double]$spawnX;Y=[double]$spawnY;Width=$w;Height=$h;BodyWidth=$w;BodyHeight=$h;BodyOffsetX=0.0;BodyOffsetY=0.0;VX=0.0;VY=0.0;Dragging=$false;IsDynamic=($gadgetKind-in@('Fan','TeleporterA','TeleporterB'));SpringCooldown=0;PhysicsStartY=[double]$spawnY;PhysicsDebugSeen=$false;Direction=1;RotationSpeed=1.0;Angle=0.0;SpinAngle=0.0;SpinTransform=$null;Target=$null;DebugSeen=$false;GameMarker=$false}
        $border.Tag=$gadget
        if($gadgetKind-eq'Rotator'){
            $gadget.SpinTransform=New-Object Windows.Media.RotateTransform 0
            $border.RenderTransformOrigin=[Windows.Point]::new(.5,.5);$border.RenderTransform=$gadget.SpinTransform
            $label.FontSize=22
        }
        $border.Add_MouseLeftButtonDown({
            param($sender,$e)
            if($script:wiringMode-or$script:ropeToolMode-or$script:eraserMode){return}
            $data=$sender.Tag;$beforeX=$data.Window.Left;$beforeY=$data.Window.Top
            if($null-ne$data.PSObject.Properties['Dragging']){$data.VX=0;$data.VY=0;$data.Dragging=$true}
            try{$data.Window.DragMove()}finally{if($null-ne$data.PSObject.Properties['Dragging']){$data.Dragging=$false}}
            $moved=[Math]::Abs($data.Window.Left-$beforeX)+[Math]::Abs($data.Window.Top-$beforeY)
            if($moved-ge4){Rebase-FrozenRopeForPlacement $data}
            if($moved-lt4){if($data.Kind-eq'Switch'){$data.SignalOn=-not$data.SignalOn}elseif($data.Kind-eq'Button'){$data.PulseTicks=90;$data.SignalOn=$true}}
        })
        $border.ContextMenu=New-PlacementContextMenu $gadget ($gadgetKind-ne'Rotator')
        Register-RopeSelectable $gadgetWindow $gadget
        $gadgetWindow.Add_LocationChanged({param($sender,$e);$data=@($script:playroomGadgets|Where-Object{$_.Window-eq$sender}|Select-Object -First 1);if($data.Count){$data[0].X=$sender.Left+(($sender.Width-$data[0].Width)/2);$data[0].Y=$sender.Top+(($sender.Height-$data[0].Height)/2)}})
        $gadgetWindow.Content=$border;$gadgetWindow.Left=$spawnX;$gadgetWindow.Top=$spawnY;$gadgetWindow.Show()
        if($gadgetKind-eq'Fan'){Initialize-FanWind $gadget}
        $script:playroomGadgets.Add($gadget)|Out-Null;$index++
    }
}

function Add-PlayroomHazard([string]$kind) {
    if(-not$script:playroomActive){return}
    $screenLeft=[Windows.SystemParameters]::VirtualScreenLeft;$screenTop=[Windows.SystemParameters]::VirtualScreenTop
    $screenWidth=[Windows.SystemParameters]::VirtualScreenWidth;$screenHeight=[Windows.SystemParameters]::VirtualScreenHeight
    $w=$(if($kind-eq'Laser'){300.0}elseif($kind-eq'FireJet'){54.0}else{106.0})
    $h=$(if($kind-eq'Laser'){300.0}elseif($kind-eq'FireJet'){116.0}else{30.0})
    $hazardWindow=New-Object Windows.Window
    $hazardWindow.Title="Windowisp $kind";$hazardWindow.Width=$w;$hazardWindow.Height=$h
    $hazardWindow.WindowStyle=[Windows.WindowStyle]::None;$hazardWindow.AllowsTransparency=$true
    $hazardWindow.Background=[Windows.Media.Brushes]::Transparent;$hazardWindow.ShowInTaskbar=$false
    $hazardWindow.Topmost=$true;$hazardWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $canvas=New-Object Windows.Controls.Canvas;$canvas.Width=$w;$canvas.Height=$h
    $visual=$null;$emitter=$null;$reflection=$null;$beamWindow=$null;$beamLines=$null;$beamGlowLines=$null;$fireTransform=$null
    if($kind-eq'Spikes'){
        $visual=New-ToyboxImage 'Spikes';$visual.Width=$w;$visual.Height=$h
        $visual.Stretch=[Windows.Media.Stretch]::Fill
        $canvas.Children.Add($visual)|Out-Null
        $emitter=New-Object Windows.Controls.Border;$emitter.Width=$w;$emitter.Height=$h
        $emitter.Background=[Windows.Media.Brushes]::Transparent
        $canvas.Children.Add($emitter)|Out-Null
    }elseif($kind-eq'FireJet'){
        $visual=New-Object Windows.Controls.Canvas;$visual.Width=54;$visual.Height=76
        $outerFlame=New-Object Windows.Shapes.Path
        $outerFlame.Data=[Windows.Media.Geometry]::Parse('M27,76 C10,72 4,61 10,48 C15,38 12,29 19,15 C21,28 28,28 31,3 C43,22 39,34 47,45 C57,61 45,73 27,76 Z')
        $outerFlame.Fill=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,194,28),[Windows.Media.Color]::FromRgb(219,35,25),90)
        $outerFlame.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(210,104,19,48));$outerFlame.StrokeThickness=1.5
        $outerFlame.Effect=New-Object Windows.Media.Effects.DropShadowEffect
        $outerFlame.Effect.Color=[Windows.Media.Color]::FromRgb(255,69,20);$outerFlame.Effect.BlurRadius=15;$outerFlame.Effect.ShadowDepth=0
        $visual.Children.Add($outerFlame)|Out-Null
        $middleFlame=New-Object Windows.Shapes.Path
        $middleFlame.Data=[Windows.Media.Geometry]::Parse('M27,71 C17,68 14,59 19,50 C23,43 21,36 27,25 C30,39 38,42 39,52 C42,62 36,69 27,71 Z')
        $middleFlame.Fill=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,249,128),[Windows.Media.Color]::FromRgb(255,111,18),90)
        $visual.Children.Add($middleFlame)|Out-Null
        $coreFlame=New-Object Windows.Shapes.Path
        $coreFlame.Data=[Windows.Media.Geometry]::Parse('M27,69 C21,65 22,58 27,49 C34,58 34,65 27,69 Z')
        $coreFlame.Fill=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,255,224))
        $visual.Children.Add($coreFlame)|Out-Null
        $fireTransform=[Windows.Media.ScaleTransform]::new(1,1)
        $visual.RenderTransformOrigin=[Windows.Point]::new(.5,1);$visual.RenderTransform=$fireTransform
        [Windows.Controls.Canvas]::SetLeft($visual,0);[Windows.Controls.Canvas]::SetTop($visual,-7)
        $canvas.Children.Add($visual)|Out-Null
        $emitter=New-Object Windows.Controls.Border;$emitter.Width=54;$emitter.Height=54
        $fireSource=Get-ToyboxImageSource 'FireJet'
        $emitter.Background=$(if($null-ne$fireSource){New-Object Windows.Media.ImageBrush $fireSource}else{New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(76,67,74))})
        [Windows.Controls.Canvas]::SetTop($emitter,62);$canvas.Children.Add($emitter)|Out-Null
    }else{
        $beamWindow=New-Object Windows.Window
        $beamWindow.Title='Windowisp Laser Beam'
        $beamWindow.Width=$screenWidth;$beamWindow.Height=$screenHeight
        $beamWindow.Left=$screenLeft;$beamWindow.Top=$screenTop
        $beamWindow.WindowStyle=[Windows.WindowStyle]::None;$beamWindow.AllowsTransparency=$true
        $beamWindow.Background=[Windows.Media.Brushes]::Transparent;$beamWindow.ShowInTaskbar=$false
        $beamWindow.ShowActivated=$false;$beamWindow.Topmost=$true;$beamWindow.ResizeMode=[Windows.ResizeMode]::NoResize
        $beamCanvas=New-Object Windows.Controls.Canvas
        $beamCanvas.Width=$screenWidth;$beamCanvas.Height=$screenHeight;$beamCanvas.IsHitTestVisible=$false
        $beamLines=New-Object Collections.ArrayList;$beamGlowLines=New-Object Collections.ArrayList
        foreach($segmentIndex in 0..7){
            $glow=New-Object Windows.Shapes.Line
            $glow.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(115,255,18,46))
            $glow.StrokeThickness=13;$glow.Visibility=[Windows.Visibility]::Hidden
            $glow.Effect=New-Object Windows.Media.Effects.DropShadowEffect
            $glow.Effect.Color=[Windows.Media.Color]::FromRgb(255,0,36);$glow.Effect.BlurRadius=24;$glow.Effect.ShadowDepth=0
            $beamCanvas.Children.Add($glow)|Out-Null;$beamGlowLines.Add($glow)|Out-Null
            $line=New-Object Windows.Shapes.Line
            $line.Stroke=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,255,255),[Windows.Media.Color]::FromRgb(255,72,92),0)
            $line.StrokeThickness=3.2;$line.Visibility=[Windows.Visibility]::Hidden
            $line.Effect=New-Object Windows.Media.Effects.DropShadowEffect
            $line.Effect.Color=[Windows.Media.Color]::FromRgb(255,52,70);$line.Effect.BlurRadius=7;$line.Effect.ShadowDepth=0
            $beamCanvas.Children.Add($line)|Out-Null;$beamLines.Add($line)|Out-Null
        }
        $beamWindow.Content=$beamCanvas
        $visual=$beamLines[0];$reflection=$beamLines[1]
        $emitter=New-Object Windows.Controls.Border;$emitter.Width=62;$emitter.Height=62;$emitter.CornerRadius=[Windows.CornerRadius]::new(31)
        $laserSource=Get-ToyboxImageSource 'Laser'
        $emitter.Background=$(if($null-ne$laserSource){New-Object Windows.Media.ImageBrush $laserSource}else{New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(92,25,38))})
        [Windows.Controls.Canvas]::SetLeft($emitter,119);[Windows.Controls.Canvas]::SetTop($emitter,119);$canvas.Children.Add($emitter)|Out-Null
    }
    $spawnX=$screenLeft+(($screenWidth-$w)/2);$spawnY=$screenTop+$screenHeight-$h-95
    $bodyWidth=$(if($kind-eq'Laser'){62.0}elseif($kind-eq'FireJet'){54.0}else{$w})
    $bodyHeight=$(if($kind-eq'Laser'){62.0}elseif($kind-eq'FireJet'){54.0}else{$h})
    $bodyOffsetX=$(if($kind-eq'Laser'){119.0}else{0.0})
    $bodyOffsetY=$(if($kind-eq'Laser'){119.0}elseif($kind-eq'FireJet'){62.0}else{0.0})
    $hazard=[pscustomobject]@{Kind=$kind;Window=$hazardWindow;Element=$canvas;Visual=$visual;Reflection=$reflection;ReflectedSegment=$null;BeamWindow=$beamWindow;BeamLines=$beamLines;BeamGlowLines=$beamGlowLines;BeamSegments=(New-Object Collections.ArrayList);FireTransform=$fireTransform;Emitter=$emitter;ManualPower=$true;X=[double]$spawnX;Y=[double]$spawnY;Width=$w;Height=$h;BodyWidth=$bodyWidth;BodyHeight=$bodyHeight;BodyOffsetX=$bodyOffsetX;BodyOffsetY=$bodyOffsetY;VX=0.0;VY=0.0;Dragging=$false;IsDynamic=($kind-in@('Spikes','Laser','FireJet'));SpringCooldown=0;PhysicsStartY=[double]$spawnY;PhysicsDebugSeen=$false;Angle=0.0;Active=$true}
    $emitter.Tag=$hazard
    $emitter.Add_MouseLeftButtonDown({
        param($sender,$e)
        $data=$sender.Tag;$data.VX=0;$data.VY=0;$data.Dragging=$true
        try{$data.Window.DragMove()}finally{$data.Dragging=$false}
        # Synchronise logical coordinates once after a real user drag. Do not use
        # LocationChanged here: programmatic Left/Top updates arrive separately,
        # and that callback was restoring the previous Y during every physics tick.
        $data.X=$data.Window.Left+(($data.Window.Width-$data.Width)/2)
        $data.Y=$data.Window.Top+(($data.Window.Height-$data.Height)/2)
        $data.VX=0;$data.VY=0
        Rebase-FrozenRopeForPlacement $data
    })
    $emitter.ContextMenu=New-PlacementContextMenu $hazard $true
    Register-RopeSelectable $hazardWindow $hazard
    $hazardWindow.Add_LocationChanged({
        param($sender,$e)
        $data=$sender.Tag
        if($null-ne$data-and$data.Dragging){
            $data.X=$sender.Left+(($sender.Width-$data.Width)/2)
            $data.Y=$sender.Top+(($sender.Height-$data.Height)/2)
        }
    })
    $hazardWindow.Content=$canvas;$hazardWindow.Left=$spawnX;$hazardWindow.Top=$spawnY;$hazardWindow.Show()
    if($null-ne$beamWindow){$beamWindow.Show();Set-OverlayClickThrough $beamWindow}
    $script:playroomGadgets.Add($hazard)|Out-Null
}

function Invoke-SandboxHazardDamage([string]$player) {
    if($player-eq'P2'){
        if(-not$script:twoPlayerActive-or$script:p2Hearts-le0-or$script:p2InvulnerableTicks-gt0){return}
        if($script:playroomActive){$script:p2Hearts=[Math]::Max(1,$script:p2Hearts-1)}
        else{$script:p2Hearts--}
        $script:p2InvulnerableTicks=90
    }else{
        if($script:hearts-le0-or$script:invulnerableTicks-gt0){return}
        if($script:playroomActive){$script:hearts=[Math]::Max(1,$script:hearts-1)}
        else{$script:hearts--}
        $script:invulnerableTicks=90
        if(-not$script:playroomActive-and$script:hearts-le0){$script:active=$false;Register-ControlKeys $false;Set-ClickThrough $true;Update-Menu}
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:sandbox-damage player=$player hearts=$($script:hearts) p2Hearts=$($script:p2Hearts) active=$($script:active) p1Ticks=$($script:invulnerableTicks) p2Ticks=$($script:p2InvulnerableTicks)")}
}

function Test-PointNearSegment([double]$px,[double]$py,[double]$x1,[double]$y1,[double]$x2,[double]$y2,[double]$radius) {
    $dx=$x2-$x1;$dy=$y2-$y1;$lengthSquared=($dx*$dx)+($dy*$dy)
    if($lengthSquared-le0){return $false}
    $t=[Math]::Max(0.0,[Math]::Min(1.0,(($px-$x1)*$dx+($py-$y1)*$dy)/$lengthSquared))
    $cx=$x1+($t*$dx);$cy=$y1+($t*$dy)
    return ((($px-$cx)*($px-$cx)+($py-$cy)*($py-$cy))-le($radius*$radius))
}

function Test-RotatedPlacementPoint($data,[double]$px,[double]$py,[double]$padding=0) {
    $cx=$data.X+$data.Width/2;$cy=$data.Y+$data.Height/2
    $r=-1*$data.Angle*[Math]::PI/180;$dx=$px-$cx;$dy=$py-$cy
    $localX=($dx*[Math]::Cos($r))-($dy*[Math]::Sin($r))
    $localY=($dx*[Math]::Sin($r))+($dy*[Math]::Cos($r))
    return ([Math]::Abs($localX)-le$data.Width/2+$padding-and[Math]::Abs($localY)-le$data.Height/2+$padding)
}

function Get-RayDesktopDistance([double]$ox,[double]$oy,[double]$dx,[double]$dy) {
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $right=$left+[Windows.SystemParameters]::VirtualScreenWidth;$bottom=$top+[Windows.SystemParameters]::VirtualScreenHeight
    $distances=New-Object Collections.ArrayList
    if($dx-gt.000001){$distances.Add(($right-$ox)/$dx)|Out-Null}elseif($dx-lt-.000001){$distances.Add(($left-$ox)/$dx)|Out-Null}
    if($dy-gt.000001){$distances.Add(($bottom-$oy)/$dy)|Out-Null}elseif($dy-lt-.000001){$distances.Add(($top-$oy)/$dy)|Out-Null}
    return [double](@($distances|Where-Object{$_-gt.01}|Measure-Object -Minimum).Minimum)
}

function Get-RayPlacementHit($data,[double]$ox,[double]$oy,[double]$dx,[double]$dy,[double]$maxDistance) {
    $angle=$(if($null-ne$data.PSObject.Properties['Angle']){[double]$data.Angle}else{0.0})
    $r=$angle*[Math]::PI/180;$ux=[Math]::Cos($r);$uy=[Math]::Sin($r);$vx=-[Math]::Sin($r);$vy=[Math]::Cos($r)
    $width=[double]$data.Width;$height=[double]$data.Height
    $cx=[double]$data.X+($width/2.0);$cy=[double]$data.Y+($height/2.0);$rx=$ox-$cx;$ry=$oy-$cy
    $localOx=($rx*$ux)+($ry*$uy);$localOy=($rx*$vx)+($ry*$vy)
    $localDx=($dx*$ux)+($dy*$uy);$localDy=($dx*$vx)+($dy*$vy)
    $tNear=.5;$tFar=$maxDistance;$normalLocalX=0.0;$normalLocalY=0.0
    foreach($axis in @(@($localOx,$localDx,($width/2.0),1),@($localOy,$localDy,($height/2.0),2))){
        $origin=[double]$axis[0];$direction=[double]$axis[1];$half=[double]$axis[2]
        if([Math]::Abs($direction)-lt.000001){if([Math]::Abs($origin)-gt$half){return $null};continue}
        $t1=(-$half-$origin)/$direction;$t2=($half-$origin)/$direction
        $near=[Math]::Min($t1,$t2);$far=[Math]::Max($t1,$t2)
        if($near-gt$tNear){
            $tNear=$near
            if($axis[3]-eq1){$normalLocalX=$(if($t1-lt$t2){-1.0}else{1.0});$normalLocalY=0.0}
            else{$normalLocalX=0.0;$normalLocalY=$(if($t1-lt$t2){-1.0}else{1.0})}
        }
        $tFar=[Math]::Min($tFar,$far)
        if($tNear-gt$tFar){return $null}
    }
    if($tNear-lt.5-or$tNear-gt$maxDistance){return $null}
    return [pscustomobject]@{Distance=$tNear;NormalX=($normalLocalX*$ux)+($normalLocalY*$vx);NormalY=($normalLocalX*$uy)+($normalLocalY*$vy);Object=$data}
}

function Get-RayCircleHit($data,[double]$ox,[double]$oy,[double]$dx,[double]$dy,[double]$maxDistance) {
    $size=[double]$data.Size;$radius=$size/2.0
    $cx=[double]$data.X+$radius;$cy=[double]$data.Y+$radius;$rx=$ox-$cx;$ry=$oy-$cy
    $b=($rx*$dx)+($ry*$dy);$c=($rx*$rx)+($ry*$ry)-($radius*$radius)
    $disc=($b*$b)-$c;if($disc-lt0){return $null}
    $distance=-$b-[Math]::Sqrt($disc);if($distance-lt.5-or$distance-gt$maxDistance){return $null}
    $hx=$ox+$dx*$distance;$hy=$oy+$dy*$distance;$nx=($hx-$cx)/$radius;$ny=($hy-$cy)/$radius
    return [pscustomobject]@{Distance=$distance;NormalX=$nx;NormalY=$ny;Object=$data}
}

function Update-LaserReflection($laser) {
    if($null-eq$laser.BeamLines){return}
    foreach($line in @($laser.BeamLines)){$line.Visibility=[Windows.Visibility]::Hidden}
    foreach($line in @($laser.BeamGlowLines)){$line.Visibility=[Windows.Visibility]::Hidden}
    $laser.BeamSegments.Clear();$laser.ReflectedSegment=$null
    $screenLeft=[Windows.SystemParameters]::VirtualScreenLeft;$screenTop=[Windows.SystemParameters]::VirtualScreenTop
    $r=$laser.Angle*[Math]::PI/180;$dx=[Math]::Cos($r);$dy=[Math]::Sin($r)
    $centreX=$laser.X+150;$centreY=$laser.Y+150
    $ox=$centreX+($dx*29);$oy=$centreY+($dy*29)
    for($bounce=0;$bounce-lt$laser.BeamLines.Count;$bounce++){
        $maxDistance=Get-RayDesktopDistance $ox $oy $dx $dy
        $nearest=$null
        foreach($candidate in @($script:playroomBlocks)){
            if($candidate.Type-eq'Ladder'){continue}
            $hit=Get-RayPlacementHit $candidate $ox $oy $dx $dy $maxDistance
            if($null-ne$hit-and($null-eq$nearest-or$hit.Distance-lt$nearest.Distance)){$nearest=$hit}
        }
        foreach($candidate in @($script:playroomBalls)){
            $hit=Get-RayCircleHit $candidate $ox $oy $dx $dy $maxDistance
            if($null-ne$hit-and($null-eq$nearest-or$hit.Distance-lt$nearest.Distance)){$nearest=$hit}
        }
        foreach($candidate in @($script:playroomGadgets|Where-Object{$_-ne$laser-and$_.Kind-notin@('Rotator','Rope')-and$_.Window.IsVisible})){
            $hit=Get-RayPlacementHit $candidate $ox $oy $dx $dy $maxDistance
            if($null-ne$hit-and($null-eq$nearest-or$hit.Distance-lt$nearest.Distance)){$nearest=$hit}
        }
        $distance=$(if($null-ne$nearest){$nearest.Distance}else{$maxDistance})
        $endX=$ox+$dx*$distance;$endY=$oy+$dy*$distance
        $segment=[pscustomobject]@{X1=$ox;Y1=$oy;X2=$endX;Y2=$endY}
        $laser.BeamSegments.Add($segment)|Out-Null
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LASER_VISUAL-eq'1'-and$bounce-eq0-and-not$script:diagnosticLaserSegmentMarker){
            [Console]::Out.WriteLine("diagnostic:laser-segment x1=$($segment.X1) y1=$($segment.Y1) x2=$($segment.X2) y2=$($segment.Y2) playerX=$($script:x+$PetWidth/2) playerY=$($script:y+$PetHeight/2)")
            $script:diagnosticLaserSegmentMarker=$true
        }
        $line=$laser.BeamLines[$bounce]
        $line.X1=$ox-$screenLeft;$line.Y1=$oy-$screenTop;$line.X2=$endX-$screenLeft;$line.Y2=$endY-$screenTop
        $line.Visibility=[Windows.Visibility]::Visible
        $glow=$laser.BeamGlowLines[$bounce]
        $glow.X1=$line.X1;$glow.Y1=$line.Y1;$glow.X2=$line.X2;$glow.Y2=$line.Y2
        $glow.Opacity=.82+(.12*[Math]::Sin(($script:hazardTick+$bounce*9)*.24))
        $glow.Visibility=[Windows.Visibility]::Visible
        if($bounce-eq1){$laser.ReflectedSegment=$segment}
        $isMirror=$null-ne$nearest-and$nearest.Object.Kind-eq'Block'-and$nearest.Object.Type-eq'Mirror'
        if(-not$isMirror){break}
        $dot=($dx*$nearest.NormalX)+($dy*$nearest.NormalY)
        $dx=$dx-(2*$dot*$nearest.NormalX);$dy=$dy-(2*$dot*$nearest.NormalY)
        $ox=$endX+($dx*.75);$oy=$endY+($dy*.75)
    }
}

function Update-PlayroomHazards {
    if(-not$script:playroomActive-and-not$script:active){return}
    $script:hazardTick++
    if($env:WINDOWISP_TEST_CRUMBLE_ANIMATION-eq'1'-and$null-ne$script:crumbleTestBlock){
        $testAge=$script:hazardTick-$script:crumbleTestStartTick
        if(($testAge-ge15-and$testAge-le35)-or($testAge-ge65-and$testAge-le85)-or($testAge-ge115-and$testAge-le135)){
            $before=$script:crumbleTestBlock.Landings;Trigger-TemporaryBlock $script:crumbleTestBlock 'DiagnosticWeight'
            if($script:crumbleTestBlock.Landings-ne$before){[Console]::Out.WriteLine("diagnostic:crumble-impact count=$($script:crumbleTestBlock.Landings) tick=$testAge")}
        }
    }
    foreach($h in @($script:playroomGadgets|Where-Object{$_.Kind-in@('Spikes','FireJet','Laser')})){
        $wiredOn=Test-HazardWiredOn $h
        if($null-ne$h.Emitter){$h.Emitter.Opacity=$(if($wiredOn){1}else{.42})}
        if($null-ne$h.Element){$h.Element.Opacity=$(if($wiredOn){1}else{.42})}
        $updateHazardArtwork=$script:playroomActive-or(($script:hazardTick%2)-eq0)
        if($h.Kind-eq'FireJet'){
            # A powered Fire Blaster stays on. Timing/pulsing belongs to the Timer
            # gadget, so an unwired or manually enabled blaster must not flicker.
            $h.Active=$wiredOn
            $h.Visual.Visibility=$(if($h.Active){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden})
            if($h.Active-and$null-ne$h.FireTransform-and$updateHazardArtwork){
                $h.FireTransform.ScaleX=.94+(.08*[Math]::Sin($script:hazardTick*.71))
                $h.FireTransform.ScaleY=.91+(.12*[Math]::Sin(($script:hazardTick*.93)+.8))
                $h.Visual.Opacity=.9+(.1*[Math]::Sin($script:hazardTick*.47))
            }
        }
        if($h.Kind-eq'Laser'){
            if($wiredOn){if($updateHazardArtwork-or$h.BeamSegments.Count-eq0){Update-LaserReflection $h}}else{$h.BeamSegments.Clear();foreach($line in @($h.BeamLines)+@($h.BeamGlowLines)){$line.Visibility=[Windows.Visibility]::Hidden}}
        }
        foreach($player in @('P1','P2')){
            if($player-eq'P2'-and-not$script:twoPlayerActive){continue}
            $px=$(if($player-eq'P2'){$script:p2X}else{$script:x});$py=$(if($player-eq'P2'){$script:p2Y}else{$script:y})
            $hit=$false
            if($h.Kind-eq'Spikes'-and$wiredOn){
                $hit=Test-RotatedPlacementPoint $h ($px+$PetWidth/2) ($py+$PetHeight-8) 13
            }elseif($h.Kind-eq'FireJet'-and$h.Active){
                $hit=Test-RotatedPlacementPoint $h ($px+$PetWidth/2) ($py+$PetHeight/2) 22
            }elseif($h.Kind-eq'Laser'-and$wiredOn){
                for($segmentIndex=0;$segmentIndex-lt$h.BeamSegments.Count;$segmentIndex++){
                    $segment=$h.BeamSegments[$segmentIndex]
                    $segmentHit=Test-PointNearSegment ($px+$PetWidth/2) ($py+$PetHeight/2) $segment.X1 $segment.Y1 $segment.X2 $segment.Y2 28
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LASER_VISUAL-eq'1'-and$player-eq'P1'-and$segmentIndex-eq0-and-not$script:diagnosticLaserHitMarker){
                        [Console]::Out.WriteLine("diagnostic:laser-hit-check hit=$segmentHit hearts=$($script:hearts) ticks=$($script:invulnerableTicks)")
                        $script:diagnosticLaserHitMarker=$true
                    }
                    if($segmentHit){$hit=$true;break}
                }
            }
            if($hit){Invoke-SandboxHazardDamage $player}
        }
    }
}

function Get-SpringTopContact($spring,[double]$centreX,[double]$centreY,[double]$radius,[double]$velocityX,[double]$velocityY) {
    $r=$spring.Angle*[Math]::PI/180
    $ux=[Math]::Cos($r);$uy=[Math]::Sin($r);$vx=-[Math]::Sin($r);$vy=[Math]::Cos($r)
    $springCentreX=$spring.X+$spring.Width/2;$springCentreY=$spring.Y+$spring.Height/2
    $dx=$centreX-$springCentreX;$dy=$centreY-$springCentreY
    $localX=($dx*$ux)+($dy*$uy);$localY=($dx*$vx)+($dy*$vy)
    $normalX=-$vx;$normalY=-$vy
    $approach=($velocityX*$normalX)+($velocityY*$normalY)
    $topDistance=[Math]::Abs($localY+($spring.Height/2))
    $touchesTop=[Math]::Abs($localX)-le($spring.Width/2+$radius*.55)-and$localY-le0-and$topDistance-le($radius+10)
    if(-not$touchesTop-or$approach-gt1.5){return $null}
    return [pscustomobject]@{X=$normalX;Y=$normalY}
}

function Update-PlayroomGadgets {
    if(-not$script:playroomActive-and-not$script:active){return}
    Update-WiringSignals
    if($script:playroomActive-or($script:inputTick%2)-eq0){Update-ConveyorVisuals}
    Update-FreeRotationHandlePosition
    Update-DynamicHazards
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROTATOR-eq'1'-and-not$script:rotatorUpdateMarker){
        [Console]::Out.WriteLine("diagnostic:gadget-update count=$($script:playroomGadgets.Count) kinds=$(@($script:playroomGadgets|ForEach-Object{$_.Kind})-join',')")
        $script:rotatorUpdateMarker=$true
    }
    if($script:teleportCooldown-gt0){$script:teleportCooldown--};if($script:p2TeleportCooldown-gt0){$script:p2TeleportCooldown--}
    foreach($object in @($script:playroomBalls)){if($object.TeleportCooldown-gt0){$object.TeleportCooldown--}}
    $allPortals=@($script:playroomGadgets|Where-Object{$_.Kind-like'Teleporter*'})
    foreach($portal in $allPortals){$portalOn=Test-HazardWiredOn $portal;if($null-ne$portal.Element){$portal.Element.Opacity=$(if($portalOn){1}else{.42})}}
    $portals=@($allPortals|Where-Object{Test-HazardWiredOn $_})
    foreach($g in @($script:playroomGadgets)){
        if($g.Kind-eq'Spring'){
            $springTriggered=$false
            $p1Spring=Get-SpringTopContact $g ($script:x+$PetWidth/2) ($script:y+$PetHeight/2) ([Math]::Min($PetWidth,$PetHeight)*.38) $script:vx $script:vy
            if($null-ne$p1Spring){
                $script:vx=$p1Spring.X*24;$script:vy=$p1Spring.Y*24;$script:grounded=$false
                $springTriggered=$true
                if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_ALL-eq'1'-and-not$script:springAllP1Reported){
                    $script:springAllP1Reported=$true;[Console]::Out.WriteLine("diagnostic:spring-all target=Player1 vx=$([Math]::Round($script:vx,2)) vy=$([Math]::Round($script:vy,2))")
                }
            }
            if($script:twoPlayerActive){
                $p2Spring=Get-SpringTopContact $g ($script:p2X+$PetWidth/2) ($script:p2Y+$PetHeight/2) ([Math]::Min($PetWidth,$PetHeight)*.38) $script:p2VX $script:p2VY
                if($null-ne$p2Spring){
                    $script:p2VX=$p2Spring.X*24;$script:p2VY=$p2Spring.Y*24;$script:p2Grounded=$false
                    $springTriggered=$true
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_ALL-eq'1'-and-not$script:springAllP2Reported){
                        $script:springAllP2Reported=$true;[Console]::Out.WriteLine("diagnostic:spring-all target=Player2 vx=$([Math]::Round($script:p2VX,2)) vy=$([Math]::Round($script:p2VY,2))")
                    }
                }
            }
            foreach($o in @($script:playroomBalls)){
                if($o.CarriedBy){continue}
                $ballSpring=Get-SpringTopContact $g ($o.X+$o.Size/2) ($o.Y+$o.Size/2) ($o.Size/2) $o.VX $o.VY
                if($null-ne$ballSpring){
                    $o.VX=$ballSpring.X*19;$o.VY=$ballSpring.Y*19
                    $springTriggered=$true
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_ALL-eq'1'-and($null-eq$o.PSObject.Properties['SpringTestReported']-or-not$o.SpringTestReported)){
                        $o|Add-Member -NotePropertyName SpringTestReported -NotePropertyValue $true -Force
                        [Console]::Out.WriteLine("diagnostic:spring-all target=$($o.Kind) vx=$([Math]::Round($o.VX,2)) vy=$([Math]::Round($o.VY,2))")
                    }
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_DIRECTION-eq'1'){[Console]::Out.WriteLine("diagnostic:spring-ball-launch angle=$($g.Angle) vx=$($o.VX) vy=$($o.VY)")}
                }
            }
            foreach($hazard in @($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['IsDynamic']-and$_.IsDynamic})){
                if($null-ne$hazard.PSObject.Properties['FrozenRope']-and$null-ne$hazard.FrozenRope){continue}
                if($hazard.Dragging){continue}
                if($hazard.SpringCooldown-gt0){continue}
                $hazardCentreX=$hazard.X+$hazard.BodyOffsetX+($hazard.BodyWidth/2)
                $hazardCentreY=$hazard.Y+$hazard.BodyOffsetY+($hazard.BodyHeight/2)
                $hazardRadius=[Math]::Min($hazard.BodyWidth,$hazard.BodyHeight)*.46
                $hazardSpring=Get-SpringTopContact $g $hazardCentreX $hazardCentreY $hazardRadius $hazard.VX $hazard.VY
                if($null-ne$hazardSpring){
                    $springCentreX=$g.X+($g.Width/2);$springCentreY=$g.Y+($g.Height/2)
                    $launchCentreX=$springCentreX+($hazardSpring.X*(($g.Height/2)+$hazardRadius+2))
                    $launchCentreY=$springCentreY+($hazardSpring.Y*(($g.Height/2)+$hazardRadius+2))
                    $hazard.X=$launchCentreX-$hazard.BodyOffsetX-($hazard.BodyWidth/2)
                    $hazard.Y=$launchCentreY-$hazard.BodyOffsetY-($hazard.BodyHeight/2)
                    $hazard.VX=$hazardSpring.X*19;$hazard.VY=$hazardSpring.Y*19
                    $hazard.SpringCooldown=8
                    Set-PlacementWindowPosition $hazard
                    $springTriggered=$true
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_ALL-eq'1'-and($null-eq$hazard.PSObject.Properties['SpringTestReported']-or-not$hazard.SpringTestReported)){
                        $hazard|Add-Member -NotePropertyName SpringTestReported -NotePropertyValue $true -Force
                        [Console]::Out.WriteLine("diagnostic:spring-all target=$($hazard.Kind) vx=$([Math]::Round($hazard.VX,2)) vy=$([Math]::Round($hazard.VY,2))")
                    }
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_HAZARD-eq'1'){[Console]::Out.WriteLine("diagnostic:spring-hazard-launch kind=$($hazard.Kind) angle=$($g.Angle) vx=$($hazard.VX) vy=$($hazard.VY)")}
                }
            }
            if($springTriggered){$g.CompressionTicks=14}
            if($g.CompressionTicks-gt0-and$null-ne$g.SpringScale){
                $springPhase=(15-$g.CompressionTicks)/14.0;$springPhase=[Math]::Max(0,[Math]::Min(1,$springPhase))
                if($springPhase-lt.34){$phaseValue=$springPhase/.34;$smooth=$phaseValue*$phaseValue*(3-(2*$phaseValue));$springPress=$smooth}
                else{$phaseValue=($springPhase-.34)/.66;$smooth=$phaseValue*$phaseValue*(3-(2*$phaseValue));$springPress=1-$smooth}
                $g.SpringScale.ScaleY=1-(.18*$springPress)
                $g.SpringScale.ScaleX=1+(.055*$springPress)
                if($null-ne$g.SpringBase){$g.SpringBase.Opacity=.88+(.12*$springPress)}
                $g.CompressionTicks--
                if($g.CompressionTicks-le0){$g.SpringScale.ScaleX=1;$g.SpringScale.ScaleY=1;if($null-ne$g.SpringBase){$g.SpringBase.Opacity=1}}
            }
        }elseif($g.Kind-eq'Fan'){
            $fanOn=Test-HazardWiredOn $g
            if($null-ne$g.Art){$g.Art.Opacity=$(if($fanOn){1}else{.42})}
            Update-FanWind $g $fanOn
            if(-not$fanOn){continue}
            $r=$g.Angle*[Math]::PI/180;$fx=[Math]::Cos($r);$fy=[Math]::Sin($r)
            $originX=$g.X+($g.Width/2);$originY=$g.Y+($g.Height/2)
            $p1dx=($script:x+$PetWidth/2)-$originX;$p1dy=($script:y+$PetHeight/2)-$originY
            $forward=($p1dx*$fx)+($p1dy*$fy);$side=[Math]::Abs((-1*$p1dx*$fy)+($p1dy*$fx))
            if($forward-ge0-and$forward-le280-and$side-le85){$script:vx+=$fx*.32;$script:vy+=$fy*.32}
            if($script:twoPlayerActive){
                $p2dx=($script:p2X+$PetWidth/2)-$originX;$p2dy=($script:p2Y+$PetHeight/2)-$originY
                $forward=($p2dx*$fx)+($p2dy*$fy);$side=[Math]::Abs((-1*$p2dx*$fy)+($p2dy*$fx))
                if($forward-ge0-and$forward-le280-and$side-le85){$script:p2VX+=$fx*.32;$script:p2VY+=$fy*.32}
            }
            foreach($o in @($script:playroomBalls)){
                $odx=($o.X+$o.Size/2)-$originX;$ody=($o.Y+$o.Size/2)-$originY
                $forward=($odx*$fx)+($ody*$fy);$side=[Math]::Abs((-1*$odx*$fy)+($ody*$fx))
                if($forward-ge0-and$forward-le280-and$side-le85){$o.VX+=$fx*.24;$o.VY+=$fy*.24}
            }
            foreach($hazard in @($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['IsDynamic']-and$_.IsDynamic-and$_-ne$g})){
                if($hazard.Dragging-or($null-ne$hazard.PSObject.Properties['FrozenRope']-and$null-ne$hazard.FrozenRope)){continue}
                $hx=$hazard.X+$hazard.BodyOffsetX+($hazard.BodyWidth/2);$hy=$hazard.Y+$hazard.BodyOffsetY+($hazard.BodyHeight/2)
                $hdx=$hx-$originX;$hdy=$hy-$originY
                $forward=($hdx*$fx)+($hdy*$fy);$side=[Math]::Abs((-1*$hdx*$fy)+($hdy*$fx))
                if($forward-ge0-and$forward-le280-and$side-le85){$hazard.VX+=$fx*.24;$hazard.VY+=$fy*.24}
            }
        }elseif($g.Kind-eq'Rotator'){
            $rotatorOn=Test-HazardWiredOn $g
            if($null-ne$g.Element){$g.Element.Opacity=$(if($rotatorOn){1}else{.42})}
            if(-not$rotatorOn){continue}
            $g.SpinAngle=($g.SpinAngle+(2.8*$g.Direction*$g.RotationSpeed))%360
            if($null-ne$g.SpinTransform){$g.SpinTransform.Angle=$g.SpinAngle}
            if($null-ne$g.Target-and-not$g.Target.Window.IsVisible){$g.Target=$null}
            if($null-eq$g.Target){
                $nearest=$null;$nearestDistance=125.0;$gx=$g.X+$g.Width/2;$gy=$g.Y+$g.Height/2
                $candidateCount=0
                foreach($candidate in @($script:playroomBlocks|Where-Object{$null-eq$_.PSObject.Properties['FrozenRope']-or$null-eq$_.FrozenRope})+@($script:playroomGadgets|Where-Object{$_-ne$g-and$_.Kind-notin@('Rotator','Rope')-and($null-eq$_.PSObject.Properties['FrozenRope']-or$null-eq$_.FrozenRope)})){
                    $candidateCount++
                    $cx=$candidate.X+$candidate.Width/2;$cy=$candidate.Y+$candidate.Height/2
                    $distance=[Math]::Sqrt((($cx-$gx)*($cx-$gx))+(($cy-$gy)*($cy-$gy)))
                    if($distance-lt$nearestDistance){$nearest=$candidate;$nearestDistance=$distance}
                }
                if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and-not$g.DebugSeen){[Console]::Out.WriteLine("diagnostic:rotator-search candidates=$candidateCount nearest=$nearestDistance gx=$gx gy=$gy");$g.DebugSeen=$true}
                $g.Target=$nearest
                if($null-ne$nearest){
                    if($null-eq$nearest.PSObject.Properties['ContinuousRotation']){$nearest|Add-Member -NotePropertyName ContinuousRotation -NotePropertyValue $true}
                    else{$nearest.ContinuousRotation=$true}
                    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:rotator-linked kind=$($nearest.Kind) type=$($nearest.Type)")}
                }
            }
            if($null-ne$g.Target-and($script:inputTick%4)-eq0){
                Set-PlacementAngle $g.Target ($g.Target.Angle+(2.8*$g.Direction*$g.RotationSpeed))
                if(-not$script:playroomActive-and$env:WINDOWISP_DIAGNOSTICS-eq'1'-and-not$g.GameMarker){[Console]::Out.WriteLine("diagnostic:rotator-game-active angle=$($g.Target.Angle)");$g.GameMarker=$true}
            }
        }
    }
    Update-PlayroomRopes
    if($portals.Count-ge2){
        foreach($source in $portals){$targets=@($portals|Where-Object{$_.Kind-ne$source.Kind}|Select-Object -First 1);if($targets.Count-eq0){continue};$target=$targets[0]
            if($script:teleportCooldown-le0-and$script:x+$PetWidth-gt$source.X-and$script:x-lt$source.X+$source.Width-and$script:y+$PetHeight-gt$source.Y-and$script:y-lt$source.Y+$source.Height){$script:x=$target.X+($target.Width-$PetWidth)/2;$script:y=$target.Y-$PetHeight-4;$script:teleportCooldown=45}
            if($script:twoPlayerActive-and$script:p2TeleportCooldown-le0-and$script:p2X+$PetWidth-gt$source.X-and$script:p2X-lt$source.X+$source.Width-and$script:p2Y+$PetHeight-gt$source.Y-and$script:p2Y-lt$source.Y+$source.Height){$script:p2X=$target.X+($target.Width-$PetWidth)/2;$script:p2Y=$target.Y-$PetHeight-4;$script:p2TeleportCooldown=45}
            foreach($o in @($script:playroomBalls)){if($o.TeleportCooldown-le0-and$o.X+$o.Size-gt$source.X-and$o.X-lt$source.X+$source.Width-and$o.Y+$o.Size-gt$source.Y-and$o.Y-lt$source.Y+$source.Height){$o.X=$target.X+($target.Width-$o.Size)/2;$o.Y=$target.Y-$o.Size-4;$o.TeleportCooldown=45}}
        }
    }
}

function Clear-PlayroomObjects {
    Close-FreeRotationHandle
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output "diagnostic:sandbox-clear blocks=$($script:playroomBlocks.Count) balls=$($script:playroomBalls.Count)"}
    foreach ($blockData in @($script:playroomBlocks)) { $blockData.Window.Close() }
    foreach ($ball in @($script:playroomBalls)) { $ball.Window.Close() }
    foreach ($gadget in @($script:playroomGadgets)) {
        $gadget.Window.Close()
        if($null-ne$gadget.PSObject.Properties['BeamWindow']-and$null-ne$gadget.BeamWindow){$gadget.BeamWindow.Close()}
        if($gadget.Kind-eq'Rope'-and$null-ne$script:ropeOverlayCanvas){foreach($ropePath in @($gadget.VisualPaths)){$script:ropeOverlayCanvas.Children.Remove($ropePath)|Out-Null}}
        if($null-ne$gadget.PSObject.Properties['WindLines']-and$null-ne$script:ropeOverlayCanvas){foreach($wind in @($gadget.WindLines)){$script:ropeOverlayCanvas.Children.Remove($wind.Line)|Out-Null}}
    }
    foreach($wire in @($script:playroomWires)){$wire.Window.Close();if($null-ne$script:ropeOverlayCanvas){foreach($wirePath in @($wire.VisualPaths)){$script:ropeOverlayCanvas.Children.Remove($wirePath)|Out-Null}}}
    $script:playroomBlocks.Clear(); $script:playroomBalls.Clear();$script:playroomGadgets.Clear();$script:playroomWires.Clear()
    $script:ropeConnectFirst=$null;$script:ropeConnectSource=$null
    $script:wireConnectFirst=$null
}

function Clear-PlayroomBalls {
    foreach ($ball in @($script:playroomBalls)) { Remove-RopesForPlacement $ball; $ball.Window.Close() }
    $script:playroomBalls.Clear()
}

function Update-BallPhysicsUi {
    $percent = [Math]::Max(1,[Math]::Min(100,[Math]::Round($script:ballPhysicsValue)))
    if($null-ne$script:ballPhysicsLabel){$script:ballPhysicsLabel.Text = "BALL BOUNCE  $percent%"}
    if($null-ne$script:sandboxPhysicsLabel){$script:sandboxPhysicsLabel.Text = "BALL BOUNCE  $percent%"}
    if($null-ne$script:ballPhysicsSlider-and[math]::Abs($script:ballPhysicsSlider.Value-$script:ballPhysicsValue)-gt0.1){$script:ballPhysicsSlider.Value=$script:ballPhysicsValue}
    if($null-ne$script:sandboxPhysicsSlider-and[math]::Abs($script:sandboxPhysicsSlider.Value-$script:ballPhysicsValue)-gt0.1){$script:sandboxPhysicsSlider.Value=$script:ballPhysicsValue}
}

function Toggle-BallCarry([string]$owner) {
    $carried = @($script:playroomBalls | Where-Object { $_.CarriedBy -eq $owner } | Select-Object -First 1)
    $playerX = $(if ($owner -eq 'Player2') { $script:p2X } else { $script:x })
    $playerY = $(if ($owner -eq 'Player2') { $script:p2Y } else { $script:y })
    $playerVX = $(if ($owner -eq 'Player2') { $script:p2VX } else { $script:vx })
    $playerVY = $(if ($owner -eq 'Player2') { $script:p2VY } else { $script:vy })
    $facing = $(if ($owner -eq 'Player2') { $script:p2Facing } else { $script:facing })
    if ($facing -eq 0) { $facing = 1 }
    if ($carried.Count -gt 0) {
        $ball = $carried[0]
        $ball.CarriedBy = ''
        if($ball.Kind-eq'Bat'){$ball.BatCharging=$false;$ball.BatChargeTicks=0;$ball.SwingTicks=0}
        $ball.VX = ($facing * (9.0 + ([Math]::Abs($playerVX) * 0.65)))
        $ball.VY = -[Math]::Max(5.5, 6.5 + ([Math]::Max(0,-$playerVY) * 0.35))
        $ball.PetHitCooldown = 14
        return
    }
    $nearest = $null; $nearestDistance = 115.0
    $playerCenterX = $playerX + ($PetWidth / 2); $playerCenterY = $playerY + ($PetHeight / 2)
    foreach ($ball in @($script:playroomBalls)) {
        if($null-ne$ball.PSObject.Properties['FrozenRope']-and$null-ne$ball.FrozenRope){continue}
        if($null-ne$ball.PSObject.Properties['Dragging']-and$ball.Dragging){$ball.VX=0;$ball.VY=0;continue}
        if ($ball.CarriedBy) { continue }
        $dx = ($ball.X + $ball.Radius) - $playerCenterX
        $dy = ($ball.Y + $ball.Radius) - $playerCenterY
        $distance = [Math]::Sqrt(($dx * $dx) + ($dy * $dy))
        if ($distance -lt $nearestDistance) { $nearest = $ball; $nearestDistance = $distance }
    }
    if ($null -ne $nearest) {
        $nearest.CarriedBy = $owner; $nearest.VX = 0; $nearest.VY = 0
        if($nearest.Kind-eq'Bat'){$nearest.BatCharging=$false;$nearest.BatChargeTicks=0;$nearest.SwingTicks=0}
        $nearest.PetHitCooldown = 14
    }
}

function Get-CarriedBat([string]$owner) {
    $carriedBats=@($script:playroomBalls|Where-Object{$_.Kind-eq'Bat'-and$_.CarriedBy-eq$owner}|Select-Object -First 1)
    if($carriedBats.Count-gt0){return $carriedBats[0]}
    return $null
}

function Set-PlayroomObjectVisual($object,[double]$angle,[double]$scaleX=1.0) {
    if($null-ne$object.PSObject.Properties['VisualRotate']-and$null-ne$object.VisualRotate){
        if($null-ne$object.PSObject.Properties['VisualScale']-and$null-ne$object.VisualScale){$object.VisualScale.ScaleX=$scaleX}
        $object.VisualRotate.Angle=$angle
    }else{$object.Element.RenderTransform.Angle=$angle}
}

function Update-CarriedToyPositions {
    foreach($toy in @($script:playroomBalls|Where-Object{$_.CarriedBy})){
        $carrierX=$(if($toy.CarriedBy-eq'Player2'){$script:p2X}else{$script:x})
        $carrierY=$(if($toy.CarriedBy-eq'Player2'){$script:p2Y}else{$script:y})
        $carrierFacing=$(if($toy.CarriedBy-eq'Player2'){$script:p2Facing}else{$script:facing})
        if($carrierFacing-eq0){$carrierFacing=1}
        $heldDistance=$(if($toy.Kind-eq'Bat'){48}else{42})
        $toy.X=$carrierX+($PetWidth/2)+($carrierFacing*$heldDistance)-$toy.Radius
        $toy.Y=$carrierY+$(if($toy.Kind-eq'Bat'){15}else{22})
        $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
        $toy.X=[Math]::Max($left,[Math]::Min($left+[Windows.SystemParameters]::VirtualScreenWidth-$toy.Size,$toy.X))
        $toy.Y=[Math]::Max($top,[Math]::Min($top+[Windows.SystemParameters]::VirtualScreenHeight-$toy.Size,$toy.Y))
        $toy.Window.Left=$toy.X;$toy.Window.Top=$toy.Y
    }
}

function Hit-BallsWithBat([string]$owner,$bat) {
    $playerX=$(if($owner-eq'Player2'){$script:p2X}else{$script:x})
    $playerY=$(if($owner-eq'Player2'){$script:p2Y}else{$script:y})
    $playerVX=$(if($owner-eq'Player2'){$script:p2VX}else{$script:vx})
    $facing=$(if($owner-eq'Player2'){$script:p2Facing}else{$script:facing});if($facing-eq0){$facing=1}
    $power=[Math]::Max(0,[Math]::Min(1,$bat.SwingPower))
    $strikeX=$playerX+($PetWidth/2)+($facing*(66+(12*$power)));$strikeY=$playerY+46
    $hitRadius=94+(18*$power)
    foreach($ball in @($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'-and-not$_.CarriedBy})){
        $dx=($ball.X+$ball.Radius)-$strikeX;$dy=($ball.Y+$ball.Radius)-$strikeY
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_BAT_SWING-eq'1'){[Console]::Out.WriteLine("diagnostic:bat-contact dx=$dx dy=$dy d2=$(($dx*$dx)+($dy*$dy))")}
        if((($dx*$dx)+($dy*$dy))-le($hitRadius*$hitRadius)){
            $ball.VX=$facing*(12.0+(18*$power)+([Math]::Abs($playerVX)*.45))
            $ball.VY=-(5.5+(7*$power))
            $ball.PetHitCooldown=18
            if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:bat-hit owner=$owner vx=$($ball.VX) vy=$($ball.VY)")}
        }
    }
    $bat.SwingHitDone=$true
}

function Start-BatCharge([string]$owner) {
    $bat=Get-CarriedBat $owner
    if($null-eq$bat){return $false}
    if($bat.SwingTicks-gt0){return $true}
    $bat.BatCharging=$true;$bat.BatChargeTicks=0;$bat.SwingHitDone=$false
    return $true
}

function Update-BatCharge([string]$owner) {
    $bat=Get-CarriedBat $owner
    if($null-ne$bat-and$bat.BatCharging){$bat.BatChargeTicks=[Math]::Min(75,$bat.BatChargeTicks+1)}
}

function Release-BatSwing([string]$owner) {
    $bat=Get-CarriedBat $owner
    if($null-eq$bat-or-not$bat.BatCharging){return $false}
    $bat.BatCharging=$false;$bat.SwingPower=[Math]::Max(.08,[Math]::Min(1,$bat.BatChargeTicks/75.0))
    $bat.SwingDuration=18;$bat.SwingTicks=$bat.SwingDuration;$bat.SwingHitDone=$false
    return $true
}

function Update-PlayroomBalls {
    if (-not $script:playroomActive) { return }
    $left = [Windows.SystemParameters]::VirtualScreenLeft
    $top = [Windows.SystemParameters]::VirtualScreenTop
    $right = $left + [Windows.SystemParameters]::VirtualScreenWidth
    $floor = $top + [Windows.SystemParameters]::VirtualScreenHeight
    foreach ($ball in @($script:playroomBalls)) {
        if($null-ne$ball.PSObject.Properties['FrozenRope']-and$null-ne$ball.FrozenRope){continue}
        if($script:footballActive-and$null-ne$ball.PSObject.Properties['FootballBall']-and$ball.FootballBall-and$script:footballCountdownTicks-gt0){
            $ball.VX=0;$ball.VY=0;$ball.Window.Left=$ball.X;$ball.Window.Top=$ball.Y
            continue
        }
        $size = $ball.Size
        if ($ball.CarriedBy) {
            $carrierFacing = $(if ($ball.CarriedBy -eq 'Player2') { $script:p2Facing } else { $script:facing })
            if ($carrierFacing -eq 0) { $carrierFacing = 1 }
            $ball.VX = 0; $ball.VY = 0
            if($ball.Kind-eq'Bat'){
                if($ball.BatCharging){
                    $chargePower=[Math]::Min(1,$ball.BatChargeTicks/75.0)
                    $chargePulse=[Math]::Sin($ball.BatChargeTicks*.48)*2.2*$chargePower
                    $ball.Angle=$carrierFacing*(-18-(48*$chargePower)+$chargePulse)
                    Set-PlayroomObjectVisual $ball $ball.Angle ($carrierFacing*(1+(.07*$chargePower)))
                }elseif($ball.SwingTicks-gt0){
                    $swingProgress=($ball.SwingDuration-$ball.SwingTicks)/[double]$ball.SwingDuration
                    $ball.Angle=$carrierFacing*(-66+(142*$swingProgress))
                    if(-not$ball.SwingHitDone-and$swingProgress-ge.46){Hit-BallsWithBat $ball.CarriedBy $ball}
                    $ball.SwingTicks--
                    Set-PlayroomObjectVisual $ball $ball.Angle $carrierFacing
                }else{$ball.Angle=-12*$carrierFacing;Set-PlayroomObjectVisual $ball $ball.Angle $carrierFacing}
            }else{
                $ball.Angle = ($ball.Angle + ($carrierFacing * 1.2)) % 360
                Set-PlayroomObjectVisual $ball $ball.Angle
            }
            continue
        }
        $physics = ([Math]::Max(1,[Math]::Min(100,$ball.Physics)) - 1.0) / 99.0
        $gravity = 0.82 * [Math]::Pow(1.0 - $physics, 0.35)
        $restitution = 0.25 + (0.75 * $physics)
        $wallRestitution = 0.55 + (0.45 * $physics)
        $kickScale = 0.80 + (0.45 * $physics)
        if ($ball.PetHitCooldown -gt 0) { $ball.PetHitCooldown-- }
        $oldX = $ball.X; $oldY = $ball.Y
        $oldBottom = $ball.Y + $size
        $ball.VY = [Math]::Min(20, $ball.VY + $gravity)
        $ball.X += $ball.VX; $ball.Y += $ball.VY
        if ($ball.X -le $left) { $ball.X = $left; $ball.VX = [Math]::Abs($ball.VX) * $wallRestitution }
        if ($ball.X + $size -ge $right) { $ball.X = $right - $size; $ball.VX = -[Math]::Abs($ball.VX) * $wallRestitution }
        if ($ball.Y -le $top -and $ball.VY -lt 0) {
            $ball.Y = $top; $ball.VY = [Math]::Abs($ball.VY) * $wallRestitution
        }
        if ($ball.Y + $size -ge $floor) {
            $impact = [Math]::Abs($ball.VY)
            $ball.Y = $floor - $size
            $ball.VY = $(if (($impact * $restitution) -lt 1.0) { 0.0 } else { -$impact * $restitution })
            $ball.VX *= $(0.94 + (0.058 * $physics))
        }
        foreach ($rect in $script:platforms) {
            if ($ball.VY -ge 0 -and $ball.X + $size - 4 -gt $rect.Left -and $ball.X + 4 -lt $rect.Right -and
                $oldBottom -le ($rect.Top + 5) -and $ball.Y + $size -ge $rect.Top) {
                $impact = [Math]::Abs($ball.VY)
                $ball.Y = $rect.Top - $size
                $ball.VY = $(if (($impact * $restitution) -lt 1.0) { 0.0 } else { -$impact * $restitution })
            }
        }
        foreach ($blockData in @($script:playroomBlocks)) {
            if($blockData.Type-eq'Ladder'-or$blockData.TemporaryState-eq'Gone'){continue}
            $blockLeft = $blockData.X; $blockRight = $blockData.X + $blockData.Width
            $blockTop = $blockData.Y; $blockBottom = $blockData.Y + $blockData.Height
            $oldLeft = $oldX; $oldRight = $oldX + $size; $oldTop = $oldY
            $newLeft = $ball.X; $newRight = $ball.X + $size
            $newTop = $ball.Y; $newBottom = $ball.Y + $size
            $horizontalOverlap = $newRight - 3 -gt $blockLeft -and $newLeft + 3 -lt $blockRight
            $verticalOverlap = $newBottom - 3 -gt $blockTop -and $newTop + 3 -lt $blockBottom
            $surfaceScale = $(if ($blockData.Type -eq 'Bouncy') { 1.18 } elseif ($blockData.Type -eq 'Fire') { 0.95 } elseif ($blockData.Type -eq 'Ice') { 0.82 } else { 1.0 })
            $surfaceRestitution = [Math]::Min(1.16, $restitution * $surfaceScale)
            if([Math]::Abs($blockData.Angle)-gt.01){
                # Sweep the ball along this frame's path so fast balls cannot tunnel
                # through the narrower silhouette of an angled or rotating block.
                $targetX=$ball.X;$targetY=$ball.Y
                $travel=[Math]::Max([Math]::Abs($targetX-$oldX),[Math]::Abs($targetY-$oldY))
                $sweepSteps=[Math]::Max(1,[Math]::Min(10,[Math]::Ceiling($travel/4.0)))
                $rotatedHit=$false
                for($sweepStep=1;$sweepStep-le$sweepSteps;$sweepStep++){
                    $sweepT=$sweepStep/[double]$sweepSteps
                    $ball.X=$oldX+(($targetX-$oldX)*$sweepT)
                    $ball.Y=$oldY+(($targetY-$oldY)*$sweepT)
                    if(Resolve-BallRotatedBlock $ball $blockData $surfaceRestitution){
                        $rotatedHit=$true
                        break
                    }
                }
                if(-not$rotatedHit){$ball.X=$targetX;$ball.Y=$targetY}
                continue
            }

            if ($ball.VY -ge 0 -and $horizontalOverlap -and $oldBottom -le $blockTop + 4 -and $newBottom -ge $blockTop) {
                $ball.Y = $blockData.Y - $size
                Trigger-TemporaryBlock $blockData ("Toy:{0}" -f [Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($ball))
                $impact = [Math]::Abs($ball.VY)
                $ball.VY = $(if (($impact * $surfaceRestitution) -lt 1.0) { 0.0 } else { -$impact * $surfaceRestitution })
                if ($blockData.Type -eq 'Fire') { $ball.VY = [Math]::Min(-6.5, $ball.VY) }
                if ($blockData.Type -eq 'Ice') { $ball.VX *= 1.08 }
                if ($blockData.Type -eq 'Conveyor') { $ball.VX = [Math]::Max(-16, [Math]::Min(16, $ball.VX + ($blockData.Direction * .85))) }
            } elseif($blockData.Type-eq'Cloud'){
                # Like the player, toys only see the cloud's descending top
                # face; its underside and edges remain airy.
                continue
            } elseif ($ball.VY -lt 0 -and $horizontalOverlap -and $oldTop -ge $blockBottom - 4 -and $newTop -le $blockBottom) {
                $ball.Y = $blockBottom
                $ball.VY = [Math]::Abs($ball.VY) * $surfaceRestitution
                if ($blockData.Type -eq 'Fire') { $ball.VY = [Math]::Max(6.5, $ball.VY) }
            } elseif ($verticalOverlap -and $ball.VX -gt 0 -and $oldRight -le $blockLeft + 4 -and $newRight -ge $blockLeft) {
                $ball.X = $blockLeft - $size
                $ball.VX = -[Math]::Abs($ball.VX) * $surfaceRestitution
                if ($blockData.Type -eq 'Fire') { $ball.VX = [Math]::Min(-6.5, $ball.VX) }
            } elseif ($verticalOverlap -and $ball.VX -lt 0 -and $oldLeft -ge $blockRight - 4 -and $newLeft -le $blockRight) {
                $ball.X = $blockRight
                $ball.VX = [Math]::Abs($ball.VX) * $surfaceRestitution
                if ($blockData.Type -eq 'Fire') { $ball.VX = [Math]::Max(6.5, $ball.VX) }
            }
        }
        if ($ball.PetHitCooldown -le 0 -and
            $ball.X + $size - 2 -gt $script:x + 8 -and $ball.X + 2 -lt $script:x + $PetWidth - 8 -and
            $ball.Y + $size - 2 -gt $script:y + 8 -and $ball.Y + 2 -lt $script:y + $PetHeight - 5) {
            $direction = $(if (($ball.X + $ball.Radius) -lt ($script:x + ($PetWidth / 2))) { -1 } else { 1 })
            $ball.VX = (($script:vx * 0.85) + ($direction * 5.0)) * $kickScale
            $ball.VY = -[Math]::Max(2.4, ([Math]::Abs($script:vy) * 0.42 + 2.2) * $kickScale)
            $ball.PetHitCooldown = 12
        }
        if($script:twoPlayerActive-and$ball.PetHitCooldown-le0-and
            $ball.X+$size-2-gt$script:p2X+8-and$ball.X+2-lt$script:p2X+$PetWidth-8-and
            $ball.Y+$size-2-gt$script:p2Y+8-and$ball.Y+2-lt$script:p2Y+$PetHeight-5){
            $direction=$(if(($ball.X+$ball.Radius)-lt($script:p2X+($PetWidth/2))){-1}else{1})
            $ball.VX=(($script:p2VX*.85)+($direction*5.0))*$kickScale
            $ball.VY=-[Math]::Max(2.4,([Math]::Abs($script:p2VY)*.42+2.2)*$kickScale)
            $ball.PetHitCooldown=12
            if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:p2-ball-kick vx=$([Math]::Round($ball.VX,1)) vy=$([Math]::Round($ball.VY,1))")}
        }
        $ball.Angle = ($ball.Angle + ($ball.VX * 1.8)) % 360
        Set-PlayroomObjectVisual $ball $ball.Angle
        $ball.Window.Left = $ball.X; $ball.Window.Top = $ball.Y
    }
}

function New-SandboxSlotButton([string]$label, [string]$kind, $brush, [scriptblock]$action) {
    $button=New-Object Windows.Controls.Button
    $button.Width=82;$button.Height=70;$button.Margin=[Windows.Thickness]::new(4)
    $button.Focusable=$false;$button.IsTabStop=$false
    $button.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(38,72,99),[Windows.Media.Color]::FromRgb(24,48,72),90)
    $button.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(111,174,216))
    $button.BorderThickness=[Windows.Thickness]::new(1)
    $button.Cursor=[Windows.Input.Cursors]::Hand
    $content=New-Object Windows.Controls.StackPanel
    $content.VerticalAlignment=[Windows.VerticalAlignment]::Center
    $preview=New-ToyboxImage $(if($kind-like'Teleporter*'){'Teleporter'}else{$kind})
    if($null-ne$preview){
        $preview.Width=48;$preview.Height=36
    }elseif($kind-eq'Ball'){
        $preview=New-Object Windows.Shapes.Ellipse
        $preview.Width=32;$preview.Height=32;$preview.Fill=$brush
        $preview.Stroke=[Windows.Media.Brushes]::White;$preview.StrokeThickness=1.5
    }elseif($kind-in@('Bat','Bone','Spring','Teleporter','Fan','Rope')){
        $preview=New-Object Windows.Controls.TextBlock
        $preview.Text=$(if($kind-eq'Bat'){'🏏'}elseif($kind-eq'Bone'){'🦴'}elseif($kind-eq'Spring'){'↥'}elseif($kind-eq'Teleporter'){'◎'}elseif($kind-eq'Rope'){'〰'}else{'🌀'})
        $preview.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Emoji')
        $preview.FontSize=27;$preview.Foreground=$brush
    }else{
        $preview=New-Object Windows.Controls.Border
        $preview.Width=46;$preview.Height=22;$preview.Background=$brush
        $preview.BorderBrush=[Windows.Media.Brushes]::White;$preview.BorderThickness=[Windows.Thickness]::new(1)
        $preview.CornerRadius=[Windows.CornerRadius]::new($(if($kind-eq'Bouncy'){9}else{3}))
    }
    $preview.HorizontalAlignment=[Windows.HorizontalAlignment]::Center
    $content.Children.Add($preview)|Out-Null
    $text=New-Object Windows.Controls.TextBlock
    $text.Text=$label;$text.Foreground=[Windows.Media.Brushes]::White;$text.FontSize=10
    $text.FontWeight=[Windows.FontWeights]::SemiBold;$text.HorizontalAlignment=[Windows.HorizontalAlignment]::Center
    $text.Margin=[Windows.Thickness]::new(0,5,0,0)
    $content.Children.Add($text)|Out-Null
    $button.Content=$content;$button.Add_Click($action)
    return $button
}

function Add-SandboxMysterySlots([string]$category) {
    # Every palette deliberately keeps three unrevealed spaces. When a future
    # item replaces one, add another mystery slot so anticipation never reaches zero.
    foreach($mysteryIndex in 1..3){
        $button=New-Object Windows.Controls.Button
        $button.Width=82;$button.Height=70;$button.Margin=[Windows.Thickness]::new(4)
        $button.Tag="Mystery:$category"
        $button.Focusable=$false;$button.IsTabStop=$false;$button.Cursor=[Windows.Input.Cursors]::Arrow
        $button.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(32,48,64),[Windows.Media.Color]::FromRgb(16,29,43),90)
        $button.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(79,105,126));$button.BorderThickness=[Windows.Thickness]::new(1)
        $button.ToolTip="Unknown $category item - to be announced"
        $content=New-Object Windows.Controls.StackPanel;$content.VerticalAlignment='Center'
        $silhouette=New-Object Windows.Controls.Border;$silhouette.Width=48;$silhouette.Height=31;$silhouette.CornerRadius=[Windows.CornerRadius]::new(8)
        $silhouette.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(11,23,35));$silhouette.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(71,97,119));$silhouette.BorderThickness=[Windows.Thickness]::new(1)
        $question=New-Object Windows.Controls.TextBlock;$question.Text='???';$question.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(137,164,184));$question.FontSize=16;$question.FontWeight='Bold';$question.HorizontalAlignment='Center';$question.VerticalAlignment='Center';$silhouette.Child=$question;$silhouette.HorizontalAlignment='Center';$content.Children.Add($silhouette)|Out-Null
        $label=New-Object Windows.Controls.TextBlock;$label.Text='TBA';$label.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(154,184,205));$label.FontSize=10;$label.FontWeight='Bold';$label.HorizontalAlignment='Center';$label.Margin=[Windows.Thickness]::new(0,5,0,0);$content.Children.Add($label)|Out-Null
        $button.Content=$content;$script:sandboxTrayPanel.Children.Add($button)|Out-Null
    }
}

function Update-SandboxToolboxPosition {
    if($null-eq$script:sandboxHotbarWindow){return}
    $screenLeft=[Windows.SystemParameters]::VirtualScreenLeft
    $screenTop=[Windows.SystemParameters]::VirtualScreenTop
    $screenWidth=[Windows.SystemParameters]::VirtualScreenWidth
    $screenHeight=[Windows.SystemParameters]::VirtualScreenHeight
    if(-not$script:sandboxToolboxHasCustomPosition){
        $script:sandboxHotbarWindow.Left=$screenLeft+(($screenWidth-$script:sandboxHotbarWindow.Width)/2)
        $script:sandboxHotbarWindow.Top=$screenTop+$screenHeight-$script:sandboxHotbarWindow.Height-24
    }
    $script:sandboxTrayWindow.Left=$script:sandboxHotbarWindow.Left+(($script:sandboxHotbarWindow.Width-$script:sandboxTrayWindow.Width)/2)
    $script:sandboxTrayWindow.Top=$script:sandboxHotbarWindow.Top-$script:sandboxTrayWindow.Height-8
}

function Show-SandboxCategory([string]$category) {
    if($null-eq$script:sandboxTrayWindow){return}
    if($script:sandboxCategory-eq$category-and$script:sandboxTrayWindow.IsVisible){
        $script:sandboxTrayWindow.Hide();$script:sandboxCategory='';return
    }
    $script:sandboxCategory=$category
    $script:sandboxTrayPanel.Children.Clear()
    $twoRows=$category-in@('Blocks','Gadgets')
    $script:sandboxTrayPanel.Rows=$(if($twoRows){2}else{1})
    $script:sandboxTrayWindow.Height=$(if($twoRows){194}else{118})
    $script:sandboxTrayTitle.Text=$(if($category-eq'Blocks'){'BLOCK PALETTE'}elseif($category-eq'Toys'){'TOYBOX'}elseif($category-eq'Gadgets'){'GADGET LAB'}else{'HAZARDS'})
    if($category-eq'Blocks'){
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Normal' 'Normal' (Get-BlockBrush 'Normal') {Add-PlayroomBlock 'Normal'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Wood Platform' 'Wooden' (Get-BlockBrush 'Wooden') {Add-PlayroomBlock 'Wooden'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Bouncy' 'Bouncy' (Get-BlockBrush 'Bouncy') {Add-PlayroomBlock 'Bouncy'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Fire' 'Fire' (Get-BlockBrush 'Fire') {Add-PlayroomBlock 'Fire'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Ice' 'Ice' (Get-BlockBrush 'Ice') {Add-PlayroomBlock 'Ice'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Grass' 'Grass' (Get-BlockBrush 'Grass') {Add-PlayroomBlock 'Grass'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Mirror' 'Mirror' (Get-BlockBrush 'Mirror') {Add-PlayroomBlock 'Mirror'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Ladder' 'Ladder' (Get-BlockBrush 'Ladder') {Add-PlayroomBlock 'Ladder'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Conveyor' 'Conveyor' (Get-BlockBrush 'Conveyor') {Add-PlayroomBlock 'Conveyor'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Cloud' 'Cloud' (Get-BlockBrush 'Cloud') {Add-PlayroomBlock 'Cloud'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Crumbling' 'Crumbling' (Get-BlockBrush 'Crumbling') {Add-PlayroomBlock 'Crumbling'}))|Out-Null
    }elseif($category-eq'Toys'){
        $ballBrush=New-Object Windows.Media.LinearGradientBrush
        $ballBrush.StartPoint=[Windows.Point]::new(0,0);$ballBrush.EndPoint=[Windows.Point]::new(1,1)
        $ballBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(220,53,62),0.0)))
        $ballBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(42,105,207),0.52)))
        $ballBrush.GradientStops.Add((New-Object Windows.Media.GradientStop ([Windows.Media.Color]::FromRgb(220,53,62),1.0)))
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Ball' 'Ball' $ballBrush {Add-PlayroomBall}))|Out-Null
        $wood=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(225,163,74))
        $cream=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(244,235,210))
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Baseball Bat' 'Bat' $wood {Add-PlayroomToy 'Bat'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Toy Bone' 'Bone' $cream {Add-PlayroomToy 'Bone'}))|Out-Null
    }elseif($category-eq'Gadgets'){
        $green=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(112,221,153))
        $blue=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(105,184,239))
        $violet=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(184,132,246))
        $purple=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(210,137,241))
        $switchBlue=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(70,134,205))
        $buttonRed=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(218,74,91))
        $plateGold=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(222,170,54))
        $timerPurple=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(145,87,208))
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Spring' 'Spring' $green {Add-PlayroomGadget 'Spring'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Teleporter' 'Teleporter' $violet {Add-PlayroomGadget 'Teleporter'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Fan' 'Fan' $blue {Add-PlayroomGadget 'Fan'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Rotator' 'Rotator' $purple {Add-PlayroomGadget 'Rotator'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Switch' 'Switch' $switchBlue {Add-PlayroomGadget 'Switch'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Button' 'Button' $buttonRed {Add-PlayroomGadget 'Button'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Plate' 'PressurePlate' $plateGold {Add-PlayroomGadget 'PressurePlate'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Timer' 'Timer' $timerPurple {Add-PlayroomGadget 'Timer'}))|Out-Null
    }else{
        $steel=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(186,196,213))
        $orange=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(245,100,36))
        $red=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(244,50,75))
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Spikes' 'Spikes' $steel {Add-PlayroomHazard 'Spikes'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Fire Jet' 'FireJet' $orange {Add-PlayroomHazard 'FireJet'}))|Out-Null
        $script:sandboxTrayPanel.Children.Add((New-SandboxSlotButton 'Laser' 'Laser' $red {Add-PlayroomHazard 'Laser'}))|Out-Null
    }
    Add-SandboxMysterySlots $category
    Update-SandboxToolboxPosition
    if(-not$script:sandboxTrayWindow.IsVisible){$script:sandboxTrayWindow.Show()}
    Set-OverlayClickThroughState $script:sandboxTrayWindow $false
    $script:sandboxTrayWindow.Topmost=$true
    $script:sandboxTrayWindow.Activate()|Out-Null
}

function Set-SandboxToolboxVisible([bool]$visible) {
    if($null-eq$script:sandboxHotbarWindow){return}
    if($visible){
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output 'diagnostic:builder-show'}
        Update-SandboxToolboxPosition
        if(-not$script:sandboxHotbarWindow.IsVisible){$script:sandboxHotbarWindow.Show()}
        Set-OverlayClickThroughState $script:sandboxHotbarWindow $false
        $script:sandboxHotbarWindow.Topmost=$true
        $script:sandboxHotbarWindow.Activate()|Out-Null
        if($script:gridSnapEnabled){New-GridOverlay;if(-not$script:gridOverlayWindow.IsVisible){$script:gridOverlayWindow.Show();Set-OverlayClickThroughState $script:gridOverlayWindow $true}}
    }else{
        Set-EraserMode $false
        Set-RopeToolMode $false;Set-WiringMode $false
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output 'diagnostic:builder-hide'}
        if($null-ne$script:gridOverlayWindow){$script:gridOverlayWindow.Hide()}
        $script:sandboxTrayWindow.Hide();$script:sandboxHotbarWindow.Hide();$script:sandboxCategory=''
    }
}

function New-SandboxToolbox {
    if($null-ne$script:sandboxHotbarWindow){return}
    $script:sandboxHotbarWindow=New-Object Windows.Window
    $script:sandboxHotbarWindow.Title='Windowisp Builder Hotbar'
    $availableHotbarWidth=[Math]::Max(360,[Windows.SystemParameters]::VirtualScreenWidth-24)
    $script:sandboxHotbarWindow.Width=[Math]::Min(854,$availableHotbarWidth);$script:sandboxHotbarWindow.Height=58
    $script:sandboxHotbarWindow.WindowStyle=[Windows.WindowStyle]::None
    $script:sandboxHotbarWindow.AllowsTransparency=$true
    $script:sandboxHotbarWindow.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(28,65,94),[Windows.Media.Color]::FromRgb(15,33,53),90)
    $script:sandboxHotbarWindow.Topmost=$true;$script:sandboxHotbarWindow.ShowInTaskbar=$false
    $script:sandboxHotbarWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $hotbarRoot=New-Object Windows.Controls.DockPanel
    $hotbarGrip=New-Object Windows.Controls.Border
    $hotbarGrip.Width=12;$hotbarGrip.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(78,139,177))
    $hotbarGrip.CornerRadius=[Windows.CornerRadius]::new(8,0,0,8);$hotbarGrip.Cursor=[Windows.Input.Cursors]::SizeAll
    $hotbarGripText=New-Object Windows.Controls.TextBlock
    $hotbarGripText.Text=[string][char]0x22EE;$hotbarGripText.Foreground=[Windows.Media.Brushes]::White
    $hotbarGripText.FontSize=18;$hotbarGripText.Opacity=.65
    $hotbarGripText.HorizontalAlignment='Center';$hotbarGripText.VerticalAlignment='Center'
    $hotbarGrip.Child=$hotbarGripText
    $hotbarGrip.Add_MouseLeftButtonDown({
        $script:sandboxHotbarWindow.DragMove();$script:sandboxToolboxHasCustomPosition=$true
        if($null-ne$script:sandboxTrayWindow){
            $script:sandboxTrayWindow.Left=$script:sandboxHotbarWindow.Left+(($script:sandboxHotbarWindow.Width-$script:sandboxTrayWindow.Width)/2)
            $script:sandboxTrayWindow.Top=$script:sandboxHotbarWindow.Top-$script:sandboxTrayWindow.Height-8
        }
    })
    [Windows.Controls.DockPanel]::SetDock($hotbarGrip,[Windows.Controls.Dock]::Left);$hotbarRoot.Children.Add($hotbarGrip)|Out-Null
    $bar=New-Object Windows.Controls.StackPanel;$bar.Orientation=[Windows.Controls.Orientation]::Horizontal
    $bar.HorizontalAlignment=[Windows.HorizontalAlignment]::Center;$bar.VerticalAlignment=[Windows.VerticalAlignment]::Center
    $blocks=New-MenuButton 'Blocks' {Show-SandboxCategory 'Blocks'} ''
    $blocks.Width=94;$blocks.Margin=[Windows.Thickness]::new(3);$blocks.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(83,158,91),[Windows.Media.Color]::FromRgb(37,91,58),90);$blocks.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(139,211,137))
    $toys=New-MenuButton 'Toys' {Show-SandboxCategory 'Toys'} ''
    $toys.Width=86;$toys.Margin=[Windows.Thickness]::new(3);$toys.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(218,156,59),[Windows.Media.Color]::FromRgb(130,78,29),90);$toys.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,208,116))
    $gadgets=New-MenuButton 'Gadgets' {Show-SandboxCategory 'Gadgets'} ''
    $gadgets.Width=100;$gadgets.Margin=[Windows.Thickness]::new(3);$gadgets.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(94,111,196),[Windows.Media.Color]::FromRgb(54,61,125),90);$gadgets.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(159,174,244))
    $hazards=New-MenuButton 'Hazards' {Show-SandboxCategory 'Hazards'} ''
    $hazards.Width=100;$hazards.Margin=[Windows.Thickness]::new(3);$hazards.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(191,67,79),[Windows.Media.Color]::FromRgb(108,34,52),90);$hazards.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(246,135,143))
    $script:eraserButton=New-Object Windows.Controls.Button
    $script:eraserButton.Width=48;$script:eraserButton.Height=40;$script:eraserButton.Margin=[Windows.Thickness]::new(3)
    $script:eraserButton.Focusable=$false;$script:eraserButton.IsTabStop=$false
    $script:eraserButton.Cursor=[Windows.Input.Cursors]::Hand
    $script:eraserButton.BorderThickness=[Windows.Thickness]::new(1)
    $eraserCanvas=New-Object Windows.Controls.Canvas;$eraserCanvas.Width=28;$eraserCanvas.Height=24
    $eraserBody=New-Object Windows.Controls.Border;$eraserBody.Width=22;$eraserBody.Height=12
    $eraserBody.CornerRadius=[Windows.CornerRadius]::new(2)
    $eraserBody.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,126,151),[Windows.Media.Color]::FromRgb(106,187,230),0)
    $eraserBody.BorderBrush=[Windows.Media.Brushes]::White;$eraserBody.BorderThickness=[Windows.Thickness]::new(1.5)
    $eraserBody.RenderTransformOrigin=[Windows.Point]::new(.5,.5);$eraserBody.RenderTransform=[Windows.Media.RotateTransform]::new(-32)
    [Windows.Controls.Canvas]::SetLeft($eraserBody,3);[Windows.Controls.Canvas]::SetTop($eraserBody,6)
    $eraserCanvas.Children.Add($eraserBody)|Out-Null
    $script:eraserButton.Content=$eraserCanvas
    $script:eraserButton.Add_Click({Toggle-EraserMode})
    Update-EraserButtonVisual
    $script:gridButton=New-Object Windows.Controls.Button
    $script:gridButton.Width=48;$script:gridButton.Height=40;$script:gridButton.Margin=[Windows.Thickness]::new(3)
    $script:gridButton.Focusable=$false;$script:gridButton.IsTabStop=$false;$script:gridButton.Cursor=[Windows.Input.Cursors]::Hand
    $script:gridButton.BorderThickness=[Windows.Thickness]::new(1);$script:gridButton.Add_Click({Toggle-GridSnap})
    $gridIcon=New-Object Windows.Controls.Canvas;$gridIcon.Width=26;$gridIcon.Height=26
    $gridBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(126,225,242))
    foreach($offset in @(2.0,9.0,16.0,23.0)){
        $vertical=New-Object Windows.Shapes.Line;$vertical.X1=$offset;$vertical.X2=$offset;$vertical.Y1=2;$vertical.Y2=24;$vertical.Stroke=$gridBrush;$vertical.StrokeThickness=1.5;$gridIcon.Children.Add($vertical)|Out-Null
        $horizontal=New-Object Windows.Shapes.Line;$horizontal.X1=2;$horizontal.X2=24;$horizontal.Y1=$offset;$horizontal.Y2=$offset;$horizontal.Stroke=$gridBrush;$horizontal.StrokeThickness=1.5;$gridIcon.Children.Add($horizontal)|Out-Null
    }
    $script:gridButton.Content=$gridIcon;Update-GridButtonVisual
    $script:ropeToolButton=New-Object Windows.Controls.Button;$script:ropeToolButton.Width=48;$script:ropeToolButton.Height=40;$script:ropeToolButton.Margin=[Windows.Thickness]::new(3);$script:ropeToolButton.Focusable=$false;$script:ropeToolButton.Cursor=[Windows.Input.Cursors]::Hand;$script:ropeToolButton.ToolTip='Rope Tool';$script:ropeToolButton.Add_Click({Set-RopeToolMode (-not$script:ropeToolMode)})
    $ropeIcon=New-Object Windows.Controls.Canvas;$ropeIcon.Width=30;$ropeIcon.Height=26
    $ropeShadow=New-Object Windows.Shapes.Path;$ropeShadow.Data=[Windows.Media.Geometry]::Parse('M4,19 C1,10 8,3 15,8 C23,14 13,24 7,18 C2,12 17,5 24,12 C28,17 24,22 20,22');$ropeShadow.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(77,42,22));$ropeShadow.StrokeThickness=6;$ropeShadow.StrokeStartLineCap='Round';$ropeShadow.StrokeEndLineCap='Round'
    $ropeLine=New-Object Windows.Shapes.Path;$ropeLine.Data=$ropeShadow.Data;$ropeLine.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(231,169,77));$ropeLine.StrokeThickness=3;$ropeLine.StrokeStartLineCap='Round';$ropeLine.StrokeEndLineCap='Round';$ropeIcon.Children.Add($ropeShadow)|Out-Null;$ropeIcon.Children.Add($ropeLine)|Out-Null;$script:ropeToolButton.Content=$ropeIcon
    $script:wiringButton=New-Object Windows.Controls.Button;$script:wiringButton.Width=48;$script:wiringButton.Height=40;$script:wiringButton.Margin=[Windows.Thickness]::new(3);$script:wiringButton.Focusable=$false;$script:wiringButton.Cursor=[Windows.Input.Cursors]::Hand;$script:wiringButton.ToolTip='Wiring Tool';$script:wiringButton.Add_Click({Set-WiringMode (-not$script:wiringMode)})
    $wireIcon=New-Object Windows.Controls.Canvas;$wireIcon.Width=30;$wireIcon.Height=26
    foreach($ringSize in @(20,14,8)){$ring=New-Object Windows.Shapes.Ellipse;$ring.Width=$ringSize;$ring.Height=$ringSize;$ring.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,70,87));$ring.StrokeThickness=2.5;[Windows.Controls.Canvas]::SetLeft($ring,3+((20-$ringSize)/2));[Windows.Controls.Canvas]::SetTop($ring,3+((20-$ringSize)/2));$wireIcon.Children.Add($ring)|Out-Null}
    $wireTail=New-Object Windows.Shapes.Path;$wireTail.Data=[Windows.Media.Geometry]::Parse('M22,13 C27,13 25,23 29,23');$wireTail.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,205,65));$wireTail.StrokeThickness=3;$wireTail.StrokeStartLineCap='Round';$wireTail.StrokeEndLineCap='Round';$wireIcon.Children.Add($wireTail)|Out-Null;$script:wiringButton.Content=$wireIcon
    Update-ConnectionToolVisuals
    $clear=New-MenuButton 'Clear All' {Clear-PlayroomObjects} ''
    $clear.Width=100;$clear.Margin=[Windows.Thickness]::new(3)
    $close=New-MenuButton 'Hide' {Set-SandboxToolboxVisible $false} ''
    $close.Width=82;$close.Margin=[Windows.Thickness]::new(3)
    $bar.Children.Add($blocks)|Out-Null;$bar.Children.Add($toys)|Out-Null;$bar.Children.Add($gadgets)|Out-Null;$bar.Children.Add($hazards)|Out-Null
    $bar.Children.Add($script:ropeToolButton)|Out-Null;$bar.Children.Add($script:wiringButton)|Out-Null;$bar.Children.Add($script:eraserButton)|Out-Null;$bar.Children.Add($script:gridButton)|Out-Null
    $bar.Children.Add($clear)|Out-Null;$bar.Children.Add($close)|Out-Null
    $hotbarScroll=New-Object Windows.Controls.ScrollViewer
    $hotbarScroll.HorizontalScrollBarVisibility=[Windows.Controls.ScrollBarVisibility]::Auto;$hotbarScroll.VerticalScrollBarVisibility=[Windows.Controls.ScrollBarVisibility]::Disabled
    $hotbarScroll.PanningMode=[Windows.Controls.PanningMode]::HorizontalOnly;$hotbarScroll.Content=$bar
    $hotbarRoot.Children.Add($hotbarScroll)|Out-Null
    $script:sandboxHotbarWindow.Content=$hotbarRoot

    $script:sandboxTrayWindow=New-Object Windows.Window
    $script:sandboxTrayWindow.Title='Windowisp Builder Tray'
    $script:sandboxTrayWindow.Width=790;$script:sandboxTrayWindow.Height=118
    $script:sandboxTrayWindow.WindowStyle=[Windows.WindowStyle]::None
    $script:sandboxTrayWindow.AllowsTransparency=$true
    $script:sandboxTrayWindow.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(30,62,88),[Windows.Media.Color]::FromRgb(17,36,56),90)
    $script:sandboxTrayWindow.Topmost=$true;$script:sandboxTrayWindow.ShowInTaskbar=$false
    $script:sandboxTrayWindow.ResizeMode=[Windows.ResizeMode]::NoResize
    $trayRoot=New-Object Windows.Controls.DockPanel
    $script:sandboxTrayTitle=New-Object Windows.Controls.TextBlock
    $script:sandboxTrayTitle.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(190,229,250))
    $script:sandboxTrayTitle.FontSize=11;$script:sandboxTrayTitle.FontWeight=[Windows.FontWeights]::Bold
    $script:sandboxTrayTitle.Margin=[Windows.Thickness]::new(12,7,0,2)
    [Windows.Controls.DockPanel]::SetDock($script:sandboxTrayTitle,[Windows.Controls.Dock]::Top)
    $trayRoot.Children.Add($script:sandboxTrayTitle)|Out-Null
    $script:sandboxTrayPanel=New-Object Windows.Controls.Primitives.UniformGrid
    $script:sandboxTrayPanel.Rows=1;$script:sandboxTrayPanel.HorizontalAlignment=[Windows.HorizontalAlignment]::Stretch
    $trayRoot.Children.Add($script:sandboxTrayPanel)|Out-Null
    $script:sandboxTrayWindow.Content=$trayRoot
    Update-SandboxToolboxPosition
}

function Start-Playroom {
    if ($script:playroomActive) { return }
    $script:playroomActive = $true
    Set-WireEditingVisible $true
    Set-RopeEditingVisible $true
    if($null-eq$script:sandboxHotbarWindow){New-SandboxToolbox}
    Set-SandboxToolboxVisible $false
    foreach ($blockData in @($script:playroomBlocks)) { Set-BlockGameplayVisual $blockData $false }
    foreach($placement in @($script:playroomGadgets)){
        if($placement.Kind-in@('Rotator','Rope')){$placement.Window.Show()}
        Set-OverlayClickThroughState $placement.Window $false
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:desktop-play-start' }
    foreach ($shot in @($script:projectiles)) { Remove-SharedGameplayElement $shot.Element }
    $script:projectiles.Clear(); Remove-AllEnemies; Remove-Star $false; Remove-Shield; Remove-ShieldPickup
    $script:enemySpawnTicks = 999999; $script:starSpawnTicks = 999999; $script:shieldPickupSpawnTicks = 999999
    Set-GameMode $true
    # Re-entering Sandbox must preserve the user's build without duplicating
    # the starter platform on every round trip through another game mode.
    if($script:playroomBlocks.Count-eq0){Add-PlayroomBlock 'Normal'}
    if($script:playroomBalls.Count-eq0){Add-PlayroomBall}
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_P2_PET_SWITCH-eq'1'){
        Set-TwoPlayerMode $true
        $p1Before=$script:activePetId
        $p2Choice=@(Get-PersonalPetCatalog|Where-Object{$_.Id-ne$script:activePetId}|Select-Object -First 1)
        if($p2Choice.Count-gt0){$p2SwitchResult=Select-PetForPlayer $p2Choice[0] 'P2'}else{$p2SwitchResult=$false}
        [Console]::Out.WriteLine("diagnostic:p2-direct-switch result=$p2SwitchResult p1=$($script:activePetId) p1Before=$p1Before p2=$($script:p2PetId) p2Name=$($script:p2PetName)")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ERASER-eq'1'){
        $eraserBefore=$script:playroomBlocks.Count
        Set-EraserMode $true
        $eraserTarget=@($script:playroomBlocks|Select-Object -First 1)
        if($eraserTarget.Count-gt0){Remove-PlayroomPlacement $eraserTarget[0]}
        Invoke-ExitControl
        Invoke-ExitControl
        [Console]::Out.WriteLine("diagnostic:eraser active=$($script:eraserMode) gameActive=$($script:active) exitGuard=$($script:eraserExitGuardTicks) before=$eraserBefore after=$($script:playroomBlocks.Count) button=$($null-ne$script:eraserButton)")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LADDER-eq'1'){
        Add-PlayroomBlock 'Ladder'
        $testLadder=@($script:playroomBlocks|Where-Object{$_.Type-eq'Ladder'}|Select-Object -Last 1)[0]
        if($null-ne$testLadder){
            $testLadder.X=$script:x+($PetWidth/2)-($testLadder.Width/2)
            $testLadder.Y=$script:y+($PetHeight/2)-($testLadder.Height/2)
            Set-PlacementWindowPosition $testLadder
            Set-PlacementAngle $testLadder 28
            $testContact=Get-LadderContact $script:x $script:y
            if($null-ne$testContact){
                [Console]::Out.WriteLine("diagnostic:ladder-contact found=True angle=$($testLadder.Angle) upX=$($testContact.UpX) upY=$($testContact.UpY)")
                $testSolid=[pscustomobject]@{Type='Normal';X=$testLadder.X;Y=$testLadder.Y;Width=$testLadder.Width;Height=$testLadder.Height}
                $testOneWay=[pscustomobject]@{Type='Wooden';X=$testLadder.X;Y=$testLadder.Y;Width=$testLadder.Width;Height=$testLadder.Height}
                $solidPass=Test-LadderBlockPassThrough $testContact $testSolid
                $oneWayPass=Test-LadderBlockPassThrough $testContact $testOneWay
                [Console]::Out.WriteLine("diagnostic:ladder-block-pass solid=$solidPass oneWay=$oneWayPass")
            }
            else{[Console]::Out.WriteLine("diagnostic:ladder-contact found=False angle=$($testLadder.Angle)")}
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE-eq'1'){
        $testRopeBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        $testRopeBall=@($script:playroomBalls|Select-Object -First 1)[0]
        if($null-ne$testRopeBlock-and$null-ne$testRopeBall){
            Add-PlayroomGadget 'RopeCoil'
            $testRopeCoil=@($script:playroomGadgets|Where-Object{$_.Kind-eq'RopeCoil'}|Select-Object -Last 1)[0]
            Arm-RopePlacement $testRopeCoil
            Connect-RopeEndpoint $testRopeBlock
            Connect-RopeEndpoint $testRopeBall
            $testRope=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}|Select-Object -Last 1)[0]
            $testRope.Length=140
            $testRopeBall.X=$testRopeBlock.X+300;$testRopeBall.Y=$testRopeBlock.Y+160
            $testRopeBall.VX=3;$testRopeBall.VY=4
            [Console]::Out.WriteLine('diagnostic:rope-test-started')
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE_UNATTACH-eq'1'){
        $testUnattachBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        $testUnattachBall=@($script:playroomBalls|Select-Object -First 1)[0]
        if($null-ne$testUnattachBlock-and$null-ne$testUnattachBall){
            New-PlayroomRope $testUnattachBlock $testUnattachBall
            $testUnattachRope=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}|Select-Object -Last 1)[0]
            Unattach-PlayroomRope $testUnattachRope
            [Console]::Out.WriteLine("diagnostic:rope-unattached ropes=$(@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}).Count) coils=$(@($script:playroomGadgets|Where-Object{$_.Kind-eq'RopeCoil'}).Count)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE_STRETCH-eq'1'){
        $testStretchBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        $testStretchBall=@($script:playroomBalls|Select-Object -First 1)[0]
        if($null-ne$testStretchBlock-and$null-ne$testStretchBall){
            New-PlayroomRope $testStretchBlock $testStretchBall
            $testStretchRope=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}|Select-Object -Last 1)[0]
            $oldLength=$testStretchRope.Length
            $testStretchRope.DragStartLength=$oldLength
            $testStretchRope.DragStartX=$testStretchRope.Window.Left+13
            $testStretchRope.DragStartY=$testStretchRope.Window.Top+13
            $testStretchRope.Dragging=$true
            $testStretchRope.Window.Left+=110;$testStretchRope.Window.Top+=170
            Set-RopeLengthFromHandle $testStretchRope
            $testStretchRope.Dragging=$false
            Update-OnePlayroomRope $testStretchRope $true
            $longLength=$testStretchRope.Length
            $testStretchRope.DragStartLength=$longLength
            $testStretchRope.DragStartX=$testStretchRope.Window.Left+13
            $testStretchRope.DragStartY=$testStretchRope.Window.Top+13
            $testStretchRope.Dragging=$true
            $testStretchRope.Window.Top-=260
            Set-RopeLengthFromHandle $testStretchRope
            $testStretchRope.Dragging=$false
            Update-OnePlayroomRope $testStretchRope $true
            [Console]::Out.WriteLine("diagnostic:rope-resized old=$oldLength longer=$longLength shorter=$($testStretchRope.Length)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_HAZARD_GRAVITY-eq'1'){
        Add-PlayroomHazard 'Laser';Add-PlayroomHazard 'FireJet';Add-PlayroomHazard 'Spikes'
        $testGravityBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        $testGravityHazards=@($script:playroomGadgets|Where-Object{$_.Kind-in@('Laser','FireJet','Spikes')})
        if($null-ne$testGravityBlock){
            foreach($testGravityHazard in $testGravityHazards){New-PlayroomRope $testGravityBlock $testGravityHazard 190}
            [Console]::Out.WriteLine("diagnostic:hazard-ropes-created count=$($testGravityHazards.Count)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_CONVEYOR_HAZARD-eq'1'){
        Add-PlayroomBlock 'Conveyor';Add-PlayroomHazard 'FireJet'
        $testConveyor=@($script:playroomBlocks|Where-Object{$_.Type-eq'Conveyor'}|Select-Object -Last 1)[0]
        $testConveyorHazard=@($script:playroomGadgets|Where-Object{$_.Kind-eq'FireJet'}|Select-Object -Last 1)[0]
        $testLeft=[Windows.SystemParameters]::VirtualScreenLeft;$testTop=[Windows.SystemParameters]::VirtualScreenTop
        $testConveyor.X=$testLeft+100;$testConveyor.Y=$testTop+350;$testConveyor.Width=300;Set-PlacementAngle $testConveyor 0
        $testConveyorHazard.X=$testConveyor.X+40;$testConveyorHazard.Y=$testConveyor.Y-$testConveyorHazard.BodyOffsetY-$testConveyorHazard.BodyHeight
        $testConveyorHazard.VX=7;$testConveyorHazard.VY=0;Set-PlacementWindowPosition $testConveyorHazard
        [Console]::Out.WriteLine('diagnostic:conveyor-hazard-started')
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_WIRING-eq'1'){
        foreach($kind in @('Switch','Button','PressurePlate','Timer')){Add-PlayroomGadget $kind}
        Add-PlayroomGadget 'Fan'
        foreach($kind in @('Spikes','FireJet','Laser')){Add-PlayroomHazard $kind}
        $testInputs=@($script:playroomGadgets|Where-Object{$_.Kind-in@('Switch','Button','PressurePlate','Timer')})
        $testFan=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Fan'}|Select-Object -Last 1)[0]
        $testHazards=@($script:playroomGadgets|Where-Object{$_.Kind-in@('Spikes','FireJet','Laser')})
        Update-PlayroomHazards;Update-PlayroomGadgets
        $testFire=@($testHazards|Where-Object{$_.Kind-eq'FireJet'})[0];$testLaser=@($testHazards|Where-Object{$_.Kind-eq'Laser'})[0]
        [Console]::Out.WriteLine("diagnostic:wiring-defaults spike=$(Test-HazardWiredOn $testHazards[0]) fire=$(Test-HazardWiredOn $testFire) laser=$(Test-HazardWiredOn $testLaser) fan=$(Test-HazardWiredOn $testFan) fireOpacity=$($testFire.Element.Opacity) laserOpacity=$($testLaser.Element.Opacity) fanOpacity=$($testFan.Art.Opacity)")
        $testInputs[0].SignalOn=$true;$testInputs[1].PulseTicks=30
        New-PlayroomWire $testInputs[0] $testHazards[0];New-PlayroomWire $testInputs[1] $testHazards[1];New-PlayroomWire $testInputs[3] $testHazards[2];New-PlayroomWire $testInputs[0] $testFan
        Set-WireChannel $script:playroomWires[0] 5
        Update-WiringSignals
        [Console]::Out.WriteLine("diagnostic:wiring wires=$($script:playroomWires.Count) spike=$(Test-HazardWiredOn $testHazards[0]) fire=$(Test-HazardWiredOn $testHazards[1]) laser=$(Test-HazardWiredOn $testHazards[2]) fan=$(Test-HazardWiredOn $testFan) channels=$(@($script:playroomWires|ForEach-Object{$_.Channel})-join',')")
        $testInputs[0].SignalOn=$false;$testInputs[1].PulseTicks=0;Update-WiringSignals
        [Console]::Out.WriteLine("diagnostic:wiring-off spike=$(Test-HazardWiredOn $testHazards[0]) fire=$(Test-HazardWiredOn $testHazards[1])")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ROPE_BLOCK_COLLISION-eq'1'){
        $testAnchor=@($script:playroomBlocks|Select-Object -First 1)[0]
        $testRoutedBall=@($script:playroomBalls|Select-Object -First 1)[0]
        Add-PlayroomBlock 'Normal'
        $testObstacle=@($script:playroomBlocks|Select-Object -Last 1)[0]
        if($null-ne$testAnchor-and$null-ne$testRoutedBall-and$null-ne$testObstacle){
            $testLeft=[Windows.SystemParameters]::VirtualScreenLeft;$testTop=[Windows.SystemParameters]::VirtualScreenTop
            $testAnchor.X=$testLeft+220;$testAnchor.Y=$testTop+180;Set-PlacementWindowPosition $testAnchor
            $testObstacle.X=$testLeft+400;$testObstacle.Y=$testTop+300;Set-PlacementAngle $testObstacle 25;Set-PlacementWindowPosition $testObstacle
            $testRoutedBall.X=$testLeft+600;$testRoutedBall.Y=$testTop+220;$testRoutedBall.VX=0;$testRoutedBall.VY=0;Set-PlacementWindowPosition $testRoutedBall
            New-PlayroomRope $testAnchor $testRoutedBall 460
            [Console]::Out.WriteLine('diagnostic:rope-block-test-started')
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_FREE_ROTATE-eq'1'){
        $testFreeRotate=@($script:playroomBlocks|Select-Object -First 1)[0]
        if($null-ne$testFreeRotate){
            Show-FreeRotationHandle $testFreeRotate
            Set-PlacementAngle $testFreeRotate 37.4
            [Console]::Out.WriteLine("diagnostic:free-rotate angle=$($testFreeRotate.Angle) handleVisible=$($script:activeRotationHandleWindow.IsVisible)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_FROZEN_ROPE-eq'1'){
        Add-PlayroomBlock 'Ice'
        $testIce=@($script:playroomBlocks|Where-Object{$_.Type-eq'Ice'}|Select-Object -Last 1)[0]
        $testFrozenBall=@($script:playroomBalls|Select-Object -First 1)[0]
        if($null-ne$testIce-and$null-ne$testFrozenBall){
            $testFrozenLeft=[Windows.SystemParameters]::VirtualScreenLeft;$testFrozenTop=[Windows.SystemParameters]::VirtualScreenTop
            $testIce.X=$testFrozenLeft+420;$testIce.Y=$testFrozenTop+360;Set-PlacementWindowPosition $testIce
            $testFrozenBall.X=$testFrozenLeft+680;$testFrozenBall.Y=$testFrozenTop+360;Set-PlacementWindowPosition $testFrozenBall
            New-PlayroomRope $testIce $testFrozenBall
            $testFrozenRope=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}|Select-Object -Last 1)[0]
            $beforeFrozenX=$testFrozenBall.X;$beforeFrozenY=$testFrozenBall.Y
            $physicsOwned=$null-ne$testFrozenBall.PSObject.Properties['FrozenRope']-and$testFrozenBall.FrozenRope-eq$testFrozenRope
            $initialFrozenRadius=$testFrozenRope.FrozenRadius
            $testFrozenRope.DragStartLength=$testFrozenRope.Length
            $testFrozenRope.DragStartFrozenRadius=$initialFrozenRadius
            $testFrozenRope.DragStartX=$testFrozenRope.Window.Left+13;$testFrozenRope.DragStartY=$testFrozenRope.Window.Top+13
            $testFrozenRope.Dragging=$true;$testFrozenRope.Window.Top-=55
            Set-RopeLengthFromHandle $testFrozenRope
            $testFrozenRope.Dragging=$false;Update-OnePlayroomRope $testFrozenRope $true
            $resizedFrozenRadius=$testFrozenRope.FrozenRadius
            Set-PlacementAngle $testIce 90
            Update-FrozenRope $testFrozenRope
            [Console]::Out.WriteLine("diagnostic:frozen-rope frozen=$($testFrozenRope.Frozen) physicsOwned=$physicsOwned initialRadius=$initialFrozenRadius resizedRadius=$resizedFrozenRadius beforeX=$beforeFrozenX beforeY=$beforeFrozenY afterX=$($testFrozenBall.X) afterY=$($testFrozenBall.Y) iceAngle=$($testIce.Angle)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_FROZEN_ROPE_DEVICES-eq'1'){
        $stressLeft=[Windows.SystemParameters]::VirtualScreenLeft;$stressTop=[Windows.SystemParameters]::VirtualScreenTop
        $stressPairs=New-Object Collections.ArrayList
        $stressKinds=@('FireJet','Laser','Spikes')
        for($stressIndex=0;$stressIndex-lt$stressKinds.Count;$stressIndex++){
            Add-PlayroomBlock 'Ice';Add-PlayroomHazard $stressKinds[$stressIndex]
            $stressIce=@($script:playroomBlocks|Where-Object{$_.Type-eq'Ice'}|Select-Object -Last 1)[0]
            $stressDevice=@($script:playroomGadgets|Where-Object{$_.Kind-eq$stressKinds[$stressIndex]}|Select-Object -Last 1)[0]
            $stressIce.X=$stressLeft+180+($stressIndex*330);$stressIce.Y=$stressTop+310;Set-PlacementWindowPosition $stressIce
            $stressDevice.X=$stressIce.X+185;$stressDevice.Y=$stressIce.Y-95;Set-PlacementWindowPosition $stressDevice
            if($stressDevice.Kind-eq'FireJet'){$stressDevice.ManualPower=$true}
            New-PlayroomRope $stressIce $stressDevice
            $stressPairs.Add([pscustomobject]@{Anchor=$stressIce;Device=$stressDevice;Rope=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}|Select-Object -Last 1)[0]})|Out-Null
        }
        Add-PlayroomGadget 'Rotator'
        $stressRotator=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rotator'}|Select-Object -Last 1)[0]
        $stressRotator.Target=$stressPairs[0].Anchor;$stressRotator.RotationSpeed=2.0
        $fireInactiveTicks=0
        $stressClock=[Diagnostics.Stopwatch]::StartNew()
        for($stressTick=0;$stressTick-lt240;$stressTick++){
            Update-PlayroomGadgets;Update-PlayroomHazards
            if(-not$stressPairs[0].Device.Active){$fireInactiveTicks++}
        }
        $stressClock.Stop()
        $maxRebaseError=0.0;$allFinite=$true
        foreach($pair in @($stressPairs)){
            $pair.Device.X+=37;$pair.Device.Y-=23;Set-PlacementWindowPosition $pair.Device
            Rebase-FrozenRopeForPlacement $pair.Device
            $expected=Get-RopeAttachmentPoint $pair.Device
            Update-FrozenRope $pair.Rope
            $actual=Get-RopeAttachmentPoint $pair.Device
            $error=[Math]::Sqrt((($actual.X-$expected.X)*($actual.X-$expected.X))+(($actual.Y-$expected.Y)*($actual.Y-$expected.Y)))
            $maxRebaseError=[Math]::Max($maxRebaseError,$error)
            if([double]::IsNaN($pair.Device.X)-or[double]::IsInfinity($pair.Device.X)-or[double]::IsNaN($pair.Device.Y)-or[double]::IsInfinity($pair.Device.Y)){$allFinite=$false}
        }
        [Console]::Out.WriteLine("diagnostic:frozen-device-stress pairs=$($stressPairs.Count) ticks=240 elapsedMs=$($stressClock.ElapsedMilliseconds) finite=$allFinite maxRebaseError=$([Math]::Round($maxRebaseError,4)) fireInactiveTicks=$fireInactiveTicks rotatorAngle=$([Math]::Round($stressPairs[0].Anchor.Angle,1))")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SEAMLESS_BLOCKS-eq'1'){
        $testSeamlessBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        if($null-ne$testSeamlessBlock){
            $testSeamlessBlock.Width=560;$testSeamlessBlock.Height=230
            $testSeamlessBlock.X=[Windows.SystemParameters]::VirtualScreenLeft+(([Windows.SystemParameters]::VirtualScreenWidth-$testSeamlessBlock.Width)/2)
            $testSeamlessBlock.Y=[Windows.SystemParameters]::VirtualScreenTop+(([Windows.SystemParameters]::VirtualScreenHeight-$testSeamlessBlock.Height)/2)
            $testSeamlessBlock.Window.Width=$testSeamlessBlock.Width;$testSeamlessBlock.Window.Height=$testSeamlessBlock.Height
            Set-PlacementWindowPosition $testSeamlessBlock
            [Console]::Out.WriteLine('diagnostic:seamless-block-resized')
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_FIREJET_VISUAL-eq'1'){
        Add-PlayroomHazard 'FireJet'
        [Console]::Out.WriteLine('diagnostic:firejet-visual-spawned')
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_HAZARD_DRAG-eq'1'){
        Add-PlayroomHazard 'FireJet'
        $testDragHazard=@($script:playroomGadgets|Where-Object{$_.Kind-eq'FireJet'}|Select-Object -Last 1)[0]
        $testDragHazard.X=[Windows.SystemParameters]::VirtualScreenLeft+180;$testDragHazard.Y=[Windows.SystemParameters]::VirtualScreenTop+160;$testDragHazard.VY=9;$testDragHazard.Dragging=$true
        $heldY=$testDragHazard.Y;Update-DynamicHazards;$heldAfter=$testDragHazard.Y
        $testDragHazard.Dragging=$false;Update-DynamicHazards
        [Console]::Out.WriteLine("diagnostic:hazard-drag heldY=$heldY heldAfter=$heldAfter releasedY=$($testDragHazard.Y) releasedVY=$($testDragHazard.VY)")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LASER_VISUAL-eq'1'){
        Add-PlayroomHazard 'Laser'
        $testLaser=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Laser'}|Select-Object -Last 1)[0]
        if($null-ne$testLaser){
            $script:hearts=1
            $script:x=$testLaser.X+205
            $script:y=$testLaser.Y+150-($PetHeight/2)
            $script:vx=0;$script:vy=0
        }
        [Console]::Out.WriteLine('diagnostic:laser-visual-spawned')
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LASER_SUPPORT-eq'1'){
        if(-not$script:playroomActive){Start-Playroom}
        $supportBlock=@($script:playroomBlocks|Where-Object{$_.Type-eq'Normal'}|Select-Object -First 1)[0]
        if($null-ne$supportBlock){
            $supportBlock.Width=360;$supportBlock.Height=42
            $supportBlock.X=[Windows.SystemParameters]::VirtualScreenLeft+(([Windows.SystemParameters]::VirtualScreenWidth-$supportBlock.Width)/2)
            $supportBlock.Y=[Windows.SystemParameters]::VirtualScreenTop+460
            Set-PlacementAngle $supportBlock 0
            Add-PlayroomHazard 'Laser'
            $supportLaser=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Laser'}|Select-Object -Last 1)[0]
            $supportLaser.X=$supportBlock.X+(($supportBlock.Width-$supportLaser.BodyWidth)/2)-$supportLaser.BodyOffsetX
            $supportLaser.Y=$supportBlock.Y-150-$supportLaser.BodyOffsetY-$supportLaser.BodyHeight
            $supportLaser.VX=0;$supportLaser.VY=0;Set-PlacementWindowPosition $supportLaser
            $script:diagnosticSupportCases=@([pscustomobject]@{Name='Laser/Normal';Object=$supportLaser;Block=$supportBlock;Ticks=0;Complete=$false})
            [Console]::Out.WriteLine("diagnostic:support-start case=Laser/Normal bodyBottom=$($supportLaser.Y+$supportLaser.BodyOffsetY+$supportLaser.BodyHeight) blockTop=$($supportBlock.Y)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_BAT_SWING-eq'1'){
        Add-PlayroomToy 'Bat'
        $testBat=@($script:playroomBalls|Where-Object{$_.Kind-eq'Bat'}|Select-Object -Last 1)[0]
        $testBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'}|Select-Object -First 1)[0]
        if($null-ne$testBat-and$null-ne$testBall){
            $script:facing=1;$testBat.CarriedBy='Player1'
            $testBall.X=$script:x+($PetWidth/2)+70-$testBall.Radius
            $testBall.Y=$script:y+46-$testBall.Radius
            $testBall.VX=0;$testBall.VY=0;$testBall.PetHitCooldown=99
            Start-BatCharge 'Player1'|Out-Null;$testBat.BatChargeTicks=75;Release-BatSwing 'Player1'|Out-Null
            [Console]::Out.WriteLine("diagnostic:bat-swing-started power=$($testBat.SwingPower)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_BONE-eq'1'){
        Add-PlayroomToy 'Bone'
        $testBone=@($script:playroomBalls|Where-Object{$_.Kind-eq'Bone'}|Select-Object -Last 1)[0]
        if($null-ne$testBone){
            $testBone.CarriedBy='Player1'
            Set-PlayroomObjectVisual $testBone 24
            [Console]::Out.WriteLine("diagnostic:bone-spawned visualScaleNull=$($null-eq$testBone.VisualScale) carried=$($testBone.CarriedBy)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_EMPTY_ATTACK-eq'1'){
        $emptyAttackResult=Start-BatCharge 'Player1'
        [Console]::Out.WriteLine("diagnostic:empty-attack-safe result=$emptyAttackResult")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_DIRECTION-eq'1'){
        Add-PlayroomGadget 'Spring'
        $testSpring=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Spring'}|Select-Object -Last 1)[0]
        $testBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'}|Select-Object -First 1)[0]
        if($null-ne$testSpring-and$null-ne$testBall){
            Set-PlacementAngle $testSpring 90
            $normalX=1.0;$normalY=0.0
            $centreX=$testSpring.X+$testSpring.Width/2+($normalX*($testSpring.Height/2+$testBall.Radius-2))
            $centreY=$testSpring.Y+$testSpring.Height/2
            $testBall.X=$centreX-$testBall.Radius;$testBall.Y=$centreY-$testBall.Radius
            $testBall.VX=-2;$testBall.VY=0;$testBall.PetHitCooldown=99
            [Console]::Out.WriteLine('diagnostic:spring-direction-test-started')
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_HAZARD-eq'1'){
        Add-PlayroomGadget 'Spring'
        Add-PlayroomHazard 'Laser'
        $testSpring=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Spring'}|Select-Object -Last 1)[0]
        $testLaser=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Laser'}|Select-Object -Last 1)[0]
        if($null-ne$testSpring-and$null-ne$testLaser){
            $testSpring.X=[Windows.SystemParameters]::VirtualScreenLeft+240
            $testSpring.Y=[Windows.SystemParameters]::VirtualScreenTop+[Windows.SystemParameters]::VirtualScreenHeight-210
            Set-PlacementWindowPosition $testSpring
            Set-PlacementAngle $testSpring 0
            $testRadius=[Math]::Min($testLaser.BodyWidth,$testLaser.BodyHeight)*.46
            $testCentreX=$testSpring.X+($testSpring.Width/2)
            $testCentreY=$testSpring.Y-$testRadius+2
            $testLaser.X=$testCentreX-$testLaser.BodyOffsetX-($testLaser.BodyWidth/2)
            $testLaser.Y=$testCentreY-$testLaser.BodyOffsetY-($testLaser.BodyHeight/2)
            $testLaser.VX=0;$testLaser.VY=3
            Set-PlacementWindowPosition $testLaser
            [Console]::Out.WriteLine('diagnostic:spring-hazard-test-started')
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_SPRING_ALL-eq'1'){
        Set-TwoPlayerMode $true;Set-Player2Controller 'Human'
        Add-PlayroomGadget 'Spring'
        Add-PlayroomToy 'Bat';Add-PlayroomToy 'Bone'
        Add-PlayroomGadget 'Fan';Add-PlayroomGadget 'Teleporter'
        foreach($kind in @('Spikes','FireJet','Laser')){Add-PlayroomHazard $kind}
        $testSpring=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Spring'}|Select-Object -Last 1)[0]
        if($null-ne$testSpring){
            $testSpring.X=[Windows.SystemParameters]::VirtualScreenLeft+([Windows.SystemParameters]::VirtualScreenWidth-$testSpring.Width)/2
            $testSpring.Y=[Windows.SystemParameters]::VirtualScreenTop+[Windows.SystemParameters]::VirtualScreenHeight-220
            Set-PlacementAngle $testSpring 0;Set-PlacementWindowPosition $testSpring
            $springCentreX=$testSpring.X+$testSpring.Width/2
            $playerRadius=[Math]::Min($PetWidth,$PetHeight)*.38
            $playerCentreY=$testSpring.Y-$playerRadius+2
            $script:x=$springCentreX-($PetWidth/2);$script:y=$playerCentreY-($PetHeight/2);$script:vx=0;$script:vy=4;$script:grounded=$false
            $script:p2X=$script:x+4;$script:p2Y=$script:y;$script:p2VX=0;$script:p2VY=4;$script:p2Grounded=$false
            foreach($toy in @($script:playroomBalls)){
                $toy.X=$springCentreX-$toy.Radius;$toy.Y=$testSpring.Y-$toy.Radius+2-$toy.Radius
                $toy.VX=0;$toy.VY=4;$toy.CarriedBy='';$toy.PetHitCooldown=99
                $toy.Window.Left=$toy.X;$toy.Window.Top=$toy.Y
            }
            $dynamicTargets=@($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['IsDynamic']-and$_.IsDynamic})
            foreach($target in $dynamicTargets){
                $radius=[Math]::Min($target.BodyWidth,$target.BodyHeight)*.46
                $target.X=$springCentreX-$target.BodyOffsetX-($target.BodyWidth/2)
                $target.Y=$testSpring.Y-$radius+2-$target.BodyOffsetY-($target.BodyHeight/2)
                $target.VX=0;$target.VY=4;$target.SpringCooldown=0;Set-PlacementWindowPosition $target
                if($target.Kind-eq'Fan'){$target.ManualPower=$false}
                $probe=Get-SpringTopContact $testSpring ($target.X+$target.BodyOffsetX+$target.BodyWidth/2) ($target.Y+$target.BodyOffsetY+$target.BodyHeight/2) $radius $target.VX $target.VY
                [Console]::Out.WriteLine("diagnostic:spring-all-probe target=$($target.Kind) contact=$($null-ne$probe) radius=$([Math]::Round($radius,2)) centre=$([Math]::Round($target.X+$target.BodyOffsetX+$target.BodyWidth/2,2)),$([Math]::Round($target.Y+$target.BodyOffsetY+$target.BodyHeight/2,2)) spring=$([Math]::Round($testSpring.X+$testSpring.Width/2,2)),$([Math]::Round($testSpring.Y+$testSpring.Height/2,2)) angle=$($testSpring.Angle)")
            }
            [Console]::Out.WriteLine("diagnostic:spring-all-start toys=$($script:playroomBalls.Count) dynamic=$($dynamicTargets.Count) targets=$($script:playroomBalls.Count+$dynamicTargets.Count+2)")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_FAN_ALL-eq'1'){
        Set-TwoPlayerMode $true;Set-Player2Controller 'Human'
        Add-PlayroomGadget 'Fan';Add-PlayroomHazard 'Laser'
        $testFan=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Fan'}|Select-Object -Last 1)[0]
        $testLaser=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Laser'}|Select-Object -Last 1)[0]
        $testBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'}|Select-Object -First 1)[0]
        if($null-ne$testFan-and$null-ne$testLaser-and$null-ne$testBall){
            $testFan.X=[Windows.SystemParameters]::VirtualScreenLeft+280;$testFan.Y=[Windows.SystemParameters]::VirtualScreenTop+300
            $testFan.VX=0;$testFan.VY=0;$testFan.Dragging=$true;$testFan.ManualPower=$true;Set-PlacementAngle $testFan 0;Set-PlacementWindowPosition $testFan
            $originX=$testFan.X+$testFan.Width/2;$originY=$testFan.Y+$testFan.Height/2
            $script:x=$originX+120-($PetWidth/2);$script:y=$originY-($PetHeight/2);$script:vx=0;$script:vy=0
            $script:p2X=$script:x;$script:p2Y=$script:y+20;$script:p2VX=0;$script:p2VY=0
            $testBall.X=$originX+120-$testBall.Radius;$testBall.Y=$originY-$testBall.Radius;$testBall.VX=0;$testBall.VY=0
            $testLaser.X=$originX+120-$testLaser.BodyOffsetX-($testLaser.BodyWidth/2);$testLaser.Y=$originY-$testLaser.BodyOffsetY-($testLaser.BodyHeight/2);$testLaser.VX=0;$testLaser.VY=0;Set-PlacementWindowPosition $testLaser
            Update-PlayroomGadgets
            $horizontalPass=$script:vx-gt0-and$script:p2VX-gt0-and$testBall.VX-gt0-and$testLaser.VX-gt0-and$testFan.VX-eq0-and$testFan.VY-eq0
            [Console]::Out.WriteLine("diagnostic:fan-all angle=0 pass=$horizontalPass p1=$([Math]::Round($script:vx,2)) p2=$([Math]::Round($script:p2VX,2)) ball=$([Math]::Round($testBall.VX,2)) laser=$([Math]::Round($testLaser.VX,2)) fan=$([Math]::Round($testFan.VX,2)),$([Math]::Round($testFan.VY,2))")
            $testFan.ManualPower=$false;$script:vx=0;$script:p2VX=0;$testBall.VX=0;$testLaser.VX=0;Update-PlayroomGadgets
            $offPass=$script:vx-eq0-and$script:p2VX-eq0-and$testBall.VX-eq0-and$testLaser.VX-eq0-and@($testFan.WindLines|Where-Object{$_.Line.Opacity-gt0}).Count-eq0
            [Console]::Out.WriteLine("diagnostic:fan-all poweredOff pass=$offPass visibleWind=$(@($testFan.WindLines|Where-Object{$_.Line.Opacity-gt0}).Count)")
            $testFan.ManualPower=$true;Set-PlacementAngle $testFan 90
            $script:x=$originX-($PetWidth/2);$script:y=$originY+120-($PetHeight/2);$script:vx=0;$script:vy=0
            $testBall.X=$originX-$testBall.Radius;$testBall.Y=$originY+120-$testBall.Radius;$testBall.VX=0;$testBall.VY=0
            Update-PlayroomGadgets
            $verticalPass=[Math]::Abs($script:vx)-lt.01-and$script:vy-gt0-and[Math]::Abs($testBall.VX)-lt.01-and$testBall.VY-gt0
            [Console]::Out.WriteLine("diagnostic:fan-all angle=90 pass=$verticalPass p1=$([Math]::Round($script:vx,2)),$([Math]::Round($script:vy,2)) ball=$([Math]::Round($testBall.VX,2)),$([Math]::Round($testBall.VY,2))")
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_GADGET_LOAD-in@('Baseline','Fans','Ropes3','Ropes','BlockBaseline','BlocksSeparated','BlocksLayered','LaddersSeparated','LaddersLayered','LaddersSeparatedMoving','LaddersLayeredMoving')){
        $script:gadgetBenchmarkPhase=$env:WINDOWISP_TEST_GADGET_LOAD
        while($script:playroomBalls.Count-lt5){Add-PlayroomBall}
        $benchLeft=[Windows.SystemParameters]::VirtualScreenLeft;$benchTop=[Windows.SystemParameters]::VirtualScreenTop
        $benchBalls=@($script:playroomBalls|Select-Object -First 5)
        for($i=0;$i-lt$benchBalls.Count;$i++){
            $benchBalls[$i].X=$benchLeft+430+($i*45);$benchBalls[$i].Y=$benchTop+180+($i*105)
            $benchBalls[$i].VX=1.2;$benchBalls[$i].VY=0;$benchBalls[$i].Window.Left=$benchBalls[$i].X;$benchBalls[$i].Window.Top=$benchBalls[$i].Y
        }
        if($script:gadgetBenchmarkPhase-eq'Fans'){
            for($i=0;$i-lt5;$i++){
                Add-PlayroomGadget 'Fan';$benchFan=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Fan'}|Select-Object -Last 1)[0]
                $benchFan.X=$benchLeft+270;$benchFan.Y=$benchTop+165+($i*105);$benchFan.VX=0;$benchFan.VY=0;$benchFan.Dragging=$true;$benchFan.ManualPower=$true
                Set-PlacementAngle $benchFan 0;Set-PlacementWindowPosition $benchFan
            }
        }elseif($script:gadgetBenchmarkPhase-in@('Ropes3','Ropes')){
            $benchAnchor=@($script:playroomBlocks|Select-Object -First 1)[0]
            $benchAnchor.X=$benchLeft+245;$benchAnchor.Y=$benchTop+130;$benchAnchor.Width=200;$benchAnchor.Height=32
            $benchAnchor.Window.Width=$benchAnchor.Width;$benchAnchor.Window.Height=$benchAnchor.Height;Set-PlacementWindowPosition $benchAnchor
            $benchRopeCount=$(if($script:gadgetBenchmarkPhase-eq'Ropes3'){3}else{5})
            for($i=0;$i-lt$benchRopeCount;$i++){
                $benchBalls[$i].X=$benchLeft+500+($i*55);$benchBalls[$i].Y=$benchTop+260+($i*75)
                $benchBalls[$i].Window.Left=$benchBalls[$i].X;$benchBalls[$i].Window.Top=$benchBalls[$i].Y
                New-PlayroomRope $benchAnchor $benchBalls[$i] 220
            }
        }elseif($script:gadgetBenchmarkPhase-in@('BlockBaseline','BlocksSeparated','BlocksLayered','LaddersSeparated','LaddersLayered','LaddersSeparatedMoving','LaddersLayeredMoving')){
            Set-TwoPlayerMode $true;Set-Player2Controller 'Human'
            if($script:gadgetBenchmarkPhase-in@('BlocksSeparated','BlocksLayered')){
                while($script:playroomBlocks.Count-lt5){Add-PlayroomBlock 'Normal'}
                $benchBlocks=@($script:playroomBlocks|Select-Object -First 5)
                for($i=0;$i-lt$benchBlocks.Count;$i++){
                    $benchBlocks[$i].X=$(if($script:gadgetBenchmarkPhase-eq'BlocksLayered'){$benchLeft+520}else{$benchLeft+180+($i*210)})
                    $benchBlocks[$i].Y=$(if($script:gadgetBenchmarkPhase-eq'BlocksLayered'){$benchTop+460}else{$benchTop+260+(($i%2)*230)})
                    Set-PlacementAngle $benchBlocks[$i] 0;Set-PlacementWindowPosition $benchBlocks[$i]
                }
                $contactBlock=$benchBlocks[0]
                $script:x=$contactBlock.X+20;$script:y=$contactBlock.Y-$PetHeight;$script:vx=1.5;$script:vy=2
                $script:p2X=$contactBlock.X+$contactBlock.Width-$PetWidth-20;$script:p2Y=$script:y;$script:p2VX=-1.5;$script:p2VY=2
                foreach($ball in $benchBalls){$ball.X=$contactBlock.X+($contactBlock.Width-$ball.Size)/2;$ball.Y=$contactBlock.Y-$ball.Size-20;$ball.VX=1.1;$ball.VY=2;$ball.Window.Left=$ball.X;$ball.Window.Top=$ball.Y}
            }elseif($script:gadgetBenchmarkPhase-like'Ladders*'){
                Add-PlayroomBlock 'Ladder';Add-PlayroomBlock 'Ladder'
                $benchLadders=@($script:playroomBlocks|Where-Object{$_.Type-eq'Ladder'}|Select-Object -Last 2)
                for($i=0;$i-lt$benchLadders.Count;$i++){
                    $benchLadders[$i].X=$(if($script:gadgetBenchmarkPhase-like'LaddersLayered*'){$benchLeft+570}else{$benchLeft+420+($i*300)})
                    $benchLadders[$i].Y=$benchTop+330;Set-PlacementAngle $benchLadders[$i] 0;Set-PlacementWindowPosition $benchLadders[$i]
                    $benchLadders[$i]|Add-Member -NotePropertyName BenchmarkBaseX -NotePropertyValue ([double]$benchLadders[$i].X) -Force
                    $benchLadders[$i]|Add-Member -NotePropertyName BenchmarkBaseY -NotePropertyValue ([double]$benchLadders[$i].Y) -Force
                }
                $script:x=$benchLadders[0].X+($benchLadders[0].Width-$PetWidth)/2;$script:y=$benchLadders[0].Y+30;$script:vx=0;$script:vy=0
                $script:p2X=$benchLadders[$benchLadders.Count-1].X+($benchLadders[$benchLadders.Count-1].Width-$PetWidth)/2;$script:p2Y=$benchLadders[$benchLadders.Count-1].Y+45;$script:p2VX=0;$script:p2VY=0
            }
        }
        $benchProcess=[Diagnostics.Process]::GetCurrentProcess();$benchProcess.Refresh()
        $script:gadgetBenchmarkCpuStartMs=$benchProcess.TotalProcessorTime.TotalMilliseconds
        $script:gadgetBenchmarkWallStartMs=$script:frameClock.Elapsed.TotalMilliseconds
        $script:gadgetBenchmarkStartHandles=$benchProcess.HandleCount
        $script:gadgetBenchmarkStartWindows=0
        $script:frameGapMax=0;$script:frameGapSum=0;$script:frameGapSamples=0;$script:lastFrameMs=$script:gadgetBenchmarkWallStartMs
        [Console]::Out.WriteLine("diagnostic:gadget-benchmark-start phase=$($script:gadgetBenchmarkPhase) balls=$($script:playroomBalls.Count) blocks=$($script:playroomBlocks.Count) ladders=$(@($script:playroomBlocks|Where-Object{$_.Type-eq'Ladder'}).Count) fans=$(@($script:playroomGadgets|Where-Object{$_.Kind-eq'Fan'}).Count) ropes=$(@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}).Count) windows=$($script:gadgetBenchmarkStartWindows) handles=$($script:gadgetBenchmarkStartHandles)")
    }
    if($env:WINDOWISP_TEST_ROTATOR-eq'1'){
        Add-PlayroomGadget 'Rotator'
        $testRotator=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Rotator'}|Select-Object -Last 1)[0]
        $testBlock=@($script:playroomBlocks|Select-Object -First 1)[0]
        if($null-ne$testRotator-and$null-ne$testBlock){
            $desiredRotatorX=$testBlock.X+20;$desiredRotatorY=$testBlock.Y+35
            $testRotator.X=$desiredRotatorX;$testRotator.Y=$desiredRotatorY
            $testRotator.Window.Left=$desiredRotatorX;$testRotator.Window.Top=$desiredRotatorY
        }
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine('diagnostic:rotator-spawned')}
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_BALL_INTERACT -eq '1' -and $script:playroomBalls.Count -gt 0) {
        $testBall = $script:playroomBalls[0]
        $testBall.X = $script:x + $PetWidth - 12; $testBall.Y = $script:y + 24
        $testBall.VX = 0; $testBall.VY = 0
        $testBall.CarriedBy = 'Player1'
        $testBall.Window.Left = $testBall.X; $testBall.Window.Top = $testBall.Y
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_BALL_BLOCK_SIDE -eq '1' -and
        $script:playroomBalls.Count -gt 0 -and $script:playroomBlocks.Count -gt 0) {
        $testBall = $script:playroomBalls[0]; $testBlock = $script:playroomBlocks[0]
        $testBall.X = $testBlock.X - $testBall.Size - 24
        $testBall.Y = $testBlock.Y - (($testBall.Size - $testBlock.Height) / 2)
        $testBall.VX = 8; $testBall.VY = 0; $testBall.PetHitCooldown = 999
        $testBall.Window.Left = $testBall.X; $testBall.Window.Top = $testBall.Y
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_BLOCK_ART -eq '1') {
        $artTypes=@('Normal','Wooden','Bouncy','Fire','Ice','Grass','Mirror','Conveyor','Cloud','Crumbling')
        for($artIndex=0;$artIndex-lt$artTypes.Count;$artIndex++){
            Add-PlayroomBlock $artTypes[$artIndex]
            $artBlock=@($script:playroomBlocks|Where-Object{$_.Type-eq$artTypes[$artIndex]}|Select-Object -Last 1)[0]
            $artColumn=$artIndex%5;$artRow=[Math]::Floor($artIndex/5)
            $artBlock.Width=220;$artBlock.Height=$(if($artBlock.Type-in@('Wooden','Conveyor')){$artBlock.Height}else{220})
            $artBlock.X=[Windows.SystemParameters]::VirtualScreenLeft+32+($artColumn*260);$artBlock.Y=[Windows.SystemParameters]::VirtualScreenTop+155+($artRow*290)
            Set-PlacementAngle $artBlock 0
        }
        [Console]::Out.WriteLine("diagnostic:block-art types=$($artTypes-join',') fixedWood=$(@($script:playroomBlocks|Where-Object{$_.Type-eq'Wooden'}|Select-Object -Last 1)[0].Height) fixedConveyor=$(@($script:playroomBlocks|Where-Object{$_.Type-eq'Conveyor'}|Select-Object -Last 1)[0].Height)")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_CRUMBLE_ANIMATION-eq'1'){
        Add-PlayroomBlock 'Crumbling';$script:crumbleTestBlock=@($script:playroomBlocks|Select-Object -Last 1)[0]
        $script:crumbleTestBlock.Width=460;$script:crumbleTestBlock.Height=120
        $script:crumbleTestBlock.X=[Windows.SystemParameters]::VirtualScreenLeft+(([Windows.SystemParameters]::VirtualScreenWidth-460)/2)
        $script:crumbleTestBlock.Y=[Windows.SystemParameters]::VirtualScreenTop+330;Set-PlacementAngle $script:crumbleTestBlock 0
        $script:crumbleTestStartTick=$script:hazardTick
        [Console]::Out.WriteLine('diagnostic:crumble-animation-ready impacts=0')
    }
    Update-PlatformHighlights
    Update-Menu
}

function Stop-Playroom {
    if (-not $script:playroomActive) { return }
    if($script:wispfallActive-or$null-ne$script:wispfallLavaWindow){Remove-WispfallSetup}
    Set-GridSnap $false
    Set-EraserMode $false
    Close-FreeRotationHandle
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine('diagnostic:stop-playroom-begin')}
    Clear-PlayroomBalls
    Set-SandboxToolboxVisible $false
    $script:playroomActive = $false
    Set-WireEditingVisible $false
    Set-RopeEditingVisible $false
    foreach ($blockData in @($script:playroomBlocks)) { Set-BlockGameplayVisual $blockData $true }
    foreach($placement in @($script:playroomGadgets)){
        if($placement.Kind-in@('Rotator','Rope')){$placement.Window.Hide()}
        else{Set-OverlayClickThroughState $placement.Window $true}
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:desktop-play-stop' }
    $script:enemySpawnTicks = 120; $script:starSpawnTicks = 90; $script:shieldPickupSpawnTicks = 45
    Update-PlatformHighlights; Update-Menu
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine('diagnostic:stop-playroom-end')}
}

function Clear-Dodgeballs {
    foreach ($ball in @($script:dodgeballs)) {
        Remove-SharedGameplayElement $ball.Element
    }
    $script:dodgeballs.Clear()
}

function New-Dodgeball {
    $size = 46.0
    $fromRight = $script:dodgeballFromRight
    $script:dodgeballFromRight = -not $script:dodgeballFromRight
    $left = [Windows.SystemParameters]::VirtualScreenLeft
    $top = [Windows.SystemParameters]::VirtualScreenTop
    $width = [Windows.SystemParameters]::VirtualScreenWidth

    $ballWindow = New-Object Windows.Window
    $ballWindow.Title = 'Windowisp Dodgeball'
    $ballWindow.Width = $size; $ballWindow.Height = $size
    $ballWindow.WindowStyle = [Windows.WindowStyle]::None
    $ballWindow.ResizeMode = [Windows.ResizeMode]::NoResize
    $ballWindow.AllowsTransparency = $true
    $ballWindow.Background = [Windows.Media.Brushes]::Transparent
    $ballWindow.ShowInTaskbar = $false; $ballWindow.ShowActivated=$false
    $ballWindow.Focusable=$false;$ballWindow.Topmost = $script:alwaysOnTop

    $grid = New-Object Windows.Controls.Grid
    $grid.Width=$size;$grid.Height=$size;$grid.IsHitTestVisible=$false
    $ballArt=New-ToyboxImage 'Ball'
    if($null-ne$ballArt){$ballArt.Width=$size;$ballArt.Height=$size;$grid.Children.Add($ballArt)|Out-Null}
    $rotate = New-Object Windows.Media.RotateTransform
    $rotate.CenterX = 23; $rotate.CenterY = 23; $grid.RenderTransform = $rotate

    $x = $(if ($fromRight) { $left + $width - $size - 8 } else { $left + 8 })
    $y = $top + 62
    # Aim inward from either corner, then vary the launch by up to 33 degrees.
    # The resulting velocity is never damped, so every ball keeps its own steady flight.
    $baseAngleDegrees = 38.0
    $launchAngleDegrees = $baseAngleDegrees + (($script:random.NextDouble() * 66.0) - 33.0)
    $launchAngleDegrees = [Math]::Max(5.0, [Math]::Min(71.0, $launchAngleDegrees))
    $launchRadians = $launchAngleDegrees * [Math]::PI / 180.0
    $speed = 6.6
    $vx = [Math]::Cos($launchRadians) * $speed * $(if ($fromRight) { -1 } else { 1 })
    $vy = [Math]::Sin($launchRadians) * $speed
    $ball = [pscustomobject]@{ Window=$null;Element=$grid; X=[double]$x; Y=[double]$y; VX=[double]$vx; VY=[double]$vy; Size=$size; Radius=($size/2); Rotate=$rotate; LaunchAngle=[double]$launchAngleDegrees }
    Add-SharedGameplayElement $grid $x $y
    $script:dodgeballs.Add($ball) | Out-Null
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output ('diagnostic:dodgeball-spawn side={0} angle={1:0.0} speed={2:0.0} count={3}' -f $(if($fromRight){'right'}else{'left'}),$launchAngleDegrees,$speed,$script:dodgeballs.Count) }
}

function Update-Dodgeballs {
    $left = [Windows.SystemParameters]::VirtualScreenLeft
    $top = [Windows.SystemParameters]::VirtualScreenTop
    $right = $left + [Windows.SystemParameters]::VirtualScreenWidth
    $bottom = $top + [Windows.SystemParameters]::VirtualScreenHeight
    foreach ($ball in @($script:dodgeballs)) {
        $oldX=$ball.X;$oldY=$ball.Y
        $ball.X += $ball.VX; $ball.Y += $ball.VY
        foreach($blockData in @($script:playroomBlocks)){
            if([Math]::Abs($blockData.Angle)-gt.01){
                $targetX=$ball.X;$targetY=$ball.Y
                $travel=[Math]::Max([Math]::Abs($targetX-$oldX),[Math]::Abs($targetY-$oldY))
                $sweepSteps=[Math]::Max(1,[Math]::Min(10,[Math]::Ceiling($travel/4.0)))
                $rotatedHit=$false
                for($sweepStep=1;$sweepStep-le$sweepSteps;$sweepStep++){
                    $sweepT=$sweepStep/[double]$sweepSteps
                    $ball.X=$oldX+(($targetX-$oldX)*$sweepT)
                    $ball.Y=$oldY+(($targetY-$oldY)*$sweepT)
                    if(Resolve-BallRotatedBlock $ball $blockData 1.0){$rotatedHit=$true;break}
                }
                if($rotatedHit){break}
                $ball.X=$targetX;$ball.Y=$targetY
                continue
            }
            $oldRight=$oldX+$ball.Size;$oldBottom=$oldY+$ball.Size
            $newRight=$ball.X+$ball.Size;$newBottom=$ball.Y+$ball.Size
            $horizontalOverlap=$newRight-3-gt$blockData.X -and $ball.X+3-lt$blockData.X+$blockData.Width
            $verticalOverlap=$newBottom-3-gt$blockData.Y -and $ball.Y+3-lt$blockData.Y+$blockData.Height
            if($ball.VY-gt0-and$horizontalOverlap-and$oldBottom-le$blockData.Y+4-and$newBottom-ge$blockData.Y){
                $ball.Y=$blockData.Y-$ball.Size;$ball.VY=-[Math]::Abs($ball.VY);break
            }elseif($ball.VY-lt0-and$horizontalOverlap-and$oldY-ge$blockData.Y+$blockData.Height-4-and$ball.Y-le$blockData.Y+$blockData.Height){
                $ball.Y=$blockData.Y+$blockData.Height;$ball.VY=[Math]::Abs($ball.VY);break
            }elseif($ball.VX-gt0-and$verticalOverlap-and$oldRight-le$blockData.X+4-and$newRight-ge$blockData.X){
                $ball.X=$blockData.X-$ball.Size;$ball.VX=-[Math]::Abs($ball.VX);break
            }elseif($ball.VX-lt0-and$verticalOverlap-and$oldX-ge$blockData.X+$blockData.Width-4-and$ball.X-le$blockData.X+$blockData.Width){
                $ball.X=$blockData.X+$blockData.Width;$ball.VX=[Math]::Abs($ball.VX);break
            }
        }
        if ($ball.X -le $left) { $ball.X = $left; $ball.VX = [Math]::Abs($ball.VX) }
        elseif ($ball.X + $ball.Size -ge $right) { $ball.X = $right - $ball.Size; $ball.VX = -[Math]::Abs($ball.VX) }
        if ($ball.Y -le $top) { $ball.Y = $top; $ball.VY = [Math]::Abs($ball.VY) }
        elseif ($ball.Y + $ball.Size -ge $bottom) { $ball.Y = $bottom - $ball.Size; $ball.VY = -[Math]::Abs($ball.VY) }
        # Physics remains 100 Hz, but transparent HWND composition is capped at
        # 50 Hz. Updating both position and rotation every 10 ms made one ball
        # enough to monopolise WPF's dispatcher on some desktops.
        if(($script:inputTick%2)-eq0){
            $ball.Rotate.Angle = ($ball.Rotate.Angle + ($(if($ball.VX -ge 0){10}else{-10}))) % 360
            Set-SharedOverlayElementPosition $ball.Element $ball.X $ball.Y
        }

        $hitP1 = $script:invulnerableTicks -le 0 -and
            ($ball.X + $ball.Size -gt $script:x + 8) -and ($ball.X -lt $script:x + $PetWidth - 8) -and
            ($ball.Y + $ball.Size -gt $script:y + 8) -and ($ball.Y -lt $script:y + $PetHeight - 5)
        $hitP2 = $script:twoPlayerActive -and $script:p2Hearts -gt 0 -and $script:p2InvulnerableTicks -le 0 -and
            ($ball.X + $ball.Size -gt $script:p2X + 8) -and ($ball.X -lt $script:p2X + $PetWidth - 8) -and
            ($ball.Y + $ball.Size -gt $script:p2Y + 8) -and ($ball.Y -lt $script:p2Y + $PetHeight - 5)
        if ($hitP1 -or $hitP2) {
            if ($hitP1) { $script:hearts--; $script:invulnerableTicks = 75 }
            else { $script:p2Hearts--; $script:p2InvulnerableTicks = 75 }
            Remove-SharedGameplayElement $ball.Element;$script:dodgeballs.Remove($ball)
            if ($script:hearts -le 0) {
                $script:active = $false; Register-ControlKeys $false; Set-ClickThrough $true; Update-Menu
            }
        }
    }
}

function Update-HitProtectionVisuals {
    $p1Protected = $script:active -and $script:invulnerableTicks -gt 0
    $p1FlashOn = $p1Protected -and (([Math]::Floor($script:invulnerableTicks / 6) % 2) -eq 0)
    $window.Opacity = $(if ($p1FlashOn) { 0.34 } else { 1.0 })

    if ($null -ne $script:player2Window) {
        $p2Protected = $script:active -and $script:p2InvulnerableTicks -gt 0
        $p2FlashOn = $p2Protected -and (([Math]::Floor($script:p2InvulnerableTicks / 6) % 2) -eq 0)
        $script:player2Window.Opacity = $(if ($p2FlashOn) { 0.34 } else { 1.0 })
    }
}

function Remove-FootballSetup {
    foreach($object in @($script:footballModeObjects|Where-Object{$null-ne$_})){
        if($object.Kind-eq'Wire'){Remove-PlayroomPlacement $object}
        elseif($object.Kind-eq'FootballDecoration'){try{$object.Window.Close()}catch{}}
    }
    foreach($object in @($script:footballModeObjects|Where-Object{$null-ne$_-and$_.Kind-notin@('Wire','FootballDecoration')})){
        Remove-PlayroomPlacement $object
    }
    $script:footballModeObjects=@();$script:footballLeftGoal=$null;$script:footballRightGoal=$null
}

function New-FootballGoalFrame([string]$side,[double]$x,[double]$groundY) {
    $goalWindow=New-Object Windows.Window;$goalWindow.Title="Windowisp $side Goal";$goalWindow.Width=132;$goalWindow.Height=126
    $goalWindow.Left=$x;$goalWindow.Top=$groundY-$goalWindow.Height;$goalWindow.WindowStyle='None';$goalWindow.AllowsTransparency=$true
    $goalWindow.Background=[Windows.Media.Brushes]::Transparent;$goalWindow.Topmost=$true;$goalWindow.ShowInTaskbar=$false;$goalWindow.ShowActivated=$false;$goalWindow.ResizeMode='NoResize'
    $canvas=New-Object Windows.Controls.Canvas;$canvas.Width=132;$canvas.Height=126;$canvas.IsHitTestVisible=$false
    $colour=New-Object Windows.Media.SolidColorBrush $(if($side-eq'P1'){[Windows.Media.Color]::FromRgb(73,181,255)}else{[Windows.Media.Color]::FromRgb(239,72,160)})
    foreach($segment in @(@(8,120,8,20),@(8,20,124,20),@(124,20,124,120))){
        $line=New-Object Windows.Shapes.Line;$line.X1=$segment[0];$line.Y1=$segment[1];$line.X2=$segment[2];$line.Y2=$segment[3]
        $line.Stroke=$colour;$line.StrokeThickness=7;$line.StrokeStartLineCap='Round';$line.StrokeEndLineCap='Round';$canvas.Children.Add($line)|Out-Null
    }
    foreach($netX in @(32,56,80,104)){$line=New-Object Windows.Shapes.Line;$line.X1=$netX;$line.Y1=25;$line.X2=$netX;$line.Y2=116;$line.Stroke=$colour;$line.StrokeThickness=1;$line.Opacity=.35;$canvas.Children.Add($line)|Out-Null}
    foreach($netY in @(44,66,88,110)){$line=New-Object Windows.Shapes.Line;$line.X1=12;$line.Y1=$netY;$line.X2=120;$line.Y2=$netY;$line.Stroke=$colour;$line.StrokeThickness=1;$line.Opacity=.35;$canvas.Children.Add($line)|Out-Null}
    $label=New-Object Windows.Controls.TextBlock;$label.Text="$side GOAL";$label.Foreground=[Windows.Media.Brushes]::White;$label.FontWeight='Bold';$label.FontSize=12
    [Windows.Controls.Canvas]::SetLeft($label,42);[Windows.Controls.Canvas]::SetTop($label,1);$canvas.Children.Add($label)|Out-Null
    $goalWindow.Content=$canvas;$goalWindow.Show();Set-OverlayClickThrough $goalWindow
    return [pscustomobject]@{Kind='FootballDecoration';Window=$goalWindow}
}

function Reset-FootballKickoff([string]$message='') {
    if($null-eq$script:footballBall){return}
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $width=[Windows.SystemParameters]::VirtualScreenWidth
    $script:footballBall.CarriedBy='';$script:footballBall.VX=0;$script:footballBall.VY=0
    $script:footballBall.X=$left+($width-$script:footballBall.Size)/2
    $script:footballBall.Y=$top+105
    $script:footballBall.Window.Left=$script:footballBall.X;$script:footballBall.Window.Top=$script:footballBall.Y
    $script:x=$left+($width*.22)-($PetWidth/2);$script:y=$top+120;$script:vx=0;$script:vy=0;$script:grounded=$false
    $script:p2X=$left+($width*.78)-($PetWidth/2);$script:p2Y=$top+120;$script:p2VX=0;$script:p2VY=0;$script:p2Grounded=$false
    if($null-ne$script:player2Window){$script:player2Window.Left=$script:p2X;$script:player2Window.Top=$script:p2Y}
    $script:footballCountdownTicks=180;$script:footballKickoffTextTicks=45;$script:footballGoalCooldown=210
    $script:footballMessage=$message
}

function Start-Football {
    if(-not$script:playroomActive){Start-Playroom}
    Remove-FootballSetup
    Clear-PlayroomBalls
    $script:footballActive=$true;$script:gameType='Football';$script:footballP1Score=0;$script:footballP2Score=0;$script:footballMatchOver=$false
    $humanSecondPlayerAlreadyEnabled=$script:twoPlayerActive-and$script:p2ControllerMode-eq'Human'
    Set-TwoPlayerMode $true
    if(-not$humanSecondPlayerAlreadyEnabled-and$script:p2ControllerMode-eq'Human'){Set-Player2Controller 'Opponent'}
    Add-PlayroomBall
    $script:footballBall=@($script:playroomBalls|Where-Object{$_.Kind-eq'Ball'}|Select-Object -Last 1)[0]
    $script:footballBall|Add-Member -NotePropertyName FootballBall -NotePropertyValue $true -Force
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $width=[Windows.SystemParameters]::VirtualScreenWidth;$height=[Windows.SystemParameters]::VirtualScreenHeight
    Add-PlayroomGadget 'PressurePlate';$leftPlate=@($script:playroomGadgets|Where-Object{$_.Kind-eq'PressurePlate'}|Select-Object -Last 1)[0]
    Add-PlayroomGadget 'PressurePlate';$rightPlate=@($script:playroomGadgets|Where-Object{$_.Kind-eq'PressurePlate'}|Select-Object -Last 1)[0]
    Add-PlayroomHazard 'FireJet';$leftFire=@($script:playroomGadgets|Where-Object{$_.Kind-eq'FireJet'}|Select-Object -Last 1)[0]
    Add-PlayroomHazard 'FireJet';$rightFire=@($script:playroomGadgets|Where-Object{$_.Kind-eq'FireJet'}|Select-Object -Last 1)[0]
    # Keep the goal feet above the normal Windows taskbar without introducing
    # a WinForms dependency into the WPF runtime.
    $groundY=$top+$height-48
    $leftPlate.X=$left+27;$leftPlate.Y=$groundY-$leftPlate.Height
    $rightPlate.X=$left+$width-$rightPlate.Width-27;$rightPlate.Y=$groundY-$rightPlate.Height
    $leftFire.X=$leftPlate.X+($leftPlate.Width-$leftFire.BodyWidth)/2-$leftFire.BodyOffsetX;$leftFire.Y=$leftPlate.Y-$leftFire.Height+10
    $rightFire.X=$rightPlate.X+($rightPlate.Width-$rightFire.BodyWidth)/2-$rightFire.BodyOffsetX;$rightFire.Y=$rightPlate.Y-$rightFire.Height+10
    foreach($placement in @($leftPlate,$rightPlate,$leftFire,$rightFire)){Set-PlacementWindowPosition $placement;$placement|Add-Member -NotePropertyName FootballGoal -NotePropertyValue $true -Force}
    $leftFire.IsDynamic=$false;$rightFire.IsDynamic=$false
    New-PlayroomWire $leftPlate $leftFire;$leftWire=@($script:playroomWires|Select-Object -Last 1)[0]
    New-PlayroomWire $rightPlate $rightFire;$rightWire=@($script:playroomWires|Select-Object -Last 1)[0]
    $leftFrame=New-FootballGoalFrame 'P2' ($left+8) $groundY
    $rightFrame=New-FootballGoalFrame 'P1' ($left+$width-140) $groundY
    $script:footballLeftGoal=$leftPlate;$script:footballRightGoal=$rightPlate
    $script:footballModeObjects=@($leftWire,$rightWire,$leftPlate,$rightPlate,$leftFire,$rightFire,$leftFrame,$rightFrame)
    Set-SandboxToolboxVisible $false;Set-WireEditingVisible $false;Set-RopeEditingVisible $false
    foreach($block in @($script:playroomBlocks)){Set-BlockGameplayVisual $block $true}
    foreach($placement in @($script:playroomGadgets)){Set-OverlayClickThroughState $placement.Window $true}
    $script:active=$true;Register-ControlKeys $true;Set-ClickThrough $false
    Reset-FootballKickoff
    if($null-ne$script:gameModePanel){$script:gameModePanel.Visibility=[Windows.Visibility]::Collapsed}
    if($null-ne$script:menuWindow-and$script:menuWindow.IsVisible){$script:menuWindow.Hide()}
    Update-Hud;Update-Menu
}

function Update-Football {
    if(-not$script:footballActive-or$null-eq$script:footballBall){return}
    if($script:footballGoalCooldown-gt0){$script:footballGoalCooldown--}
    if($script:footballCountdownTicks-gt0){
        $script:footballCountdownTicks--
        $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop;$width=[Windows.SystemParameters]::VirtualScreenWidth
        $script:footballBall.X=$left+($width-$script:footballBall.Size)/2;$script:footballBall.Y=$top+105
        $script:footballBall.VX=0;$script:footballBall.VY=0;$script:footballBall.Window.Left=$script:footballBall.X;$script:footballBall.Window.Top=$script:footballBall.Y
        return
    }
    if($script:footballKickoffTextTicks-gt0){$script:footballKickoffTextTicks--}
    if($script:footballMatchOver-or$script:footballGoalCooldown-gt0){return}
    $ball=$script:footballBall
    $leftGoalHit=$ball.X+$ball.Size-gt$script:footballLeftGoal.X-and$ball.X-lt$script:footballLeftGoal.X+$script:footballLeftGoal.Width-and$ball.Y+$ball.Size-gt$script:footballLeftGoal.Y
    $rightGoalHit=$ball.X+$ball.Size-gt$script:footballRightGoal.X-and$ball.X-lt$script:footballRightGoal.X+$script:footballRightGoal.Width-and$ball.Y+$ball.Size-gt$script:footballRightGoal.Y
    if($leftGoalHit){$script:footballP2Score++;$message='GOAL!  P2 SCORES'}elseif($rightGoalHit){$script:footballP1Score++;$message='GOAL!  P1 SCORES'}else{return}
    if($script:footballP1Score-ge3-or$script:footballP2Score-ge3){
        $script:footballMatchOver=$true;$script:footballMessage=$(if($script:footballP1Score-gt$script:footballP2Score){'P1 WINS!'}else{'P2 WINS!'})
        $ball.VX=0;$ball.VY=0
    }else{Reset-FootballKickoff $message}
}

function Close-WispfallLava {
    if($null-ne$script:wispfallLavaWindow){
        try{$script:wispfallLavaWindow.Close()}catch{}
        $script:wispfallLavaWindow=$null
    }
}

function Hide-SandboxObjectsForWispfall {
    if($script:wispfallStoredBlocks.Count-or$script:wispfallStoredGadgets.Count-or$script:wispfallStoredWires.Count){return}
    Set-WireEditingVisible $false;Set-RopeEditingVisible $false
    $script:wispfallStoredBlocks=@($script:playroomBlocks)
    $script:wispfallStoredGadgets=@($script:playroomGadgets)
    $script:wispfallStoredWires=@($script:playroomWires)
    foreach($block in $script:wispfallStoredBlocks){$block.Window.Hide()}
    foreach($gadget in $script:wispfallStoredGadgets){if($null-ne$gadget.Window){$gadget.Window.Hide()}}
    foreach($wire in $script:wispfallStoredWires){if($null-ne$wire.Window){$wire.Window.Hide()}}
    $script:playroomBlocks.Clear();$script:playroomGadgets.Clear();$script:playroomWires.Clear()
}

function Restore-SandboxObjectsAfterWispfall {
    foreach($block in @($script:wispfallStoredBlocks)){
        $script:playroomBlocks.Add($block)|Out-Null
        if($block.TemporaryState-ne'Gone'){$block.Window.Show()}
    }
    foreach($gadget in @($script:wispfallStoredGadgets)){$script:playroomGadgets.Add($gadget)|Out-Null;if($null-ne$gadget.Window){$gadget.Window.Show()}}
    foreach($wire in @($script:wispfallStoredWires)){$script:playroomWires.Add($wire)|Out-Null}
    $script:wispfallStoredBlocks=@();$script:wispfallStoredGadgets=@();$script:wispfallStoredWires=@()
}

function Remove-WispfallSetup {
    foreach($block in @($script:playroomBlocks|Where-Object{$_.WispfallGenerated})){Remove-PlayroomBlock $block}
    foreach($gadget in @($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['WispfallGenerated']-and$_.WispfallGenerated})){Remove-PlayroomPlacement $gadget}
    Close-WispfallLava
    $script:wispfallActive=$false
    Restore-SandboxObjectsAfterWispfall
    if($null-ne$script:wispfallPreviousScalePercent){
        $restoreScale=[int]$script:wispfallPreviousScalePercent;$script:wispfallPreviousScalePercent=$null
        if($script:petScalePercent-ne$restoreScale){Set-PetScale $restoreScale $false}
    }
}

function Return-ToSandbox {
    if($script:footballActive){
        $script:footballActive=$false
        Clear-PlayroomBalls
        Remove-FootballSetup
    }
    if($script:wispfallActive-or$null-ne$script:wispfallLavaWindow){Remove-WispfallSetup}
    # Return-ToSandbox is also used after ordinary Survival/Dodgeball sessions,
    # where Stop-Playroom has disabled the editor state entirely. Re-enter the
    # playroom before restoring its controls and visuals.
    if(-not$script:playroomActive){Start-Playroom}
    $script:gameType='Survival';$script:wispfallGameOver=$false;$script:footballMatchOver=$false
    $script:active=$true;$script:hearts=[Math]::Max(1,$script:hearts)
    Register-ControlKeys $true;Set-ClickThrough $false
    Set-WireEditingVisible $true;Set-RopeEditingVisible $true
    foreach($block in @($script:playroomBlocks)){Set-BlockGameplayVisual $block $false}
    foreach($placement in @($script:playroomGadgets)){
        if($placement.Kind-in@('Rotator','Rope')){$placement.Window.Show()}
        else{Set-OverlayClickThroughState $placement.Window $false}
    }
    if($null-eq$script:sandboxHotbarWindow){New-SandboxToolbox}
    Set-SandboxToolboxVisible $true
    Update-PlatformHighlights;Update-Hud;Update-Menu
}

function Add-WispfallPlatform([double]$y) {
    $previousY=$script:wispfallHighestY;$previousX=$script:wispfallLastX
    $stage=[Math]::Floor($script:wispfallTicks/1800)
    $types=$(if($stage-le0){@('Normal','Grass','Bouncy')}elseif($stage-eq1){@('Normal','Wooden','Bouncy','Cloud','Ice')}elseif($stage-eq2){@('Wooden','Cloud','Crumbling','Ice','Conveyor','Bouncy')}else{@('Cloud','Crumbling','Wooden','Conveyor','Bouncy','Fire')})
    $type=$types[$script:random.Next(0,$types.Count)]
    Add-PlayroomBlock $type
    $block=@($script:playroomBlocks|Select-Object -Last 1)[0]
    $screenLeft=[Windows.SystemParameters]::VirtualScreenLeft;$screenWidth=[Windows.SystemParameters]::VirtualScreenWidth
    # Wispfall needs an open climbing route: platforms should leave enough vertical
    # clearance for the pet and should lead the player across the whole desktop.
    $sizeRoll=$script:random.NextDouble()
    $block.Width=$(if($sizeRoll-lt.18){$script:random.Next(110,151)}elseif($sizeRoll-gt.82){$script:random.Next(270,351)}elseif($stage-le0){$script:random.Next(190,271)}elseif($stage-eq1){$script:random.Next(165,246)}else{$script:random.Next(140,216)})
    $laneCount=[Math]::Max(6,[Math]::Min(10,[Math]::Floor($screenWidth/175)))
    $laneWidth=($screenWidth-80)/$laneCount
    if($script:wispfallLastLane-le0){$script:wispfallLaneDirection=1}
    elseif($script:wispfallLastLane-ge($laneCount-1)){$script:wispfallLaneDirection=-1}
    $laneStep=$(if($script:random.NextDouble()-lt.28){2}else{1})
    $directedLane=$script:wispfallLastLane+($script:wispfallLaneDirection*$laneStep)
    if($directedLane-lt0-or$directedLane-ge$laneCount){
        $script:wispfallLaneDirection*=-1
        $directedLane=$script:wispfallLastLane+($script:wispfallLaneDirection*$laneStep)
    }
    $directedLane=[Math]::Max(0,[Math]::Min($laneCount-1,$directedLane))
    $lane=$(if($script:random.NextDouble()-lt.88){$directedLane}else{[Math]::Max(0,[Math]::Min($laneCount-1,$script:wispfallLastLane+$script:random.Next(-1,2)))})
    $laneCentre=$screenLeft+40+(($lane+.5)*$laneWidth)
    $jitter=[Math]::Min(34,$laneWidth*.2)
    $candidate=$laneCentre-($block.Width/2)+(($script:random.NextDouble()*2-1)*$jitter)
    $minX=$screenLeft+25;$maxX=$screenLeft+$screenWidth-$block.Width-25
    $block.X=[Math]::Max($minX,[Math]::Min($maxX,$candidate));$block.Y=$y
    $block.Height=$(if($type-eq'Wooden'){18}else{30});$block.WispfallGenerated=$true
    # This resizes both the logical collision body and its painted WPF window.
    Set-PlacementAngle $block 0;Set-BlockGameplayVisual $block $true
    $ladderAdded=$false
    if($previousY-gt$y-and($env:WINDOWISP_TEST_WISPFALL_VARIETY-eq'1'-or$script:random.NextDouble()-lt.12)){
        $gap=$previousY-$y
        Add-PlayroomBlock 'Ladder';$ladder=@($script:playroomBlocks|Select-Object -Last 1)[0]
        $ladder.Width=56;$ladder.Height=[Math]::Max(105,$gap+18)
        $ladder.X=[Math]::Max($screenLeft+10,[Math]::Min($screenLeft+$screenWidth-$ladder.Width-10,$block.X+($block.Width-$ladder.Width)/2))
        $ladder.Y=$block.Y+6;$ladder.WispfallGenerated=$true;Set-PlacementAngle $ladder 0;Set-BlockGameplayVisual $ladder $true
        $ladderAdded=$true
    }
    if(-not$ladderAdded-and$block.Width-ge170-and$type-notin@('Cloud','Crumbling','Fire')-and($env:WINDOWISP_TEST_WISPFALL_VARIETY-eq'1'-or$script:random.NextDouble()-lt.13)){
        Add-PlayroomGadget 'Spring';$spring=@($script:playroomGadgets|Where-Object{$_.Kind-eq'Spring'}|Select-Object -Last 1)[0]
        if($null-ne$spring){
            $spring|Add-Member -NotePropertyName WispfallGenerated -NotePropertyValue $true -Force
            $spring|Add-Member -NotePropertyName WispfallSupport -NotePropertyValue $block -Force
            $spring.X=$block.X+($block.Width-$spring.Width)/2;$spring.Y=$block.Y-$spring.Height+8
            Set-PlacementWindowPosition $spring;Set-OverlayClickThroughState $spring.Window $true
        }
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_WISPFALL_VARIETY-eq'1'){
        [Console]::Out.WriteLine("diagnostic:wispfall-platform type=$type logical=$([Math]::Round($block.Width))x$([Math]::Round($block.Height)) window=$([Math]::Round($block.Window.Width))x$([Math]::Round($block.Window.Height)) ladders=$(@($script:playroomBlocks|Where-Object{$_.WispfallGenerated-and$_.Type-eq'Ladder'}).Count) springs=$(@($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['WispfallGenerated']-and$_.WispfallGenerated}).Count)")
    }
    $script:wispfallLastX=$block.X+($block.Width/2);$script:wispfallLastLane=$lane;$script:wispfallHighestY=$y
}

function Start-Wispfall {
    if(-not$script:playroomActive){Start-Playroom}
    if($script:footballActive){$script:footballActive=$false;Remove-FootballSetup}
    Remove-WispfallSetup
    $script:wispfallPreviousScalePercent=$script:petScalePercent
    if($script:petScalePercent-ne70){Set-PetScale 70 $false}
    Clear-PlayroomBalls
    Hide-SandboxObjectsForWispfall
    $script:wispfallActive=$true;$script:gameType='Wispfall';$script:wispfallTicks=0;$script:wispfallScore=0;$script:wispfallGameOver=$false
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop;$width=[Windows.SystemParameters]::VirtualScreenWidth;$height=[Windows.SystemParameters]::VirtualScreenHeight
    $laneCount=[Math]::Max(6,[Math]::Min(10,[Math]::Floor($width/175)))
    $script:wispfallLavaTop=$top+$height-55;$script:wispfallLastX=$left+($width/2);$script:wispfallLastLane=[Math]::Floor($laneCount/2);$script:wispfallLaneDirection=$(if($script:random.Next(0,2)-eq0){-1}else{1});$script:wispfallHighestY=$top+$height-130
    $lava=New-Object Windows.Window;$lava.Title='Windowisp Wispfall Lava';$lava.Width=$width;$lava.Height=70;$lava.Left=$left;$lava.Top=$script:wispfallLavaTop
    $lava.WindowStyle='None';$lava.AllowsTransparency=$true;$lava.Background=[Windows.Media.Brushes]::Transparent
    $lava.Topmost=$true;$lava.ShowInTaskbar=$false;$lava.ShowActivated=$false;$lava.ResizeMode='NoResize';$lava.Show();Set-OverlayClickThrough $lava;$script:wispfallLavaWindow=$lava
    $lavaGrid=New-Object Windows.Controls.Grid;$lavaGrid.ClipToBounds=$true;$lavaGrid.IsHitTestVisible=$false
    $lavaDepth=New-Object Windows.Controls.Border
    $lavaSource=Get-ToyboxImageSource 'WispfallLava'
    if($null-ne$lavaSource){
        $lavaBrush=New-Object Windows.Media.ImageBrush $lavaSource;$lavaBrush.TileMode='FlipXY';$lavaBrush.ViewportUnits='Absolute'
        $lavaBrush.Viewport=[Windows.Rect]::new(0,0,330,330);$lavaBrush.Stretch='Fill';$lavaBrush.AlignmentX='Left';$lavaBrush.AlignmentY='Top'
        $lavaDepth.Background=$lavaBrush
    }else{$lavaDepth.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,171,18),[Windows.Media.Color]::FromRgb(116,5,30),90)}
    $lavaGrid.Children.Add($lavaDepth)|Out-Null
    $surface=New-Object Windows.Shapes.Path;$surface.Height=24;$surface.VerticalAlignment='Top';$surface.Stretch='Fill'
    $surface.Data=[Windows.Media.Geometry]::Parse('M0,14 C35,0 70,25 108,10 C147,-4 184,23 222,8 C260,-5 300,23 340,9 C382,-4 420,24 464,8 C510,-5 552,21 600,10 L600,28 L0,28 Z')
    $surface.Fill=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(255,250,92),[Windows.Media.Color]::FromRgb(255,112,12),90)
    $surface.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,239,102));$surface.StrokeThickness=3
    $lavaGrid.Children.Add($surface)|Out-Null
    $bubbleCanvas=New-Object Windows.Controls.Canvas;$bubbleCanvas.ClipToBounds=$true
    foreach($bubbleSpec in @(@(.06,20,12),@(.15,43,7),@(.27,28,16),@(.39,51,9),@(.52,31,13),@(.66,47,8),@(.78,23,15),@(.9,40,10),@(.96,16,6))){
        $bubble=New-Object Windows.Shapes.Ellipse;$bubble.Width=$bubbleSpec[2];$bubble.Height=$bubbleSpec[2]
        $bubble.Fill=New-Object Windows.Media.RadialGradientBrush ([Windows.Media.Color]::FromRgb(255,247,118),[Windows.Media.Color]::FromRgb(255,91,9))
        $bubble.Stroke=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,202,35));$bubble.StrokeThickness=1.5
        [Windows.Controls.Canvas]::SetLeft($bubble,$width*$bubbleSpec[0]);[Windows.Controls.Canvas]::SetTop($bubble,$bubbleSpec[1]);$bubbleCanvas.Children.Add($bubble)|Out-Null
    }
    $lavaGrid.Children.Add($bubbleCanvas)|Out-Null;$lava.Content=$lavaGrid
    foreach($offset in @(0,150,300,450,600,750)){Add-WispfallPlatform ($top+$height-125-$offset)}
    $start=@($script:playroomBlocks|Where-Object{$_.WispfallGenerated-and$_.Type-ne'Ladder'}|Sort-Object Y -Descending|Select-Object -First 1)[0]
    $script:x=$start.X+20;$script:y=$start.Y-$PetHeight;$script:vx=0;$script:vy=0;$script:grounded=$true
    if($script:twoPlayerActive){$script:p2X=$start.X+$start.Width-$PetWidth-20;$script:p2Y=$script:y;$script:p2VX=0;$script:p2VY=0}
    Set-SandboxToolboxVisible $false;Set-WireEditingVisible $false;Set-RopeEditingVisible $false
    foreach($block in @($script:playroomBlocks|Where-Object{$_.WispfallGenerated})){Set-BlockGameplayVisual $block $true}
    $script:active=$true;Register-ControlKeys $true;Set-ClickThrough $false
    if($null-ne$script:gameModePanel){$script:gameModePanel.Visibility='Collapsed'};if($null-ne$script:menuWindow){$script:menuWindow.Hide()}
    Update-Hud;Update-Menu
}

function Update-Wispfall {
    if(-not$script:wispfallActive-or$script:wispfallGameOver){return}
    $script:wispfallTicks++;$script:wispfallScore=[Math]::Max($script:wispfallScore,[Math]::Floor($script:wispfallTicks/6))
    $top=[Windows.SystemParameters]::VirtualScreenTop;$bottom=$top+[Windows.SystemParameters]::VirtualScreenHeight
    $descent=[Math]::Min(1.45,.22+($script:wispfallTicks/9000.0));$rise=[Math]::Min(.34,.045+($script:wispfallTicks/30000.0))
    $lavaLimit=$bottom-([Windows.SystemParameters]::VirtualScreenHeight*.15)
    $script:wispfallLavaTop=[Math]::Max($lavaLimit,$script:wispfallLavaTop-$rise)
    $script:wispfallLavaWindow.Top=$script:wispfallLavaTop;$script:wispfallLavaWindow.Height=$bottom-$script:wispfallLavaTop+8
    foreach($block in @($script:playroomBlocks|Where-Object{$_.WispfallGenerated})){
        $block.Y+=$descent;Set-PlacementWindowPosition $block
        if($block.Y-gt$script:wispfallLavaTop+25){Remove-PlayroomBlock $block}
    }
    foreach($spring in @($script:playroomGadgets|Where-Object{$null-ne$_.PSObject.Properties['WispfallGenerated']-and$_.WispfallGenerated})){
        $support=$spring.WispfallSupport
        if($null-eq$support-or-not$script:playroomBlocks.Contains($support)-or$support.TemporaryState-eq'Gone'){
            Remove-PlayroomPlacement $spring;continue
        }
        $spring.X=$support.X+($support.Width-$spring.Width)/2;$spring.Y=$support.Y-$spring.Height+8;Set-PlacementWindowPosition $spring
    }
    if($script:wispfallHighestY-gt$top+85){Add-WispfallPlatform ($script:wispfallHighestY-$script:random.Next(135,171))}
    # Keep the generated stream filled above the screen as old platforms descend.
    $script:wispfallHighestY+=$descent
    Update-TemporaryBlocks
    $p1Out=$script:y+$PetHeight-12-ge$script:wispfallLavaTop
    $p2Out=$script:twoPlayerActive-and$script:p2Y+$PetHeight-12-ge$script:wispfallLavaTop
    if($p1Out-and(-not$script:twoPlayerActive-or$p2Out)){
        $script:wispfallGameOver=$true;$script:active=$false;Register-ControlKeys $false
        Close-WispfallLava
        Update-Hud;Update-Menu
    }
}

function Start-GameType([string]$type) {
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:start-game-type-begin type=$type playroom=$($script:playroomActive)")}
    if($type-eq'Football'){Start-Football;return}
    if($type-eq'Wispfall'){Start-Wispfall;return}
    if ($type -notin @('Survival','Dodgeball')) { $type = 'Survival' }
    if($script:footballActive){$script:footballActive=$false;Remove-FootballSetup}
    if($script:wispfallActive){Remove-WispfallSetup}
    if ($script:playroomActive) { Stop-Playroom }
    $script:gameType = $type
    Reset-Game
    Reset-PetPosition
    Set-GameMode $true
    $script:lastRenderKey = ''
    if ($null -ne $script:gameModePanel) { $script:gameModePanel.Visibility = [Windows.Visibility]::Collapsed }
    Update-Hud; Update-Menu
    Hide-ControlOverlay
    if ($null -ne $script:controlsWindow) { $script:controlsWindow.Close(); $script:controlsWindow = $null }
    [Windows.Input.Keyboard]::ClearFocus()
    if ($null -ne $script:menuWindow -and $script:menuWindow.IsVisible) { $script:menuWindow.Hide() }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:start-game-type-end type=$type active=$($script:active)")}
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:game-type $type" }
}

function Restart-CurrentGame { Start-GameType $script:gameType }

function Restart-SurvivalGame {
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:survival-restart playroom=$($script:playroomActive) active=$($script:active)" }
    Start-GameType 'Survival'
}

function Show-Controls {
    if ($null -ne $script:controlsWindow -and $script:controlsWindow.IsVisible) {
        $script:controlsWindow.Activate() | Out-Null
        return
    }

    $script:controlsWindow = New-Object Windows.Window
    $script:controlsWindow.Title = 'Windowisp Controls'
    $script:controlsWindow.Width = 386; $script:controlsWindow.Height = 565
    $script:controlsWindow.WindowStyle = [Windows.WindowStyle]::None
    $script:controlsWindow.AllowsTransparency = $true
    $script:controlsWindow.Background = [Windows.Media.Brushes]::Transparent
    $script:controlsWindow.ShowInTaskbar = $false; $script:controlsWindow.Topmost = $script:alwaysOnTop
    $script:controlsWindow.ResizeMode = [Windows.ResizeMode]::NoResize

    $layout = New-Object Windows.Controls.Grid
    $tail = New-Object Windows.Shapes.Polygon
    $tail.Points = New-Object Windows.Media.PointCollection
    $tail.Points.Add([Windows.Point]::new(0, 80))
    $tail.Points.Add([Windows.Point]::new(18, 68))
    $tail.Points.Add([Windows.Point]::new(18, 92))
    $tail.Fill = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(31, 28, 45))
    $tail.HorizontalAlignment = [Windows.HorizontalAlignment]::Left
    $tail.VerticalAlignment = [Windows.VerticalAlignment]::Top
    $layout.Children.Add($tail) | Out-Null

    $bubble = New-Object Windows.Controls.Border
    $bubble.Margin = [Windows.Thickness]::new(16, 0, 0, 0)
    $bubble.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(31, 28, 45))
    $bubble.BorderBrush = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(91, 78, 121))
    $bubble.BorderThickness = [Windows.Thickness]::new(1)
    $bubble.CornerRadius = [Windows.CornerRadius]::new(18)
    $bubble.Effect = New-Object Windows.Media.Effects.DropShadowEffect
    $bubble.Effect.Color = [Windows.Media.Colors]::Black
    $bubble.Effect.BlurRadius = 24; $bubble.Effect.ShadowDepth = 5; $bubble.Effect.Opacity = 0.42

    $content = New-Object Windows.Controls.StackPanel
    $content.Margin = [Windows.Thickness]::new(22, 16, 22, 18)
    $back = New-Object Windows.Controls.Button
    $back.Content = ([string][char]0x2190) + '  Back'
    $back.HorizontalAlignment = [Windows.HorizontalAlignment]::Left
    $back.Background = [Windows.Media.Brushes]::Transparent
    $back.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255, 178, 112))
    $back.BorderThickness = [Windows.Thickness]::new(0)
    $back.FontSize = 14; $back.FontWeight = [Windows.FontWeights]::SemiBold
    $back.Cursor = [Windows.Input.Cursors]::Hand
    $back.Add_Click({ $script:controlsWindow.Close(); $script:controlsWindow = $null })
    $content.Children.Add($back) | Out-Null

    $heading = New-Object Windows.Controls.TextBlock
    $heading.Text = 'CONTROLS'; $heading.Foreground = [Windows.Media.Brushes]::White
    $heading.FontSize = 20; $heading.FontWeight = [Windows.FontWeights]::Bold
    $heading.Margin = [Windows.Thickness]::new(2, 10, 0, 12)
    $content.Children.Add($heading) | Out-Null

    $controls = @(
        @('A / D or Left / Right', 'Move - double-tap in air to dash'),
        @('W / Space / Up', 'Jump - double jump or leap from blocks / screen edges'),
        @('S or Down', 'Drop through wooden platforms'),
        @('J', 'Hold to charge - release to fire'),
        @('E', 'Pick up / throw a nearby ball'),
        @('F7', 'Freeze frame + click-through'),
        @('F8', 'Pause / resume Game Mode'),
        @('F9', 'Restart the round'),
        @('F10', 'Close Windowisp'),
        @('Ctrl + Alt + P', 'Open or close the Control Centre'),
        @('Esc', 'Exit Game Mode'),
        @('P2 Arrows / Down', 'Move and drop - Numpad preset'),
        @('P2 Numpad 0 / + / 1', 'Jump / attack / interact'),
        @('P2 I / J / K / L / O / U', 'Laptop movement, attack + interact')
    )
    foreach ($entry in $controls) {
        $row = New-Object Windows.Controls.Grid
        $row.Margin = [Windows.Thickness]::new(2, 3, 2, 3)
        $row.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition -Property @{ Width = [Windows.GridLength]::new(132) }))
        $row.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition -Property @{ Width = [Windows.GridLength]::new(1, [Windows.GridUnitType]::Star) }))
        $key = New-Object Windows.Controls.TextBlock
        $key.Text = $entry[0]; $key.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255, 190, 132))
        $key.FontWeight = [Windows.FontWeights]::SemiBold; $key.FontSize = 12
        $action = New-Object Windows.Controls.TextBlock
        $action.Text = $entry[1]; $action.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(224, 219, 235))
        $action.FontSize = 12; $action.TextWrapping = [Windows.TextWrapping]::Wrap
        [Windows.Controls.Grid]::SetColumn($action, 1)
        $row.Children.Add($key) | Out-Null; $row.Children.Add($action) | Out-Null
        $content.Children.Add($row) | Out-Null
    }
    $tip = New-Object Windows.Controls.TextBlock
    $tip.Text = 'Tip: drag the dotted grip beside the paw to move the hub.'
    $tip.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(167, 158, 188))
    $tip.FontSize = 11; $tip.Margin = [Windows.Thickness]::new(2, 12, 2, 0)
    $content.Children.Add($tip) | Out-Null
    $bubble.Child = $content; $layout.Children.Add($bubble) | Out-Null
    $script:controlsWindow.Content = $layout

    $screenLeft = [Windows.SystemParameters]::VirtualScreenLeft
    $screenRight = $screenLeft + [Windows.SystemParameters]::VirtualScreenWidth
    $screenTop = [Windows.SystemParameters]::VirtualScreenTop
    $screenBottom = $screenTop + [Windows.SystemParameters]::VirtualScreenHeight
    $menuLeft = [Math]::Min($script:menuWindow.Left, $screenRight - $script:menuWindow.Width - $script:controlsWindow.Width - 20)
    $script:menuWindow.Left = [Math]::Max($screenLeft + 8, $menuLeft)
    $script:controlsWindow.Left = $script:menuWindow.Left + $script:menuWindow.Width + 6
    $script:controlsWindow.Top = [Math]::Max($screenTop + 8, [Math]::Min($screenBottom - $script:controlsWindow.Height - 8, $script:menuWindow.Top + 18))
    $script:controlsWindow.Opacity = 0
    $script:controlsWindow.Show()
    $fade = New-Object Windows.Media.Animation.DoubleAnimation
    $fade.From = 0; $fade.To = 1; $fade.Duration = [Windows.Duration]::new([TimeSpan]::FromMilliseconds(140))
    $script:controlsWindow.BeginAnimation([Windows.Window]::OpacityProperty, $fade)
}

function Get-ControlKeyName([int]$virtualKey) {
    switch ($virtualKey) {
        0x20 { return 'Space' }
        0x25 { return 'Left' }
        0x26 { return 'Up' }
        0x27 { return 'Right' }
        0x28 { return 'Down' }
        0x60 { return 'Numpad 0' }
        0x61 { return 'Numpad 1' }
        0x6B { return 'Numpad +' }
        default {
            $name = [Windows.Input.KeyInterop]::KeyFromVirtualKey($virtualKey).ToString()
            if ($name -match '^D([0-9])$') { return $Matches[1] }
            return $name
        }
    }
}

function Save-ControlBindings {
    try {
        $configDirectory = Split-Path -Parent $script:controlsConfigPath
        if (-not (Test-Path -LiteralPath $configDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
        }
        $script:controlBindings | ConvertTo-Json | Set-Content -LiteralPath $script:controlsConfigPath -Encoding UTF8
    } catch {}
}

function Update-ControlBindingButtons {
    foreach ($actionName in @($script:controlsBindingButtons.Keys)) {
        $button = $script:controlsBindingButtons[$actionName]
        $button.Content = Get-ControlKeyName ([int]$script:controlBindings[$actionName])
    }
}

function Hide-ControlOverlay {
    $script:capturingBinding = $null
    Update-ControlBindingButtons
    if ($null -ne $script:controlsOverlay) { $script:controlsOverlay.Visibility = [Windows.Visibility]::Collapsed }
}

function Show-ControlOverlay {
    if ($null -eq $script:controlsOverlay) { return }
    Update-ControlBindingButtons
    $script:controlsOverlay.Visibility = [Windows.Visibility]::Visible
    [Windows.Controls.Panel]::SetZIndex($script:controlsOverlay, 20)
    $script:menuWindow.Activate() | Out-Null
    $script:controlsOverlay.Focus() | Out-Null
}

function New-ControlsOverlay {
    $overlay = New-Object Windows.Controls.Border
    $overlay.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(255,26,23,38))
    $overlay.BorderBrush = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(91,78,121))
    $overlay.BorderThickness = [Windows.Thickness]::new(1)
    $overlay.Visibility = [Windows.Visibility]::Collapsed
    $overlay.Focusable = $true

    $layout = New-Object Windows.Controls.DockPanel
    $header = New-Object Windows.Controls.Grid
    $header.Height = 58; $header.Margin = [Windows.Thickness]::new(10,4,10,0)
    $back = New-Object Windows.Controls.Button
    $back.Content = ([string][char]0x2190); $back.Width=38; $back.Height=34
    $back.HorizontalAlignment='Left'; $back.Background=[Windows.Media.Brushes]::Transparent
    $back.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,178,112))
    $back.BorderThickness=[Windows.Thickness]::new(0);$back.FontSize=22;$back.Cursor=[Windows.Input.Cursors]::Hand
    $back.Add_Click({ Hide-ControlOverlay })
    $title = New-Object Windows.Controls.TextBlock
    $title.Text='CONTROLS';$title.Foreground=[Windows.Media.Brushes]::White;$title.FontSize=17
    $title.FontWeight=[Windows.FontWeights]::Bold;$title.HorizontalAlignment='Center';$title.VerticalAlignment='Center'
    $header.Children.Add($back)|Out-Null;$header.Children.Add($title)|Out-Null
    [Windows.Controls.DockPanel]::SetDock($header,[Windows.Controls.Dock]::Top)
    $layout.Children.Add($header)|Out-Null

    $scroll = New-Object Windows.Controls.ScrollViewer
    $scroll.VerticalScrollBarVisibility=[Windows.Controls.ScrollBarVisibility]::Auto
    $scroll.HorizontalScrollBarVisibility=[Windows.Controls.ScrollBarVisibility]::Disabled
    $content = New-Object Windows.Controls.StackPanel
    $content.Margin=[Windows.Thickness]::new(12,0,12,14)
    $hint = New-Object Windows.Controls.TextBlock
    $hint.Text='Click a key, then press its replacement.';$hint.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(177,168,196))
    $hint.FontSize=11;$hint.Margin=[Windows.Thickness]::new(4,0,4,8)
    $content.Children.Add($hint)|Out-Null
    $definitions = @(
        @('PLAYER 1',$null),
        @('Move Left','P1Left'),@('Move Right','P1Right'),@('Jump','P1Jump'),@('Drop','P1Drop'),@('Attack','P1Attack'),@('Interact / Throw','P1Interact'),
        @('PLAYER 2',$null),
        @('Move Left','P2Left'),@('Move Right','P2Right'),@('Jump','P2Jump'),@('Drop','P2Drop'),@('Attack','P2Attack'),@('Interact / Throw','P2Interact')
    )
    foreach ($definition in $definitions) {
        if ($null -eq $definition[1]) {
            $section = New-Object Windows.Controls.TextBlock
            $section.Text=$definition[0];$section.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,178,112))
            $section.FontSize=11;$section.FontWeight=[Windows.FontWeights]::Bold;$section.Margin=[Windows.Thickness]::new(4,8,4,4)
            $content.Children.Add($section)|Out-Null
            continue
        }
        $row = New-Object Windows.Controls.Grid
        $row.Height=38;$row.Margin=[Windows.Thickness]::new(2,2,2,2)
        $row.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition -Property @{Width=[Windows.GridLength]::new(1,[Windows.GridUnitType]::Star)}))
        $row.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition -Property @{Width=[Windows.GridLength]::new(102)}))
        $action = New-Object Windows.Controls.TextBlock
        $action.Text=$definition[0];$action.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(225,220,236))
        $action.FontSize=12;$action.VerticalAlignment='Center';$action.Margin=[Windows.Thickness]::new(8,0,4,0)
        $keyButton = New-Object Windows.Controls.Button
        $keyButton.Tag=$definition[1];$keyButton.Margin=[Windows.Thickness]::new(3)
        $keyButton.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(55,48,73))
        $keyButton.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,190,132))
        $keyButton.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(106,89,136))
        $keyButton.BorderThickness=[Windows.Thickness]::new(1);$keyButton.Cursor=[Windows.Input.Cursors]::Hand
        $keyButton.Add_Click({
            param($sender,$eventArgs)
            if ($null -ne $script:capturingBinding -and $script:controlsBindingButtons.ContainsKey($script:capturingBinding)) {
                Update-ControlBindingButtons
            }
            $script:capturingBinding=[string]$sender.Tag
            $sender.Content='Press key...'
            $script:menuWindow.Activate()|Out-Null
            $script:controlsOverlay.Focus()|Out-Null
        })
        [Windows.Controls.Grid]::SetColumn($keyButton,1)
        $row.Children.Add($action)|Out-Null;$row.Children.Add($keyButton)|Out-Null
        $script:controlsBindingButtons[$definition[1]]=$keyButton
        $content.Children.Add($row)|Out-Null
    }
    $reset = New-MenuButton 'Reset Controls' {
        $script:controlBindings=$script:controlDefaults.Clone()
        $script:p2Preset='Numpad'
        Save-ControlBindings; Update-ControlBindingButtons; Update-Menu
    }
    $content.Children.Add($reset)|Out-Null
    $scroll.Content=$content;$layout.Children.Add($scroll)|Out-Null
    $overlay.Child=$layout
    $overlay.Add_PreviewKeyDown({
        param($sender,$eventArgs)
        if ($null -eq $script:capturingBinding) { return }
        $pressedKey = $(if ($eventArgs.Key -eq [Windows.Input.Key]::System) { $eventArgs.SystemKey } else { $eventArgs.Key })
        if ($pressedKey -eq [Windows.Input.Key]::Escape) {
            $script:capturingBinding=$null;Update-ControlBindingButtons;$eventArgs.Handled=$true;return
        }
        $virtualKey=[Windows.Input.KeyInterop]::VirtualKeyFromKey($pressedKey)
        if ($virtualKey -gt 0) {
            $script:controlBindings[$script:capturingBinding]=[int]$virtualKey
            $script:capturingBinding=$null;Save-ControlBindings;Update-ControlBindingButtons
            $eventArgs.Handled=$true
        }
    })
    $script:controlsOverlay=$overlay
    Update-ControlBindingButtons
    return $overlay
}

function Set-AlwaysOnTop([bool]$enabled) {
    $script:alwaysOnTop = $enabled
    $window.Topmost = $enabled
    if ($null -ne $script:menuButtonWindow) { $script:menuButtonWindow.Topmost = $enabled }
    if ($null -ne $script:menuWindow) { $script:menuWindow.Topmost = $enabled }
    if ($null -ne $script:controlsWindow) { $script:controlsWindow.Topmost = $enabled }
    if ($null -ne $script:player2Window) { $script:player2Window.Topmost = $enabled }
    if ($null -ne $script:sandboxHotbarWindow) { $script:sandboxHotbarWindow.Topmost = $enabled }
    if ($null -ne $script:gridOverlayWindow) { $script:gridOverlayWindow.Topmost = $enabled }
    if ($null -ne $script:sandboxTrayWindow) { $script:sandboxTrayWindow.Topmost = $enabled }
    if ($null -ne $script:petSelectorWindow) { $script:petSelectorWindow.Topmost = $enabled }
    if ($null -ne $script:ropeOverlayWindow) { $script:ropeOverlayWindow.Topmost = $enabled }
    foreach($gadget in @($script:playroomGadgets)){if($null-ne$gadget.Window){$gadget.Window.Topmost=$enabled}}
}

function Set-Frozen([bool]$enabled) {
    $script:frozen = $enabled
    Register-ControlKeys ($script:active -and -not $script:frozen)
    Set-ClickThrough ($script:frozen -or -not $script:active)
    Update-Menu
}

function Set-ActivePetAtlas([string]$path,[string]$id,[string]$displayName,[string]$player='P1') {
    if(-not(Test-Path -LiteralPath $path -PathType Leaf)){return}
    $newAtlas=New-Object Windows.Media.Imaging.BitmapImage
    $newAtlas.BeginInit();$newAtlas.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $newAtlas.UriSource=[Uri](Resolve-Path -LiteralPath $path).Path
    $newAtlas.EndInit();$newAtlas.Freeze()
    if($newAtlas.PixelWidth-ne1536-or$newAtlas.PixelHeight-ne2288){return}
    if($player-eq'P2'){
        $script:p2Atlas=$newAtlas;$script:p2PetId=$id;$script:p2PetName=$displayName
        $script:p2SpriteFrameCache.Clear();$script:p2LastRenderKey=''
        if($null-ne$script:p2StatusPortrait){$script:p2StatusPortrait.Source=Get-P2SpriteFrame 0 0}
        if($script:twoPlayerActive-and$null-ne$script:player2Window){Draw-Player2 'idle' $(if($script:p2Facing-eq0){1}else{$script:p2Facing}) 0}
    }else{
        $script:atlas=$newAtlas;$script:activePetId=$id;$script:activePetName=$displayName
        $script:spriteFrameCache.Clear();$script:lastRenderKey=''
        if($null-ne$script:p1StatusPortrait){$script:p1StatusPortrait.Source=Get-PetSpriteFrame 0 0}
    }
    Update-PetSelectorButton
    if($null-ne$script:petSelectorWindow-and$script:petSelectorWindow.IsVisible){Show-PetSelector}
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:pet-switch player=$player id=$id name=$displayName")}
}

function Get-PersonalPetCatalog {
    $userProfile=[Environment]::GetFolderPath('UserProfile')
    if(-not[string]::IsNullOrWhiteSpace($env:USERPROFILE)-and(Test-Path -LiteralPath $env:USERPROFILE -PathType Container)){
        $userProfile=$env:USERPROFILE
    }
    $petRoot=$(if(-not[string]::IsNullOrWhiteSpace($env:WINDOWISP_PET_ROOT)){$env:WINDOWISP_PET_ROOT}else{Join-Path $userProfile '.codex\pets'})
    $cacheRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\pet-cache'
    $personalCatalog=@()
    if(Test-Path -LiteralPath $petRoot -PathType Container){
        foreach($manifestPath in Get-ChildItem -LiteralPath $petRoot -Filter pet.json -File -Recurse -ErrorAction SilentlyContinue){
            try{
                $manifest=Get-Content -LiteralPath $manifestPath.FullName -Raw|ConvertFrom-Json
                if([int]$manifest.spriteVersionNumber-ne2-or[string]::IsNullOrWhiteSpace([string]$manifest.id)){continue}
                $safeId=([string]$manifest.id)-replace'[^a-zA-Z0-9._-]','_'
                $personalCatalog+=[pscustomobject]@{
                    Id=[string]$manifest.id
                    DisplayName=$(if($manifest.displayName){[string]$manifest.displayName}else{[string]$manifest.id})
                    CachePath=(Join-Path $cacheRoot "$safeId.png")
                    SourcePath=(Join-Path $manifestPath.DirectoryName ([string]$manifest.spritesheetPath))
                    Updated=$manifestPath.LastWriteTimeUtc
                    IsStarter=$false;IsBuiltIn=$false
                }
            }catch{}
        }
    }
    $builtInCatalog=@()
    $builtInRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\codex-default-pets'
    foreach($builtInSpec in @(@('codex','Codex'),@('dewey','Dewey'),@('fireball','Fireball'),@('hoots','Hoots'),@('rocky','Rocky'),@('seedy','Seedy'),@('stacky','Stacky'),@('bsod','BSOD'),@('null-signal','Null Signal'))){
        $builtInId=[string]$builtInSpec[0];$builtInSource=Join-Path $builtInRoot "$builtInId.webp"
        if((-not(Test-Path -LiteralPath $builtInSource -PathType Leaf))-or@($personalCatalog|Where-Object{$_.Id-eq$builtInId}).Count-gt0){continue}
        $builtInCatalog+=[pscustomobject]@{Id=$builtInId;DisplayName=[string]$builtInSpec[1];CachePath=(Join-Path $cacheRoot "$builtInId.png");SourcePath=$builtInSource;Updated=(Get-Item -LiteralPath $builtInSource).LastWriteTimeUtc;IsStarter=$false;IsBuiltIn=$true}
    }
    $starterCatalog=@()
    $starterManifestPath=Join-Path $PSScriptRoot 'assets\caiuto-cub\pet.json'
    if(Test-Path -LiteralPath $starterManifestPath -PathType Leaf){
        try{
            $starterManifest=Get-Content -LiteralPath $starterManifestPath -Raw|ConvertFrom-Json
            $starterSource=Join-Path (Split-Path -Parent $starterManifestPath) ([string]$starterManifest.spritesheetPath)
            if([int]$starterManifest.spriteVersionNumber-eq2-and(Test-Path -LiteralPath $starterSource -PathType Leaf)-and-not($personalCatalog|Where-Object{$_.Id-eq[string]$starterManifest.id})){
                $starterCatalog+=[pscustomobject]@{Id=[string]$starterManifest.id;DisplayName=$(if($starterManifest.displayName){[string]$starterManifest.displayName}else{[string]$starterManifest.id});CachePath=$starterSource;SourcePath=$starterSource;Updated=[DateTime]::MinValue;IsStarter=$true;IsBuiltIn=$false}
            }
        }catch{}
    }
    return @($personalCatalog|Sort-Object DisplayName)+@($builtInCatalog)+@($starterCatalog)
}

function Get-PetPreviewImage([string]$cachePath,[string]$sourcePath,[string]$id) {
    if($script:petSelectorTarget-eq'P2'-and$id-eq$script:p2PetId-and$null-ne$script:p2Atlas){
        return Get-P2SpriteFrame 0 0
    }
    if($id-eq$script:activePetId-and$null-ne$script:atlas){
        return Get-PetSpriteFrame 0 0
    }
    foreach($previewPath in @($cachePath,$sourcePath)){
    if(-not(Test-Path -LiteralPath $previewPath -PathType Leaf)){continue}
    try{
        $previewAtlas=New-Object Windows.Media.Imaging.BitmapImage
        $previewAtlas.BeginInit();$previewAtlas.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad
        $previewAtlas.UriSource=[Uri](Resolve-Path -LiteralPath $previewPath).Path
        $previewAtlas.EndInit();$previewAtlas.Freeze()
        if($previewAtlas.PixelWidth-eq1536-and$previewAtlas.PixelHeight-eq2288){
            return [Windows.Media.Imaging.CroppedBitmap]::new($previewAtlas,[Windows.Int32Rect]::new(0,0,192,208))
        }
    }catch{}
    }
    return $null
}

function Set-PetScale([int]$percent,[bool]$save=$true) {
    if($percent-notin@(70,85,100,115)){return}
    $oldWidth=$PetWidth;$oldHeight=$PetHeight
    $p1Center=$script:x+($oldWidth/2);$p1Bottom=$script:y+$oldHeight
    $p2Center=$script:p2X+($oldWidth/2);$p2Bottom=$script:p2Y+$oldHeight
    $script:petScalePercent=$percent
    $script:PetWidth=[int][Math]::Round($script:basePetWidth*($percent/100.0))
    $script:PetHeight=[int][Math]::Round($script:basePetHeight*($percent/100.0))
    $script:x=$p1Center-($script:PetWidth/2);$script:y=$p1Bottom-$script:PetHeight
    $window.Width=$script:PetWidth;$window.Height=$script:PetHeight
    $pet.Width=$script:PetWidth;$pet.Height=$script:PetHeight
    if($script:twoPlayerActive-and$null-ne$script:player2Window){
        $script:p2X=$p2Center-($script:PetWidth/2);$script:p2Y=$p2Bottom-$script:PetHeight
        $script:player2Window.Width=$script:PetWidth;$script:player2Window.Height=$script:PetHeight
    }
    $script:lastRenderKey='';$script:p2LastRenderKey=''
    if($save){
        try{
            $directory=Split-Path -Parent $script:petScalePath
            if(-not(Test-Path -LiteralPath $directory -PathType Container)){New-Item -ItemType Directory -Path $directory -Force|Out-Null}
            @{percent=$percent}|ConvertTo-Json|Set-Content -LiteralPath $script:petScalePath -Encoding UTF8
        }catch{}
    }
    if($null-ne$script:petSelectorWindow-and$script:petSelectorWindow.IsVisible){Show-PetSelector}
}

function Update-PetSelectorButton {
    if($null-eq$script:petSelectorButton){return}
    $script:petSelectorButton.Content=([string][char]::ConvertFromUtf32(0x1F43A))
    $script:petSelectorButton.ToolTip=$(if($script:twoPlayerActive){"Choose player pets - P1: $($script:activePetName) | P2: $($script:p2PetName)"}else{"Choose player pet - P1: $($script:activePetName)"})
}

function Select-PetForPlayer($entry,[string]$targetPlayer) {
    if($null-eq$entry-or$targetPlayer-notin@('P1','P2')){return $false}
    $currentId=$(if($targetPlayer-eq'P2'){$script:p2PetId}else{$script:activePetId})
    if($entry.Id-eq$currentId){return $true}
    if(Test-Path -LiteralPath $entry.CachePath -PathType Leaf){
        Set-ActivePetAtlas $entry.CachePath $entry.Id $entry.DisplayName $targetPlayer|Out-Null
        return $(if($targetPlayer-eq'P2'){$script:p2PetId-eq$entry.Id}else{$script:activePetId-eq$entry.Id})
    }
    $launcher=Join-Path $PSScriptRoot 'game-mode.ps1'
    $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$launcher`"",'-Action','Switch','-PetId',"`"$($entry.Id)`"",'-Player',$targetPlayer)
    Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden|Out-Null
    return $true
}

function Show-PetSelector {
    if($null-ne$script:menuWindow-and$script:menuWindow.IsVisible){$script:menuWindow.Hide()}
    if($null-eq$script:petSelectorWindow){
        $script:petSelectorWindow=New-Object Windows.Window
        $script:petSelectorWindow.Title='Windowisp Pet Selector'
        $script:petSelectorWindow.Width=420;$script:petSelectorWindow.Height=330
        $script:petSelectorWindow.WindowStyle=[Windows.WindowStyle]::None
        $script:petSelectorWindow.AllowsTransparency=$true
        $script:petSelectorWindow.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(29,62,90),[Windows.Media.Color]::FromRgb(16,34,54),90)
        $script:petSelectorWindow.Topmost=$true;$script:petSelectorWindow.ShowInTaskbar=$false
        $script:petSelectorWindow.ResizeMode=[Windows.ResizeMode]::NoResize
        $root=New-Object Windows.Controls.DockPanel
        $top=New-Object Windows.Controls.StackPanel
        [Windows.Controls.DockPanel]::SetDock($top,[Windows.Controls.Dock]::Top);$root.Children.Add($top)|Out-Null
        $header=New-Object Windows.Controls.TextBlock
        $cloudGlyph=[string][char]0x2601
        $header.Text="$cloudGlyph  CHOOSE YOUR WINDOWISP  $cloudGlyph";$header.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(200,235,253))
        $header.FontSize=14;$header.FontWeight=[Windows.FontWeights]::Bold;$header.Margin=[Windows.Thickness]::new(14,12,10,8)
        $top.Children.Add($header)|Out-Null
        $players=New-Object Windows.Controls.StackPanel;$players.Orientation=[Windows.Controls.Orientation]::Horizontal
        $players.Margin=[Windows.Thickness]::new(12,0,8,6);$top.Children.Add($players)|Out-Null
        $script:petSelectorP1Button=New-Object Windows.Controls.Button
        $script:petSelectorP1Button.Content='Choose for P1';$script:petSelectorP1Button.Width=112;$script:petSelectorP1Button.Height=28
        $script:petSelectorP1Button.Margin=[Windows.Thickness]::new(0,0,6,0);$script:petSelectorP1Button.Add_Click({$script:petSelectorTarget='P1';Show-PetSelector})
        $players.Children.Add($script:petSelectorP1Button)|Out-Null
        $script:petSelectorP2Button=New-Object Windows.Controls.Button
        $script:petSelectorP2Button.Content='Choose for P2';$script:petSelectorP2Button.Width=112;$script:petSelectorP2Button.Height=28
        $script:petSelectorP2Button.Add_Click({$script:petSelectorTarget='P2';Show-PetSelector})
        $players.Children.Add($script:petSelectorP2Button)|Out-Null
        $sizeLabel=New-Object Windows.Controls.TextBlock
        $sizeLabel.Text='PET SIZE  -  applies to both players';$sizeLabel.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(166,203,226))
        $sizeLabel.FontSize=10;$sizeLabel.FontWeight=[Windows.FontWeights]::SemiBold;$sizeLabel.Margin=[Windows.Thickness]::new(14,3,10,5)
        $top.Children.Add($sizeLabel)|Out-Null
        $sizeGrid=New-Object Windows.Controls.Primitives.UniformGrid;$sizeGrid.Rows=1;$sizeGrid.Columns=4
        $sizeGrid.Margin=[Windows.Thickness]::new(12,0,12,8)
        foreach($sizeOption in @(@('Small',70),@('Compact',85),@('Normal',100),@('Large',115))){
            $sizeButton=New-Object Windows.Controls.Button
            $sizeButton.Content="$($sizeOption[0]) $($sizeOption[1])%";$sizeButton.Height=28;$sizeButton.Margin=[Windows.Thickness]::new(2,0,2,0)
            $sizeButton.Tag=[int]$sizeOption[1];$sizeButton.Foreground=[Windows.Media.Brushes]::White;$sizeButton.Cursor=[Windows.Input.Cursors]::Hand
            $sizeButton.Add_Click({param($sender,$eventArgs)Set-PetScale ([int]$sender.Tag) $true})
            $script:petSizeButtons+=,$sizeButton;$sizeGrid.Children.Add($sizeButton)|Out-Null
        }
        $top.Children.Add($sizeGrid)|Out-Null
        $scroll=New-Object Windows.Controls.ScrollViewer
        $scroll.VerticalScrollBarVisibility=[Windows.Controls.ScrollBarVisibility]::Auto
        $script:petSelectorPanel=New-Object Windows.Controls.WrapPanel
        $script:petSelectorPanel.Margin=[Windows.Thickness]::new(8)
        $scroll.Content=$script:petSelectorPanel;$root.Children.Add($scroll)|Out-Null
        $script:petSelectorWindow.Content=$root
    }
    if(-not$script:twoPlayerActive){$script:petSelectorTarget='P1'}
    $script:petSelectorP2Button.Visibility=$(if($script:twoPlayerActive){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed})
    foreach($sizeButton in @($script:petSizeButtons)){
        $selectedSize=[int]$sizeButton.Tag-eq$script:petScalePercent
        $sizeButton.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb($(if($selectedSize){53}else{31}),$(if($selectedSize){135}else{65}),$(if($selectedSize){181}else{92})))
        $sizeButton.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb($(if($selectedSize){151}else{83}),$(if($selectedSize){211}else{135}),$(if($selectedSize){242}else{169})))
    }
    foreach($pair in @(@($script:petSelectorP1Button,'P1'),@($script:petSelectorP2Button,'P2'))){
        $selected=$script:petSelectorTarget-eq$pair[1]
        $pair[0].Foreground=[Windows.Media.Brushes]::White
        $pair[0].Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb($(if($selected){47}else{31}),$(if($selected){121}else{65}),$(if($selected){174}else{92})))
        $pair[0].BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(116,187,230))
    }
    $selectedPetId=$(if($script:petSelectorTarget-eq'P2'){$script:p2PetId}else{$script:activePetId})
    $script:petSelectorPanel.Children.Clear()
    $selectedPetTile=$null
    $currentPetGroup=''
    foreach($entry in @(Get-PersonalPetCatalog)){
        $petGroup=$(if($entry.IsStarter){'WINDOWISP STARTER'}elseif($entry.IsBuiltIn){'CODEX PETS'}else{'YOUR PETS'})
        if($petGroup-ne$currentPetGroup){
            $groupHeader=New-Object Windows.Controls.TextBlock
            $groupHeader.Text=$petGroup;$groupHeader.Width=372;$groupHeader.Height=24
            $groupHeader.Margin=[Windows.Thickness]::new(7,8,7,0)
            $groupHeader.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(151,211,242))
            $groupHeader.FontSize=10;$groupHeader.FontWeight=[Windows.FontWeights]::Bold
            $script:petSelectorPanel.Children.Add($groupHeader)|Out-Null
            $currentPetGroup=$petGroup
        }
        $tile=New-Object Windows.Controls.Button
        $tile.Width=116;$tile.Height=128;$tile.Margin=[Windows.Thickness]::new(6)
        $tile.Tag=$entry;$tile.Cursor=[Windows.Input.Cursors]::Hand
        $tile.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb($(if($entry.Id-eq$selectedPetId){51}else{36}),$(if($entry.Id-eq$selectedPetId){103}else{68}),$(if($entry.Id-eq$selectedPetId){143}else{94})),[Windows.Media.Color]::FromRgb(20,42,63),90)
        $tile.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb($(if($entry.Id-eq$selectedPetId){126}else{78}),$(if($entry.Id-eq$selectedPetId){204}else{132}),$(if($entry.Id-eq$selectedPetId){246}else{164})))
        $tile.BorderThickness=[Windows.Thickness]::new($(if($entry.Id-eq$selectedPetId){2}else{1}))
        if($entry.Id-eq$selectedPetId){$selectedPetTile=$tile}
        $stack=New-Object Windows.Controls.StackPanel
        $previewSource=Get-PetPreviewImage $entry.CachePath $entry.SourcePath $entry.Id
        if($null-ne$previewSource){
            $preview=New-Object Windows.Controls.Image;$preview.Width=82;$preview.Height=82
            $preview.Stretch=[Windows.Media.Stretch]::Uniform;$preview.Source=$previewSource
        }else{
            $preview=New-Object Windows.Controls.Border;$preview.Width=82;$preview.Height=82
            $preview.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(48,78,101))
            $initial=New-Object Windows.Controls.TextBlock
            $initial.Text=$entry.DisplayName.Substring(0,1).ToUpperInvariant();$initial.FontSize=30
            $initial.FontWeight=[Windows.FontWeights]::Bold;$initial.Foreground=[Windows.Media.Brushes]::White
            $initial.HorizontalAlignment=[Windows.HorizontalAlignment]::Center;$initial.VerticalAlignment=[Windows.VerticalAlignment]::Center
            $preview.Child=$initial
        }
        $stack.Children.Add($preview)|Out-Null
        $name=New-Object Windows.Controls.TextBlock;$name.Text=$entry.DisplayName
        $name.Foreground=[Windows.Media.Brushes]::White;$name.FontSize=11;$name.FontWeight=[Windows.FontWeights]::SemiBold
        $name.HorizontalAlignment=[Windows.HorizontalAlignment]::Center;$name.TextTrimming=[Windows.TextTrimming]::CharacterEllipsis
        $stack.Children.Add($name)|Out-Null
        if($entry.Id-eq$selectedPetId){
            $active=New-Object Windows.Controls.TextBlock;$active.Text='ACTIVE';$active.FontSize=9
            $active.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(144,210,255))
            $active.HorizontalAlignment=[Windows.HorizontalAlignment]::Center;$stack.Children.Add($active)|Out-Null
        }
        $tile.Content=$stack
        $tile.Add_Click({
            param($sender,$eventArgs)
            $selectedEntry=$sender.Tag
            $selectedId=[string]$selectedEntry.Id
            $currentId=$(if($script:petSelectorTarget-eq'P2'){$script:p2PetId}else{$script:activePetId})
            if($selectedId-eq$currentId){$script:petSelectorWindow.Hide();return}
            Select-PetForPlayer $selectedEntry $script:petSelectorTarget|Out-Null
            $script:petSelectorWindow.Hide()
        })
        $script:petSelectorPanel.Children.Add($tile)|Out-Null
    }
    $script:petSelectorWindow.Left=[Windows.SystemParameters]::VirtualScreenLeft+[Windows.SystemParameters]::VirtualScreenWidth-$script:petSelectorWindow.Width-20
    $script:petSelectorWindow.Top=$script:menuButtonWindow.Top+$script:menuButtonWindow.Height+6
    if(-not$script:petSelectorWindow.IsVisible){$script:petSelectorWindow.Show()}else{$script:petSelectorWindow.Activate()|Out-Null}
    if($null-ne$selectedPetTile){$script:petSelectorWindow.UpdateLayout();$selectedPetTile.BringIntoView()}
}

function Toggle-PetSelector {
    if($null-ne$script:petSelectorWindow-and$script:petSelectorWindow.IsVisible){$script:petSelectorWindow.Hide()}else{Show-PetSelector}
}

function Update-Menu {
    if ($null -eq $script:menuWindow) { return }
    $state = $(if ($script:frozen) { 'FROZEN' } elseif($script:footballActive){'FOOTBALL'} elseif($script:wispfallActive){$(if($script:wispfallGameOver){'WISPFALL OVER'}else{'WISPFALL'})} elseif ($script:playroomActive) { 'SANDBOX' } elseif ($script:hearts -le 0) { "$($script:gameType.ToUpper()) OVER" } elseif ($script:active) { $script:gameType.ToUpper() } else { 'PET PAUSED' })
    $script:menuTitle.Text = "$([string][char]0x2601)  WINDOWISP  |  $state"
    $script:menuActionButton.Content.Children[0].Text = $(if ($script:active -and -not $script:playroomActive) { "Pause $($script:gameType)" } else { 'Start Game Mode' })
    $restartAvailable=($script:footballActive-or$script:wispfallActive-or($script:active-and-not$script:playroomActive))
    $script:menuRestartButton.Visibility=$(if($restartAvailable){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed})
    $script:menuRestartButton.Content.Children[0].Text=$(if($script:footballActive){'Restart Football Match'}elseif($script:wispfallActive){'Restart Wispfall Run'}else{"Restart $($script:gameType)"})
    $script:menuFreezeButton.Content.Children[0].Text = $(if ($script:frozen) { 'Unfreeze Pet' } else { 'Freeze Pet' })
    $script:menuSpeedButton.Content.Children[1].Text = $script:petSpeedNames[$script:petSpeedIndex]
    $script:menuWanderButton.Content.Children[1].Text = $(if ($script:autoWander) { 'On' } else { 'Off' })
    $script:menuTopmostButton.Content.Children[1].Text = $(if ($script:alwaysOnTop) { 'On' } else { 'Off' })
    if($null-ne$script:menuFamiliarButton){$script:menuFamiliarButton.Content.Children[1].Text=$script:familiarMode}
    $script:p2MenuButton.Content.Children[0].Text = $(if ($script:twoPlayerActive) { 'Disable Two Player' } else { 'Enable Two Player' })
    $script:p2PresetButton.Content.Children[1].Text = $script:p2Preset
    $script:p2PresetButton.Visibility = $(if($script:twoPlayerActive){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed})
    if($null-ne$script:p2ControllerButton){
        $script:p2ControllerButton.Content.Children[1].Text=$script:p2ControllerMode
        $script:p2ControllerButton.Visibility=$(if($script:twoPlayerActive){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed})
    }
    if($null-ne$script:p2AIDifficultyButton){
        $script:p2AIDifficultyButton.Content.Children[1].Text=$script:p2AIDifficulty
        $script:p2AIDifficultyButton.Visibility=$(if($script:twoPlayerActive-and$script:p2ControllerMode-eq'Opponent'){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed})
    }
    $script:playroomButton.Content.Children[0].Text = $(if($script:wispfallActive-or$script:footballActive){'Return to Sandbox'}elseif ($script:playroomActive) { 'Open Builder Hotbar' } else { 'Start Sandbox Mode' })
    if($null-ne$script:sandboxToolButton){
        $script:sandboxToolButton.Visibility=[Windows.Visibility]::Visible
        $script:menuButtonWindow.Width=188
        $script:menuButtonWindow.Left=[Windows.SystemParameters]::VirtualScreenLeft+[Windows.SystemParameters]::VirtualScreenWidth-$script:menuButtonWindow.Width-20
    }
    if (-not $script:playroomActive) {
        $script:playroomPanel.Visibility = [Windows.Visibility]::Collapsed
    }
    if ($script:active -and -not $script:playroomActive) { $script:gameModePanel.Visibility = [Windows.Visibility]::Collapsed }
}

function Toggle-Menu {
    if ($null -eq $script:menuWindow) { return }
    if ($script:menuWindow.IsVisible) {
        if ($null -ne $script:controlsWindow) { $script:controlsWindow.Close(); $script:controlsWindow = $null }
        Hide-ControlOverlay
        $script:menuWindow.Hide()
    } else {
        Update-Menu
        $left = $script:menuButtonWindow.Left - $script:menuWindow.Width + $script:menuButtonWindow.Width
        $top = $script:menuButtonWindow.Top + $script:menuButtonWindow.Height + 6
        $minLeft = [Windows.SystemParameters]::VirtualScreenLeft + 8
        $maxLeft = [Windows.SystemParameters]::VirtualScreenLeft + [Windows.SystemParameters]::VirtualScreenWidth - $script:menuWindow.Width - 8
        $maxTop = [Windows.SystemParameters]::VirtualScreenTop + [Windows.SystemParameters]::VirtualScreenHeight - $script:menuWindow.Height - 8
        $script:menuWindow.Left = [Math]::Max($minLeft, [Math]::Min($maxLeft, $left))
        $script:menuWindow.Top = [Math]::Min($maxTop, $top)
        $script:menuWindow.Show(); $script:menuWindow.Activate() | Out-Null
    }
}

function Show-QuickTutorial([bool]$firstRun = $false) {
    if ($null -ne $script:tutorialWindow -and $script:tutorialWindow.IsVisible) {
        $script:tutorialWindow.Activate() | Out-Null
        return
    }
    $tutorial = New-Object Windows.Window
    $tutorial.Title = 'Windowisp Quick Tutorial'
    $tutorial.Width = 430; $tutorial.Height = 430
    $tutorial.WindowStyle = [Windows.WindowStyle]::None
    $tutorial.AllowsTransparency = $true
    $tutorial.Background = [Windows.Media.Brushes]::Transparent
    $tutorial.Topmost = $true; $tutorial.ShowInTaskbar = $false
    $tutorial.ResizeMode = [Windows.ResizeMode]::NoResize
    $tutorial.Left = [Windows.SystemParameters]::VirtualScreenLeft + ([Windows.SystemParameters]::VirtualScreenWidth - $tutorial.Width) / 2
    $tutorial.Top = [Windows.SystemParameters]::VirtualScreenTop + ([Windows.SystemParameters]::VirtualScreenHeight - $tutorial.Height) / 2

    $card = New-Object Windows.Controls.Border
    $card.CornerRadius = [Windows.CornerRadius]::new(18)
    $card.BorderThickness = [Windows.Thickness]::new(2)
    $card.BorderBrush = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(74, 174, 238))
    $card.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(250, 26, 23, 38))
    $card.Padding = [Windows.Thickness]::new(24, 20, 24, 20)
    $panel = New-Object Windows.Controls.StackPanel

    $title = New-Object Windows.Controls.TextBlock
    $title.Text = $(if ($firstRun) { 'WELCOME TO WINDOWISP' } else { 'WINDOWISP QUICK TUTORIAL' })
    $title.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(116, 211, 255))
    $title.FontSize = 20; $title.FontWeight = [Windows.FontWeights]::Bold
    $title.Margin = [Windows.Thickness]::new(0, 0, 0, 12)
    $panel.Children.Add($title) | Out-Null

    $intro = New-Object Windows.Controls.TextBlock
    $intro.Text = 'Windowisp starts in Sandbox so you can meet your pet and build safely.'
    $intro.TextWrapping = [Windows.TextWrapping]::Wrap
    $intro.Foreground = [Windows.Media.Brushes]::White; $intro.FontSize = 14
    $intro.Margin = [Windows.Thickness]::new(0, 0, 0, 13)
    $panel.Children.Add($intro) | Out-Null

    foreach ($tipText in @(
        '1  BUILD  -  Use the blue tools button to place blocks, toys, gadgets and hazards.',
        '2  PLAY  -  Open the paw menu, choose Start Game Mode, then Survival or Dodgeball.',
        '3  MOVE  -  A/D moves, W or Space jumps, S drops, J attacks and E carries toys.',
        '4  DESKTOP  -  Application windows are platforms. Try moving or minimizing one.'
    )) {
        $tip = New-Object Windows.Controls.TextBlock
        $tip.Text = $tipText; $tip.TextWrapping = [Windows.TextWrapping]::Wrap
        $tip.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(226, 232, 244))
        $tip.FontSize = 13; $tip.Margin = [Windows.Thickness]::new(0, 0, 0, 10)
        $panel.Children.Add($tip) | Out-Null
    }

    $note = New-Object Windows.Controls.TextBlock
    $note.Text = 'Wires and editing handles hide automatically during gameplay. Press Ctrl+Alt+P whenever you need the menu.'
    $note.TextWrapping = [Windows.TextWrapping]::Wrap
    $note.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(175, 185, 205))
    $note.FontSize = 12; $note.Margin = [Windows.Thickness]::new(0, 2, 0, 14)
    $panel.Children.Add($note) | Out-Null

    $done = New-Object Windows.Controls.Button
    $done.Content = 'Got it - start building'
    $done.Height = 38; $done.FontWeight = [Windows.FontWeights]::Bold
    $done.Foreground = [Windows.Media.Brushes]::White
    $done.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(231, 119, 50))
    $done.BorderThickness = [Windows.Thickness]::new(0); $done.Cursor = [Windows.Input.Cursors]::Hand
    $done.Add_Click({
        try {
            $directory = Split-Path -Parent $script:tutorialSeenPath
            if (-not (Test-Path -LiteralPath $directory -PathType Container)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
            Set-Content -LiteralPath $script:tutorialSeenPath -Value 'Windowisp tutorial v1 completed' -Encoding UTF8
        } catch {}
        if ($null -ne $script:tutorialWindow) { $script:tutorialWindow.Close() }
    })
    $panel.Children.Add($done) | Out-Null
    $card.Child = $panel; $tutorial.Content = $card
    $tutorial.Add_Closed({ $script:tutorialWindow = $null })
    $script:tutorialWindow = $tutorial
    $tutorial.Show(); $tutorial.Activate() | Out-Null
}

function New-ControlCentre {
    $script:menuButtonWindow = New-Object Windows.Window
    $script:menuButtonWindow.Title = 'Windowisp Control Centre'
    $script:menuButtonWindow.Width = 188; $script:menuButtonWindow.Height = 48
    $script:menuButtonWindow.WindowStyle = [Windows.WindowStyle]::None
    $script:menuButtonWindow.AllowsTransparency = $true
    $script:menuButtonWindow.Background = [Windows.Media.Brushes]::Transparent
    $script:menuButtonWindow.Topmost = $true; $script:menuButtonWindow.ShowInTaskbar = $false
    $script:menuButtonWindow.ResizeMode = [Windows.ResizeMode]::NoResize
    $script:menuButtonWindow.Left = [Windows.SystemParameters]::VirtualScreenLeft + [Windows.SystemParameters]::VirtualScreenWidth - 208
    $script:menuButtonWindow.Top = [Windows.SystemParameters]::VirtualScreenTop + 110

    $dock = New-Object Windows.Controls.DockPanel
    $grip = New-Object Windows.Controls.Border
    $grip.Width = 12
    $grip.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(245,76,137,177))
    $grip.CornerRadius = [Windows.CornerRadius]::new(8,0,0,8)
    $grip.Cursor = [Windows.Input.Cursors]::SizeAll
    $gripText = New-Object Windows.Controls.TextBlock
    $gripText.Text = [string][char]0x22EE
    $gripText.Foreground = [Windows.Media.Brushes]::White
    $gripText.Opacity = 0.65;$gripText.FontSize = 18
    $gripText.HorizontalAlignment = 'Center';$gripText.VerticalAlignment = 'Center'
    $grip.Child = $gripText
    $grip.Add_MouseLeftButtonDown({$script:menuButtonWindow.DragMove()})
    [Windows.Controls.DockPanel]::SetDock($grip,[Windows.Controls.Dock]::Left)
    $dock.Children.Add($grip)|Out-Null
    $buttonGrid = New-Object Windows.Controls.Primitives.UniformGrid
    $buttonGrid.Rows=1;$buttonGrid.Columns=4

    $paw = New-Object Windows.Controls.Button
    $paw.Focusable=$false;$paw.IsTabStop=$false
    $paw.Content = ([string][char]::ConvertFromUtf32(0x1F43E))
    $paw.FontFamily = New-Object Windows.Media.FontFamily('Segoe UI Emoji')
    $paw.FontSize = 23; $paw.ToolTip = 'Open Windowisp menu (Ctrl+Alt+P)'
    $paw.Background = New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(239,148,67),[Windows.Media.Color]::FromRgb(171,79,35),90)
    $paw.Foreground = [Windows.Media.Brushes]::White; $paw.BorderThickness = [Windows.Thickness]::new(0)
    $paw.Cursor = [Windows.Input.Cursors]::Hand
    # Use a mouse-only event. WPF Button.Click can also be raised by Space when
    # Windows restores focus to this floating widget after another window hides.
    $paw.Add_PreviewMouseLeftButtonDown({
        param($sender,$eventArgs)
        $eventArgs.Handled=$true
        Toggle-Menu
    })
    $buttonGrid.Children.Add($paw) | Out-Null
    $script:sandboxToolButton=New-Object Windows.Controls.Button
    $script:sandboxToolButton.Focusable=$false;$script:sandboxToolButton.IsTabStop=$false
    $script:sandboxToolButton.Content=([string][char]::ConvertFromUtf32(0x1F6E0))
    $script:sandboxToolButton.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Emoji')
    $script:sandboxToolButton.FontSize=20
    $script:sandboxToolButton.ToolTip='Open or close Sandbox builder hotbar'
    $script:sandboxToolButton.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(94,183,108),[Windows.Media.Color]::FromRgb(40,105,66),90)
    $script:sandboxToolButton.Foreground=[Windows.Media.Brushes]::White
    $script:sandboxToolButton.BorderThickness=[Windows.Thickness]::new(0)
    $script:sandboxToolButton.Cursor=[Windows.Input.Cursors]::Hand
    $script:sandboxToolButton.Visibility=[Windows.Visibility]::Visible
    $script:sandboxToolButton.Add_PreviewMouseLeftButtonDown({
        param($sender,$eventArgs)
        $eventArgs.Handled=$true
        if(-not$script:playroomActive){Start-Playroom}
        if($null-eq$script:sandboxHotbarWindow){New-SandboxToolbox}
        Set-SandboxToolboxVisible (-not$script:sandboxHotbarWindow.IsVisible)
        if($null-ne$script:menuWindow-and$script:menuWindow.IsVisible){$script:menuWindow.Hide()}
    })
    $buttonGrid.Children.Add($script:sandboxToolButton)|Out-Null
    $script:petSelectorButton=New-Object Windows.Controls.Button
    $script:petSelectorButton.Focusable=$false;$script:petSelectorButton.IsTabStop=$false
    $script:petSelectorButton.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Emoji')
    $script:petSelectorButton.FontSize=20
    $script:petSelectorButton.Foreground=[Windows.Media.Brushes]::White
    $script:petSelectorButton.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(157,119,218),[Windows.Media.Color]::FromRgb(82,61,139),90)
    $script:petSelectorButton.BorderThickness=[Windows.Thickness]::new(0)
    $script:petSelectorButton.Cursor=[Windows.Input.Cursors]::Hand
    $script:petSelectorButton.Add_PreviewMouseLeftButtonDown({
        param($sender,$eventArgs)
        $eventArgs.Handled=$true
        Toggle-PetSelector
    })
    $buttonGrid.Children.Add($script:petSelectorButton)|Out-Null
    $script:wipPowerupButton=New-Object Windows.Controls.Button
    $script:wipPowerupButton.Focusable=$false;$script:wipPowerupButton.IsTabStop=$false;$script:wipPowerupButton.Cursor=[Windows.Input.Cursors]::Hand
    $script:wipPowerupButton.Tag='FuturePowerupWIP';$script:wipPowerupButton.ToolTip='Future Power-ups - work in progress'
    $script:wipPowerupButton.Background=New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(222,58,72),[Windows.Media.Color]::FromRgb(122,24,42),90)
    $script:wipPowerupButton.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,151,159));$script:wipPowerupButton.BorderThickness=[Windows.Thickness]::new(0)
    $wipStack=New-Object Windows.Controls.StackPanel;$wipStack.VerticalAlignment='Center'
    $wipQuestion=New-Object Windows.Controls.TextBlock;$wipQuestion.Text='???';$wipQuestion.FontSize=13;$wipQuestion.FontWeight='Black';$wipQuestion.Foreground=[Windows.Media.Brushes]::White;$wipQuestion.HorizontalAlignment='Center'
    $wipSign=New-Object Windows.Controls.Border;$wipSign.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,226,104));$wipSign.CornerRadius=[Windows.CornerRadius]::new(2);$wipSign.Padding=[Windows.Thickness]::new(3,0,3,0);$wipSign.HorizontalAlignment='Center'
    $wipText=New-Object Windows.Controls.TextBlock;$wipText.Text='WIP';$wipText.FontSize=8;$wipText.FontWeight='Bold';$wipText.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(76,39,33));$wipSign.Child=$wipText
    $wipStack.Children.Add($wipQuestion)|Out-Null;$wipStack.Children.Add($wipSign)|Out-Null;$script:wipPowerupButton.Content=$wipStack
    $script:wipPowerupButton.Add_PreviewMouseLeftButtonDown({param($sender,$eventArgs)$eventArgs.Handled=$true;if($null-ne$script:menuWindow-and-not$script:menuWindow.IsVisible){$script:menuWindow.Show()};$script:menuTitle.Text="$([string][char]0x2601)  POWER-UPS  |  COMING SOON"})
    $buttonGrid.Children.Add($script:wipPowerupButton)|Out-Null
    $dock.Children.Add($buttonGrid)|Out-Null
    $script:menuButtonWindow.Content = $dock
    Update-PetSelectorButton

    $script:menuWindow = New-Object Windows.Window
    $script:menuWindow.Title = 'Windowisp Menu'
    $script:menuWindow.Width = 300; $script:menuWindow.Height = 470
    $script:menuWindow.WindowStyle = [Windows.WindowStyle]::None
    $script:menuWindow.AllowsTransparency = $true
    $script:menuWindow.Background = New-Object Windows.Media.LinearGradientBrush ([Windows.Media.Color]::FromRgb(29,62,90),[Windows.Media.Color]::FromRgb(15,32,51),90)
    $script:menuWindow.Topmost = $true; $script:menuWindow.ShowInTaskbar = $false
    $script:menuWindow.ResizeMode = [Windows.ResizeMode]::NoResize

    $panel = New-Object Windows.Controls.StackPanel
    $script:menuTitle = New-Object Windows.Controls.TextBlock
    $script:menuTitle.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(201,236,253)); $script:menuTitle.FontSize = 15
    $script:menuTitle.FontWeight = [Windows.FontWeights]::Bold
    $script:menuTitle.Margin = [Windows.Thickness]::new(16, 14, 12, 10)
    $panel.Children.Add($script:menuTitle) | Out-Null

    $script:menuActionButton = New-MenuButton 'Start Game Mode' {
        if ($script:active -and -not $script:playroomActive) {
            Set-GameMode $false
        } else {
            $script:gameModePanel.Visibility = $(if ($script:gameModePanel.Visibility -eq [Windows.Visibility]::Visible) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
        }
        Update-Menu
    } 'F8'
    $panel.Children.Add($script:menuActionButton) | Out-Null
    $script:gameModePanel = New-Object Windows.Controls.StackPanel
    $script:gameModePanel.Margin = [Windows.Thickness]::new(8, 0, 8, 2)
    $script:gameModePanel.Visibility = [Windows.Visibility]::Collapsed
    $script:gameModePanel.Children.Add((New-MenuButton 'Survival Mode' { Start-GameType 'Survival' })) | Out-Null
    $script:gameModePanel.Children.Add((New-MenuButton 'Dodgeball' { Start-GameType 'Dodgeball' } '3 hits')) | Out-Null
    $script:gameModePanel.Children.Add((New-MenuButton 'Football' { Start-GameType 'Football' } 'First to 3')) | Out-Null
    $script:gameModePanel.Children.Add((New-MenuButton 'Wispfall' { Start-GameType 'Wispfall' } 'Climb!')) | Out-Null
    $panel.Children.Add($script:gameModePanel) | Out-Null
    $script:menuRestartButton = New-MenuButton 'Restart Round' { Restart-CurrentGame } 'F9'
    $panel.Children.Add($script:menuRestartButton) | Out-Null
    $script:menuFreezeButton = New-MenuButton 'Freeze Pet' { Set-Frozen (-not $script:frozen) } 'F7'
    $panel.Children.Add($script:menuFreezeButton) | Out-Null
    $script:p2MenuButton = New-MenuButton 'Enable Two Player' { Set-TwoPlayerMode (-not $script:twoPlayerActive) }
    $panel.Children.Add($script:p2MenuButton) | Out-Null
    $script:p2PresetButton = New-MenuButton 'Player 2 Controls' {
        $script:p2Preset = $(if ($script:p2Preset -eq 'Numpad') { 'Laptop' } else { 'Numpad' })
        Set-Player2PresetBindings $script:p2Preset
        Update-Menu
    } 'Numpad'
    $panel.Children.Add($script:p2PresetButton) | Out-Null
    $script:p2ControllerButton=New-MenuButton 'Player 2 Controller' {
        $next=$(switch($script:p2ControllerMode){'Human'{'Opponent'}'Opponent'{'Friend'}default{'Human'}})
        Set-Player2Controller $next
    } 'Human'
    $panel.Children.Add($script:p2ControllerButton)|Out-Null
    $script:p2AIDifficultyButton=New-MenuButton 'Opponent Difficulty' {
        $next=$(switch($script:p2AIDifficulty){'Friendly'{'Normal'}'Normal'{'Tricky'}default{'Friendly'}})
        Set-Player2AIDifficulty $next
    } 'Normal'
    $panel.Children.Add($script:p2AIDifficultyButton)|Out-Null
    $script:playroomButton = New-MenuButton 'Start Sandbox Mode' {
        if($script:wispfallActive-or$script:footballActive){
            Return-ToSandbox
        }elseif ($script:playroomActive) {
            if($null-eq$script:sandboxHotbarWindow){New-SandboxToolbox}
            Set-SandboxToolboxVisible $true
        } else {
            Start-Playroom
            Set-SandboxToolboxVisible $true
        }
        if($null-ne$script:menuWindow){$script:menuWindow.Hide()}
    }
    $panel.Children.Add($script:playroomButton) | Out-Null
    $script:playroomPanel = New-Object Windows.Controls.StackPanel
    $script:playroomPanel.Margin = [Windows.Thickness]::new(8, 0, 8, 2)
    $script:playroomPanel.Visibility = [Windows.Visibility]::Collapsed
    $script:playroomPanel.Children.Add((New-MenuButton 'Spawn Ball' { Add-PlayroomBall })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Normal Block' { Add-PlayroomBlock 'Normal' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Wooden Platform' { Add-PlayroomBlock 'Wooden' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Bouncy Block' { Add-PlayroomBlock 'Bouncy' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Fire Block' { Add-PlayroomBlock 'Fire' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Ice Block' { Add-PlayroomBlock 'Ice' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Ladder' { Add-PlayroomBlock 'Ladder' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Place Conveyor' { Add-PlayroomBlock 'Conveyor' })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Clear Toys + Blocks' { Clear-PlayroomObjects })) | Out-Null
    $script:playroomPanel.Children.Add((New-MenuButton 'Exit Sandbox (Keep Blocks)' { Stop-Playroom })) | Out-Null
    $panel.Children.Add($script:playroomPanel) | Out-Null
    $panel.Children.Add((New-MenuButton 'Reset Position' { Reset-PetPosition })) | Out-Null
    $panel.Children.Add((New-MenuButton 'Controls' { Show-ControlOverlay } 'Edit')) | Out-Null
    $panel.Children.Add((New-MenuButton 'Quick Tutorial' { Show-QuickTutorial $false } 'Help')) | Out-Null

    $settingsButton = New-MenuButton 'Settings' {
        $script:settingsPanel.Visibility = $(if ($script:settingsPanel.Visibility -eq [Windows.Visibility]::Visible) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
    }
    $panel.Children.Add($settingsButton) | Out-Null
    $script:settingsPanel = New-Object Windows.Controls.StackPanel
    $script:settingsPanel.Margin = [Windows.Thickness]::new(8, 0, 8, 2)
    $script:settingsPanel.Visibility = [Windows.Visibility]::Collapsed
    $script:menuSpeedButton = New-MenuButton 'Pet Speed' {
        $script:petSpeedIndex = ($script:petSpeedIndex + 1) % $script:petSpeedNames.Count
        Update-Menu
    } $script:petSpeedNames[$script:petSpeedIndex]
    $script:settingsPanel.Children.Add($script:menuSpeedButton) | Out-Null
    $script:menuWanderButton = New-MenuButton 'Auto Wander' {
        $script:autoWander = -not $script:autoWander
        Update-Menu
    } 'Off'
    $script:settingsPanel.Children.Add($script:menuWanderButton) | Out-Null
    $script:menuTopmostButton = New-MenuButton 'Always on Top' {
        Set-AlwaysOnTop (-not $script:alwaysOnTop)
        Update-Menu
    } 'On'
    $script:settingsPanel.Children.Add($script:menuTopmostButton) | Out-Null
    $script:menuFamiliarButton=New-MenuButton 'Familiar Speech' {
        $modes=@('Quiet','Normal','Chatty');$current=[Array]::IndexOf($modes,$script:familiarMode);Set-FamiliarMode $modes[(($current+1)%$modes.Count)]
    } $script:familiarMode
    $script:settingsPanel.Children.Add($script:menuFamiliarButton)|Out-Null
    $panel.Children.Add($script:settingsPanel) | Out-Null

    $recoveryButton = New-MenuButton 'Recovery' {
        $script:recoveryPanel.Visibility = $(if ($script:recoveryPanel.Visibility -eq [Windows.Visibility]::Visible) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
    } 'Stuck?'
    $panel.Children.Add($recoveryButton) | Out-Null
    $script:recoveryPanel = New-Object Windows.Controls.StackPanel
    $script:recoveryPanel.Margin = [Windows.Thickness]::new(8, 0, 8, 2)
    $script:recoveryPanel.Visibility = [Windows.Visibility]::Collapsed
    $script:recoveryPanel.Children.Add((New-MenuButton 'Unstick Pet' { Reset-WindowispRuntime } 'Keeps builds')) | Out-Null
    $script:recoveryPanel.Children.Add((New-MenuButton 'Restart Windowisp' { Restart-WindowispRuntime } 'Full reset')) | Out-Null
    $panel.Children.Add($script:recoveryPanel) | Out-Null

    $creditsButton = New-MenuButton 'Credits & Contact' {
        $script:creditsPanel.Visibility = $(if ($script:creditsPanel.Visibility -eq [Windows.Visibility]::Visible) { [Windows.Visibility]::Collapsed } else { [Windows.Visibility]::Visible })
    } 'About'
    $panel.Children.Add($creditsButton) | Out-Null
    $script:creditsPanel = New-Object Windows.Controls.StackPanel
    $script:creditsPanel.Margin = [Windows.Thickness]::new(8, 0, 8, 4)
    $script:creditsPanel.Visibility = [Windows.Visibility]::Collapsed
    $creditsCard=New-Object Windows.Controls.Border
    $creditsCard.Margin=[Windows.Thickness]::new(4,2,4,4);$creditsCard.Padding=[Windows.Thickness]::new(12,10,12,10)
    $creditsCard.CornerRadius=[Windows.CornerRadius]::new(7)
    $creditsCard.Background=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(20,43,67))
    $creditsCard.BorderBrush=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(104,168,211));$creditsCard.BorderThickness=[Windows.Thickness]::new(1)
    $creditsTextPanel=New-Object Windows.Controls.StackPanel
    $creditsTitle=New-Object Windows.Controls.TextBlock;$creditsTitle.Text='WINDOWISP 0.3.0';$creditsTitle.FontWeight='Bold';$creditsTitle.FontSize=14;$creditsTitle.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(201,236,253));$creditsTextPanel.Children.Add($creditsTitle)|Out-Null
    $creditsByline=New-Object Windows.Controls.TextBlock;$creditsByline.Text='Designed and created by CAIUTO AI';$creditsByline.Margin=[Windows.Thickness]::new(0,3,0,0);$creditsByline.Foreground=[Windows.Media.Brushes]::White;$creditsTextPanel.Children.Add($creditsByline)|Out-Null
    $creditsBuild=New-Object Windows.Controls.TextBlock;$creditsBuild.Text='Developed with OpenAI Codex';$creditsBuild.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(154,184,205));$creditsBuild.FontSize=11;$creditsTextPanel.Children.Add($creditsBuild)|Out-Null
    $creditsLicence=New-Object Windows.Controls.TextBlock;$creditsLicence.Text='Free beta - MIT licence';$creditsLicence.Margin=[Windows.Thickness]::new(0,5,0,0);$creditsLicence.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(154,184,205));$creditsLicence.FontSize=11;$creditsTextPanel.Children.Add($creditsLicence)|Out-Null
    $creditsContact=New-Object Windows.Controls.TextBlock;$creditsContact.Text='Support: cai-lear@hotmail.com';$creditsContact.Margin=[Windows.Thickness]::new(0,5,0,0);$creditsContact.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,211,118));$creditsContact.FontSize=11;$creditsContact.TextWrapping='Wrap';$creditsTextPanel.Children.Add($creditsContact)|Out-Null
    $creditsCard.Child=$creditsTextPanel;$script:creditsPanel.Children.Add($creditsCard)|Out-Null
    $script:creditsPanel.Children.Add((New-MenuButton 'Visit Windowisp Website' { Start-Process 'https://caiuto-ai.caiuto.chatgpt.site' } 'Open'))|Out-Null
    $script:creditsPanel.Children.Add((New-MenuButton 'Email Support' { Start-Process 'mailto:cai-lear@hotmail.com?subject=Windowisp%20Support' } 'Contact'))|Out-Null
    $script:creditsPanel.Children.Add((New-MenuButton 'Copy Support Email' { try{[Windows.Clipboard]::SetText('cai-lear@hotmail.com')}catch{} } 'Copy'))|Out-Null
    $script:creditsPanel.Children.Add((New-MenuButton 'Third-Party Notices' { $notices=Join-Path $PSScriptRoot 'THIRD_PARTY_NOTICES.md';if(Test-Path -LiteralPath $notices){Start-Process $notices} } 'Credits'))|Out-Null
    $panel.Children.Add($script:creditsPanel) | Out-Null
    $panel.Children.Add((New-MenuButton 'Close Windowisp' { $window.Close() } 'F10')) | Out-Null
    $scroll = New-Object Windows.Controls.ScrollViewer
    $scroll.VerticalScrollBarVisibility = [Windows.Controls.ScrollBarVisibility]::Auto
    $scroll.HorizontalScrollBarVisibility = [Windows.Controls.ScrollBarVisibility]::Disabled
    $scroll.Content = $panel
    $menuRoot = New-Object Windows.Controls.Grid
    $menuRoot.Children.Add($scroll)|Out-Null
    $menuRoot.Children.Add((New-ControlsOverlay))|Out-Null
    $script:menuWindow.Content = $menuRoot
    Update-Menu
    $script:menuButtonWindow.Show()
}

function New-PlayerStatusWindow([string]$player, [bool]$tinted) {
    $statusWindow = New-Object Windows.Window
    $statusWindow.Title = "Windowisp $player Status"
    $statusWindow.Width = 205; $statusWindow.Height = 54
    $statusWindow.WindowStyle = [Windows.WindowStyle]::None; $statusWindow.AllowsTransparency = $true
    $statusWindow.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(225, 24, 21, 36))
    $statusWindow.Topmost = $true; $statusWindow.ShowInTaskbar = $false; $statusWindow.ShowActivated = $false
    $grid = New-Object Windows.Controls.Grid
    $portrait = New-Object Windows.Controls.Image
    $portrait.Width = 45; $portrait.Height = 48; $portrait.HorizontalAlignment = 'Left'; $portrait.Margin = [Windows.Thickness]::new(5,2,0,2)
    $portrait.Source = $(if($player-eq'P2'){Get-P2SpriteFrame 0 0}else{Get-PetSpriteFrame 0 0})
    if($tinted){$portrait.Effect=New-Object Windows.Media.Effects.DropShadowEffect;$portrait.Effect.Color=[Windows.Media.Color]::FromRgb(236,67,190);$portrait.Effect.BlurRadius=12;$portrait.Effect.ShadowDepth=0}
    $text = New-Object Windows.Controls.TextBlock
    $text.Margin=[Windows.Thickness]::new(55,0,8,0);$text.VerticalAlignment='Center';$text.FontFamily=New-Object Windows.Media.FontFamily('Segoe UI Emoji')
    $text.FontSize=18;$text.FontWeight=[Windows.FontWeights]::Bold;$text.Foreground=New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255,76,99))
    $grid.Children.Add($portrait)|Out-Null;$grid.Children.Add($text)|Out-Null;$statusWindow.Content=$grid
    $statusWindow.Show();Set-OverlayClickThrough $statusWindow;$statusWindow.Visibility=[Windows.Visibility]::Hidden
    return [pscustomobject]@{Window=$statusWindow;Text=$text;Portrait=$portrait}
}

function New-HudWindows {
    $script:hudWindow = New-Object Windows.Window
    $script:hudWindow.Title = 'Windowisp HUD'
    $script:hudWindow.Width = 570; $script:hudWindow.Height = 70
    $script:hudWindow.WindowStyle = [Windows.WindowStyle]::None; $script:hudWindow.AllowsTransparency = $true
    $script:hudWindow.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(205, 20, 18, 31))
    $script:hudWindow.Topmost = $true; $script:hudWindow.ShowInTaskbar = $false; $script:hudWindow.ShowActivated = $false
    $script:hudText = New-Object Windows.Controls.TextBlock
    $script:hudText.Foreground = [Windows.Media.Brushes]::White; $script:hudText.FontSize = 15
    $script:hudText.FontWeight = [Windows.FontWeights]::Bold; $script:hudText.TextAlignment = 'Center'
    $script:hudText.VerticalAlignment = 'Center'; $script:hudWindow.Content = $script:hudText
    $script:hudWindow.Left = [Windows.SystemParameters]::VirtualScreenLeft + (([Windows.SystemParameters]::VirtualScreenWidth - $script:hudWindow.Width) / 2)
    $script:hudWindow.Top = [Windows.SystemParameters]::VirtualScreenTop + 12
    $script:hudWindow.Show(); Set-OverlayClickThrough $script:hudWindow

    $script:heartWindow = New-Object Windows.Window
    $script:heartWindow.Title = 'Windowisp Hearts'
    $script:heartWindow.Width = 116; $script:heartWindow.Height = 34
    $script:heartWindow.WindowStyle = [Windows.WindowStyle]::None; $script:heartWindow.AllowsTransparency = $true
    $script:heartWindow.Background = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(190, 28, 20, 35))
    $script:heartWindow.Topmost = $true; $script:heartWindow.ShowInTaskbar = $false; $script:heartWindow.ShowActivated = $false
    $script:heartText = New-Object Windows.Controls.TextBlock
    $script:heartText.Foreground = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromRgb(255, 70, 92))
    $script:heartText.FontFamily = New-Object Windows.Media.FontFamily('Segoe UI Emoji')
    $script:heartText.FontSize = 21; $script:heartText.FontWeight = [Windows.FontWeights]::Bold
    $script:heartText.TextAlignment = 'Center'; $script:heartText.VerticalAlignment = 'Center'
    $script:heartWindow.Content = $script:heartText
    $script:heartWindow.Show(); Set-OverlayClickThrough $script:heartWindow
    $p1Status=New-PlayerStatusWindow 'P1' $false;$script:p1StatusWindow=$p1Status.Window;$script:p1StatusText=$p1Status.Text;$script:p1StatusPortrait=$p1Status.Portrait
    $p2Status=New-PlayerStatusWindow 'P2' $true;$script:p2StatusWindow=$p2Status.Window;$script:p2StatusText=$p2Status.Text;$script:p2StatusPortrait=$p2Status.Portrait
}

function Ensure-ShieldWindow {
    if ($null -ne $script:shieldElement) { return }
    $shieldCanvas = New-Object Windows.Controls.Canvas
    $shieldCanvas.Width=93;$shieldCanvas.Height=93;$shieldCanvas.IsHitTestVisible=$false
    $script:shieldRing = New-Object Windows.Shapes.Ellipse
    $script:shieldRing.Width = 83; $script:shieldRing.Height = 83
    $script:shieldRing.Stroke = New-Object Windows.Media.SolidColorBrush ([Windows.Media.Color]::FromArgb(210, 92, 232, 255))
    $script:shieldRing.StrokeThickness = 4
    $script:shieldRing.StrokeDashArray = New-Object Windows.Media.DoubleCollection
    @(1.2, 1.1, 3.2, 1.1) | ForEach-Object { $script:shieldRing.StrokeDashArray.Add($_) }
    $script:shieldRing.RenderTransformOrigin = [Windows.Point]::new(0.5, 0.5)
    $script:shieldRotate=[Windows.Media.RotateTransform]::new(0);$script:shieldRing.RenderTransform=$script:shieldRotate
    $script:shieldRing.Effect = New-Object Windows.Media.Effects.DropShadowEffect
    $script:shieldRing.Effect.Color = [Windows.Media.Color]::FromRgb(40, 215, 255)
    $script:shieldRing.Effect.BlurRadius = 16; $script:shieldRing.Effect.ShadowDepth = 0; $script:shieldRing.Effect.Opacity = 0.9
    [Windows.Controls.Canvas]::SetLeft($script:shieldRing, 5); [Windows.Controls.Canvas]::SetTop($script:shieldRing, 5)
    $shieldCanvas.Children.Add($script:shieldRing) | Out-Null
    $script:shieldElement=$shieldCanvas
    Add-SharedGameplayElement $shieldCanvas ($script:x+(($PetWidth-93)/2)) ($script:y+(($PetHeight-93)/2))
}

function Update-Shield {
    if ($script:shieldTicks -gt 0 -and $script:active -and $script:hearts -gt 0) {
        Ensure-ShieldWindow
        $script:shieldTicks--
        $script:shieldAngle = ($script:shieldAngle + 6) % 360
        $script:shieldRotate.Angle=$script:shieldAngle
        Set-SharedOverlayElementPosition $script:shieldElement ($script:x+(($PetWidth-93)/2)) ($script:y+(($PetHeight-93)/2))
        $script:shieldElement.Visibility = [Windows.Visibility]::Visible
    } elseif ($null -ne $script:shieldElement) {
        $script:shieldElement.Visibility = [Windows.Visibility]::Hidden
    }
}

function Remove-Shield {
    if ($null -ne $script:shieldElement) { Remove-SharedGameplayElement $script:shieldElement;$script:shieldElement=$null;$script:shieldRing=$null;$script:shieldRotate=$null }
}

function New-ShieldPickup {
    if ($null -ne $script:shieldPickup) { return }
    $pickupWindow = New-Object Windows.Window
    $pickupWindow.Title = 'Windowisp Shield Pickup'
    $pickupWindow.Width = 84; $pickupWindow.Height = 90
    $pickupWindow.WindowStyle = [Windows.WindowStyle]::None; $pickupWindow.AllowsTransparency = $true
    $pickupWindow.Background = [Windows.Media.Brushes]::Transparent; $pickupWindow.Topmost = $true
    $pickupWindow.ShowInTaskbar = $false; $pickupWindow.ShowActivated = $false
    $pickupWindow.ResizeMode = [Windows.ResizeMode]::NoResize

    $pickupCanvas = New-Object Windows.Controls.Canvas
    $pickupCanvas.Width=84;$pickupCanvas.Height=90;$pickupCanvas.IsHitTestVisible=$false
    $shieldShape = New-Object Windows.Controls.Image
    $shieldShape.Source=Get-ToyboxImageSource 'ShieldPickup';$shieldShape.Width=84;$shieldShape.Height=90;$shieldShape.Stretch='Uniform'
    $shieldShape.RenderTransformOrigin = [Windows.Point]::new(0.5, 0.5)
    $transformGroup = New-Object Windows.Media.TransformGroup
    $scaleTransform = [Windows.Media.ScaleTransform]::new(1, 1)
    $rotateTransform = [Windows.Media.RotateTransform]::new(0)
    $transformGroup.Children.Add($scaleTransform); $transformGroup.Children.Add($rotateTransform)
    $shieldShape.RenderTransform = $transformGroup
    $pickupCanvas.Children.Add($shieldShape) | Out-Null

    $left = [int][Windows.SystemParameters]::VirtualScreenLeft
    $top = [int][Windows.SystemParameters]::VirtualScreenTop
    $maxX = [int]($left + [Windows.SystemParameters]::VirtualScreenWidth - 120)
    $minY = $top + 95; $maxY = [int]($top + [Windows.SystemParameters]::VirtualScreenHeight - 195)
    $pickupX = $left + 20; $pickupY = $minY
    foreach ($attempt in 1..12) {
        $pickupX = $script:random.Next($left + 20, [Math]::Max($left + 21, $maxX))
        $pickupY = $script:random.Next($minY, [Math]::Max($minY + 1, $maxY))
        if ([Math]::Abs($pickupX - $script:x) + [Math]::Abs($pickupY - $script:y) -gt 260) { break }
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_AUTOCOLLECT_SHIELD -eq '1') {
        $pickupX = [int]$script:x; $pickupY = [int]$script:y
    }
    Add-SharedGameplayElement $pickupCanvas $pickupX $pickupY
    $script:shieldPickup = [pscustomobject]@{
        Window=$null;Element=$pickupCanvas; Shape=$shieldShape; Scale=$scaleTransform; Rotate=$rotateTransform
        X=[double]$pickupX; Y=[double]$pickupY; BaseY=[double]$pickupY; Angle=0.0
    }
}

function Update-ShieldPickup {
    if ($null -eq $script:shieldPickup) { return }
    $script:shieldPickup.Angle = ($script:shieldPickup.Angle + 5) % 360
    $radians = ($script:shieldPickup.Angle * [Math]::PI) / 180
    $script:shieldPickup.Scale.ScaleX = [Math]::Max(0.18, [Math]::Abs([Math]::Cos($radians)))
    $script:shieldPickup.Rotate.Angle = [Math]::Sin($radians) * 7
    $script:shieldPickup.Y = $script:shieldPickup.BaseY + ([Math]::Sin($radians * 0.7) * 8)
    Set-SharedOverlayElementPosition $script:shieldPickup.Element $script:shieldPickup.X $script:shieldPickup.Y
}

function Remove-ShieldPickup {
    if ($null -ne $script:shieldPickup) { Remove-SharedGameplayElement $script:shieldPickup.Element;$script:shieldPickup = $null }
}

function Update-Hud {
    if ($null -eq $script:hudWindow) { return }
    $seconds = [Math]::Floor($script:elapsedTicks / 60)
    $minutes = [Math]::Floor($seconds / 60); $remaining = $seconds % 60
    $dashStatus = $(if ($script:dashCooldown -le 0) { 'DASH READY' } else { 'DASH {0:0.0}s' -f ($script:dashCooldown / 60) })
    $shieldStatus = $(if ($script:shieldTicks -gt 0) { 'SHIELD {0:0.0}s' -f ($script:shieldTicks / 60) } else { 'SHIELD --' })
    $chargeStatus = $(if ($script:charging) { 'CHARGE {0:0}%' -f ([Math]::Min(100, ($script:chargeTicks / 90) * 100)) } else { 'HOLD J' })
    $script:hudText.Text = $(if($script:gameType-eq'Wispfall'){
        if($script:wispfallGameOver){"WISPFALL OVER   |   SCORE $($script:wispfallScore)   |   F9 TO CLIMB AGAIN"}
        else{"WISPFALL   |   SCORE $($script:wispfallScore)   |   KEEP CLIMBING!"}
    }elseif($script:gameType-eq'Football'){
        if($script:footballMatchOver){"FOOTBALL   $($script:footballMessage)   |   P1 $($script:footballP1Score) - $($script:footballP2Score) P2"}
        elseif($script:footballCountdownTicks-gt0){
            $count=[Math]::Max(1,[Math]::Ceiling($script:footballCountdownTicks/60.0))
            "FOOTBALL   $($script:footballMessage)   |   P1 $($script:footballP1Score) - $($script:footballP2Score) P2   |   $count"
        }elseif($script:footballKickoffTextTicks-gt0){"FOOTBALL   P1 $($script:footballP1Score) - $($script:footballP2Score) P2   |   KICK OFF!"}
        else{"FOOTBALL   P1 $($script:footballP1Score) - $($script:footballP2Score) P2   |   FIRST TO 3   |   F9 RESTART"}
    }elseif ($script:hearts -le 0) {
        "$($script:gameType.ToUpper()) OVER   TIME $('{0:00}:{1:00}' -f $minutes,$remaining)"
    } elseif ($script:gameType -eq 'Dodgeball') {
        'DODGEBALL   TIME {0:00}:{1:00}  |  BALLS {2}  |  3 HITS AND YOU ARE OUT' -f $minutes,$remaining,$script:dodgeballs.Count
    } else {
        $wave=Get-SurvivalWave;$bossText=$(if(@($script:enemies|Where-Object{$_.Kind-eq'Boss'}).Count){'  |  BOSS'}else{''})
        'WAVE {0}  SCORE {1:000000}  TIME {2:00}:{3:00}{4}{5}  |  {6}  |  {7}{8}' -f $wave,$script:score,$minutes,$remaining,[Environment]::NewLine,$dashStatus,$shieldStatus,$chargeStatus,$bossText
    })
    $heartEmoji = ([string][char]0x2764) + ([string][char]0xFE0F)
    $heartSeparator = [string][char]0x2009
    $script:heartText.Text = $(if ($script:hearts -gt 0) { (($heartEmoji + $heartSeparator) * $script:hearts).Trim() } else { 'KO' })
    $script:heartWindow.Left = $script:x + $PetWidth - 12
    $script:heartWindow.Top = $script:y - 30
    $visibility = $(if (($script:footballActive-or$script:wispfallActive-or-not$script:playroomActive)-and($script:active-or$script:hearts-le0-or$script:footballMatchOver-or$script:wispfallGameOver)) { [Windows.Visibility]::Visible } else { [Windows.Visibility]::Hidden })
    $script:hudWindow.Visibility = $visibility
    $script:heartWindow.Visibility=[Windows.Visibility]::Hidden
    $script:p1StatusText.Text="P1  "+$(if($script:hearts-gt0){(($heartEmoji+$heartSeparator)*$script:hearts).Trim()}else{'KO'})
    $script:p1StatusWindow.Left=[Windows.SystemParameters]::VirtualScreenLeft+18;$script:p1StatusWindow.Top=[Windows.SystemParameters]::VirtualScreenTop+16
    $script:p1StatusWindow.Visibility=$visibility
    if($script:twoPlayerActive){
        $script:p2StatusText.Text="P2  "+$(if($script:p2Hearts-gt0){(($heartEmoji+$heartSeparator)*$script:p2Hearts).Trim()}else{'KO'})
        $script:p2StatusWindow.Left=[Windows.SystemParameters]::VirtualScreenLeft+[Windows.SystemParameters]::VirtualScreenWidth-$script:p2StatusWindow.Width-18;$script:p2StatusWindow.Top=[Windows.SystemParameters]::VirtualScreenTop+16
        $script:p2StatusWindow.Visibility=$visibility
    }else{
        $script:p2StatusWindow.Visibility=[Windows.Visibility]::Hidden
    }
}

function Set-EnemyFrame($enemyObject, [int]$frame) {
    if($null-eq$enemyObject-or$enemyObject.Frame-eq$frame-or-not$script:enemyAtlases.ContainsKey($enemyObject.Type)){return}
    $enemyAtlas=$script:enemyAtlases[$enemyObject.Type]
    $cellWidth=[int]($enemyAtlas.PixelWidth/4);$key="$($enemyObject.Type)|$frame"
    if(-not$script:enemyFrameCache.ContainsKey($key)){
        $crop=[Windows.Media.Imaging.CroppedBitmap]::new($enemyAtlas,[Windows.Int32Rect]::new(($frame*$cellWidth),0,$cellWidth,$enemyAtlas.PixelHeight))
        $crop.Freeze();$script:enemyFrameCache[$key]=$crop
    }
    $enemyObject.Image.Source=$script:enemyFrameCache[$key]
    $enemyObject.Frame = $frame
}

function Get-SurvivalWave {[Math]::Max(1,1+[Math]::Floor($script:elapsedTicks/900))}

function Get-NextEnemyType {
    $wave=Get-SurvivalWave
    if($wave-ge5-and($wave%5)-eq0-and$script:lastBossWave-ne$wave-and-not@($script:enemies|Where-Object{$_.Kind-eq'Boss'}).Count){
        $script:lastBossWave=$wave;return 'GloamGolem'
    }
    $available=@('EmberImp')
    if($wave-ge2){$available+=@('CinderMoth','MossHopper')}
    if($wave-ge3){$available+='ShellbackRoller'}
    if($wave-ge4){$available+='StormJelly'}
    return $available[$script:random.Next(0,$available.Count)]
}

function New-Enemy([string]$type='') {
    if([string]::IsNullOrWhiteSpace($type)){$type=Get-NextEnemyType}
    if(-not$script:enemyAtlases.ContainsKey($type)-or-not$script:enemyTypes.ContainsKey($type)){return}
    $definition=$script:enemyTypes[$type];$width=[double]$definition.Width;$height=[double]$definition.Height
    $enemyImage = New-Object Windows.Controls.Image
    $enemyImage.Width=$width;$enemyImage.Height=$height;$enemyImage.IsHitTestVisible=$false
    $enemyImage.Stretch = [Windows.Media.Stretch]::Uniform
    $enemyImage.RenderTransformOrigin=[Windows.Point]::new(.5,.5)
    $enemyScale=[Windows.Media.ScaleTransform]::new(1,1);$enemyImage.RenderTransform=$enemyScale
    $fromRight = ($script:random.Next(0, 2) -eq 1)
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$top=[Windows.SystemParameters]::VirtualScreenTop
    $screenWidth=[Windows.SystemParameters]::VirtualScreenWidth;$screenHeight=[Windows.SystemParameters]::VirtualScreenHeight
    $enemyX=$(if($fromRight){$left+$screenWidth-$width-55}else{$left+55})
    $isGround=$definition.Kind-in@('Hopper','Roller','Boss')
    $groundY=$top+$screenHeight-$height-48
    $enemyY=$(if($isGround){$top+45+($script:enemies.Count%3)*35}else{$top+100+($script:enemies.Count%4)*115})
    Add-SharedGameplayElement $enemyImage $enemyX $enemyY
    $enemyObject = [pscustomobject]@{
        Window=$null;Element=$enemyImage;Image=$enemyImage;Type=$type;Kind=$definition.Kind
        Width=$width;Height=$height;X=[double]$enemyX;Y=[double]$enemyY;GroundY=[double]$groundY;Grounded=$false
        VX=$(if($fromRight){-1.5}else{1.5});VY=0.0;Health=[int]$definition.Health;MaxHealth=[int]$definition.Health
        Speed=[double]$definition.Speed;ScoreValue=[int]$definition.Score;AttackCooldown=(75+($script:enemies.Count*23));AttackTicks=0
        ContactCooldown=0;Frame=-1;HomeY=[double]$enemyY;Phase=($script:random.NextDouble()*6.28);VisualScale=$enemyScale
    }
    $script:enemies.Add($enemyObject) | Out-Null
    Set-EnemyFrame $enemyObject 0
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output "diagnostic:enemy-spawn type=$type wave=$(Get-SurvivalWave) side=$(if($fromRight){'right'}else{'left'}) count=$($script:enemies.Count)"}
}

function Resolve-EnemyGround($enemyObject,[double]$oldY){
    $oldBottom=$oldY+$enemyObject.Height;$newBottom=$enemyObject.Y+$enemyObject.Height
    $floor=[Windows.SystemParameters]::VirtualScreenTop+[Windows.SystemParameters]::VirtualScreenHeight
    $landing=[double]$floor
    if($enemyObject.VY-ge0){
        $bodyLeft=$enemyObject.X+10;$bodyRight=$enemyObject.X+$enemyObject.Width-10
        for($platformIndex=0;$platformIndex-lt@($script:platforms).Count;$platformIndex++){
            $platform=$script:platforms[$platformIndex]
            if($bodyRight-gt$platform.Left-and$bodyLeft-lt$platform.Right-and$oldBottom-le$platform.Top+7-and$newBottom-ge$platform.Top-and$platform.Top-lt$landing-and(Test-PlatformTopExposed $platformIndex $bodyLeft $bodyRight $platform.Top)){$landing=$platform.Top}
        }
        foreach($block in @($script:playroomBlocks)){
            if($block.Type-eq'Ladder'-or$block.TemporaryState-eq'Gone'-or[Math]::Abs($block.Angle)-gt.01){continue}
            if($bodyRight-gt$block.X-and$bodyLeft-lt$block.X+$block.Width-and$oldBottom-le$block.Y+7-and$newBottom-ge$block.Y-and$block.Y-lt$landing){$landing=$block.Y}
        }
    }
    if($newBottom-ge$landing){$enemyObject.Y=$landing-$enemyObject.Height;$enemyObject.VY=0;$enemyObject.Grounded=$true}
    else{$enemyObject.Grounded=$false}
}

function Test-EnemyObstacleAhead($enemyObject,[int]$direction){
    if($direction-eq0){return $false}
    $probeX=$(if($direction-lt0){$enemyObject.X-12}else{$enemyObject.X+$enemyObject.Width+12})
    $bodyTop=$enemyObject.Y+12;$bodyBottom=$enemyObject.Y+$enemyObject.Height-6
    foreach($block in @($script:playroomBlocks)){
        if($block.Type-eq'Ladder'-or$block.TemporaryState-eq'Gone'-or[Math]::Abs($block.Angle)-gt.01){continue}
        if($probeX-ge$block.X-and$probeX-le$block.X+$block.Width-and$bodyBottom-gt$block.Y+5-and$bodyTop-lt$block.Y+$block.Height){return $true}
    }
    return $false
}

function Update-OneEnemy($enemyObject){
    $targetX=$script:x+($PetWidth/2);$targetY=$script:y+($PetHeight/2)
    if($script:twoPlayerActive-and$script:p2Hearts-gt0){
        $p1Distance=[Math]::Abs($targetX-($enemyObject.X+$enemyObject.Width/2))
        $p2Distance=[Math]::Abs(($script:p2X+$PetWidth/2)-($enemyObject.X+$enemyObject.Width/2))
        if($p2Distance-lt$p1Distance){$targetX=$script:p2X+($PetWidth/2);$targetY=$script:p2Y+($PetHeight/2)}
    }
    $dx=$targetX-($enemyObject.X+$enemyObject.Width/2);$dy=$targetY-($enemyObject.Y+$enemyObject.Height/2)
    $enemyObject.AttackCooldown--;if($enemyObject.ContactCooldown-gt0){$enemyObject.ContactCooldown--}
    $oldEnemyY=$enemyObject.Y
    switch($enemyObject.Kind){
        'FlyerShooter' {
            $enemyObject.VX=[Math]::Max(-$enemyObject.Speed,[Math]::Min($enemyObject.Speed,($enemyObject.VX*.92)+([Math]::Sign($dx)*.32)))
            $enemyObject.VY=[Math]::Max(-3.2,[Math]::Min(3.2,($enemyObject.VY*.9)+([Math]::Sign($dy)*.18)))
            if($enemyObject.AttackCooldown-le0){$enemyObject.AttackTicks=26;$enemyObject.AttackCooldown=[Math]::Max(70,160-[Math]::Floor($script:score/10))}
            if($enemyObject.AttackTicks-gt0){
                $enemyObject.AttackTicks--;Set-EnemyFrame $enemyObject $(if($enemyObject.AttackTicks-gt10){2}else{3})
                if($enemyObject.AttackTicks-eq10){$length=[Math]::Max(1,[Math]::Sqrt($dx*$dx+$dy*$dy));New-Fireball -owner 'Enemy' -originX ($enemyObject.X+$enemyObject.Width/2) -originY ($enemyObject.Y+$enemyObject.Height/2) -velocityX (($dx/$length)*8.5) -velocityY (($dy/$length)*8.5)}
            }else{Set-EnemyFrame $enemyObject ([Math]::Floor($script:elapsedTicks/12)%2)}
        }
        'Hopper' {
            $enemyObject.VX=([Math]::Sign($dx)*$enemyObject.Speed)
            $direction=[Math]::Sign($enemyObject.VX)
            if($enemyObject.Grounded-and($enemyObject.AttackCooldown-le0-or(Test-EnemyObstacleAhead $enemyObject $direction))){$enemyObject.VY=-11.5;$enemyObject.Grounded=$false;$enemyObject.AttackCooldown=72}
        }
        'Roller' {
            if($enemyObject.AttackCooldown-le0){$enemyObject.AttackTicks=58;$enemyObject.AttackCooldown=145}
            $charging=$enemyObject.AttackTicks-gt0;if($charging){$enemyObject.AttackTicks--}
            $enemyObject.VX=[Math]::Sign($dx)*$(if($charging){$enemyObject.Speed}else{2.0})
            if($enemyObject.Grounded-and(Test-EnemyObstacleAhead $enemyObject ([Math]::Sign($enemyObject.VX)))){$enemyObject.VY=-8.5;$enemyObject.Grounded=$false}
        }
        'Swooper' {
            if($enemyObject.AttackCooldown-le0){$enemyObject.AttackTicks=52;$enemyObject.AttackCooldown=125}
            if($enemyObject.AttackTicks-gt0){
                $enemyObject.AttackTicks--;$enemyObject.VX=[Math]::Max(-$enemyObject.Speed,[Math]::Min($enemyObject.Speed,($enemyObject.VX*.86)+([Math]::Sign($dx)*.72)))
                $enemyObject.VY=[Math]::Max(-$enemyObject.Speed,[Math]::Min($enemyObject.Speed,($enemyObject.VY*.84)+([Math]::Sign($dy)*.62)));Set-EnemyFrame $enemyObject $(if($enemyObject.AttackTicks-gt30){2}else{3})
            }else{
                $hoverY=$enemyObject.HomeY+([Math]::Sin(($script:elapsedTicks/22)+$enemyObject.Phase)*45);$enemyObject.VX=[Math]::Max(-3.0,[Math]::Min(3.0,($enemyObject.VX*.94)+([Math]::Sign($dx)*.16)));$enemyObject.VY=($hoverY-$enemyObject.Y)*.08;Set-EnemyFrame $enemyObject ([Math]::Floor($script:elapsedTicks/14)%2)
            }
        }
        'Boss' {
            $enemyObject.VX=[Math]::Sign($dx)*$enemyObject.Speed
            if($enemyObject.Grounded-and(Test-EnemyObstacleAhead $enemyObject ([Math]::Sign($enemyObject.VX)))){$enemyObject.VY=-10.5;$enemyObject.Grounded=$false}
            if($enemyObject.AttackCooldown-le0){$enemyObject.AttackTicks=48;$enemyObject.AttackCooldown=105}
            if($enemyObject.AttackTicks-gt0){
                $enemyObject.AttackTicks--;Set-EnemyFrame $enemyObject $(if($enemyObject.AttackTicks-gt30){1}elseif($enemyObject.AttackTicks-gt14){2}else{3})
                if($enemyObject.AttackTicks-eq14){foreach($angle in @(-.28,0,.28)){$length=[Math]::Max(1,[Math]::Sqrt($dx*$dx+$dy*$dy));$baseX=$dx/$length;$baseY=$dy/$length;New-Fireball -owner 'Enemy' -originX ($enemyObject.X+$enemyObject.Width/2) -originY ($enemyObject.Y+$enemyObject.Height*.45) -velocityX (($baseX*[Math]::Cos($angle)-$baseY*[Math]::Sin($angle))*7.2) -velocityY (($baseX*[Math]::Sin($angle)+$baseY*[Math]::Cos($angle))*7.2)}}
            }
        }
    }
    if($enemyObject.Kind-in@('Hopper','Roller','Boss')){$enemyObject.VY=[Math]::Min(22,$enemyObject.VY+.82)}
    $enemyObject.X+=($enemyObject.VX*$script:enemyMovementScale)
    $enemyObject.Y+=($enemyObject.VY*$script:enemyMovementScale)
    $left=[Windows.SystemParameters]::VirtualScreenLeft;$right=$left+[Windows.SystemParameters]::VirtualScreenWidth-$enemyObject.Width
    $enemyObject.X=[Math]::Max($left,[Math]::Min($right,$enemyObject.X))
    if($enemyObject.Kind-in@('Hopper','Roller','Boss')){
        Resolve-EnemyGround $enemyObject $oldEnemyY
        if([Math]::Abs($enemyObject.VX)-gt.15){$enemyObject.VisualScale.ScaleX=$(if($enemyObject.VX-lt0){-1}else{1})}
        if($enemyObject.Kind-eq'Hopper'){
            Set-EnemyFrame $enemyObject $(if(-not$enemyObject.Grounded){$(if($enemyObject.VY-lt0){1}else{2})}else{([Math]::Floor($script:elapsedTicks/9)%2)*3})
        }elseif($enemyObject.Kind-eq'Roller'){
            Set-EnemyFrame $enemyObject $(if($enemyObject.AttackTicks-gt0){3}elseif(-not$enemyObject.Grounded){2}else{[Math]::Floor($script:elapsedTicks/9)%2})
        }elseif($enemyObject.AttackTicks-le0){Set-EnemyFrame $enemyObject $(if($enemyObject.Grounded){[Math]::Floor($script:elapsedTicks/13)%2}else{1})}
    }
    if(($script:inputTick%2)-eq0){Set-SharedOverlayElementPosition $enemyObject.Element $enemyObject.X $enemyObject.Y}
    if($enemyObject.ContactCooldown-le0){
        $hitP1=$enemyObject.X+$enemyObject.Width-gt$script:x+8-and$enemyObject.X-lt$script:x+$PetWidth-8-and$enemyObject.Y+$enemyObject.Height-gt$script:y+8-and$enemyObject.Y-lt$script:y+$PetHeight-5
        $hitP2=$script:twoPlayerActive-and$enemyObject.X+$enemyObject.Width-gt$script:p2X+8-and$enemyObject.X-lt$script:p2X+$PetWidth-8-and$enemyObject.Y+$enemyObject.Height-gt$script:p2Y+8-and$enemyObject.Y-lt$script:p2Y+$PetHeight-5
        if($hitP1-and$script:invulnerableTicks-le0){$script:hearts--;$script:invulnerableTicks=90;$enemyObject.ContactCooldown=55}
        elseif($hitP2-and$script:p2InvulnerableTicks-le0){$script:p2Hearts--;$script:p2InvulnerableTicks=90;$enemyObject.ContactCooldown=55}
    }
}

function Remove-Enemy($enemyObject, [bool]$defeated) {
    if ($null -ne $enemyObject) { Remove-SharedGameplayElement $enemyObject.Element;$script:enemies.Remove($enemyObject) }
    if ($defeated) {
        $script:score += $enemyObject.ScoreValue; $script:enemiesDefeated++
    }
}

function Remove-AllEnemies {
    foreach ($enemyObject in @($script:enemies)) { Remove-SharedGameplayElement $enemyObject.Element }
    $script:enemies.Clear()
}

function New-Star {
    $starWindow = New-Object Windows.Window
    $starWindow.Title = 'Windowisp Star'
    $starWindow.Width = 84; $starWindow.Height = 84
    $starWindow.WindowStyle = [Windows.WindowStyle]::None; $starWindow.AllowsTransparency = $true
    $starWindow.Background = [Windows.Media.Brushes]::Transparent; $starWindow.Topmost = $true
    $starWindow.ShowInTaskbar = $false; $starWindow.ShowActivated = $false; $starWindow.ResizeMode = [Windows.ResizeMode]::NoResize

    $canvas = New-Object Windows.Controls.Canvas
    $canvas.Width=84;$canvas.Height=84;$canvas.IsHitTestVisible=$false
    $polygon = New-Object Windows.Controls.Image
    $polygon.Source=Get-ToyboxImageSource 'StarPickup';$polygon.Width=84;$polygon.Height=84;$polygon.Stretch='Uniform'
    $polygon.RenderTransformOrigin = [Windows.Point]::new(0.5, 0.5)
    $starTransforms = New-Object Windows.Media.TransformGroup
    $starScale = [Windows.Media.ScaleTransform]::new(1,1)
    $starRotate = [Windows.Media.RotateTransform]::new(0)
    $starTransforms.Children.Add($starScale)|Out-Null;$starTransforms.Children.Add($starRotate)|Out-Null
    $polygon.RenderTransform=$starTransforms
    $canvas.Children.Add($polygon) | Out-Null

    $left = [int][Windows.SystemParameters]::VirtualScreenLeft
    $top = [int][Windows.SystemParameters]::VirtualScreenTop
    $maxX = [int]($left + [Windows.SystemParameters]::VirtualScreenWidth - 120)
    $minY = $top + 90
    $maxY = [int]($top + [Windows.SystemParameters]::VirtualScreenHeight - 190)
    $starX = $left + 20; $starY = $minY
    foreach ($attempt in 1..12) {
        $starX = $script:random.Next($left + 20, [Math]::Max($left + 21, $maxX))
        $starY = $script:random.Next($minY, [Math]::Max($minY + 1, $maxY))
        if ([Math]::Abs($starX - $script:x) + [Math]::Abs($starY - $script:y) -gt 260) { break }
    }
    Add-SharedGameplayElement $canvas $starX $starY
    $script:star = [pscustomobject]@{ Window=$null;Element=$canvas; Shape=$polygon; Rotate=$starRotate; X=[double]$starX; Y=[double]$starY; Angle=0.0 }
}

function Remove-Star([bool]$collected) {
    if ($null -ne $script:star) { Remove-SharedGameplayElement $script:star.Element;$script:star = $null }
    if ($collected) {
        $script:score += 10
        $script:starsCollected++
        if (($script:starsCollected % 3) -eq 0 -and $null -eq $script:shieldPickup) {
            $script:shieldPickupSpawnTicks = 30
        }
        $script:starSpawnTicks = $script:random.Next(180, 361)
    }
}

function Reset-Game {
    foreach ($shot in @($script:projectiles)) { Remove-SharedGameplayElement $shot.Element }
    $script:projectiles.Clear(); Remove-AllEnemies; Remove-Star $false; Remove-Shield; Remove-ShieldPickup; Clear-Dodgeballs
    $script:score = 0; $script:hearts = 3; $script:elapsedTicks = 0; $script:lastBossWave = 0
    $script:invulnerableTicks = 0; $script:enemySpawnTicks = 210; $script:starSpawnTicks = 150
    $script:enemyNextSpawnAt = [DateTime]::UtcNow.AddSeconds(5)
    $script:dodgeballNextSpawnAt = [DateTime]::UtcNow.AddSeconds(5); $script:dodgeballFromRight = $false
    $script:p2Hearts=3;$script:p2InvulnerableTicks=0
    $script:enemiesDefeated = 0; $script:starsCollected = 0; $script:shieldTicks = 0; $script:shieldPickupSpawnTicks = 45
    $script:airJumpsRemaining = 1; $script:dashTicks = 0; $script:dashCooldown = 0
    $script:charging = $false; $script:chargeTicks = 0; $script:attackCooldown = 0
    $script:groundPlatformHwnd = [IntPtr]::Zero; $script:groundPlatformRect = $null
    $script:p2GroundPlatformHwnd = [IntPtr]::Zero; $script:p2GroundPlatformRect = $null
    if ($script:playroomActive) {
        $script:enemySpawnTicks = 999999; $script:starSpawnTicks = 999999; $script:shieldPickupSpawnTicks = 999999
    }
}

function Set-GameMode([bool]$enabled) {
    if(-not$enabled-and($script:wispfallActive-or$null-ne$script:wispfallLavaWindow)){Remove-WispfallSetup}
    if ($script:active -eq $enabled) { return }
    if ($enabled -and $script:hearts -le 0) { Reset-Game }
    $script:active = $enabled
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:game-mode active=$($script:active)" }
    Register-ControlKeys ($script:active -and -not $script:frozen)
    Set-ClickThrough ($script:frozen -or -not $script:active)
    Update-PlatformHighlights
    $script:lastRenderKey = ''
    Update-Menu
}

$window.Add_SourceInitialized({
    try {
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:source-initialized-begin' }
    $helper = New-Object Windows.Interop.WindowInteropHelper($window)
    $script:hwnd = $helper.Handle
    $script:source = [Windows.Interop.HwndSource]::FromHwnd($script:hwnd)
    $script:source.AddHook({
        param($hookHwnd, $msg, $wParam, $lParam, [ref]$handled)
        if ($msg -ne [PetNative]::WM_HOTKEY) { return [IntPtr]::Zero }
        $id = $wParam.ToInt32(); $handled.Value = $true
        if ($id -eq $hotkeyIds.Toggle) {
            Set-GameMode (-not $script:active)
        } elseif ($id -eq $hotkeyIds.Reset) {
            Restart-CurrentGame
        } elseif ($id -eq $hotkeyIds.Close) {
            $window.Close()
        } elseif ($id -eq $hotkeyIds.Menu) {
            Toggle-Menu
        } elseif ($id -eq $hotkeyIds.Freeze) {
            Set-Frozen (-not $script:frozen)
        } elseif ($id -eq $hotkeyIds.Exit) {
            Invoke-ExitControl
        }
        return [IntPtr]::Zero
    })
    [PetNative]::RegisterHotKey($script:hwnd, $hotkeyIds.Toggle, [PetNative]::MOD_NOREPEAT, $vk.F8) | Out-Null
    [PetNative]::RegisterHotKey($script:hwnd, $hotkeyIds.Reset, [PetNative]::MOD_NOREPEAT, $vk.F9) | Out-Null
    [PetNative]::RegisterHotKey($script:hwnd, $hotkeyIds.Close, [PetNative]::MOD_NOREPEAT, $vk.F10) | Out-Null
    $menuModifiers = [PetNative]::MOD_CONTROL -bor [PetNative]::MOD_ALT -bor [PetNative]::MOD_NOREPEAT
    [PetNative]::RegisterHotKey($script:hwnd, $hotkeyIds.Menu, $menuModifiers, $vk.P) | Out-Null
    [PetNative]::RegisterHotKey($script:hwnd, $hotkeyIds.Freeze, [PetNative]::MOD_NOREPEAT, $vk.F7) | Out-Null
    Set-ClickThrough $true
    New-HudWindows
    New-ControlCentre
    $script:platforms = [PetNative]::GetPlatformWindows([uint32]$PID)
    Update-PlatformHighlights
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_WINDOW_RIDE-eq'1'){
        $ridePlatform=@($script:platforms|Select-Object -First 1)[0]
        if($null-ne$ridePlatform){
            $rideBeforeX=$script:x;$rideBeforeY=$script:y
            $script:grounded=$true;$script:groundPlatformHwnd=$ridePlatform.Hwnd
            $script:groundPlatformRect=[pscustomobject]@{Left=([double]$ridePlatform.Left-37);Top=([double]$ridePlatform.Top-19);Right=$ridePlatform.Right;Bottom=$ridePlatform.Bottom}
            Update-RidingApplicationWindow 'P1'
            $testLeftDown=$true;$testRightDown=$true
            $overlapHorizontal=$(if($testLeftDown-and-not$testRightDown){-1}elseif($testRightDown-and-not$testLeftDown){1}else{0})
            $validRide=([Math]::Abs(($script:x-$rideBeforeX)-37)-lt.01)-and([Math]::Abs(($script:y-$rideBeforeY)-19)-lt.01)
            $script:grounded=$false;Update-RidingApplicationWindow 'P1'
            $jumpDetached=([Math]::Abs($script:x-($rideBeforeX+37))-lt.01)-and([Math]::Abs($script:y-($rideBeforeY+19))-lt.01)
            $script:grounded=$true;$script:groundPlatformHwnd=[IntPtr]::new(123456789);$script:groundPlatformRect=$ridePlatform
            Update-RidingApplicationWindow 'P1'
            $invalidDetached=$script:groundPlatformHwnd-eq[IntPtr]::Zero-and-not$script:grounded
            [Console]::Out.WriteLine("diagnostic:window-ride validMove=$validRide overlapAD=$overlapHorizontal jumpDetached=$jumpDetached invalidDetached=$invalidDetached")
        }else{[Console]::Out.WriteLine('diagnostic:window-ride skipped=no-platform-window')}
    }
    if ($env:WINDOWISP_TEST_RESTART_SURVIVAL -eq '1') {
        Start-Playroom
        Restart-CurrentGame
    } elseif ($env:WINDOWISP_TEST_PLAYROOM -eq '1') {
        Start-Playroom
    }
    if ($env:WINDOWISP_TEST_CONTROLS -eq '1') { $script:menuWindow.Show(); Show-ControlOverlay }
    if ($env:WINDOWISP_TEST_DODGEBALL -eq '1') {
        Start-GameType 'Dodgeball'
        if ($env:WINDOWISP_TEST_DODGEBALL_FAST -eq '1') { $script:dodgeballNextSpawnAt = [DateTime]::UtcNow.AddMilliseconds(50) }
    }
    if ($env:WINDOWISP_TEST_TWO_PLAYER -eq '1') { Set-TwoPlayerMode $true; Set-GameMode $true }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_P2_FOOTBALL_CONTROLLER-eq'1'){
        Set-TwoPlayerMode $false;Set-Player2Controller 'Human';Start-Football
        $singlePlayerController=$script:p2ControllerMode
        Return-ToSandbox;Set-TwoPlayerMode $true;Set-Player2Controller 'Human';Start-Football
        [Console]::Out.WriteLine("diagnostic:p2-football-controller single=$singlePlayerController existingTwoPlayer=$($script:p2ControllerMode)")
    }
    if ($env:WINDOWISP_TEST_ACTIVE -eq '1') { Set-GameMode $true }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ENEMY_ROSTER-eq'1'){
        Start-GameType 'Survival';Remove-AllEnemies
        foreach($enemyType in @('EmberImp','CinderMoth','MossHopper','ShellbackRoller','StormJelly','GloamGolem')){New-Enemy $enemyType}
        [Console]::Out.WriteLine("diagnostic:enemy-roster count=$($script:enemies.Count) types=$(@($script:enemies|ForEach-Object{$_.Type})-join',') health=$(@($script:enemies|ForEach-Object{$_.Health})-join',')")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_TUTORIAL -eq '1') {
        Show-QuickTutorial $true
        [Console]::Out.WriteLine("diagnostic:tutorial visible=$($script:tutorialWindow.IsVisible) width=$($script:tutorialWindow.Width) height=$($script:tutorialWindow.Height)")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_PET_SCALE -eq '1') {
        [Console]::Out.WriteLine("diagnostic:pet-scale initial=$($script:petScalePercent) width=$PetWidth height=$PetHeight")
        Set-PetScale 70 $false
        [Console]::Out.WriteLine("diagnostic:pet-scale small=$($script:petScalePercent) width=$PetWidth height=$PetHeight window=$($window.Width)x$($window.Height)")
        Set-PetScale 85 $false
        [Console]::Out.WriteLine("diagnostic:pet-scale compact=$($script:petScalePercent) width=$PetWidth height=$PetHeight window=$($window.Width)x$($window.Height)")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_UI_REVIEW -eq '1') {
        if(-not$script:playroomActive){Start-Playroom}
        if($null-eq$script:sandboxHotbarWindow){New-SandboxToolbox}
        Set-SandboxToolboxVisible $true;Show-SandboxCategory 'Blocks'
        if(-not$script:menuWindow.IsVisible){$script:menuWindow.Show()}
        $script:creditsPanel.Visibility=[Windows.Visibility]::Visible
        [Console]::Out.WriteLine("diagnostic:ui-review menu=$($script:menuWindow.IsVisible) hotbar=$($script:sandboxHotbarWindow.IsVisible) tray=$($script:sandboxTrayWindow.IsVisible) hotbarWidth=$($script:sandboxHotbarWindow.Width) wip=$($script:wipPowerupButton.Tag) credits=$($script:creditsPanel.Visibility) creditsChildren=$($script:creditsPanel.Children.Count)")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_CONTEXT_MENUS -eq '1') {
        if(-not$script:playroomActive){Start-Playroom}
        $testRotator=[pscustomobject]@{Kind='Rotator';ManualPower=$null;Direction=1;RotationSpeed=1.0;Target=$null}
        $testFire=[pscustomobject]@{Kind='FireJet';ManualPower=$null}
        $testRope=[pscustomobject]@{Kind='Rope'}
        $rotatorMenu=New-PlacementContextMenu $testRotator $false
        $fireMenu=New-PlacementContextMenu $testFire $true
        $ropeMenu=New-PlacementContextMenu $testRope $false
        $blockMenu=@($script:playroomBlocks|Select-Object -First 1)[0].ContextMenu
        $headers={param($menu) (@($menu.Items|ForEach-Object{[string]$_.Header}) -join '|')}
        $blockChecks=@($blockMenu.Items|Where-Object{$_.Header-eq'Block Colour'}|ForEach-Object{@($_.Items|Where-Object{$_.IsChecked})}).Count
        $firePower=@($fireMenu.Items|Where-Object{$_.Header-eq'Power'}|ForEach-Object{@($_.Items|ForEach-Object{[string]$_.Header})}) -join '|'
        $menuColour=$rotatorMenu.Background.Color
        [Console]::Out.WriteLine("diagnostic:context-menus block=$(& $headers $blockMenu) rotator=$(& $headers $rotatorMenu) fire=$(& $headers $fireMenu) rope=$(& $headers $ropeMenu) blockColourChecks=$blockChecks firePower=$firePower background=$($menuColour.R),$($menuColour.G),$($menuColour.B)")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and $env:WINDOWISP_TEST_PET_SELECTOR -eq '1') {
        Show-PetSelector
        $selectorPetCount=@($script:petSelectorPanel.Children|Where-Object{$_-is[Windows.Controls.Button]-and$null-ne$_.Tag-and$null-ne$_.Tag.PSObject.Properties['Id']}).Count
        [Console]::Out.WriteLine("diagnostic:pet-selector visible=$($script:petSelectorWindow.IsVisible) pets=$selectorPetCount sizeButtons=$($script:petSizeButtons.Count) selected=$($script:petScalePercent)")
    }
    if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:source-initialized-end' }
    } catch {
        if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Error "diagnostic:source-initialized-error $($_.Exception.ToString())" }
        throw
    }
})

$script:modeTransitionStressTick = 0
$timer = New-Object Windows.Threading.DispatcherTimer
# Request below the common 15.625 ms Windows timer quantum. A 16-17 ms
# DispatcherTimer can round up to ~31 ms and visibly cap window motion near 30 FPS.
$timer.Interval = [TimeSpan]::FromMilliseconds(10)
$timer.Add_Tick({
    if($script:eraserExitGuardTicks-gt0){$script:eraserExitGuardTicks--}
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_MODE_TRANSITIONS-eq'1'){
        $script:modeTransitionStressTick++
        if($script:modeTransitionStressTick-ge30-and(($script:modeTransitionStressTick-30)%60)-eq0){
            $phase=[int](($script:modeTransitionStressTick-30)/60)%10
            $cycle=[int][Math]::Floor(($script:modeTransitionStressTick-30)/600)+1
            $transitionName=''
            try{
                switch($phase){
                    0 {$transitionName='Sandbox';Set-TwoPlayerMode $true;Return-ToSandbox}
                    1 {$transitionName='Survival';Start-GameType 'Survival'}
                    2 {$transitionName='Dodgeball';Start-GameType 'Dodgeball'}
                    3 {$transitionName='Sandbox return';Start-Playroom}
                    4 {$transitionName='Football';Start-Football}
                    5 {$transitionName='Football to Sandbox';Return-ToSandbox}
                    6 {$transitionName='Wispfall';Start-Wispfall}
                    7 {$transitionName='Wispfall to Sandbox';Return-ToSandbox}
                    8 {$transitionName='Survival return';Start-GameType 'Survival'}
                    9 {$transitionName='P2 rebuild';Set-TwoPlayerMode $false;Set-TwoPlayerMode $true}
                }
                $mode=$(if($script:footballActive){'Football'}elseif($script:wispfallActive){'Wispfall'}elseif($script:playroomActive){'Sandbox'}else{$script:gameType})
                [Console]::Out.WriteLine("diagnostic:transition cycle=$cycle phase=$phase requested=$transitionName mode=$mode active=$($script:active) p2=$($script:twoPlayerActive) blocks=$($script:playroomBlocks.Count) gadgets=$($script:playroomGadgets.Count) balls=$($script:playroomBalls.Count) dodgeballs=$($script:dodgeballs.Count) footballObjects=$(@($script:footballModeObjects).Count) lava=$($null-ne$script:wispfallLavaWindow)")
            }catch{
                [Console]::Error.WriteLine("diagnostic:transition-error cycle=$cycle phase=$phase requested=$transitionName $($_.Exception.ToString())")
            }
        }
    }
    if($env:WINDOWISP_TEST_AUTO_EXIT_TICKS){
        $script:diagnosticTickCount++
        if($script:diagnosticTickCount-ge[int]$env:WINDOWISP_TEST_AUTO_EXIT_TICKS){$window.Close();return}
    }
    if ($null -ne $script:frameClock) {
        $nowMs = $script:frameClock.Elapsed.TotalMilliseconds
        if ($script:lastFrameMs -gt 0) {
            $gap = $nowMs - $script:lastFrameMs
            $script:frameGapMax = [Math]::Max($script:frameGapMax, $gap)
            $script:frameGapSum += $gap; $script:frameGapSamples++
        }
        $script:lastFrameMs = $nowMs
    }
    if ($gameExitEvent.WaitOne(0)) { $window.Close(); return }
    if ($gameOnEvent.WaitOne(0)) {
        if (-not $script:startupModeChosen) {
            $script:startupModeChosen = $true
            Start-Playroom
            if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { [Console]::Out.WriteLine("diagnostic:startup-mode Sandbox blocks=$($script:playroomBlocks.Count) balls=$($script:playroomBalls.Count)") }
            if ($env:WINDOWISP_DIAGNOSTICS -ne '1' -and -not (Test-Path -LiteralPath $script:tutorialSeenPath -PathType Leaf)) { Show-QuickTutorial $true }
        } elseif ($script:playroomActive) {
            Start-GameType $script:gameType
        } else {
            Set-GameMode $true
        }
    }
    if ($gameOffEvent.WaitOne(0)) { Set-GameMode $false }
    if ($gameToggleEvent.WaitOne(0)) { Set-GameMode (-not $script:active) }
    if ($playroomEvent.WaitOne(0)) {
        $script:startupModeChosen = $true
        if ($script:playroomActive) { Stop-Playroom } else { Start-Playroom }
    }
    if($petSwitchEvent.WaitOne(0)){
        $switchPath=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Windowisp\pet-switch.json'
        if(Test-Path -LiteralPath $switchPath -PathType Leaf){
            try{
                $request=Get-Content -LiteralPath $switchPath -Raw|ConvertFrom-Json
                Set-ActivePetAtlas ([string]$request.atlasPath) ([string]$request.id) ([string]$request.displayName) ([string]$request.player)
            }catch{}
        }
    }
    if($familiarEventSignal.WaitOne(0)){Receive-FamiliarEvent}
    if(-not$script:p2AITestInitialized-and$env:WINDOWISP_TEST_P2_AI-in@('Opponent','Friend')-and$script:playroomActive){
        $script:p2AITestInitialized=$true
        Set-Player2Controller $env:WINDOWISP_TEST_P2_AI
        $script:active=$true
        [Console]::Out.WriteLine("diagnostic:p2-ai-start mode=$($script:p2ControllerMode) balls=$($script:playroomBalls.Count)")
    }
    if(-not$script:enemyRosterTestInitialized-and$env:WINDOWISP_TEST_ENEMY_ROSTER-eq'1'){
        $script:enemyRosterTestInitialized=$true
        Start-GameType 'Survival';Remove-AllEnemies
        foreach($enemyType in @('EmberImp','CinderMoth','MossHopper','ShellbackRoller','StormJelly','GloamGolem')){New-Enemy $enemyType}
        $script:invulnerableTicks=999999;$script:p2InvulnerableTicks=999999
        [Console]::Out.WriteLine("diagnostic:enemy-roster-active count=$($script:enemies.Count) mode=$($script:gameType) playroom=$($script:playroomActive)")
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_ENEMY_ROSTER-eq'1'-and($script:inputTick%120)-eq0-and$script:enemies.Count-gt0){
        $states=@($script:enemies|ForEach-Object{"$($_.Type):$([Math]::Round($_.X)),$([Math]::Round($_.Y)),f$($_.Frame),hp$($_.Health),g$($_.Grounded),sx$($_.VisualScale.ScaleX)"})-join'|'
        [Console]::Out.WriteLine("diagnostic:enemy-roster-state projectiles=$($script:projectiles.Count) $states")
    }
    if(-not$script:footballTestInitialized-and$env:WINDOWISP_TEST_FOOTBALL-eq'1'-and$script:playroomActive){
        $script:footballTestInitialized=$true
        Start-Football
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine('diagnostic:football-started')}
        if($env:WINDOWISP_TEST_MINIGAME_EXIT-eq'1'){
            Return-ToSandbox
            [Console]::Out.WriteLine("diagnostic:football-exit active=$($script:active) sandbox=$($script:playroomActive) football=$($script:footballActive) goals=$(@($script:playroomGadgets|Where-Object{$_.FootballGoal}).Count) hotbar=$($script:sandboxHotbarWindow.IsVisible)")
        }elseif($env:WINDOWISP_TEST_FOOTBALL_RESTART-eq'1'){
            $script:footballP1Score=2;$script:footballP2Score=1
            Restart-CurrentGame
            [Console]::Out.WriteLine("diagnostic:football-restart p1=$($script:footballP1Score) p2=$($script:footballP2Score) countdown=$($script:footballCountdownTicks) balls=$(@($script:playroomBalls|Where-Object{$_.FootballBall}).Count) goals=$(@($script:playroomGadgets|Where-Object{$_.FootballGoal}).Count)")
        }
    }
    if(-not$script:wispfallTestInitialized-and$env:WINDOWISP_TEST_WISPFALL-eq'1'-and$script:playroomActive){
        $script:wispfallTestInitialized=$true
        Set-PetScale 115 $false
        Add-PlayroomHazard 'FireJet'
        $beforeBlocks=$script:playroomBlocks.Count;$beforeGadgets=$script:playroomGadgets.Count
        Start-Wispfall
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'){
            [Console]::Out.WriteLine("diagnostic:wispfall-started scale=$($script:petScalePercent) generatedBlocks=$(@($script:playroomBlocks|Where-Object{$_.WispfallGenerated}).Count) userBlocksActive=$(@($script:playroomBlocks|Where-Object{-not$_.WispfallGenerated}).Count) userGadgetsActive=$(@($script:playroomGadgets|Where-Object{$null-eq$_.PSObject.Properties['WispfallGenerated']}).Count) storedBlocks=$($script:wispfallStoredBlocks.Count) storedGadgets=$($script:wispfallStoredGadgets.Count)")
        }
        if($env:WINDOWISP_TEST_MINIGAME_EXIT-eq'1'){
            Return-ToSandbox
            [Console]::Out.WriteLine("diagnostic:wispfall-exit scale=$($script:petScalePercent) blocks=$($script:playroomBlocks.Count)/$beforeBlocks gadgets=$($script:playroomGadgets.Count)/$beforeGadgets stored=$($script:wispfallStoredBlocks.Count),$($script:wispfallStoredGadgets.Count) lava=$($null-ne$script:wispfallLavaWindow)")
        }
    }
    if ($script:frozen) { return }

    $p1Ladder=$null
    if ($script:active) {
        $script:inputTick++
        if($script:gadgetBenchmarkPhase-like'Ladders*Moving'){
            $benchMotionX=[Math]::Sin($script:inputTick*.11)*75;$benchMotionY=[Math]::Cos($script:inputTick*.07)*28
            foreach($benchLadder in @($script:playroomBlocks|Where-Object{$_.Type-eq'Ladder'-and$null-ne$_.PSObject.Properties['BenchmarkBaseX']})){
                $benchLadder.X=$benchLadder.BenchmarkBaseX+$benchMotionX;$benchLadder.Y=$benchLadder.BenchmarkBaseY+$benchMotionY
                Set-PlacementWindowPosition $benchLadder
            }
        }
        $leftDown = (Test-KeyDown $script:controlBindings.P1Left) -or (-not $script:twoPlayerActive -and (Test-KeyDown $vk.Left))
        $rightDown = (Test-KeyDown $script:controlBindings.P1Right) -or (-not $script:twoPlayerActive -and (Test-KeyDown $vk.Right))
        $jumpDown = (Test-KeyDown $script:controlBindings.P1Jump) -or (Test-KeyDown $vk.W) -or (-not $script:twoPlayerActive -and (Test-KeyDown $vk.Up))
        $dropDown = (Test-KeyDown $script:controlBindings.P1Drop) -or (-not $script:twoPlayerActive -and (Test-KeyDown $vk.Down))
        $attackDown = Test-KeyDown $script:controlBindings.P1Attack
        $interactDown = Test-KeyDown $script:controlBindings.P1Interact
        $p1Ladder=Get-LadderContact $script:x $script:y
        $p1Climbing=$null-ne$p1Ladder
        $p1ClimbUpDown=(Test-KeyDown $vk.W)-or(-not$script:twoPlayerActive-and(Test-KeyDown $vk.Up))

        if ($leftDown -and -not $script:previousKeys.Left) {
            if (-not $script:grounded -and $script:dashCooldown -le 0 -and ($script:inputTick - $script:lastLeftTapTick) -le 16) {
                $script:vx = -18*$script:baseMovementScale; $script:vy *= 0.2; $script:dashTicks = 8; $script:dashCooldown = 90
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:air-dash-left' }
            }
            $script:lastLeftTapTick = $script:inputTick
        }
        if ($rightDown -and -not $script:previousKeys.Right) {
            if (-not $script:grounded -and $script:dashCooldown -le 0 -and ($script:inputTick - $script:lastRightTapTick) -le 16) {
                $script:vx = 18*$script:baseMovementScale; $script:vy *= 0.2; $script:dashTicks = 8; $script:dashCooldown = 90
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:air-dash-right' }
            }
            $script:lastRightTapTick = $script:inputTick
        }

        $horizontal = $(if ($leftDown -and -not $rightDown) { -1 } elseif ($rightDown -and -not $leftDown) { 1 } else { 0 })
        if ($horizontal -ne 0 -and $script:dashTicks -le 0) {
            $speedScale = $script:petSpeedScales[$script:petSpeedIndex]*$script:baseMovementScale
            $acceleration = $(if ($script:grounded) { 1.35 } else { 0.72 }) * $speedScale
            $maxSpeed = 9.5 * $speedScale
            $script:vx = [Math]::Max(-$maxSpeed, [Math]::Min($maxSpeed, $script:vx + ($horizontal * $acceleration)))
            $script:facing = $horizontal
        } elseif ($script:grounded) {
            $script:vx *= $(if ($script:surfaceEffect -eq 'Ice' -and $script:surfaceEffectTicks -gt 0) { 0.975 } else { 0.78 })
        } else {
            $script:vx *= 0.985
        }

        $p1LadderJump=$p1Climbing-and$jumpDown-and-not$script:previousKeys.Jump-and$horizontal-ne0
        if($p1LadderJump){
            $script:vy=-15.5*$script:baseMovementScale;$script:vx=$horizontal*11.5*$script:baseMovementScale
            $script:grounded=$false;$p1Climbing=$false;$p1Ladder=$null
            if($env:WINDOWISP_DIAGNOSTICS-eq'1'){Write-Output 'diagnostic:ladder-jump'}
        }elseif ($jumpDown -and -not $script:previousKeys.Jump -and -not$p1Climbing) {
            if ($script:grounded -or $script:coyoteTicks -gt 0) {
                $script:vy = -18.5*$script:baseMovementScale; $script:grounded = $false; $script:coyoteTicks = 0
                $script:airJumpsRemaining = 1
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:ground-jump' }
            } elseif ($script:wallGraceTicks -gt 0 -and $script:wallContact -ne 0) {
                $script:vy = -17.5*$script:baseMovementScale; $script:vx = -$script:wallContact * 13.5*$script:baseMovementScale
                $script:facing = -$script:wallContact; $script:wallGraceTicks = 0
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:wall-jump side=$($script:wallContact)" }
            } elseif ($script:airJumpsRemaining -gt 0) {
                $script:vy = -17*$script:baseMovementScale; $script:airJumpsRemaining--
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:double-jump' }
            }
        }
        if($p1Climbing){
            $climbDirection=$(if($p1ClimbUpDown){1}elseif($dropDown){-1}else{0})
            $axisVelocity=($script:vx*$p1Ladder.UpX)+($script:vy*$p1Ladder.UpY)
            $targetAxisVelocity=$climbDirection*5.5*$script:baseMovementScale
            $script:vx+=($targetAxisVelocity-$axisVelocity)*$p1Ladder.UpX
            $script:vy+=($targetAxisVelocity-$axisVelocity)*$p1Ladder.UpY
            $script:grounded=$false
        }
        if ($dropDown -and -not $script:previousKeys.Drop) {
            $script:dropTicks = 18; $script:grounded = $false; $script:vy = [Math]::Max(4, $script:vy)
            $script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null
        }
        if ($attackDown -and -not $script:previousKeys.Attack -and $script:attackCooldown -le 0) {
            if(Start-BatCharge 'Player1'){$script:charging=$false}
            else{
                $script:charging = $true; $script:chargeTicks = 0
                if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:charge-start' }
            }
        }
        if ($interactDown -and -not $script:previousKeys.Interact) { Toggle-BallCarry 'Player1' }
        if ($script:charging -and $attackDown) {
            $script:chargeTicks = [Math]::Min(90, $script:chargeTicks + 1)
        }
        if($attackDown){Update-BatCharge 'Player1'}
        if(-not$attackDown-and$script:previousKeys.Attack-and(Release-BatSwing 'Player1')){
            $script:charging=$false;$script:attackTicks=18;$script:attackCooldown=22
        }
        if ($script:charging -and -not $attackDown -and $script:previousKeys.Attack) {
            $chargePower = $script:chargeTicks / 90
            New-Fireball -power $chargePower
            $script:charging = $false; $script:attackTicks = 18; $script:attackCooldown = 24
            if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output "diagnostic:charge-release power=$chargePower" }
        }
        $script:previousKeys.Jump = $jumpDown; $script:previousKeys.Drop = $dropDown; $script:previousKeys.Attack = $attackDown; $script:previousKeys.Interact = $interactDown
        $script:previousKeys.Left = $leftDown; $script:previousKeys.Right = $rightDown
    } else {
        $script:previousKeys.Jump = $false; $script:previousKeys.Drop = $false; $script:previousKeys.Attack = $false; $script:previousKeys.Interact = $false
        $script:previousKeys.Left = $false; $script:previousKeys.Right = $false
        if ($script:autoWander -and $script:grounded) {
            if ($script:facing -eq 0) { $script:facing = 1 }
            $script:vx = $script:facing * (1.4 * $script:petSpeedScales[$script:petSpeedIndex] * $script:baseMovementScale)
            $wanderLeft = [Windows.SystemParameters]::VirtualScreenLeft + 12
            $wanderRight = $wanderLeft + [Windows.SystemParameters]::VirtualScreenWidth - $PetWidth - 24
            if ($script:x -le $wanderLeft) { $script:facing = 1 }
            if ($script:x -ge $wanderRight) { $script:facing = -1 }
        } elseif ($script:grounded) { $script:vx *= 0.78 }
    }

    if ($script:attackCooldown -gt 0) { $script:attackCooldown-- }
    if ($script:attackTicks -gt 0) { $script:attackTicks-- }
    if ($script:dashCooldown -gt 0) { $script:dashCooldown-- }
    if ($script:dashTicks -gt 0) { $script:dashTicks-- }
    # Hit protection belongs to the player, not to a particular game type.
    # Sandbox hazards use the same flash and always recover to full opacity.
    if ($script:invulnerableTicks -gt 0) {
        $script:invulnerableTicks--
        if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$env:WINDOWISP_TEST_LASER_VISUAL-eq'1'-and$script:invulnerableTicks-eq0){
            $script:x=[Windows.SystemParameters]::VirtualScreenLeft+40
            [Console]::Out.WriteLine('diagnostic:sandbox-protection-recovered')
        }
    }
    if ($script:p2InvulnerableTicks -gt 0) { $script:p2InvulnerableTicks-- }

    if ($script:active -and $script:hearts -gt 0 -and -not $script:playroomActive) {
        $script:elapsedTicks++
        if ($script:gameType -eq 'Dodgeball') {
            if ([DateTime]::UtcNow -ge $script:dodgeballNextSpawnAt) {
                New-Dodgeball
                $script:dodgeballNextSpawnAt = [DateTime]::UtcNow.AddSeconds(5)
            }
            Update-Dodgeballs
        } else {
        if ($env:WINDOWISP_DIAGNOSTICS -eq '1' -and ($script:elapsedTicks % 60) -eq 0) {
            Write-Output "diagnostic:survival-tick elapsed=$($script:elapsedTicks) enemy-spawn=$($script:enemySpawnTicks) star-spawn=$($script:starSpawnTicks) shield-spawn=$($script:shieldPickupSpawnTicks)"
        }
        if ($null -eq $script:star) {
            $script:starSpawnTicks--
            if ($script:starSpawnTicks -le 0) { New-Star }
        } else {
            $script:star.Angle = ($script:star.Angle + 4.5) % 360
            $script:star.Rotate.Angle = $script:star.Angle
        }
        if ($null -eq $script:shieldPickup -and $script:shieldPickupSpawnTicks -gt 0) {
            $script:shieldPickupSpawnTicks--
            if ($script:shieldPickupSpawnTicks -le 0) {
                New-ShieldPickup
                $script:shieldPickupSpawnTicks = -1
            }
        } elseif ($null -ne $script:shieldPickup) {
            Update-ShieldPickup
        }
        $wave=Get-SurvivalWave
        $enemyCap=[Math]::Min(9,3+[Math]::Ceiling($wave/2))
        if ([DateTime]::UtcNow -ge $script:enemyNextSpawnAt) {
            if ($script:enemies.Count -lt $enemyCap) { New-Enemy }
            $script:enemyNextSpawnAt=[DateTime]::UtcNow.AddSeconds([Math]::Max(1.8,5-($wave*.35)))
        }
        foreach ($enemyObject in @($script:enemies)) {
            Update-OneEnemy $enemyObject
        }
        }
    }

    $script:platformRefresh++
    # Desktop discovery is comparatively expensive (native enumeration plus
    # highlight reconciliation). A ~300 ms cadence still follows moved windows
    # smoothly through the dedicated riding code without taxing crowded games.
    if ($script:platformRefresh -ge 30) {
        $script:platformRefresh = 0
        $script:platforms = [PetNative]::GetPlatformWindows([uint32]$PID)
        Update-PlatformHighlights
    }

    Update-RidingApplicationWindow 'P1'
    $oldX = $script:x
    $oldY = $script:y
    $oldBottom = $script:y + $PetHeight
    $gravity = $(if ($null-ne$p1Ladder) { 0 } elseif ($script:dashTicks -gt 0) { 0.15 } else { 1.05 })
    $script:vy = [Math]::Min($script:vy + $gravity, 24)
    $script:x += $script:vx
    $script:y += $script:vy
    if ([Math]::Abs($script:vx) -lt 0.15) { $script:vx = 0 }
    if ($script:dropTicks -gt 0) { $script:dropTicks-- }

    $leftBound = [Windows.SystemParameters]::VirtualScreenLeft
    $topBound = [Windows.SystemParameters]::VirtualScreenTop
    $rightBound = $leftBound + [Windows.SystemParameters]::VirtualScreenWidth - $PetWidth
    $floor = $topBound + [Windows.SystemParameters]::VirtualScreenHeight
    if ($script:wallGraceTicks -gt 0) { $script:wallGraceTicks-- } else { $script:wallContact = 0 }
    if ($script:x -le $leftBound -and $script:vx -lt 0) {
        $script:x = $leftBound; $script:vx = 0
        $script:wallContact = -1; $script:wallGraceTicks = 6
        if ($script:vy -gt 4.5) { $script:vy = 4.5 }
    } elseif ($script:x -ge $rightBound -and $script:vx -gt 0) {
        $script:x = $rightBound; $script:vx = 0
        $script:wallContact = 1; $script:wallGraceTicks = 6
        if ($script:vy -gt 4.5) { $script:vy = 4.5 }
    }
    $script:x = [Math]::Max($leftBound, [Math]::Min($rightBound, $script:x))
    $script:y = [Math]::Max($topBound, $script:y)
    $script:grounded = $false
    foreach ($blockData in @($script:playroomBlocks)) {
        if($blockData.Type-in@('Ladder','Wooden','Cloud')){continue}
        if(Test-LadderBlockPassThrough $p1Ladder $blockData){continue}
        if([Math]::Abs($blockData.Angle)-gt.01){continue}
        $oldBodyTop=$oldY+8;$newBodyTop=$script:y+8
        $newLeft=$script:x+12;$newRight=$script:x+$PetWidth-12
        $horizontalOverlap=$newRight-gt$blockData.X -and $newLeft-lt$blockData.X+$blockData.Width
        if($script:vy-lt0-and$horizontalOverlap-and$oldBodyTop-ge$blockData.Y+$blockData.Height-6-and$newBodyTop-le$blockData.Y+$blockData.Height){
            $script:y=$blockData.Y+$blockData.Height-8;$script:vy=0;continue
        }
        $bodyTop = $script:y + 8; $bodyBottom = $script:y + $PetHeight - 5
        if ($bodyBottom -le $blockData.Y -or $bodyTop -ge $blockData.Y + $blockData.Height) { continue }
        $oldLeft = $oldX + 12; $oldRight = $oldX + $PetWidth - 12
        if ($script:vx -gt 0 -and $oldRight -le $blockData.X + 5 -and $newRight -ge $blockData.X) {
            $script:x = $blockData.X - ($PetWidth - 12); $script:vx = 0
            $script:wallContact = 1; $script:wallGraceTicks = 6
            if ($script:vy -gt 4.5) { $script:vy = 4.5 }
        } elseif ($script:vx -lt 0 -and $oldLeft -ge $blockData.X + $blockData.Width - 5 -and $newLeft -le $blockData.X + $blockData.Width) {
            $script:x = $blockData.X + $blockData.Width - 12; $script:vx = 0
            $script:wallContact = -1; $script:wallGraceTicks = 6
            if ($script:vy -gt 4.5) { $script:vy = 4.5 }
        }
    }

    $newBottom = $script:y + $PetHeight
    $landingY = $floor
    $landingBlock = $null
    $landingPlatform = $null
    if ($script:vy -ge 0) {
        for($platformIndex=0;$script:dropTicks-le0-and$platformIndex-lt$script:platforms.Count;$platformIndex++) {
            $r=$script:platforms[$platformIndex]
            $overlaps = ($script:x + $PetWidth - 12 -gt $r.Left) -and ($script:x + 12 -lt $r.Right)
            if ($overlaps -and $oldBottom -le ($r.Top + 5) -and $newBottom -ge $r.Top -and $r.Top -lt $landingY -and (Test-PlatformTopExposed $platformIndex ($script:x+12) ($script:x+$PetWidth-12) $r.Top)) {
                $landingY = $r.Top;$landingPlatform=$r
            }
        }
        if ($script:playroomBlocks.Count -gt 0) {
            foreach ($blockData in @($script:playroomBlocks)) {
                if($blockData.Type-in@('Ladder','Wooden','Cloud')-or$blockData.TemporaryState-eq'Gone'){continue}
                if(Test-LadderBlockPassThrough $p1Ladder $blockData){continue}
                if([Math]::Abs($blockData.Angle)-gt.01){continue}
                $blockLeft = $blockData.X
                $blockTop = $blockData.Y
                $overlaps = ($script:x + $PetWidth - 12 -gt $blockLeft) -and ($script:x + 12 -lt $blockLeft + $blockData.Width)
                if ($overlaps -and $oldBottom -le ($blockTop + 6) -and $newBottom -ge $blockTop -and $blockTop -lt $landingY) {
                    $landingY = $blockTop; $landingBlock = $blockData;$landingPlatform=$null
                }
            }
        }
    }
    if ($newBottom -ge $landingY) {
        $script:y = $landingY - $PetHeight
        $script:vy = 0; $script:grounded = $true
        if($null-ne$landingPlatform){$script:groundPlatformHwnd=$landingPlatform.Hwnd;$script:groundPlatformRect=$landingPlatform}else{$script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null}
        $script:surfaceEffect = $(if ($null -ne $landingBlock) { $landingBlock.Type } else { 'Normal' })
        $script:surfaceEffectTicks = 8
        if($null-ne$landingBlock){Trigger-TemporaryBlock $landingBlock 'Player1'}
        if ($null -ne $landingBlock -and $landingBlock.Type -eq 'Bouncy') {
            $script:vy = -20.5; $script:grounded = $false
        } elseif ($null -ne $landingBlock -and $landingBlock.Type -eq 'Fire') {
            $script:vy = -13; $script:vx += $(if ($script:facing -lt 0) { -3 } else { 3 })
            $script:grounded = $false; $script:attackTicks = 20
        } elseif ($null -ne $landingBlock -and $landingBlock.Type -eq 'Conveyor') {
            $script:vx = [Math]::Max(-13, [Math]::Min(13, $script:vx + ($landingBlock.Direction * .72)))
        }
    }else{$script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null}
    foreach($rotatedBlock in @($script:playroomBlocks|Where-Object{$_.Type-notin@('Ladder','Wooden','Cloud')-and[Math]::Abs($_.Angle)-gt.01-and-not(Test-LadderBlockPassThrough $p1Ladder $_)})){
        $resolved=Resolve-PlayerRotatedBlock $rotatedBlock $script:x $script:y $script:vx $script:vy
        if($null-ne$resolved){
            $script:x=$resolved.X;$script:y=$resolved.Y;$script:vx=$resolved.VX;$script:vy=$resolved.VY
            if($resolved.Grounded){
                $script:grounded=$true;$landingBlock=$rotatedBlock;$script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null
                $script:surfaceEffect=$rotatedBlock.Type;$script:surfaceEffectTicks=8
                if($rotatedBlock.Type-eq'Bouncy'){
                    $angle=$rotatedBlock.Angle*[Math]::PI/180
                    $script:vx+=[Math]::Sin($angle)*20.5;$script:vy-=[Math]::Cos($angle)*20.5;$script:grounded=$false
                }elseif($rotatedBlock.Type-eq'Fire'){
                    $angle=$rotatedBlock.Angle*[Math]::PI/180
                    $script:vx+=[Math]::Sin($angle)*13;$script:vy-=[Math]::Cos($angle)*13;$script:grounded=$false;$script:attackTicks=20
                }elseif($rotatedBlock.Type-eq'Conveyor'){
                    $angle=$rotatedBlock.Angle*[Math]::PI/180
                    $script:vx=[Math]::Max(-13,[Math]::Min(13,$script:vx+([Math]::Cos($angle)*$rotatedBlock.Direction*.72)))
                    $script:vy+=[Math]::Sin($angle)*$rotatedBlock.Direction*.72
                }
            }
            if($resolved.Wall-ne0){$script:wallContact=$resolved.Wall;$script:wallGraceTicks=6}
        }
    }
    foreach($wood in @($script:playroomBlocks|Where-Object{$_.Type-in@('Wooden','Cloud')})){
        $woodLanding=Resolve-PlayerWoodenPlatform $wood $oldX $oldY $script:x $script:y $script:vx $script:vy $script:dropTicks
        if($null-ne$woodLanding){
            $script:x=$woodLanding.X;$script:y=$woodLanding.Y;$script:vx=$woodLanding.VX;$script:vy=$woodLanding.VY
            if($woodLanding.Grounded){$script:grounded=$true;$landingBlock=$wood;$script:groundPlatformHwnd=[IntPtr]::Zero;$script:groundPlatformRect=$null;$script:surfaceEffect=$wood.Type;$script:surfaceEffectTicks=8;if($wood.Type-eq'Cloud'){Trigger-TemporaryBlock $wood 'Player1'}}
        }
    }
    if ($script:surfaceEffectTicks -gt 0) { $script:surfaceEffectTicks-- } else { $script:surfaceEffect = 'Normal' }
    if ($script:grounded) {
        $script:coyoteTicks = 6; $script:airJumpsRemaining = 1
    } elseif ($script:coyoteTicks -gt 0) {
        $script:coyoteTicks--
    }
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and-not$script:diagnosticMainMarker){[Console]::Out.WriteLine('diagnostic:main-update-reached');$script:diagnosticMainMarker=$true}
    try{Update-Shield}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:shield-update-error $($_.Exception.ToString())")}}
    try{Update-PlayroomBalls}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:ball-update-error $($_.Exception.ToString())")}}
    try{Update-PlayroomGadgets}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:gadget-update-error $($_.Exception.ToString())")}}
    try{Update-PlayroomHazards}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:hazard-update-error $($_.Exception.ToString())")}}
    try{Update-Football}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:football-update-error $($_.Exception.ToString())")}}
    try{Update-Wispfall}catch{if($env:WINDOWISP_DIAGNOSTICS-eq'1'){[Console]::Out.WriteLine("diagnostic:wispfall-update-error $($_.Exception.ToString())")}}
    if(-not$script:wispfallActive){try{Update-TemporaryBlocks}catch{}}
    foreach($supportCase in @($script:diagnosticSupportCases|Where-Object{-not$_.Complete})){
        $supportCase.Ticks++
        $supportObject=$supportCase.Object;$supportBlock=$supportCase.Block
        $bodyBottom=$supportObject.Y+$supportObject.BodyOffsetY+$supportObject.BodyHeight
        if(($supportCase.Ticks%20)-eq0){
            [Console]::Out.WriteLine("diagnostic:support-sample case=$($supportCase.Name) tick=$($supportCase.Ticks) bodyBottom=$([Math]::Round($bodyBottom,2)) blockTop=$([Math]::Round($supportBlock.Y,2)) vy=$([Math]::Round($supportObject.VY,2))")
        }
        if($supportCase.Ticks-ge180){
            $resting=([Math]::Abs($bodyBottom-$supportBlock.Y)-le2)-and([Math]::Abs($supportObject.VY)-le0.5)
            $fellThrough=($supportObject.Y+$supportObject.BodyOffsetY)-gt($supportBlock.Y+$supportBlock.Height)
            $result=if($resting){'PASS'}elseif($fellThrough){'FAIL_FELL_THROUGH'}else{'FAIL_UNSETTLED'}
            [Console]::Out.WriteLine("diagnostic:support-result case=$($supportCase.Name) result=$result bodyBottom=$([Math]::Round($bodyBottom,2)) blockTop=$([Math]::Round($supportBlock.Y,2))")
            $supportCase.Complete=$true
        }
    }
    Update-Player2
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'-and$script:p2ControllerMode-ne'Human'-and($script:inputTick%60)-eq0){
        [Console]::Out.WriteLine("diagnostic:p2-ai mode=$($script:p2ControllerMode) action=$($script:p2AIIntent.Label) x=$([Math]::Round($script:p2X,1)) vx=$([Math]::Round($script:p2VX,1)) grounded=$($script:p2Grounded)")
    }
    Update-HitProtectionVisuals

    foreach ($shot in @($script:projectiles)) {
        $shot.X += $shot.VX; $shot.Y += $shot.VY; $shot.Life--
        if(($script:inputTick%2)-eq0){Set-SharedOverlayElementPosition $shot.Element $shot.X $shot.Y}
        $removeShot = $false
        if ($shot.Owner -like 'Player*' -and $script:enemies.Count -gt 0) {
            foreach ($enemyObject in @($script:enemies)) {
                $hitEnemy = ($shot.X + ($shot.Width * 0.9) -gt $enemyObject.X) -and ($shot.X + 5 -lt $enemyObject.X + $enemyObject.Width) -and
                            ($shot.Y + ($shot.Height * 0.9) -gt $enemyObject.Y) -and ($shot.Y + 4 -lt $enemyObject.Y + $enemyObject.Height)
                if ($hitEnemy) {
                    $enemyObject.Health -= $shot.Damage; $removeShot = $true
                    if ($enemyObject.Health -le 0) { Remove-Enemy $enemyObject $true }
                    break
                }
            }
        } elseif ($shot.Owner -eq 'Enemy' -and $script:shieldTicks -gt 0) {
            $shieldHit = ($shot.X + $shot.Width -gt $script:x - 12) -and ($shot.X -lt $script:x + $PetWidth + 12) -and
                         ($shot.Y + $shot.Height -gt $script:y - 12) -and ($shot.Y -lt $script:y + $PetHeight + 12)
            if ($shieldHit) { $removeShot = $true }
        } elseif ($shot.Owner -eq 'Enemy' -and $script:twoPlayerActive -and $script:p2InvulnerableTicks -le 0 -and
                  ($shot.X + $shot.Width -gt $script:p2X + 8) -and ($shot.X + 5 -lt $script:p2X + $PetWidth - 8) -and
                  ($shot.Y + $shot.Height -gt $script:p2Y + 8) -and ($shot.Y + 4 -lt $script:p2Y + $PetHeight - 5)) {
            $script:p2Hearts--; $script:p2InvulnerableTicks=90; $removeShot=$true
        } elseif ($shot.Owner -eq 'Enemy' -and $script:invulnerableTicks -le 0) {
            $hitPlayer = ($shot.X + $shot.Width -gt $script:x + 8) -and ($shot.X + 5 -lt $script:x + $PetWidth - 8) -and
                         ($shot.Y + $shot.Height -gt $script:y + 8) -and ($shot.Y + 4 -lt $script:y + $PetHeight - 5)
            if ($hitPlayer) {
                $script:hearts--; $script:invulnerableTicks = 90; $removeShot = $true
                if ($script:hearts -le 0) {
                    $script:active = $false; Register-ControlKeys $false; Set-ClickThrough $true
                    Remove-AllEnemies; Remove-Star $false; Remove-Shield; Remove-ShieldPickup
                    Update-Menu
                }
            }
        }
        if ($removeShot -or $shot.Life -le 0 -or $shot.X -lt ($leftBound - 100) -or $shot.X -gt ($rightBound + $PetWidth + 100) -or $shot.Y -lt ($topBound - 100) -or $shot.Y -gt ($floor + 100)) {
            Remove-SharedGameplayElement $shot.Element;$script:projectiles.Remove($shot)
        }
    }

    if ($null -ne $script:star -and $script:active -and $script:hearts -gt 0) {
        $touchesStar = ($script:x + $PetWidth - 6 -gt $script:star.X + 8) -and ($script:x + 6 -lt $script:star.X + 96) -and
                       ($script:y + $PetHeight - 6 -gt $script:star.Y + 8) -and ($script:y + 6 -lt $script:star.Y + 96)
        if ($touchesStar) { Remove-Star $true }
    }
    if ($null -ne $script:shieldPickup -and $script:active -and $script:hearts -gt 0) {
        $touchesShield = ($script:x + $PetWidth - 6 -gt $script:shieldPickup.X + 8) -and ($script:x + 6 -lt $script:shieldPickup.X + 96) -and
                         ($script:y + $PetHeight - 6 -gt $script:shieldPickup.Y + 8) -and ($script:y + 6 -lt $script:shieldPickup.Y + 104)
        if ($touchesShield) {
            Remove-ShieldPickup
            $script:shieldTicks = 480
        }
    }

    $window.Left = $script:x; $window.Top = $script:y
    Update-FamiliarBubble
    # Commit held toys only after both player simulations and windows have moved.
    # This prevents top-level toy windows alternating between adjacent frames.
    Update-CarriedToyPositions
    $state = if ($script:charging -or $script:attackTicks -gt 0) { 'attack' } elseif (-not $script:grounded) { 'jump' } elseif ([Math]::Abs($script:vx) -gt 0.5) { 'run' } else { 'idle' }
    if ($state -ne $script:lastState) { $script:animationTick = 0; $script:lastState = $state } else { $script:animationTick++ }
    $frame = if ($state -eq 'attack') {
        $(if ($script:charging) { [Math]::Min(3, [Math]::Floor($script:chargeTicks / 23)) } else { [Math]::Min(3, [Math]::Floor($script:animationTick / 3)) })
    } elseif ($state -eq 'run') {
        [Math]::Floor($script:animationTick / 7) % 8
    } elseif ($state -eq 'jump') {
        if ($script:grounded) { 4 } elseif ($script:vy -lt -8) { 1 } elseif ($script:vy -lt 2) { 2 } elseif ($script:vy -lt 12) { 3 } else { 4 }
    } else {
        [Math]::Floor($script:animationTick / 10) % 6
    }
    Draw-Pet $script:active $state $script:facing ([int]$frame)
    $script:hudRefreshTick++
    if ($script:hudRefreshTick -ge 6) {
        $script:hudRefreshTick = 0
        Update-Hud
    }
})

$window.Add_Closed({
    $timer.Stop()
    if($script:wispfallActive-or$null-ne$script:wispfallLavaWindow){Remove-WispfallSetup}
    if ($script:hwnd -ne [IntPtr]::Zero) {
        foreach ($id in 1..12) { [PetNative]::UnregisterHotKey($script:hwnd, $id) | Out-Null }
    }
    foreach ($shot in @($script:projectiles)) { Remove-SharedGameplayElement $shot.Element }
    Remove-AllEnemies
    Remove-Star $false
    if($null-ne$script:familiarBubbleWindow){try{$script:familiarBubbleWindow.Close()}catch{};$script:familiarBubbleWindow=$null}
    Remove-PlatformHighlights
    Remove-Shield
    Remove-ShieldPickup
    Clear-Dodgeballs
    if ($null -ne $script:ropeOverlayWindow) { $script:ropeOverlayWindow.Close();$script:ropeOverlayWindow=$null;$script:ropeOverlayCanvas=$null }
    if ($null -ne $script:hudWindow) { $script:hudWindow.Close() }
    if ($null -ne $script:heartWindow) { $script:heartWindow.Close() }
    if ($null -ne $script:p1StatusWindow) { $script:p1StatusWindow.Close() }
    if ($null -ne $script:p2StatusWindow) { $script:p2StatusWindow.Close() }
    if ($null -ne $script:menuWindow) { $script:menuWindow.Close() }
    if ($null -ne $script:menuButtonWindow) { $script:menuButtonWindow.Close() }
    if ($null -ne $script:petSelectorWindow) { $script:petSelectorWindow.Close() }
    if ($null -ne $script:sandboxTrayWindow) { $script:sandboxTrayWindow.Close() }
    if ($null -ne $script:sandboxHotbarWindow) { $script:sandboxHotbarWindow.Close() }
    if ($null -ne $script:gridOverlayWindow) { $script:gridOverlayWindow.Close() }
    if ($null -ne $script:controlsWindow) { $script:controlsWindow.Close() }
    if ($null -ne $script:tutorialWindow) { $script:tutorialWindow.Close() }
    if ($script:twoPlayerActive) { Set-TwoPlayerMode $false }
    if(-not[string]::IsNullOrWhiteSpace($script:gadgetBenchmarkPhase)-and$script:gadgetBenchmarkWallStartMs-gt0){
        $benchProcess=[Diagnostics.Process]::GetCurrentProcess();$benchProcess.Refresh()
        $benchWallMs=$script:frameClock.Elapsed.TotalMilliseconds-$script:gadgetBenchmarkWallStartMs
        $benchCpuMs=$benchProcess.TotalProcessorTime.TotalMilliseconds-$script:gadgetBenchmarkCpuStartMs
        $benchCorePercent=$(if($benchWallMs-gt0){($benchCpuMs/$benchWallMs)*100}else{0})
        $benchAvg=$(if($script:frameGapSamples-gt0){$script:frameGapSum/$script:frameGapSamples}else{0})
        $benchFinite=-not([double]::IsNaN($script:x)-or[double]::IsInfinity($script:x)-or[double]::IsNaN($script:y)-or[double]::IsInfinity($script:y)-or[double]::IsNaN($script:p2X)-or[double]::IsInfinity($script:p2X)-or[double]::IsNaN($script:p2Y)-or[double]::IsInfinity($script:p2Y))
        foreach($benchBall in @($script:playroomBalls)){if([double]::IsNaN($benchBall.X)-or[double]::IsInfinity($benchBall.X)-or[double]::IsNaN($benchBall.Y)-or[double]::IsInfinity($benchBall.Y)){$benchFinite=$false;break}}
        $benchMaxRopeExcess=0.0
        foreach($benchRope in @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'})){
            $benchA=Get-RopeAttachmentPoint $benchRope.EndA;$benchB=Get-RopeAttachmentPoint $benchRope.EndB
            $benchDx=$benchB.X-$benchA.X;$benchDy=$benchB.Y-$benchA.Y
            $benchExcess=[Math]::Max(0,[Math]::Sqrt(($benchDx*$benchDx)+($benchDy*$benchDy))-$benchRope.Length)
            if($benchExcess-gt$benchMaxRopeExcess){$benchMaxRopeExcess=$benchExcess}
        }
        [Console]::Out.WriteLine(('diagnostic:gadget-benchmark-result phase={0} wallMs={1:0} cpuMs={2:0} oneCorePct={3:0.0} avgFrameMs={4:0.00} maxFrameMs={5:0.00} samples={6} handles={7} handleDelta={8} finite={9}' -f $script:gadgetBenchmarkPhase,$benchWallMs,$benchCpuMs,$benchCorePercent,$benchAvg,$script:frameGapMax,$script:frameGapSamples,$benchProcess.HandleCount,($benchProcess.HandleCount-$script:gadgetBenchmarkStartHandles),$benchFinite))
        if($script:gadgetBenchmarkPhase-in@('Ropes3','Ropes')){[Console]::Out.WriteLine(('diagnostic:rope-benchmark-integrity count={0} maxLengthExcess={1:0.000} finite={2}' -f @($script:playroomGadgets|Where-Object{$_.Kind-eq'Rope'}).Count,$benchMaxRopeExcess,$benchFinite))}
    }
    if ($script:frameGapSamples -gt 0) {
        Write-Output ('diagnostic:frame-pacing avg={0:0.00}ms max={1:0.00}ms samples={2}' -f ($script:frameGapSum / $script:frameGapSamples),$script:frameGapMax,$script:frameGapSamples)
    }
    if ($script:playroomActive) {
        Clear-PlayroomObjects
        $script:playroomActive = $false
    }
    try { $singleInstance.ReleaseMutex() } catch {}
    $singleInstance.Dispose()
    $gameOnEvent.Dispose(); $gameOffEvent.Dispose(); $gameToggleEvent.Dispose(); $gameExitEvent.Dispose(); $playroomEvent.Dispose(); $petSwitchEvent.Dispose();$familiarEventSignal.Dispose()
})

Draw-Pet $false 'idle' 0 0
if ($env:WINDOWISP_DIAGNOSTICS -eq '1') { Write-Output 'diagnostic:show-dialog' }
$timer.Start()
try{$window.ShowDialog()|Out-Null}
catch{
    if($env:WINDOWISP_DIAGNOSTICS-eq'1'){
        [Console]::Error.WriteLine("diagnostic:fatal $($_.Exception.ToString())")
        [Console]::Error.WriteLine("diagnostic:stack $($_.ScriptStackTrace)")
    }
    throw
}
