
# 360 Panorama Viewer

## Requirements

- Node.js 22+
- `OPENAI_API_KEY` set in your environment for panorama generation

## Install

```powershell
npm.cmd install
```

## Generate the panorama

The generator uses the local reference image in `assets/reference-source.png` and writes the final result to `assets/panorama-final.png`.

```powershell
npm.cmd run generate
```

Optional environment variables:

- `OPENAI_IMAGE_MODEL` default: `gpt-image-1.5`
- `OPENAI_IMAGE_SIZE` default: `2048x1024`
- `OPENAI_IMAGE_QUALITY` default: `high`
- `OPENAI_IMAGE_BACKGROUND` default: `opaque`

=======
# 360 Panorama Viewer

## Requirements

- Node.js 22+
- `OPENAI_API_KEY` set in your environment for panorama generation

## Install

```powershell
npm.cmd install
```

## Generate the panorama

The generator uses the local reference image in `assets/reference-source.png` and writes the final result to `assets/panorama-final.png`.

```powershell
npm.cmd run generate
```

Optional environment variables:

- `OPENAI_IMAGE_MODEL` default: `gpt-image-1.5`
- `OPENAI_IMAGE_SIZE` default: `2048x1024`
- `OPENAI_IMAGE_QUALITY` default: `high`
- `OPENAI_IMAGE_BACKGROUND` default: `opaque`

>>>>>>> d343f6d8fb2e8d56a6945a0e00fa2ae79fc65dfc
## Run the local viewer

```powershell
npm.cmd run serve
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Switch panoramas

You now have two ways to switch panoramas:

- Use the built-in manifest file at `assets/panoramas.json`
- Click `选择本地文件夹` in the viewer and load panorama images directly from a local folder

The local folder mode accepts `png`, `jpg`, `jpeg`, and `webp` files and keeps them available for the current browser session.

Example manifest:

```json
{
  "panoramas": [
    {
      "label": "默认全景图",
      "file": "./assets/panorama-final.png"
    },
    {
      "label": "第二张全景图",
      "file": "./assets/panorama-2.png"
    }
  ]
}
```

## Notes

- The viewer is fully local and does not use a CDN.
- If `assets/panorama-final.png` is missing, the page shows a clear empty state.
