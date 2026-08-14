/**
 * 玩偶眨眼帧生成管线（眼睛修补 / 半睁帧 / 去色键残留）。
 *
 * 注意：仓库只保留最终 webp 帧，本脚本的输入素材
 * （`*-open.png` 原始棚拍帧、`*-closed-source.png` 闭眼原帧）不随仓库分发，
 * 需要自行准备后才会生成 `*-open.webp` / `*-closed.webp` / `*-half.webp`。
 * 站点运行时使用的是 scripts 之外提交的 webp 成品，重跑前请确认会覆盖成品。
 */
import sharp from "sharp";
import path from "node:path";

const root = path.resolve("public/dolls-v3");

const dolls = [
  {
    name: "long",
    patch: { left: 420, top: 438, width: 320, height: 155, feather: 24 },
    eyes: [
      { left: 458, top: 470, width: 118, height: 110 },
      { left: 594, top: 466, width: 112, height: 108 },
    ],
  },
  {
    name: "tuantuan",
    patch: { left: 390, top: 584, width: 390, height: 105, feather: 20 },
    eyes: [
      { left: 438, top: 602, width: 82, height: 72 },
      { left: 646, top: 602, width: 82, height: 72 },
    ],
  },
  {
    name: "star",
    patch: { left: 590, top: 500, width: 300, height: 82, feather: 18 },
    eyes: [
      { left: 615, top: 521, width: 74, height: 60 },
      { left: 780, top: 521, width: 74, height: 60 },
    ],
  },
];

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

async function readRgba(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/**
 * Remove chroma-key contamination without eating the fine fur silhouette.
 *
 * Image generation leaves gray/green key colors in partially transparent hair.
 * We preserve the alpha matte, but replace the RGB of the outer six pixels with
 * the nearest clean interior color. This is the standard "color decontamination"
 * step missing from a simple background removal.
 */
function defringe(image, edgeDepth = 12, searchRadius = 30) {
  const { width, height, channels } = image.info;
  const source = image.data;
  const output = Buffer.from(source);
  const depth = new Uint8Array(width * height);
  const alphaAt = (index) => source[index * channels + 3];

  // Transparent pixels should not retain key-colored RGB data.
  for (let index = 0; index < width * height; index += 1) {
    if (alphaAt(index) <= 10) {
      output[index * channels] = 0;
      output[index * channels + 1] = 0;
      output[index * channels + 2] = 0;
      output[index * channels + 3] = 0;
    }
  }

  // Mark the first opaque/semi-opaque row touching transparency.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alphaAt(index) <= 10) continue;

      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
          if (alphaAt(ny * width + nx) <= 10) depth[index] = 1;
        }
      }
    }
  }

  // Grow the cleanup band inwards so fully opaque colored outlines are cleaned too.
  for (let currentDepth = 2; currentDepth <= edgeDepth; currentDepth += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (alphaAt(index) <= 10 || depth[index] !== 0) continue;
        if (
          depth[index - 1] === currentDepth - 1 ||
          depth[index + 1] === currentDepth - 1 ||
          depth[index - width] === currentDepth - 1 ||
          depth[index + width] === currentDepth - 1
        ) {
          depth[index] = currentDepth;
        }
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (depth[index] === 0 || alphaAt(index) <= 10) continue;

      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let radius = 1; radius <= searchRadius && bestIndex < 0; radius += 1) {
        const minX = Math.max(0, x - radius);
        const maxX = Math.min(width - 1, x + radius);
        const minY = Math.max(0, y - radius);
        const maxY = Math.min(height - 1, y + radius);

        for (let ny = minY; ny <= maxY; ny += 1) {
          for (let nx = minX; nx <= maxX; nx += 1) {
            if (nx !== minX && nx !== maxX && ny !== minY && ny !== maxY) continue;
            const candidate = ny * width + nx;
            if (alphaAt(candidate) < 242 || depth[candidate] !== 0) continue;
            const distance = (nx - x) ** 2 + (ny - y) ** 2;
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = candidate;
            }
          }
        }
      }

      if (bestIndex < 0) continue;
      const targetOffset = index * channels;
      const sourceOffset = bestIndex * channels;
      output[targetOffset] = source[sourceOffset];
      output[targetOffset + 1] = source[sourceOffset + 1];
      output[targetOffset + 2] = source[sourceOffset + 2];
      // Keep the original alpha so fine hairs remain fine instead of becoming cut out.
      output[targetOffset + 3] = clampByte(
        255 * (source[targetOffset + 3] / 255) ** 1.28
      );
    }
  }

  return { data: output, info: image.info };
}

function removeChromaResidue(image, name) {
  if (name !== "star") return image;

  const { width, height, channels } = image.info;
  const output = Buffer.from(image.data);

  // The generated star carried a few lime-green chroma-key pixels in isolated
  // outer hairs. They survive generic nearest-colour defringing because some
  // are fully opaque, so remove only that impossible hue and keep the alpha.
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    const red = output[offset];
    const green = output[offset + 1];
    const blue = output[offset + 2];
    const alpha = output[offset + 3];
    if (alpha <= 10 || green <= red * 1.02 || green <= blue * 1.3) continue;

    output[offset] = clampByte(Math.max(red, green + 18));
    output[offset + 1] = clampByte(green * 0.78);
    output[offset + 2] = clampByte(Math.min(blue, green * 0.32));
  }

  return { data: output, info: image.info };
}

