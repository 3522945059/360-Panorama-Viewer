import { access, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ASSETS_DIR = resolve("./assets");
const REFERENCE_COPY = join(ASSETS_DIR, "reference-source.png");
const PANORAMA_OUTPUT = join(ASSETS_DIR, "panorama-final.png");
const POWERSHELL_SCRIPT = resolve("./scripts/generate-panorama.ps1");

const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
const SIZE = process.env.OPENAI_IMAGE_SIZE || "1536x1024";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "high";
const BACKGROUND = process.env.OPENAI_IMAGE_BACKGROUND || "opaque";
const API_KEY = process.env.OPENAI_API_KEY;
const TARGET_WIDTH = process.env.PANORAMA_TARGET_WIDTH || "2048";
const TARGET_HEIGHT = process.env.PANORAMA_TARGET_HEIGHT || "1024";

const REFINE_MODE = process.argv.includes("--refine");
const REFINE_SOURCE_ARG_INDEX = process.argv.indexOf("--refine-source");
const REFINE_SOURCE =
  REFINE_SOURCE_ARG_INDEX >= 0
    ? resolve(process.argv[REFINE_SOURCE_ARG_INDEX + 1] || "")
    : PANORAMA_OUTPUT;

const execFileAsync = promisify(execFile);

function invariantPrompt() {
  return [
    "Create a standard 360-degree equirectangular panorama for web panorama viewing.",
    "The output must be a true equirectangular panorama with seamless left-right edges.",
    "Use the reference image as the front-facing center view of the panorama.",
    "Preserve the adult woman as the sole main subject and keep her identity, outfit, mirror-selfie pose, mood, room lighting, and overall upscale hotel-room atmosphere consistent with the reference.",
    "Remove the crouching man entirely.",
    "Expand the scene naturally to the left, right, behind the camera, ceiling, and floor as a believable hotel interior.",
    "Keep the woman clearly in the front-facing hero view, not duplicated anywhere else in the panorama.",
    "Avoid fisheye distortion, avoid text, avoid logos, avoid watermarks, avoid extra people, avoid duplicated limbs, avoid malformed mirrors.",
    "The room should feel coherent when rotated in 360 degrees, with natural continuity across walls, door frames, carpet, bed, and lighting.",
    "This is for an interactive web panorama viewer, so the horizontal seam must connect cleanly.",
  ].join(" ");
}

function refinePrompt() {
  return [
    "Refine this existing equirectangular 360 panorama.",
    "Keep the same adult woman, same front-facing composition, same hotel-room mood, and same upscale neutral lighting.",
    "Fix any seam mismatches on the left and right edges.",
    "Fix any panorama distortions, duplicated subject artifacts, incorrect reflections, or spatial inconsistencies.",
    "Preserve a true equirectangular layout suitable for web-based 360 viewing.",
    "Do not add text, logos, watermarks, or extra people.",
  ].join(" ");
}

async function ensureAssets() {
  await mkdir(ASSETS_DIR, { recursive: true });

  try {
    await access(REFERENCE_COPY);
  } catch {
    throw new Error(
      `Reference image not found at ${REFERENCE_COPY}. Copy your source image there, then rerun the generator.`,
    );
  }
}

async function runPowerShellGenerator(prompt, inputFilePath) {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    POWERSHELL_SCRIPT,
    "-ApiKey",
    API_KEY,
    "-ReferencePath",
    inputFilePath,
    "-OutputPath",
    PANORAMA_OUTPUT,
    "-Prompt",
    prompt,
    "-Model",
    MODEL,
    "-Size",
    SIZE,
    "-Quality",
    QUALITY,
    "-Background",
    BACKGROUND,
    "-TargetWidth",
    TARGET_WIDTH,
    "-TargetHeight",
    TARGET_HEIGHT,
  ];

  const { stdout, stderr } = await execFileAsync("powershell.exe", args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 4,
  });

  if (stdout.trim()) {
    console.log(stdout.trim());
  }

  if (stderr.trim()) {
    console.error(stderr.trim());
  }
}

async function main() {
  if (!API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in your environment, then rerun `npm.cmd run generate`.",
    );
  }

  await ensureAssets();

  const prompt = REFINE_MODE ? refinePrompt() : invariantPrompt();
  const sourcePath = REFINE_MODE ? REFINE_SOURCE : REFERENCE_COPY;

  await mkdir(dirname(PANORAMA_OUTPUT), { recursive: true });
  await runPowerShellGenerator(prompt, sourcePath);

  console.log(`Model: ${MODEL}`);
  console.log(`Requested API size: ${SIZE}`);
  console.log(`Final output size: ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
  console.log(
    REFINE_MODE
      ? "Mode: refine existing panorama"
      : "Mode: generate panorama from reference image",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
