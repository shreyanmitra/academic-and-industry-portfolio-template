param(
    [string]$Site = '',
    [int]$Port = 4317,
    [switch]$NoBrowser,
    [switch]$Check
)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Site) { $Site = (Split-Path -Parent $studioRoot) }
if (-not (Test-Path -LiteralPath (Join-Path $Site '_config.yml'))) { throw "Website folder not found: $Site. Use -Site to select your Jekyll portfolio." }

# Probe interpreters instead of trusting the Windows Store execution alias.
$candidates = @()
if ($env:PORTFOLIO_STUDIO_PYTHON) { $candidates += $env:PORTFOLIO_STUDIO_PYTHON }
$candidates += Join-Path $studioRoot '.venv/Scripts/python.exe'
$launcher = Get-Command py -ErrorAction SilentlyContinue
if ($launcher) {
    try {
        $resolvedPython = & $launcher.Source -3 -c 'import sys; print(sys.executable)' 2>$null
        if ($LASTEXITCODE -eq 0) { $candidates += $resolvedPython }
    } catch { }
}
foreach ($name in @('python', 'python3')) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notmatch '\\Microsoft\\WindowsApps\\') { $candidates += $command.Source }
}
$candidates += Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$candidates += @(Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Programs/Python/Python*/python.exe') -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$studioPython = $null
foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    try {
        & $candidate -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>$null
        if ($LASTEXITCODE -eq 0) { $studioPython = $candidate; break }
    } catch { }
}
if (-not $studioPython) { throw 'Python 3.10 or newer is required. Install Python or set PORTFOLIO_STUDIO_PYTHON to its executable.' }
$dependencyPath = Join-Path $studioRoot '.deps'
$priorPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = $dependencyPath
    if ($priorPythonPath) { $env:PYTHONPATH += [IO.Path]::PathSeparator + $priorPythonPath }
    $env:PYTHONUTF8 = '1'
    & $studioPython -c 'import yaml' 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing Portfolio Studio dependencies locally...'
        & $studioPython -m pip install --disable-pip-version-check --target $dependencyPath -r (Join-Path $studioRoot 'requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Dependency setup failed. Check your connection and run this launcher again.' }
    }
    if ($Check) {
        & $studioPython -c 'import sys, yaml; print("Portfolio Studio is ready (Python " + sys.version.split()[0] + ", PyYAML " + yaml.__version__ + ").")'
        exit $LASTEXITCODE
    }
    $serverArgs = @((Join-Path $studioRoot 'server.py'), '--site', $Site, '--port', $Port)
    if ($NoBrowser) { $serverArgs += '--no-browser' }
    & $studioPython @serverArgs
    exit $LASTEXITCODE
} finally { $env:PYTHONPATH = $priorPythonPath }
