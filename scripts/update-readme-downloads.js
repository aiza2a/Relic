#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const readmeFiles = [
  'README.md',
  'i18n/README.en.md',
  'i18n/README.ja.md',
  'i18n/README.ko.md',
  'i18n/README.zh-TW.md',
]

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) continue

    const key = item.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

function normalizeReleaseTag(rawTag) {
  if (!rawTag) return null

  const tag = String(rawTag).trim()
  return tag.startsWith('v') ? tag : `v${tag}`
}

function versionFromTag(tag) {
  return tag.replace(/^v/, '')
}

function isPrereleaseVersion(version) {
  return /(alpha|beta|rc|dev)/i.test(version)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readDesktopVersion() {
  const packageJsonPath = path.join(rootDir, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
  return packageJson.version
}

async function fetchReleaseAssets(repo, releaseTag, requireReleaseAssets) {
  if (!repo || !releaseTag) return []

  const url = `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(releaseTag)}`
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'quickclipboard-readme-updater',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`GitHub API 返回 ${response.status}`)
    }

    const release = await response.json()
    return Array.isArray(release.assets) ? release.assets.map((asset) => asset.name) : []
  } catch (error) {
    if (requireReleaseAssets) {
      throw new Error(`读取 Release 资产失败：${error.message}`)
    }

    console.warn(`读取 Release 资产失败，保留 Android 下载信息：${error.message}`)
    return []
  }
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map((part) => Number(part))
  const rightParts = right.split('.').map((part) => Number(part))

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

function findAndroidAsset(assetNames) {
  const matched = assetNames
    .map((name) => {
      const match = /^QuickClipboard_Android_v(\d+\.\d+\.\d+)\.apk$/.exec(name)
      return match ? { name, version: match[1] } : null
    })
    .filter(Boolean)
    .sort((left, right) => compareVersions(right.version, left.version))

  return matched[0]?.name ?? null
}

function updateAsset(content, oldAssetRegex, newAsset, releaseTag) {
  let nextContent = content.replace(oldAssetRegex, newAsset)
  const assetPattern = escapeRegExp(newAsset)
  nextContent = nextContent.replace(
    new RegExp(`releases/download/v[^/]+/${assetPattern}`, 'g'),
    `releases/download/${releaseTag}/${newAsset}`,
  )

  return nextContent
}

function updateReadmeContent(content, desktopVersion, releaseTag, androidAsset) {
  let nextContent = content.replace(
    /^(##\s+(?:下载方式|Download|ダウンロード|다운로드|下載方式)[（(])v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?([）)])/gmu,
    `$1${releaseTag}$2`,
  )

  const desktopAssets = [
    {
      pattern: /QuickClipboard_\d+\.\d+\.\d+_x64-setup\.exe/g,
      asset: `QuickClipboard_${desktopVersion}_x64-setup.exe`,
    },
    {
      pattern: /QuickClipboard_\d+\.\d+\.\d+_portable\.exe/g,
      asset: `QuickClipboard_${desktopVersion}_portable.exe`,
    },
    {
      pattern: /QuickClipboard_\d+\.\d+\.\d+\.exe/g,
      asset: `QuickClipboard_${desktopVersion}.exe`,
    },
  ]

  for (const { pattern, asset } of desktopAssets) {
    nextContent = updateAsset(nextContent, pattern, asset, releaseTag)
  }

  if (androidAsset) {
    nextContent = updateAsset(
      nextContent,
      /QuickClipboard_Android_v\d+\.\d+\.\d+\.apk/g,
      androidAsset,
      releaseTag,
    )
  }

  return nextContent
}

async function updateReadmeFiles(desktopVersion, releaseTag, androidAsset, dryRun) {
  const changedFiles = []

  for (const file of readmeFiles) {
    const filePath = path.join(rootDir, file)
    const content = await fs.readFile(filePath, 'utf8')
    const nextContent = updateReadmeContent(content, desktopVersion, releaseTag, androidAsset)

    if (nextContent === content) continue

    changedFiles.push(file)
    if (!dryRun) {
      await fs.writeFile(filePath, nextContent, 'utf8')
    }
  }

  return changedFiles
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  })

  if (result.status !== 0 && !options.allowFailure) {
    const message = result.stderr?.trim() || result.stdout?.trim() || `git ${args.join(' ')} 执行失败`
    throw new Error(message)
  }

  return result.stdout?.trim() ?? ''
}

function ensureGitIdentity() {
  const name = runGit(['config', 'user.name'], { allowFailure: true })
  const email = runGit(['config', 'user.email'], { allowFailure: true })

  if (!name) {
    runGit(['config', 'user.name', 'github-actions[bot]'])
  }

  if (!email) {
    runGit(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
  }
}

function commitChanges(commitMessage, push, pushBranch) {
  runGit(['add', '--', ...readmeFiles])

  const stagedFiles = runGit(['diff', '--cached', '--name-only', '--', ...readmeFiles])
  if (!stagedFiles) {
    console.log('README 无变更，跳过提交')
    return
  }

  ensureGitIdentity()
  runGit(['commit', '-m', commitMessage], { inherit: true })

  if (push) {
    if (!pushBranch) {
      throw new Error('启用 --push 时必须提供 --push-branch')
    }

    runGit(['push', 'origin', `HEAD:${pushBranch}`], { inherit: true })
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const desktopVersion = args.release
    ? versionFromTag(normalizeReleaseTag(args.release))
    : await readDesktopVersion()
  const releaseTag = normalizeReleaseTag(args.release || desktopVersion)
  const requireReleaseAssets = Boolean(args['require-release-assets'])

  if (isPrereleaseVersion(desktopVersion) && !args['allow-prerelease']) {
    console.log(`检测到预发布版本 ${releaseTag}，README 下载文档只在正式版发布时更新，已跳过`)
    return
  }

  const repo = args.repo || process.env.GITHUB_REPOSITORY
  const releaseAssets = await fetchReleaseAssets(repo, releaseTag, requireReleaseAssets)
  const androidAsset = args['android-asset']
    || (args['android-version'] ? `QuickClipboard_Android_v${args['android-version']}.apk` : null)
    || findAndroidAsset(releaseAssets)

  console.log(`桌面端版本：${desktopVersion}`)
  if (androidAsset) {
    console.log(`检测到 Android 包：${androidAsset}`)
  } else {
    console.log('当前正式版未检测到 Android APK，保留 README 中现有 Android 下载信息')
  }

  const changedFiles = await updateReadmeFiles(desktopVersion, releaseTag, androidAsset, Boolean(args['dry-run']))

  if (changedFiles.length === 0) {
    console.log('README 已是最新，无需更新')
    return
  }

  console.log(`已更新 README：${changedFiles.join(', ')}`)

  if (args['dry-run']) {
    console.log('dry-run 模式不会写入文件或提交')
    return
  }

  if (args.commit) {
    commitChanges(args['commit-message'] || 'chore: update README.md', Boolean(args.push), args['push-branch'])
  }
}

main().catch((error) => {
  console.error(`更新 README 失败：${error.message}`)
  process.exit(1)
})
