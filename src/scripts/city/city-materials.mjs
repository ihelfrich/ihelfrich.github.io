import * as T from "three";
import { rand } from "./city-geometry.mjs";

const scales = { brick: 1.4, concrete: 2.16, asphalt: 3, roof: 2.2 };
function texture(canvas, repeat, colour = false) {
  const t = new T.CanvasTexture(canvas);
  if (colour) t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  return [c, c.getContext("2d")];
}
function atlas(surface, style) {
  const [c, ctx] = canvas(),
    [n, nctx] = canvas(),
    [r, rctx] = canvas(),
    [e, ectx] = canvas(),
    glass = style === 3,
    rng = rand(1700 + style);
  const physical = [12, 12.8],
    tile = scales[surface.role];
  for (const [dst, img] of [
    [ctx, surface.color.image],
    [nctx, surface.normalGL.image],
    [rctx, surface.roughness.image],
  ]) {
    for (let y = 0; y < 1024; y += (1024 * tile) / physical[1])
      for (let x = 0; x < 1024; x += (1024 * tile) / physical[0])
        dst.drawImage(
          img,
          x,
          y,
          (1024 * tile) / physical[0] + 1,
          (1024 * tile) / physical[1] + 1,
        );
  }
  if (glass) {
    ctx.fillStyle = "#4d666d";
    ctx.fillRect(0, 0, 1024, 1024);
    nctx.fillStyle = "#8080ff";
    nctx.fillRect(0, 0, 1024, 1024);
    rctx.fillStyle = "#707070";
    rctx.fillRect(0, 0, 1024, 1024);
  } else {
    ctx.fillStyle = [
      "#9d513112",
      "#69584915",
      "#e8e0c020",
      "#ffffff00",
      "#c68b4d20",
      "#b9b8b820",
    ][style];
    ctx.fillRect(0, 0, 1024, 1024);
  }
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, 1024, 1024);
  for (let floor = 0; floor < 4; floor++)
    for (let bay = 0; bay < 4; bay++) {
      const x = bay * 256 + (glass ? 6 : 53),
        y = floor * 256 + (glass ? 12 : 39),
        w = glass ? 244 : 150,
        h = glass ? 222 : 172;
      ctx.fillStyle = "#101d22";
      ctx.fillRect(x - 5, y - 4, w + 10, h + 10);
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, glass ? "#8dabb3" : "#60777d");
      grad.addColorStop(0.42, glass ? "#55717b" : "#3a5058");
      grad.addColorStop(0.44, glass ? "#9caeac" : "#617376");
      grad.addColorStop(1, glass ? "#283e4b" : "#20313a");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = `rgba(14,23,30,${rng() * 0.23})`;
      ctx.fillRect(x, y, w, h);
      if (rng() > 0.68) {
        ctx.fillStyle = "#c5b99b45";
        ctx.fillRect(x + 4, y + 3, w * 0.42, h - 6);
      }
      ctx.fillStyle = glass ? "#7e9298" : "#a8a196";
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      ctx.fillRect(x, y + h * 0.53, w, 3);
      ctx.fillStyle = "#d0c6b0";
      ctx.fillRect(x - 8, y + h + 5, w + 16, 6);
      ctx.fillStyle = "#1c252a80";
      ctx.fillRect(x - 8, y + h + 11, w + 16, 5);
      nctx.fillStyle = "#8080ff";
      nctx.fillRect(x, y, w, h);
      nctx.fillStyle = "#4980ec";
      nctx.fillRect(x - 3, y, 3, h);
      nctx.fillStyle = "#b780ec";
      nctx.fillRect(x + w, y, 3, h);
      nctx.fillStyle = "#80b7ec";
      nctx.fillRect(x, y - 3, w, 3);
      nctx.fillStyle = "#8049ec";
      nctx.fillRect(x, y + h, w, 3);
      rctx.fillStyle = glass ? "#373737" : "#505050";
      rctx.fillRect(x, y, w, h);
      if (rng() > 0.6) {
        ectx.fillStyle = rng() > 0.5 ? "#ffd190" : "#e8dfb9";
        ectx.fillRect(x + 3, y + 3, w - 6, h - 6);
        ectx.fillStyle = "#111";
        ectx.fillRect(x + w / 2 - 2, y, 4, h);
        ectx.fillRect(x, y + h * 0.53, w, 3);
      }
    }
  return {
    map: texture(c, [1 / physical[0], 1 / physical[1]], true),
    normalMap: texture(n, [1 / physical[0], 1 / physical[1]]),
    roughnessMap: texture(r, [1 / physical[0], 1 / physical[1]]),
    emissiveMap: texture(e, [1 / physical[0], 1 / physical[1]], true),
  };
}
export async function createCityMaterials(renderer) {
  const loader = new T.TextureLoader(),
    assets = {};
  await Promise.all(
    Object.keys(scales).map(async (role) => {
      const result = { role };
      await Promise.all(
        ["color", "normalGL", "roughness"].map(async (channel) => {
          const t = await loader.loadAsync(
            `/st-louis/materials/${role}-${channel}-1k.jpg`,
          );
          if (channel === "color") t.colorSpace = T.SRGBColorSpace;
          t.wrapS = t.wrapT = T.RepeatWrapping;
          t.repeat.setScalar(1 / scales[role]);
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          result[channel] = t;
        }),
      );
      assets[role] = result;
    }),
  );
  const wallMaterials = Array.from(
    { length: 6 },
    (_, i) =>
      new T.MeshStandardMaterial({
        ...atlas(assets[[0, 1, 4].includes(i) ? "brick" : "concrete"], i),
        color: "#ffffff",
        roughness: 1,
        normalScale: new T.Vector2(0.65, 0.65),
        metalness: i === 3 ? 0.25 : 0.025,
        envMapIntensity: i === 3 ? 1.5 : 0.55,
        emissive: "#ffc989",
        emissiveIntensity: 0.008,
      }),
  );
  const surface = (role, opts = {}) =>
    new T.MeshStandardMaterial({
      map: assets[role].color,
      normalMap: assets[role].normalGL,
      roughnessMap: assets[role].roughness,
      normalScale: new T.Vector2(0.7, 0.7),
      roughness: 1,
      color: "#ffffff",
      ...opts,
    });
  const roof = surface("roof", { color: "#898b86" }),
    asphalt = surface("asphalt", {
      color: "#858785",
      normalScale: new T.Vector2(0.45, 0.45),
    }),
    concrete = surface("concrete", { color: "#c5c4b8" }),
    path = surface("concrete", { color: "#c4b79e" });
  return {
    wallMaterials,
    roof,
    asphalt,
    concrete,
    path,
    assets,
    setWetness(wet) {
      const w = T.MathUtils.clamp(wet ?? 0, 0, 1);
      asphalt.roughness = 1 - w * 0.75;
      asphalt.color.set("#858785").multiplyScalar(1 - w * 0.28);
      concrete.roughness = 1 - w * 0.3;
      roof.roughness = 1 - w * 0.2;
    },
    dispose() {
      for (const group of Object.values(assets))
        for (const value of Object.values(group))
          if (value?.isTexture) value.dispose();
      for (const m of [...wallMaterials, roof, asphalt, concrete, path]) {
        for (const value of Object.values(m))
          if (value?.isTexture) value.dispose();
        m.dispose();
      }
    },
  };
}
