import { describe, expect, it } from 'vitest';
import {
  FEATURE_NOT_AVAILABLE,
  FeatureNotAvailableError,
  isExplicitDevelopmentMockGeneration,
} from './generation-availability';

describe('generation availability', () => {
  it('does not enable mock generation in production', () => {
    expect(
      isExplicitDevelopmentMockGeneration({
        NODE_ENV: 'production',
        SCRIMSPEC_ALLOW_MOCK_GENERATION: 'true',
      }),
    ).toBe(false);
    expect(new FeatureNotAvailableError('MiniMax generation').code).toBe(
      FEATURE_NOT_AVAILABLE,
    );
  });
});
