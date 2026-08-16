import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Supabase is this project's hosted Postgres and nothing else: the backend
 * reaches it through a connection string, and the ORM, the migrations and the
 * authentication all stay ours.
 *
 * That is true today but nothing stops it eroding. It erodes the day someone
 * installs @supabase/supabase-js to solve one problem quickly — and from then
 * on there are two ways to read data and, worse, potentially two places a user
 * can exist. These tests are the tripwire.
 *
 * The check is on dependencies rather than source text on purpose. Adopting
 * Supabase Auth, PostgREST or the JS client means installing a package, so that
 * is the choke point. A comment or a doc mentioning Supabase is fine.
 */

const BACKEND_PACKAGE_JSON = join(__dirname, '..', '..', 'package.json');
const FRONTEND_PACKAGE_JSON = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'package.json',
);

// @supabase/* is the JS client and its Auth/Storage/Realtime siblings;
// postgrest-js is the REST layer that would bypass the NestJS API; gotrue-js is
// the standalone auth client. Any of them means the boundary has moved.
const HOSTED_BACKEND_SDK = /supabase|postgrest|gotrue/i;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function dependencyNames(packageJsonPath: string): string[] {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
}

describe('Supabase stays just Postgres', () => {
  it.each([
    ['backend', BACKEND_PACKAGE_JSON],
    ['frontend', FRONTEND_PACKAGE_JSON],
  ])('%s depends on no Supabase SDK', (label, packageJsonPath) => {
    const offenders = dependencyNames(packageJsonPath).filter((name) =>
      HOSTED_BACKEND_SDK.test(name),
    );

    // Thrown rather than asserted: jest's expect takes no message argument, and
    // a bare "expected [] but got ['@supabase/supabase-js']" does not tell the
    // next person why that is a problem.
    if (offenders.length > 0) {
      throw new Error(
        `${label}/package.json pulls in ${offenders.join(', ')}.\n\n` +
          "Supabase is this project's hosted Postgres and nothing more: all " +
          'access goes through the NestJS API, and authentication is our own ' +
          'JWT + bcrypt in backend/src/auth. Adding a Supabase SDK moves that ' +
          'boundary — most damagingly for auth, where it can leave users ' +
          'existing in two places at once.\n\n' +
          'If the decision is being reversed deliberately, update this test ' +
          'and CLAUDE.md in the same commit so the new boundary is written ' +
          'down rather than merely happening.',
      );
    }
  });

  it('still owns authentication', () => {
    const backend = dependencyNames(BACKEND_PACKAGE_JSON);

    // Password hashing and token signing live here, not in a hosted service.
    // Dropping either of these is how auth silently migrates elsewhere.
    expect(backend).toContain('bcryptjs');
    expect(backend).toContain('@nestjs/jwt');
  });
});
