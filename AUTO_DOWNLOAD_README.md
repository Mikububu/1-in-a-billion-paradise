# Auto-Download Watcher + Quality Monitor

Automatically downloads all job artifacts (PDFs + Audio) to `~/Desktop/output/`

**NEW**: Monitors for quality issues and ABORTS if critical problems detected:
- ⏱️  Job completion time anomalies
- 📏 PDF/Audio length mismatches (>50% difference)
- 📊 Missing artifacts (incomplete jobs)

## 🚀 Quick Start

```bash
# Start watcher (runs in background)
nohup npx ts-node auto-download-watcher.ts > /tmp/auto-download.log 2>&1 &

# Check if it's running
tail -f /tmp/auto-download.log

# Stop watcher
pkill -f auto-download-watcher
```

## 📁 Output Structure

```
~/Desktop/output/
├── Person1_Person2/
│   ├── Person1_Western_v1.0.pdf
│   ├── Person1_Western_audio.mp3
│   ├── Person2_Western_v1.0.pdf
│   └── ...
└── AnotherPerson1_AnotherPerson2/
    └── ...
```

## ⚙️ How It Works

1. Watches all `nuclear_v2` jobs from the last 7 days
2. Checks for new PDFs and audio files every 10 seconds
3. Downloads new artifacts to `~/Desktop/output/{person1}_{person2}/`
4. Tracks what's already downloaded to avoid duplicates
5. **NEW**: Validates each job:
   - ⏱️  Tracks job creation time and completion progress
   - 📏 Compares PDF word count vs audio duration (~150 words/min expected)
   - 📊 Checks for complete artifact sets (16 PDFs, 16 audios)
   - 🚨 **ABORTS if >50% PDF/audio mismatch detected** (critical hickup)

## 🚨 Abort Conditions

The watcher will **immediately abort and warn you** if:

1. **PDF/Audio length mismatch >50%**
   - Example: PDF has ~2000 words (13min expected) but audio is only 5min
   - Indicates LLM generated short text or audio generation failed

2. **Critical timing anomaly**
   - Job is >2 hours old and still incomplete
   - Indicates stuck workers or system failure

When aborted, check `/tmp/auto-download.log` for detailed error info.

## 🔍 Monitoring

```bash
# View real-time log
tail -f /tmp/auto-download.log

# Check output folder
ls -lh ~/Desktop/output/
```

## 🛑 Stopping

```bash
# Find process
ps aux | grep auto-download-watcher

# Kill it
pkill -f auto-download-watcher
```
