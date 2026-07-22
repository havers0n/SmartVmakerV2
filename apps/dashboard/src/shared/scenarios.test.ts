import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeAndValidateScenarios,
  getScenarioWorkspaceState,
  ScenarioGenerationError,
  type ScenarioGenerationErrorCode,
} from './scenarios';

const validScenario = {
  title: 'A valid scenario',
  description: 'A complete scenario returned by the provider.',
  aesScore: 92,
  hookStrength: 95,
  emotionalCurve: ['anticipation', 'impact'],
  scenes: [{ phase: 'HOOK', duration: 2, description: 'A clear opening shot.' }],
};

function expectCode(run: () => unknown, code: ScenarioGenerationErrorCode) {
  try {
    run();
    throw new Error('Expected scenario validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ScenarioGenerationError);
    expect((error as ScenarioGenerationError).code).toBe(code);
  }
}

describe('normalizeAndValidateScenarios', () => {
  it('accepts a correct scenarios array', () => {
    expect(normalizeAndValidateScenarios([validScenario])).toEqual([validScenario]);
  });

  it('parses a JSON-stringified array exactly once', () => {
    expect(normalizeAndValidateScenarios(JSON.stringify([validScenario]))).toEqual([validScenario]);
  });

  it('rejects a malformed string as a JSON parse failure', () => {
    expectCode(() => normalizeAndValidateScenarios('not json'), 'SCENARIO_GENERATION_JSON_PARSE_FAILED');
  });

  it('rejects the exact 8336-character beamngtest1 reproduction as truncated', () => {
    const fixture = readFileSync(
      new URL('./__fixtures__/beamngtest1-truncated-scenarios.txt', import.meta.url),
      'utf8',
    ).replace(/\r?\n$/, '');
    expect(fixture).toHaveLength(8336);
    expectCode(() => normalizeAndValidateScenarios(fixture), 'SCENARIO_GENERATION_TRUNCATED');
  });

  it.each([
    ['object', { scenarios: [validScenario] }],
    ['null', null],
    ['scalar', 42],
  ])('rejects %s instead of an array', (_label, value) => {
    expectCode(() => normalizeAndValidateScenarios(value), 'SCENARIO_GENERATION_INVALID_TYPE');
  });

  it('rejects a scenario without a required field', () => {
    const { title: _title, ...missingTitle } = validScenario;
    expectCode(
      () => normalizeAndValidateScenarios([missingTitle]),
      'SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED',
    );
  });

  it('rejects a scene without a required field', () => {
    const missingDescription = { phase: 'HOOK', duration: 2 };
    expectCode(
      () => normalizeAndValidateScenarios([{ ...validScenario, scenes: [missingDescription] }]),
      'SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED',
    );
  });

  it('rejects unknown fields because scenario objects are strict', () => {
    expectCode(
      () => normalizeAndValidateScenarios([{ ...validScenario, unexpected: true }]),
      'SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED',
    );
  });

  it('rejects an empty scenarios array explicitly', () => {
    expectCode(() => normalizeAndValidateScenarios([]), 'SCENARIO_GENERATION_EMPTY');
  });

  it('rejects finish_reason=length', () => {
    expectCode(
      () => normalizeAndValidateScenarios('[', 'length'),
      'SCENARIO_GENERATION_TRUNCATED',
    );
  });

  it('rejects valid JSON when finish_reason=length', () => {
    expectCode(
      () => normalizeAndValidateScenarios(JSON.stringify([validScenario]), 'length'),
      'SCENARIO_GENERATION_TRUNCATED',
    );
  });
});

describe('corrupted project workspace state', () => {
  it('treats missing scenarios as not generated rather than corrupted', () => {
    expect(getScenarioWorkspaceState(undefined)).toEqual({ status: 'empty' });
  });

  it('treats a stored empty array as invalid/corrupted', () => {
    expect(getScenarioWorkspaceState([])).toEqual({ status: 'corrupted' });
  });

  it('does not turn the beamngtest1 payload into an empty scenario selection', () => {
    const fixture = readFileSync(
      new URL('./__fixtures__/beamngtest1-truncated-scenarios.txt', import.meta.url),
      'utf8',
    ).replace(/\r?\n$/, '');
    expect(getScenarioWorkspaceState(fixture)).toEqual({ status: 'corrupted' });
  });
});
