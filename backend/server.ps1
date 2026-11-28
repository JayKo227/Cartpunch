$rootDir = Split-Path -Parent $PSScriptRoot
$adminDir = Join-Path $rootDir "frontend_admin"
$adminBuildId = "20261128-1027"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8088/")
$listener.Start()
Write-Output "Server running at http://localhost:8088/..."

while ($listener.IsListening) {
    $context = $null
    $response = $null
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $response.Headers.Set("Cache-Control", "no-store, no-cache, must-revalidate")
        $response.Headers.Set("Pragma", "no-cache")
        $response.Headers.Set("Expires", "0")

        $path = $request.Url.AbsolutePath
        if (($path -eq "/Admin" -or $path -eq "/Admin.html") -and $request.QueryString["build"] -ne $adminBuildId) {
            $response.StatusCode = 302
            $response.RedirectLocation = "/Admin.html?build=$adminBuildId"
            $response.Close()
            continue
        }

        if ($path -eq "/" -or $path -eq "/Monitor" -or $path -eq "/Monitor.html") {
            $file = Join-Path $rootDir "frontend_monitor\Monitor.html"
        } elseif ($path -eq "/Admin" -or $path -eq "/Admin.html") {
            $file = Join-Path $adminDir "Admin.html"
        } elseif ($path -eq "/Login" -or $path -eq "/Login.html") {
            $file = Join-Path $adminDir "Login.html"
        } elseif ($path -eq "/Signup" -or $path -eq "/Signup.html") {
            $file = Join-Path $adminDir "Signup.html"
        } elseif ($path -eq "/PendingApproval" -or $path -eq "/PendingApproval.html") {
            $file = Join-Path $adminDir "PendingApproval.html"
        } elseif ($path -eq "/ApproveAdmin" -or $path -eq "/ApproveAdmin.html") {
            $file = Join-Path $adminDir "ApproveAdmin.html"
        } elseif ($path -eq "/Verify" -or $path -eq "/Verify.html") {
            $file = Join-Path $adminDir "Verify.html"
        } elseif ($path.StartsWith("/scripts/")) {
            $file = Join-Path $adminDir $path.TrimStart('/').Replace('/', '\')
        } else {
            $adminCandidate = Join-Path $adminDir $path.TrimStart('/').Replace('/', '\')
            if (Test-Path $adminCandidate -PathType Leaf) {
                $file = $adminCandidate
            } else {
                $file = Join-Path $rootDir $path.TrimStart('/').Replace('/', '\')
            }
        }

        if (Test-Path $file -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            if ($file.EndsWith(".html")) { $response.ContentType = "text/html" }
            elseif ($file.EndsWith(".js")) { $response.ContentType = "application/javascript" }
            elseif ($file.EndsWith(".css")) { $response.ContentType = "text/css" }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        Write-Error "Request handling failed: $($_.Exception.Message)"
        if ($response) {
            try {
                $response.Close()
            } catch {
                Write-Error "Could not close the response: $($_.Exception.Message)"
            }
        }
    }
}
