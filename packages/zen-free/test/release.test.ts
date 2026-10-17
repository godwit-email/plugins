import {expect, test} from "bun:test"
import manifest from "../plugin.json"
import pkg from "../package.json"
import {registryEntry} from "../scripts/release"

test("registry metadata describes the exact release file", () => {
  const entry = registryEntry(manifest, pkg.version, "zen-free-v0.1.0", "1.6.0", new TextEncoder().encode("hello"))
  expect(entry.name).toBe("zen-free")
  expect(entry.releases[0].manifest).toEqual(manifest)
  expect(entry.releases[0].minGodwit).toBe("1.6.0")
  expect(entry.releases[0].artifacts.any).toEqual({
    url: "https://github.com/godwit-email/plugins/releases/download/zen-free-v0.1.0/index.js",
    size: 5,
    sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  })
})

test("release metadata rejects inconsistent versions and missing host compatibility", () => {
  const bytes = new Uint8Array([1])
  expect(() => registryEntry(manifest, "0.2.0", "zen-free-v0.1.0", "1.6.0", bytes)).toThrow()
  expect(() => registryEntry(manifest, pkg.version, "v0.1.0", "1.6.0", bytes)).toThrow()
  for (const version of ["", "latest", "01.6.0"]) {
    expect(() => registryEntry(manifest, pkg.version, "zen-free-v0.1.0", version, bytes)).toThrow()
  }
  expect(() => registryEntry(manifest, pkg.version, "zen-free-v0.1.0", "1.6.0", new Uint8Array())).toThrow()
})
