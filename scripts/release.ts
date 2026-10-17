import {createHash} from "node:crypto"

type Manifest = {name: string; version: string; main: string; description: Record<string, string>}
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function registryEntry(manifest: Manifest, packageVersion: string, tag: string, minGodwit: string, source: Uint8Array) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name) || manifest.main !== "index.js") throw new Error("Unexpected plugin manifest")
  if (!stableVersion.test(manifest.version) || manifest.version !== packageVersion || tag !== `${manifest.name}-v${manifest.version}`) throw new Error("Tag, package and manifest versions must match")
  if (!stableVersion.test(minGodwit)) throw new Error("Specify the stable Godwit version that first supports this plugin")
  if (!source.length || source.length > 5 * 1024 * 1024) throw new Error("Plugin size is outside the host limit")
  return {
    name: manifest.name,
    title: {default: manifest.name},
    summary: manifest.description,
    homepage: `https://github.com/godwit-email/plugins/tree/main/packages/${manifest.name}`,
    releases: [{version: manifest.version, minGodwit, manifest, artifacts: {any: {
      url: `https://github.com/godwit-email/plugins/releases/download/${tag}/index.js`,
      size: source.length,
      sha256: createHash("sha256").update(source).digest("hex"),
    }}}],
  }
}

if (import.meta.main) {
  const plugin = process.argv[2] ?? ""
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin)) throw new Error("Invalid plugin directory name")
  const dir = import.meta.dir + `/../packages/${plugin}`
  const manifest = await Bun.file(dir + "/dist/plugin.json").json()
  if (manifest.name !== plugin) throw new Error("Plugin directory and manifest name must match")
  const pkg = await Bun.file(dir + "/package.json").json()
  const entry = registryEntry(manifest, pkg.version, process.argv[3] ?? "", process.argv[4] ?? "", new Uint8Array(await Bun.file(dir + "/dist/index.js").arrayBuffer()))
  await Bun.write(dir + "/dist/registry-plugin.json", JSON.stringify(entry, null, 2) + "\n")
}
