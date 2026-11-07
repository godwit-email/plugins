# Godwit plugin directory

The plugins [Godwit](https://github.com/godwit-email/godwit)'s Extensions page offers as reviewed. Godwit reads the signed
`registry.json` from `dl.godwit.email/plugins/`. The design is
[`docs/superpowers/specs/2026-10-14-native-plugins-design.md`](https://github.com/godwit-email/godwit/blob/main/docs/superpowers/specs/2026-10-14-native-plugins-design.md) and
[ADR 0032](https://github.com/godwit-email/godwit/blob/main/docs/adr/0032-plugin-directory-points-at-plugins.md) in the Godwit repository.

## How it works

- `directory.json` says what each plugin is, in the reviewers' words, and pins by commit the
  `godwit-plugin.json` its author maintains.
- `godwit-plugin.json` lists the plugin's releases. Each release carries its `plugin.json`
  (as `manifest`) and, per file it ships, the URL, size and SHA-256. Godwit trusts **those
  exact files**, never what a plugin says about itself.
- `godwit-registry build` joins them into `registry.json`, which is built and never committed.
  Godwit cannot check a commit SHA itself, so what it trusts is the signature over the result.
- A merge to `main` builds it, runs `godwit-registry check --fetch` (the validator Godwit itself
  uses, plus a download of every file), signs `registry.json` with the repository's ed25519 key
  and uploads both files to `dl.godwit.email/plugins/`. Godwit verifies the signature with the
  public key built into it, and refuses a registry older than the one it has.
- Godwit installs a release by downloading its file and checking the size and SHA-256. A
  mismatch is discarded; nothing lets a user install it anyway.
- A **native** plugin (a shared library) runs with all of Godwit's rights. A listed native
  file is installed and enabled after one confirmation. A **script** plugin runs in Godwit's
  sandbox; being listed does not grant its permissions, the user still allows them.

## Adding a plugin or a release

In-repository script plugins live under `packages/`, including [Zen Free](packages/zen-free).
One **Plugins** workflow discovers and checks all packages and publishes a selected plugin
on manual dispatch. **Publish** separately validates, signs, and uploads the registry.

1. Commit the new release to the plugin's `godwit-plugin.json` (a new plugin: create the file).
2. Open a pull request here that sets `source.sha` to that commit, or adds the entry. The check
   shows what changes in the published `registry.json`; that difference is what gets reviewed.

An entry of `directory.json`:

```json
{
  "name": "example",
  "title": { "default": "Example", "zh-Hans": "示例" },
  "summary": { "default": "Translates mail with an example service. Sends the text to example.com." },
  "category": "translate",
  "publisher": "Example",
  "dataFlow": "third-party",
  "homepage": "https://github.com/someone/godwit-example",
  "source": { "repo": "someone/godwit-example", "path": "godwit-plugin.json", "sha": "<the full 40-character commit SHA>" }
}
```

- `category` is `translate`, `models` or `other`; `dataFlow` is `local` or `third-party`.
- `name` never changes once published: installs are keyed by it. To relabel a plugin, change `title`.

A `godwit-plugin.json`, with every release still offered or installed, not just the newest:

```json
{
  "name": "example",
  "releases": [
    {
      "version": "0.1.0",
      "minGodwit": "1.2.0",
      "manifest": { "name": "example", "version": "0.1.0", "native": { "abi": 1 }, "capabilities": ["translate"], "config": [] },
      "artifacts": {
        "darwin-arm64": { "url": "https://github.com/someone/godwit-example/releases/download/v0.1.0/example-darwin-arm64.dylib", "sha256": "…", "size": 11355106 }
      }
    }
  ]
}
```

- Native releases name each file by platform: `darwin-arm64`, `darwin-amd64`, `windows-amd64`,
  `windows-arm64`, `linux-amd64`, `linux-arm64`. A missing platform is simply not offered there.
  The file is the bare library (no archive), at most 64 MiB, exporting the C ABI in
  [`sdk/native/godwit_plugin.h`](https://github.com/godwit-email/godwit/blob/main/sdk/native/godwit_plugin.h).
- A script release has one file, `any`: the plugin bundled into the single `.js` file its
  `manifest.main` names, at most 5 MiB.
- A release that leaves `releases` is revoked for everyone who installed it.

## Building and releasing script plugins

Each `packages/<name>/` contains `plugin.json` and `package.json`, whose scripts provide
`typecheck`, `test`, and `build`. The directory name must match the manifest name. Builds
write `dist/plugin.json` and a bundled `dist/index.js`. New packages join the shared CI
without adding a workflow.

1. Bump `packages/<name>/package.json` and `plugin.json` together and merge to main.
2. Create and push `<name>-vX.Y.Z` for that main commit.
3. Run **Actions → Plugins → Run workflow** on main, supplying the plugin name, tag, and actual
   minimum released Godwit version. The workflow checks the tagged source, installs the
   published SDK, and publishes `index.js`, `plugin.json`, `<name>.tar.gz`,
   `registry-plugin.json`, and `SHA256SUMS` to GitHub Releases.
4. Copy the release from the released `registry-plugin.json` into the plugin's
   `packages/<name>/godwit-plugin.json`, preserving older releases, and merge it. Then open a PR
   that sets the plugin's `source.sha` in `directory.json` to that commit (a new plugin: adds its
   entry, whose title, summary and risk wording are the reviewers'). **Publish** builds the
   registry, validates the real downloads, signs, and uploads it.

PR checks provide a `<name>-dist` artifact. Checks and release runs install the published SDK
from npm and test against the pinned Godwit commit. Update the pin when updating the SDK/API.
Release runs require `contents: write`. If a failed run leaves a draft release, inspect
and delete that unpublished draft before retrying. Never replace published files; bump
the version instead. The workflow does not modify the registry.

## Review checklist

Before approving:

1. **Source.** Read the code, or know who builds it and from what. Prefer releases built by the
   author's public CI from a tagged commit, so the file can be traced to its source.
2. **Files.** `check --fetch` passes: every file is at its URL with the size and SHA-256 listed.
   URLs should be immutable (a release asset, not a branch).
3. **Manifest.** It is the plugin's real `plugin.json`. For a native plugin, its `describe`
   answers the same name, version, ABI and capabilities, or Godwit will not start it.
   For a script plugin, the permissions are no wider than what it does.
4. **Risk in plain words.** If the plugin depends on an unofficial or rate-limited service, or
   sends mail content somewhere, `summary` says so and `dataFlow` is `third-party`.

## Revoking

Add the version to the entry's `revoked` list, or remove the whole entry, and merge. Neither needs
the author. On its next refresh (on opening Extensions, and every 24 hours) Godwit stops every
installed copy of a file the registry no longer lists and asks the user before it runs again.

If a pinned commit can no longer be fetched (the repository was deleted or its history rewritten),
the build fails and nothing can be published until that entry is changed or removed.

## Keys

- `go run github.com/godwit-email/godwit/cmd/godwit-registry@main keygen` prints a key pair.
- The private key goes to the repository secret `GODWIT_REGISTRY_KEY`, and nowhere else.
- The public key goes into `registryPublicKey` in Godwit's `core/registry.go`. Godwit's plugin
  directory is off while that constant is empty.
- Rotating the key needs a Godwit release with the new public key; publish with the old key
  until that release is out.

Repository secrets: `GODWIT_REGISTRY_KEY`, and `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
(the same R2 token Godwit's release workflow uses).
