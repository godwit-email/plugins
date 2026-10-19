import {expect, test} from "bun:test"
import {registryEntry} from "./release"

const manifest = {name: "example-plugin", version: "1.2.3", main: "index.js", description: {default: "Example plugin"}}

test("registry metadata describes the exact release file", () => {
  const entry = registryEntry(manifest, manifest.version, "example-plugin-v1.2.3", "1.6.0", new TextEncoder().encode("hello"))
  expect(entry.name).toBe("example-plugin")
  expect(entry.releases[0].manifest).toEqual(manifest)
  expect(entry.releases[0].minGodwit).toBe("1.6.0")
  expect(entry.releases[0].artifacts.any).toEqual({
    url: "https://github.com/godwit-email/plugins/releases/download/example-plugin-v1.2.3/index.js",
    size: 5,
    sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  })
})

test("release metadata rejects inconsistent versions and missing host compatibility", () => {
  const bytes = new Uint8Array([1])
  expect(() => registryEntry(manifest, "0.2.0", "example-plugin-v1.2.3", "1.6.0", bytes)).toThrow()
  expect(() => registryEntry(manifest, manifest.version, "v1.2.3", "1.6.0", bytes)).toThrow()
  for (const version of ["", "latest", "01.6.0"]) {
    expect(() => registryEntry(manifest, manifest.version, "example-plugin-v1.2.3", version, bytes)).toThrow()
  }
  expect(() => registryEntry(manifest, manifest.version, "example-plugin-v1.2.3", "1.6.0", new Uint8Array())).toThrow()
})

test("release metadata is shared across plugin packages", () => {
  const other = {...manifest, name: "another-provider", version: "2.0.0"}
  const entry = registryEntry(other, "2.0.0", "another-provider-v2.0.0", "1.6.0", new Uint8Array([1]))
  expect(entry.name).toBe("another-provider")
  expect(entry.homepage).toEndWith("/packages/another-provider")
  expect(entry.releases[0].artifacts.any.url).toEndWith("/another-provider-v2.0.0/index.js")
  expect(() => registryEntry({...other, name: "../outside"}, "2.0.0", "../outside-v2.0.0", "1.6.0", new Uint8Array([1]))).toThrow()
})
