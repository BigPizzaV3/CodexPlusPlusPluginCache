<#
.SYNOPSIS
    Compiles and validates a legacy JasperReports 2.x JRXML file into a .jasper file.

.DESCRIPTION
    Uses JDK 8, the consuming project's dependency jars, and the legacy
    JRJdk13Compiler. The Jasper compiler is the structural validator: invalid
    fields, parameters, expressions, or DTD elements cause a non-zero exit.

.PARAMETER Jrxml
    JRXML path, absolute or relative to ProjectRoot.

.PARAMETER ProjectRoot
    Root of the consuming project. Defaults to the current directory.

.PARAMETER LibDirectory
    Directory containing the project's JasperReports 2.x and transitive jars.
    May be absolute or relative to ProjectRoot.

.PARAMETER DeployDirectory
    Optional runtime report directory. The compiled .jasper is copied here
    only after successful compilation.

.PARAMETER JdkHome
    Optional JDK 8 home. When omitted, JAVA_HOME and common Windows JDK paths
    are checked, but only a Java 8 installation is accepted.

.PARAMETER AdditionalClasspath
    Optional jar files or directories containing additional required jars.

.EXAMPLE
    pwsh -NoProfile -File scripts/compile-jrxml.ps1 `
      -Jrxml reports/complex-form.jrxml `
      -ProjectRoot . `
      -LibDirectory target/app/WEB-INF/lib

.EXAMPLE
    pwsh -NoProfile -File scripts/compile-jrxml.ps1 `
      -Jrxml reports/complex-form.jrxml `
      -ProjectRoot . `
      -LibDirectory target/app/WEB-INF/lib `
      -DeployDirectory src/main/webapp/WEB-INF/reports
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Jrxml,

    [string]$ProjectRoot = (Get-Location).Path,

    [Parameter(Mandatory = $true)]
    [string]$LibDirectory,

    [string]$DeployDirectory,

    [string]$JdkHome,

    [string[]]$AdditionalClasspath = @()
)

$ErrorActionPreference = "Stop"
$workDirectory = $null

function Resolve-ProjectPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $candidate = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    } else {
        Join-Path $Root $Path
    }

    return [System.IO.Path]::GetFullPath($candidate)
}

function Test-Java8Home {
    param([string]$Candidate)

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    $javacCandidate = Join-Path $Candidate "bin/javac.exe"
    $javaCandidate = Join-Path $Candidate "bin/java.exe"
    if (-not (Test-Path $javacCandidate)) {
        $javacCandidate = Join-Path $Candidate "bin/javac"
        $javaCandidate = Join-Path $Candidate "bin/java"
    }

    if (-not (Test-Path $javacCandidate) -or -not (Test-Path $javaCandidate)) {
        return $false
    }

    $versionOutput = (& $javaCandidate -version 2>&1 | Out-String)
    return $versionOutput -match 'version "1\.8\.'
}

function Find-Jdk8Home {
    param([string]$ExplicitHome)

    $candidates = [System.Collections.Generic.List[string]]::new()
    if (-not [string]::IsNullOrWhiteSpace($ExplicitHome)) {
        $candidates.Add($ExplicitHome)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $candidates.Add($env:JAVA_HOME)
    }

    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        foreach ($baseDirectory in @("C:\Program Files\Java", "C:\Program Files\Eclipse Adoptium")) {
            if (Test-Path $baseDirectory) {
                Get-ChildItem $baseDirectory -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match 'jdk.*(1\.8|8)' } |
                    ForEach-Object { $candidates.Add($_.FullName) }
            }
        }
    }

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Java8Home $candidate) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }

    throw "JDK 8 not found. Install a JDK 8 or pass -JdkHome with its absolute path."
}

try {
    $projectPath = [System.IO.Path]::GetFullPath($ProjectRoot)
    if (-not (Test-Path $projectPath -PathType Container)) {
        throw "Project root not found: $projectPath"
    }

    $jrxmlPath = Resolve-ProjectPath -Path $Jrxml -Root $projectPath
    if (-not (Test-Path $jrxmlPath -PathType Leaf)) {
        throw "JRXML not found: $jrxmlPath"
    }

    try {
        [xml](Get-Content -Raw -LiteralPath $jrxmlPath) | Out-Null
        Write-Host "[1/4] Well-formed XML: $jrxmlPath"
    } catch {
        throw "Malformed XML in '$jrxmlPath': $($_.Exception.Message)"
    }

    $jdkPath = Find-Jdk8Home -ExplicitHome $JdkHome
    $javac = Join-Path $jdkPath "bin/javac.exe"
    $java = Join-Path $jdkPath "bin/java.exe"
    if (-not (Test-Path $javac)) {
        $javac = Join-Path $jdkPath "bin/javac"
        $java = Join-Path $jdkPath "bin/java"
    }
    $toolsJar = Join-Path $jdkPath "lib/tools.jar"
    Write-Host "[2/4] JDK 8: $jdkPath"

    $libPath = Resolve-ProjectPath -Path $LibDirectory -Root $projectPath
    if (-not (Test-Path $libPath -PathType Container)) {
        throw "Library directory not found: $libPath. Build the consuming project or pass -LibDirectory."
    }

    $classpathEntries = [System.Collections.Generic.List[string]]::new()
    Get-ChildItem $libPath -Recurse -File -Filter "*.jar" |
        ForEach-Object { $classpathEntries.Add($_.FullName) }

    foreach ($entry in $AdditionalClasspath) {
        $resolvedEntry = Resolve-ProjectPath -Path $entry -Root $projectPath
        if (Test-Path $resolvedEntry -PathType Container) {
            Get-ChildItem $resolvedEntry -Recurse -File -Filter "*.jar" |
                ForEach-Object { $classpathEntries.Add($_.FullName) }
        } elseif (Test-Path $resolvedEntry -PathType Leaf) {
            $classpathEntries.Add($resolvedEntry)
        } else {
            throw "Additional classpath entry not found: $resolvedEntry"
        }
    }

    if (-not ($classpathEntries | Where-Object { [System.IO.Path]::GetFileName($_) -match '^jasperreports-?2\.' })) {
        throw "No JasperReports 2.x jar found in the configured classpath."
    }

    if (-not ($classpathEntries | Where-Object { [System.IO.Path]::GetFileName($_) -match '^commons-digester.*\.jar$' })) {
        $mavenRepository = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".m2/repository/commons-digester"
        if (Test-Path $mavenRepository) {
            $digesterJar = Get-ChildItem $mavenRepository -Recurse -File -Filter "commons-digester-*.jar" |
                Select-Object -First 1 -ExpandProperty FullName
            if ($digesterJar) {
                $classpathEntries.Add($digesterJar)
            }
        }
    }

    if (Test-Path $toolsJar) {
        $classpathEntries.Add($toolsJar)
    }

    $workRoot = Join-Path $projectPath "target"
    New-Item -ItemType Directory -Force -Path $workRoot | Out-Null
    $workDirectory = Join-Path $workRoot ("jaspercompile_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $workDirectory | Out-Null
    $classpathEntries.Add($workDirectory)
    $classpath = ($classpathEntries | Select-Object -Unique) -join [System.IO.Path]::PathSeparator

    $helperSource = @'
import net.sf.jasperreports.engine.JasperCompileManager;

public class CompileLegacyJasper {
    public static void main(String[] args) throws Exception {
        System.setProperty(
            "net.sf.jasperreports.compiler.class",
            "net.sf.jasperreports.engine.design.JRJdk13Compiler"
        );
        JasperCompileManager.compileReportToFile(args[0], args[1]);
        System.out.println("COMPILED_OK");
    }
}
'@
    $helperPath = Join-Path $workDirectory "CompileLegacyJasper.java"
    [System.IO.File]::WriteAllText($helperPath, $helperSource, [System.Text.UTF8Encoding]::new($false))

    & $javac -cp $classpath -d $workDirectory $helperPath
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compile the Java helper. Check the legacy classpath."
    }

    $temporaryOutput = Join-Path $workDirectory "report.jasper"
    $compilerOutput = & $java -cp $classpath CompileLegacyJasper $jrxmlPath $temporaryOutput 2>&1
    $compilerOutput | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0 -or -not ($compilerOutput | Select-String "COMPILED_OK")) {
        throw "[3/4] JasperReports compilation failed. Review the compiler output above."
    }

    $outputPath = [System.IO.Path]::ChangeExtension($jrxmlPath, ".jasper")
    Copy-Item -LiteralPath $temporaryOutput -Destination $outputPath -Force
    Write-Host "[3/4] Compiled: $outputPath ($((Get-Item $outputPath).Length) bytes)"

    if (-not [string]::IsNullOrWhiteSpace($DeployDirectory)) {
        $deployPath = Resolve-ProjectPath -Path $DeployDirectory -Root $projectPath
        New-Item -ItemType Directory -Force -Path $deployPath | Out-Null
        $deployedPath = Join-Path $deployPath ([System.IO.Path]::GetFileName($outputPath))
        Copy-Item -LiteralPath $outputPath -Destination $deployedPath -Force
        Write-Host "[4/4] Deployed: $deployedPath"
    } else {
        Write-Host "[4/4] No deployment requested; .jasper remains beside the JRXML."
    }

    Write-Host "DONE"
} finally {
    if ($workDirectory -and (Test-Path $workDirectory)) {
        Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
