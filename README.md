# Video Converter

A simple video conversion tool that helps you convert videos between different formats.

## Prerequisites

- Python 3.8 or higher
- FFmpeg

### Installing FFmpeg on macOS

#### Using Homebrew (Recommended)

```bash
brew install ffmpeg
```

#### Running the application

```bash
npm install
npm run start
```

#### Releases

Releases are automatically created on push to the `main` branch.

```
# For patch bump (1.0.0 → 1.0.1):
git commit -m "fix: fixed a bug in video processing"

# For minor bump (1.0.0 → 1.1.0):
git commit -m "feat: added new video format support"

# For major bump (1.0.0 → 2.0.0):
git commit -m "feat!: completely redesigned UI"
# or
git commit -m "feat: new architecture
BREAKING CHANGE: This version is not compatible with previous versions"
```


