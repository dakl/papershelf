# PaperShelf

## Releases

- **Never bump the version in package.json manually.** The version is set exclusively by the GitHub Actions Release workflow (`release.yml`) via `npm version --no-git-tag-version`.
- To release: trigger the Release workflow with the desired version string. It handles version bumping, building, and creating the GitHub release.
