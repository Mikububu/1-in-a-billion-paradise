/**
 * AUTO-DOWNLOAD WATCHER + QUALITY MONITOR
 * 
 * Automatically downloads all job artifacts (PDFs + Audio) to ~/Desktop/output/
 * AND monitors for quality issues:
 * - Job completion time anomalies
 * - PDF/Audio length mismatches
 * - Missing artifacts
 * 
 * If critical issues detected → ABORTS and warns user
 * 
 * Usage:
 *   npx ts-node auto-download-watcher.ts
 * 
 * Or run in background:
 *   nohup npx ts-node auto-download-watcher.ts > /tmp/auto-download.log 2>&1 &
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTPUT_DIR = path.join(process.env.HOME!, 'Desktop', 'output');

// Track what we've already downloaded
const downloadedArtifacts = new Set<string>();

// Track job metrics
const jobMetrics = new Map<string, {
  createdAt: Date;
  firstArtifact?: Date;
  lastCheck: Date;
  pdfCount: number;
  audioCount: number;
  expectedPdfs: number;
  expectedAudios: number;
}>();

interface JobInfo {
  id: string;
  person1Name: string;
  person2Name?: string;
  folderName: string;
  createdAt: Date;
  status: string;
}

interface ValidationIssue {
  severity: 'warning' | 'critical';
  message: string;
  jobId: string;
  details?: any;
}

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

// Get audio duration in seconds (requires ffmpeg/ffprobe)
async function getAudioDuration(filepath: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`);
    return parseFloat(stdout.trim());
  } catch {
    return null;
  }
}

// Estimate PDF reading time based on word count (average 150 words/min)
function estimatePdfReadingTime(wordCount: number): number {
  return (wordCount / 150) * 60; // seconds
}

// Extract word count from PDF text (rough estimate from file size)
function estimatePdfWordCount(filepath: string): number {
  const stats = fs.statSync(filepath);
  const sizeKB = stats.size / 1024;
  // Rough estimate: 1KB PDF ≈ 80-100 words (accounting for images/formatting)
  return Math.floor(sizeKB * 90);
}

// Validate PDF/audio length match
function validateArtifactPair(pdfPath: string, audioPath: string, audioDuration: number): ValidationIssue | null {
  const pdfWords = estimatePdfWordCount(pdfPath);
  const expectedDuration = estimatePdfReadingTime(pdfWords);
  const difference = Math.abs(audioDuration - expectedDuration);
  const percentDiff = (difference / expectedDuration) * 100;

  if (percentDiff > 50) {
    return {
      severity: 'critical',
      message: `PDF/Audio length mismatch: ${Math.floor(percentDiff)}% difference`,
      jobId: '',
      details: {
        pdfWords,
        expectedDuration: Math.floor(expectedDuration),
        actualDuration: Math.floor(audioDuration),
        pdfFile: path.basename(pdfPath),
        audioFile: path.basename(audioPath),
      },
    };
  }

  return null;
}

// Check job completion time
function validateJobTiming(jobId: string, createdAt: Date): ValidationIssue | null {
  const now = new Date();
  const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  
  // Expected: 16 texts (~30min) + 16 audios (~20min) + 16 PDFs (~10min) = ~60min total
  // If job is >2 hours old and not complete, something is wrong
  if (ageMinutes > 120) {
    return {
      severity: 'warning',
      message: `Job taking unusually long (${Math.floor(ageMinutes)} minutes)`,
      jobId,
      details: { ageMinutes: Math.floor(ageMinutes) },
    };
  }

  return null;
}

// ABORT and warn user
function abortWithWarning(issues: ValidationIssue[]) {
  console.error('\n🚨🚨🚨 CRITICAL ISSUES DETECTED 🚨🚨🚨\n');
  
  for (const issue of issues) {
    console.error(`❌ [${issue.severity.toUpperCase()}] ${issue.message}`);
    if (issue.details) {
      console.error(`   Details: ${JSON.stringify(issue.details, null, 2)}`);
    }
  }
  
  console.error('\n⛔ ABORTING WATCHER - Please investigate before restarting\n');
  console.error('Check logs: tail -f /tmp/auto-download.log\n');
  
  process.exit(1);
}

async function getActiveJobs(): Promise<JobInfo[]> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, params, created_at, status')
    .eq('type', 'nuclear_v2')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('created_at', { ascending: false });

  if (error || !jobs) {
    console.error('❌ Failed to fetch jobs:', error?.message);
    return [];
  }

  return jobs.map(job => {
    const params = job.params as any;
    const person1Name = params?.person1?.name || 'Person1';
    const person2Name = params?.person2?.name;
    
    const folderName = person2Name 
      ? `${person1Name}_${person2Name}`
      : person1Name;

    return {
      id: job.id,
      person1Name,
      person2Name,
      folderName,
      createdAt: new Date(job.created_at),
      status: job.status,
    };
  });
}

async function downloadNewArtifacts(job: JobInfo) {
  const jobFolder = path.join(OUTPUT_DIR, job.folderName);
  
  // Ensure job folder exists
  if (!fs.existsSync(jobFolder)) {
    fs.mkdirSync(jobFolder, { recursive: true});
  }

  // Get all artifacts for this job
  const { data: artifacts, error } = await supabase
    .from('job_artifacts')
    .select('id, artifact_type, storage_path, created_at')
    .eq('job_id', job.id)
    .in('artifact_type', ['pdf', 'audio_mp3', 'audio_m4a']);

  if (error || !artifacts) {
    return;
  }

  let newDownloads = 0;

  for (const artifact of artifacts) {
    const trackingKey = `${job.id}:${artifact.id}`;
    
    if (downloadedArtifacts.has(trackingKey)) {
      continue; // Already downloaded
    }

    try {
      // Download from Supabase Storage
      const { data, error: downloadError } = await supabase.storage
        .from('job-artifacts')
        .download(artifact.storage_path);

      if (downloadError || !data) {
        console.error(`   ❌ Download failed: ${artifact.storage_path}`);
        continue;
      }

      // Save to disk
      const filename = path.basename(artifact.storage_path);
      const filepath = path.join(jobFolder, filename);
      
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(filepath, buffer);

      const sizeKB = Math.floor(buffer.length / 1024);
      console.log(`   ✅ ${filename} (${sizeKB}KB)`);
      downloadedArtifacts.add(trackingKey);
      newDownloads++;
      
      // Update metrics
      const metrics = jobMetrics.get(job.id);
      if (metrics && !metrics.firstArtifact) {
        metrics.firstArtifact = new Date();
        const timeToFirst = (metrics.firstArtifact.getTime() - metrics.createdAt.getTime()) / (1000 * 60);
        console.log(`   ⏱️  First artifact after ${Math.floor(timeToFirst)} minutes`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error downloading ${artifact.storage_path}:`, err.message);
    }
  }
  
  // Show progress if new downloads
  if (newDownloads > 0) {
    const metrics = jobMetrics.get(job.id);
    if (metrics) {
      const progress = `${metrics.pdfCount}/16 PDFs, ${metrics.audioCount}/16 Audio`;
      console.log(`   📊 Progress: ${progress}`);
    }
  }
}

async function validateJobArtifacts(job: JobInfo, jobFolder: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  
  // Check job timing
  const timingIssue = validateJobTiming(job.id, job.createdAt);
  if (timingIssue) {
    issues.push(timingIssue);
  }
  
  // Get all PDFs and audios
  const files = fs.readdirSync(jobFolder);
  const pdfs = files.filter(f => f.endsWith('.pdf'));
  const audios = files.filter(f => f.endsWith('.mp3') || f.endsWith('.m4a'));
  
  // Expected: 16 PDFs, 16 audios for nuclear_v2
  if (pdfs.length < 16) {
    issues.push({
      severity: 'warning',
      message: `Incomplete PDFs: ${pdfs.length}/16`,
      jobId: job.id,
      details: { pdfCount: pdfs.length },
    });
  }
  
  if (audios.length < 16) {
    issues.push({
      severity: 'warning',
      message: `Incomplete Audio: ${audios.length}/16`,
      jobId: job.id,
      details: { audioCount: audios.length },
    });
  }
  
  // Validate PDF/audio pairs (match by base name)
  for (const pdf of pdfs) {
    const baseName = pdf.replace(/_v\d+\.\d+\.pdf$/, '');
    const matchingAudio = audios.find(a => a.includes(baseName));
    
    if (matchingAudio) {
      const pdfPath = path.join(jobFolder, pdf);
      const audioPath = path.join(jobFolder, matchingAudio);
      const duration = await getAudioDuration(audioPath);
      
      if (duration) {
        const issue = validateArtifactPair(pdfPath, audioPath, duration);
        if (issue) {
          issue.jobId = job.id;
          issues.push(issue);
        }
      }
    }
  }
  
  return issues;
}

async function watchLoop() {
  console.log('👀 Watching for new job artifacts...');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🔍 Monitoring: job timing, PDF/audio length, completeness\n`);

  while (true) {
    try {
      const jobs = await getActiveJobs();
      const allIssues: ValidationIssue[] = [];
      
      for (const job of jobs) {
        // Initialize metrics if new job
        if (!jobMetrics.has(job.id)) {
          jobMetrics.set(job.id, {
            createdAt: job.createdAt,
            lastCheck: new Date(),
            pdfCount: 0,
            audioCount: 0,
            expectedPdfs: 16,
            expectedAudios: 16,
          });
          console.log(`\n🆕 New job detected: ${job.folderName} (${job.id.slice(0, 8)})`);
          console.log(`   Created: ${job.createdAt.toLocaleString()}`);
        }
        
        await downloadNewArtifacts(job);
        
        // Run validations on complete/near-complete jobs
        const jobFolder = path.join(OUTPUT_DIR, job.folderName);
        if (fs.existsSync(jobFolder)) {
          const files = fs.readdirSync(jobFolder);
          const metrics = jobMetrics.get(job.id)!;
          metrics.pdfCount = files.filter(f => f.endsWith('.pdf')).length;
          metrics.audioCount = files.filter(f => f.endsWith('.mp3') || f.endsWith('.m4a')).length;
          metrics.lastCheck = new Date();
          
          // Only validate if we have some artifacts (job is in progress)
          if (metrics.pdfCount > 5 || metrics.audioCount > 5) {
            const issues = await validateJobArtifacts(job, jobFolder);
            allIssues.push(...issues);
            
            if (issues.length > 0) {
              console.log(`\n⚠️  Issues detected for ${job.folderName}:`);
              for (const issue of issues) {
                console.log(`   ${issue.severity === 'critical' ? '🚨' : '⚠️ '} ${issue.message}`);
              }
            }
          }
        }
      }
      
      // Check for critical issues
      const criticalIssues = allIssues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        abortWithWarning(criticalIssues);
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (err: any) {
      console.error('❌ Watcher error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

async function main() {
  console.log('🚀 Starting auto-download watcher...\n');
  
  await ensureOutputDir();
  await watchLoop();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
