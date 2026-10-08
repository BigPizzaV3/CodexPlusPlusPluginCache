import path from 'node:path';

import { loadConfig } from './config.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { evaluateAction } from './policy.mjs';
import { runProcess } from './process.mjs';
import { inspectProject } from './project.mjs';
import { redactText, redactValue } from './redact.mjs';

export async function verifyWorkspace(options) {
  const workspace = await resolveWorkspace(options.workspace);
  const profile = options.profile ?? await inspectProject(workspace);
  const config = options.config ?? await loadConfig(workspace);
  const commands = options.commands ?? profile.commands;
  const results = [];
  const errors = [];

  if (commands.length === 0) {
    errors.push({ code: 'FM_VERIFY_NO_COMMANDS', message: 'No project verification commands were detected.' });
  }

  for (const item of commands) {
    if (!options.run) {
      results.push({ ...item, status: 'planned' });
      continue;
    }
    if (item.confidence === 'inferred' && !options.allowInferred) {
      const error = { code: 'FM_COMMAND_INFERRED_DENIED', message: `Refusing inferred command without approval: ${item.command}` };
      errors.push(error);
      results.push({ ...item, status: 'denied', exitCode: null });
      continue;
    }
    const policyDecision = evaluateAction(config.policy, { kind: 'command', command: item.command });
    if (policyDecision.decision === 'deny') {
      errors.push({ code: 'FM_POLICY_DENIED', message: policyDecision.rationale });
      results.push({ ...item, status: 'denied', exitCode: null, policyDecision });
      continue;
    }
    const [tokenizedCommand, ...tokenizedArgs] = tokenize(item.command);
    const normalizedArgs = Array.isArray(item.args) ? item.args.map(String) : null;
    const command = normalizedArgs ? item.command : tokenizedCommand;
    const args = normalizedArgs ?? tokenizedArgs;
    const execution = await runProcess(command, args, { cwd: workspace, maxOutputBytes: options.maxOutputBytes });
    const stdout = redactText(execution.stdout, config.redaction);
    const stderr = redactText(execution.stderr, config.redaction);
    const status = execution.exitCode === 0 ? 'passed' : 'failed';
    if (status === 'failed') errors.push({ code: 'FM_VERIFY_FAILED', message: `${item.command} exited with ${execution.exitCode}` });
    results.push({
      ...item,
      ...execution,
      stdout: stdout.text,
      stderr: stderr.text,
      redaction: { matches: stdout.matches + stderr.matches, types: [...new Set([...stdout.types, ...stderr.types])] },
      policyDecision,
      status,
    });
  }

  const status = errors.length ? 'failed' : options.run ? 'passed' : 'planned';
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), status, workspace, commands: results, errors };
  const sanitized = redactValue(report, config.redaction).value;
  const reportPath = assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'reports', 'verification-latest.json'));
  await writeJsonAtomic(reportPath, sanitized);
  return { ...sanitized, evidencePath: '.codex-orchestrator/reports/verification-latest.json' };
}

export function tokenize(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (const character of command) {
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (current) tokens.push(current), current = '';
    } else {
      current += character;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