function borderColorDelta(open, closed, patch) {
  const { width } = open.info;
  const { left, top, width: patchWidth, height: patchHeight, feather } = patch;
  const sums = [0, 0, 0];
  let count = 0;

  for (let y = 0; y < patchHeight; y += 1) {
    for (let x = 0; x < patchWidth; x += 1) {
      const edge = Math.min(x, y, patchWidth - 1 - x, patchHeight - 1 - y);
      if (edge > feather * 0.85) continue;

      const index = ((top + y) * width + left + x) * 4;
      if (open.data[index + 3] < 245 || closed.data[index + 3] < 245) continue;

      // Patch borders are fur. Reject the very dark facial details and bright eye whites.
      const openLuma = (open.data[index] + open.data[index + 1] + open.data[index + 2]) / 3;
      const closedLuma = (closed.data[index] + closed.data[index + 1] + closed.data[index + 2]) / 3;
      if (openLuma < 45 || closedLuma < 45 || openLuma > 245 || closedLuma > 245) continue;

      for (let channel = 0; channel < 3; channel += 1) {
        sums[channel] += open.data[index + channel] - closed.data[index + channel];
      }
      count += 1;
    }
  }

  return count ? sums.map((sum) => sum / count) : [0, 0, 0];
}

function makeClosedOverlay(open, closed, patch) {
  const { width: canvasWidth } = open.info;
  const { left, top, width, height, feather } = patch;
  const delta = borderColorDelta(open, closed, patch);
  const overlay = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = ((top + y) * canvasWidth + left + x) * 4;
      const targetIndex = (y * width + x) * 4;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const mask = smoothstep(edge / feather);

      overlay[targetIndex] = clampByte(closed.data[sourceIndex] + delta[0]);
      overlay[targetIndex + 1] = clampByte(closed.data[sourceIndex + 1] + delta[1]);
      overlay[targetIndex + 2] = clampByte(closed.data[sourceIndex + 2] + delta[2]);
      // Never let the edited patch escape the exact silhouette of the open master.
      // This also removes any chroma-key fringe left on a generated closed source.
      overlay[targetIndex + 3] = clampByte(
        closed.data[sourceIndex + 3] * mask * (open.data[sourceIndex + 3] / 255)
      );
    }
  }

  return { overlay, delta };
}

async function makeHalfEye(open, eye) {
  const source = await sharp(open.data, { raw: open.info })
    .extract(eye)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const halfHeight = Math.max(12, Math.round(eye.height * 0.48));
  const flattened = await sharp(source.data, { raw: source.info })
    .resize(eye.width, halfHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(flattened.info.width * flattened.info.height * 4);
  const feather = Math.max(3, Math.round(Math.min(eye.width, halfHeight) * 0.1));

  for (let y = 0; y < halfHeight; y += 1) {
    for (let x = 0; x < eye.width; x += 1) {
      const index = (y * eye.width + x) * 4;
      const nx = (x + 0.5 - eye.width / 2) / (eye.width / 2);
      const ny = (y + 0.5 - halfHeight / 2) / (halfHeight / 2);
      const radial = Math.sqrt(nx * nx + ny * ny);
      const edgeMask = smoothstep((1 - radial) * feather);

      output[index] = flattened.data[index];
      output[index + 1] = flattened.data[index + 1];
      output[index + 2] = flattened.data[index + 2];
      output[index + 3] = clampByte(flattened.data[index + 3] * edgeMask);
    }
  }

  return {
    input: output,
    raw: { width: eye.width, height: halfHeight, channels: 4 },
    left: eye.left,
    top: Math.round(eye.top + eye.height * 0.39),
  };
}

}

for (const doll of dolls) {
  const openPath = path.join(root, `${doll.name}-open.png`);
  const closedSourcePath = path.join(root, `${doll.name}-closed-source.png`);
  const open = removeChromaResidue(defringe(await readRgba(openPath)), doll.name);
  const closed = removeChromaResidue(
    defringe(await readRgba(closedSourcePath)),
    doll.name
  );

  if (open.info.width !== closed.info.width || open.info.height !== closed.info.height) {
    throw new Error(`${doll.name}: open and closed source dimensions do not match`);
  }

  await sharp(open.data, { raw: open.info }).webp({ quality: 92 }).toFile(openPath.replace(/\.png$/, ".webp"));
  await sharp(closed.data, { raw: closed.info }).webp({ quality: 92 }).toFile(closedSourcePath.replace(/\.png$/, ".webp"));

  const { overlay } = makeClosedOverlay(open, closed, doll.patch);
  const closedComposite = {
    input: overlay,
    raw: { width: doll.patch.width, height: doll.patch.height, channels: 4 },
    left: doll.patch.left,
    top: doll.patch.top,
  };

  await sharp(open.data, { raw: open.info })
    .composite([closedComposite])
    .webp({ quality: 92 })
    .toFile(path.join(root, `${doll.name}-closed.webp`));

  const halfEyes = await Promise.all(doll.eyes.map((eye) => makeHalfEye(open, eye)));
  await sharp(open.data, { raw: open.info })
    .composite([closedComposite, ...halfEyes])
    .webp({ quality: 92 })
    .toFile(path.join(root, `${doll.name}-half.webp`));

}
