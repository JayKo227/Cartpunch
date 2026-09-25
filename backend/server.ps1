$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8085/")
$listener.Start()
Write-Output "Server running at http://localhost:8085/..."

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.AbsolutePath
        if ($path -eq "/" -or $path -eq "/Monitor" -or $path -eq "/Monitor.html") {
            $file = "C:\Users\Jayson\OneDrive\Documents\CARTPUNCH\frontend_monitor\Monitor.html"
        } elseif ($path -eq "/Admin" -or $path -eq "/Admin.html") {
            $file = "C:\Users\Jayson\OneDrive\Documents\CARTPUNCH\frontend_admin\Admin.html"
        } else {
            $file = Join-Path "C:\Users\Jayson\OneDrive\Documents\CARTPUNCH" $path.TrimStart('/')
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
        # ignore error on close
    }
}
