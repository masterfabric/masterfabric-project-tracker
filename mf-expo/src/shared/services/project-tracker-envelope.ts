import { graphqlRequest } from './graphql-client';

type EnvelopeResult = {
  particularGraphqlEnvelope: {
    dataJson?: string | null;
    errorsJson?: string | null;
  };
};

const ENVELOPE = /* GraphQL */ `
  query ParticularGraphqlEnvelope($input: ParticularGraphqlInput!) {
    particularGraphqlEnvelope(input: $input) {
      dataJson
      errorsJson
    }
  }
`;

const DEFAULT_PARTICULAR_KEY = 'project_tracker';
const DEFAULT_CAPABILITY = 'project.tracker.graphql';

/**
 * Forward an inner GraphQL operation to particular-project-tracker via mf-go.
 * Clients never call the Particular host directly; org-project ops hop through
 * `particularGraphqlEnvelope`. Auth / orgs / personal todos stay on direct mf-go GraphQL.
 *
 * `organizationId` is required per call — Project Tracker switches orgs at runtime.
 */
export async function projectTrackerEnvelope<T>(args: {
  organizationId: string;
  requiredCapability?: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const organizationId = args.organizationId?.trim();
  if (!organizationId) {
    throw new Error('organizationId is required for project tracker Particular calls');
  }

  const particularKey =
    (typeof process !== 'undefined' &&
      process.env.EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR?.trim()) ||
    DEFAULT_PARTICULAR_KEY;

  const data = await graphqlRequest<EnvelopeResult>(ENVELOPE, {
    input: {
      particularKey,
      organizationId,
      requiredCapability: args.requiredCapability ?? DEFAULT_CAPABILITY,
      query: args.query,
      variablesJson: JSON.stringify(args.variables ?? {}),
    },
  });

  const env = data.particularGraphqlEnvelope;
  if (env.errorsJson && env.errorsJson !== 'null' && env.errorsJson !== '[]') {
    throw new Error(`project_tracker errors: ${env.errorsJson}`);
  }
  if (!env.dataJson) {
    throw new Error('project_tracker returned empty dataJson');
  }

  const parsed = JSON.parse(env.dataJson) as { data?: T } | T;
  if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data !== undefined) {
    return parsed.data as T;
  }
  return parsed as T;
}
