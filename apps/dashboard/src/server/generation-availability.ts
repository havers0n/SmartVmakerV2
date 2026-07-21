export const FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE';

export class FeatureNotAvailableError extends Error {
  readonly code = FEATURE_NOT_AVAILABLE;

  constructor(feature: string) {
    super(`${FEATURE_NOT_AVAILABLE}: ${feature}`);
    this.name = 'FeatureNotAvailableError';
  }
}

export function isExplicitDevelopmentMockGeneration(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NODE_ENV === 'development' &&
    (env.SCRIMSPEC_ALLOW_MOCK_GENERATION === '1' ||
      env.SCRIMSPEC_ALLOW_MOCK_GENERATION === 'true')
  );
}
