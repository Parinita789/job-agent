import { Injectable, ConflictException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

export interface PipelineState {
  running: boolean;
  phase: string | null;
  command: string | null;
  error: string | null;
  lastRunAt: string | null;
  logs: string[];
}

const SCRAPER_DIR_RESOLVER = () => path.resolve(process.cwd(), '../scraper');

const PHASE_LIST = [
  { id: 'scrape', label: 'Scrape + Score', name: 'scrape + score', cmd: 'npx', args: ['tsx', 'src/phase2.ts'] },
  { id: 'alerts', label: 'LinkedIn Alerts', name: 'scrape alerts + score', cmd: 'npx', args: ['tsx', 'src/phase-alerts.ts'] },
  { id: 'rescore', label: 'Rescore Jobs', name: 'rescore', cmd: 'npx', args: ['tsx', 'src/rescore.ts'] },
  { id: 'cover-letters', label: 'Cover Letters', name: 'cover letters', cmd: 'npx', args: ['tsx', 'src/phase3.ts'] },
  { id: 'apply', label: 'Auto Apply', name: 'auto apply', cmd: 'npx', args: ['tsx', 'src/phase4.ts'] },
];

const COMMANDS: Record<string, { label: string; phases: { name: string; cmd: string; args: string[] }[] }> = {
  pipeline: {
    label: 'Full Pipeline',
    phases: [
      { name: 'scrape + score', cmd: 'npx', args: ['tsx', 'src/phase2.ts'] },
      { name: 'cover letters', cmd: 'npx', args: ['tsx', 'src/phase3.ts'] },
      { name: 'auto apply', cmd: 'npx', args: ['tsx', 'src/phase4.ts'] },
    ],
  },
  alerts: {
    label: 'LinkedIn Alerts',
    phases: [
      { name: 'scrape alerts + score', cmd: 'npx', args: ['tsx', 'src/phase-alerts.ts'] },
    ],
  },
  scrape: {
    label: 'Scrape + Score',
    phases: [
      { name: 'scrape + score', cmd: 'npx', args: ['tsx', 'src/phase2.ts'] },
    ],
  },
  rescore: {
    label: 'Rescore Jobs',
    phases: [
      { name: 'rescore', cmd: 'npx', args: ['tsx', 'src/rescore.ts'] },
    ],
  },
  'cover-letters': {
    label: 'Generate Cover Letters',
    phases: [
      { name: 'cover letters', cmd: 'npx', args: ['tsx', 'src/phase3.ts'] },
    ],
  },
  apply: {
    label: 'Auto Apply',
    phases: [
      { name: 'auto apply', cmd: 'npx', args: ['tsx', 'src/phase4.ts'] },
    ],
  },
};

@Injectable()
export class PipelineService {
  private state: PipelineState = {
    running: false,
    phase: null,
    command: null,
    error: null,
    lastRunAt: null,
    logs: [],
  };

  private maxLogs = 500;

  getStatus(): PipelineState {
    return { ...this.state, logs: [...this.state.logs] };
  }

  getLogs(since: number = 0): { logs: string[]; total: number } {
    return {
      logs: this.state.logs.slice(since),
      total: this.state.logs.length,
    };
  }

  getAvailableCommands(): { id: string; label: string }[] {
    return Object.entries(COMMANDS).map(([id, c]) => ({ id, label: c.label }));
  }

  getAvailablePhases(): { id: string; label: string }[] {
    return PHASE_LIST.map((p) => ({ id: p.id, label: p.label }));
  }

  async runCommand(commandId: string): Promise<void> {
    if (this.state.running) {
      throw new ConflictException('A command is already running');
    }

    const command = COMMANDS[commandId];
    if (!command) {
      throw new Error(`Unknown command: ${commandId}`);
    }

    this.state = {
      running: true,
      phase: command.phases[0].name,
      command: command.label,
      error: null,
      lastRunAt: null,
      logs: [],
    };

    this.addLog(`--- ${command.label} started ---`);

    const scraperDir = SCRAPER_DIR_RESOLVER();

    // run in background
    this.runPhasesSequentially(command.phases, scraperDir);
  }

  async runSelectedPhases(phaseIds: string[]): Promise<void> {
    if (this.state.running) {
      throw new ConflictException('A command is already running');
    }

    const phases = phaseIds
      .map((id) => PHASE_LIST.find((p) => p.id === id))
      .filter(Boolean) as typeof PHASE_LIST;

    if (phases.length === 0) {
      throw new Error('No valid phases selected');
    }

    const label = phases.length === PHASE_LIST.length
      ? 'Full Pipeline'
      : phases.map((p) => p.label).join(' + ');

    this.state = {
      running: true,
      phase: phases[0].name,
      command: label,
      error: null,
      lastRunAt: null,
      logs: [],
    };

    this.addLog(`--- ${label} started ---`);

    const scraperDir = SCRAPER_DIR_RESOLVER();
    this.runPhasesSequentially(phases, scraperDir);
  }

  private addLog(line: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.state.logs.push(`[${timestamp}] ${line}`);
    if (this.state.logs.length > this.maxLogs) {
      this.state.logs = this.state.logs.slice(-this.maxLogs);
    }
  }

  private async runPhasesSequentially(
    phases: { name: string; cmd: string; args: string[] }[],
    cwd: string,
  ): Promise<void> {
    for (const phase of phases) {
      this.state.phase = phase.name;
      this.addLog(`Phase: ${phase.name}`);

      try {
        await this.spawnWithLogs(phase.cmd, phase.args, cwd);
        this.addLog(`Phase "${phase.name}" completed`);
      } catch (err) {
        const msg = (err as Error).message;
        this.state.error = `${phase.name} failed: ${msg}`;
        this.addLog(`ERROR: ${phase.name} failed — ${msg}`);
        this.state.running = false;
        this.state.phase = null;
        return;
      }
    }

    this.state.running = false;
    this.state.phase = null;
    this.state.lastRunAt = new Date().toISOString();
    this.addLog(`--- ${this.state.command} completed ---`);
  }

  private spawnWithLogs(cmd: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      child.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.addLog(line);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          this.addLog(`[stderr] ${line}`);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      // timeout after 10 minutes
      setTimeout(() => {
        child.kill();
        reject(new Error('Timed out after 10 minutes'));
      }, 600000);
    });
  }
}
