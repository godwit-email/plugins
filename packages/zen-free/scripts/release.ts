import {createHash} from "node:crypto"

type Manifest = {name: string; version: string; main: string; description: Record<string, string>}
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function registryEntry(manifest: Manifest, packageVersion: string, tag: string, minGodwit: string, source: Uint8Array) {
  if (manifest.name !== "zen-free" || manifest.main !== "index.js") throw new Error("Unexpected plugin manifest")
  if (!stableVersion.test(manifest.version) || manifest.version !== packageVersion || tag !== `zen-free-v${manifest.version}`) throw new Error("Tag, package and manifest versions must match")
  if (!stableVersion.test(minGodwit)) throw new Error("Specify the stable Godwit version that first supports this plugin")
  if (!source.length || source.length > 5 * 1024 * 1024) throw new Error("Plugin size is outside the host limit")
  return {
    name: manifest.name,
    title: {default: "Zen Free"},
    summary: manifest.description,
    homepage: "https://github.com/godwit-email/plugins/tree/main/packages/zen-free",
    releases: [{version: manifest.version, minGodwit, manifest, artifacts: {any: {
      url: `https://github.com/godwit-email/plugins/releases/download/${tag}/index.js`,
      size: source.length,
      sha256: createHash("sha256").update(source).digest("hex"),
    }}}],
  }
}

if (import.meta.main) {
  const dir = import.meta.dir + "/../dist"
  const manifest = await Bun.file(dir + "/plugin.json").json()
  const pkg = await Bun.file(import.meta.dir + "/../package.json").json()
  const entry = registryEntry(manifest, pkg.version, process.argv[2] ?? "", process.argv[3] ?? "", new Uint8Array(await Bun.file(dir + "/index.js").arrayBuffer()))
  await Bun.write(dir + "/registry-plugin.json", JSON.stringify(entry, null, 2) + "\n")
}
