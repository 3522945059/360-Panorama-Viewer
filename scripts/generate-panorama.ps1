param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,

  [Parameter(Mandatory = $true)]
  [string]$ReferencePath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [string]$Prompt,

  [string]$Model = "gpt-image-1.5",
  [string]$Size = "1536x1024",
  [string]$Quality = "high",
  [string]$Background = "opaque",
  [int]$TargetWidth = 2048,
  [int]$TargetHeight = 1024
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.Drawing

function Get-MimeType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    default { return "image/png" }
  }
}

function Resize-Image {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$Width,
    [int]$Height
  )

  $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    if ($sourceImage.Width -eq $Width -and $sourceImage.Height -eq $Height) {
      if ($SourcePath -ne $DestinationPath) {
        [System.IO.File]::Copy($SourcePath, $DestinationPath, $true)
      }
      return
    }

    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    try {
      $bitmap.SetResolution($sourceImage.HorizontalResolution, $sourceImage.VerticalResolution)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $Width, $Height)
      }
      finally {
        $graphics.Dispose()
      }

      $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}

$referenceFile = Get-Item -LiteralPath $ReferencePath
$referenceBytes = [System.IO.File]::ReadAllBytes($referenceFile.FullName)
$mimeType = Get-MimeType -Path $referenceFile.FullName

$client = [System.Net.Http.HttpClient]::new()
try {
  $client.Timeout = [TimeSpan]::FromMinutes(10)
  $client.DefaultRequestHeaders.Authorization =
    [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiKey)

  $content = [System.Net.Http.MultipartFormDataContent]::new()
  try {
    $pairs = [ordered]@{
      model = $Model
      prompt = $Prompt
      size = $Size
      quality = $Quality
      background = $Background
      output_format = "png"
    }

    foreach ($entry in $pairs.GetEnumerator()) {
      $stringContent = [System.Net.Http.StringContent]::new($entry.Value)
      $content.Add($stringContent, $entry.Key)
    }

    $imageContent = [System.Net.Http.ByteArrayContent]::new($referenceBytes)
    $imageContent.Headers.ContentType =
      [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mimeType)
    $content.Add($imageContent, "image[]", $referenceFile.Name)

    $response = $client.PostAsync("https://api.openai.com/v1/images/edits", $content).GetAwaiter().GetResult()
    $rawJson = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (-not $response.IsSuccessStatusCode) {
      throw "OpenAI image generation failed ($([int]$response.StatusCode)): $rawJson"
    }

    $payload = $rawJson | ConvertFrom-Json
    $imageBase64 = $payload.data[0].b64_json

    if (-not $imageBase64) {
      throw "OpenAI image generation returned no image data."
    }

    $outputDirectory = Split-Path -Parent $OutputPath
    if ($outputDirectory) {
      New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    }

    $tempOutput = [System.IO.Path]::ChangeExtension($OutputPath, ".raw.png")
    [System.IO.File]::WriteAllBytes($tempOutput, [Convert]::FromBase64String($imageBase64))
    Resize-Image -SourcePath $tempOutput -DestinationPath $OutputPath -Width $TargetWidth -Height $TargetHeight
    Remove-Item -LiteralPath $tempOutput -Force

    $finalImage = [System.Drawing.Image]::FromFile($OutputPath)
    try {
      Write-Output ("Saved panorama to {0}" -f $OutputPath)
      Write-Output ("Final dimensions: {0}x{1}" -f $finalImage.Width, $finalImage.Height)
    }
    finally {
      $finalImage.Dispose()
    }
  }
  finally {
    $content.Dispose()
  }
}
finally {
  $client.Dispose()
}
