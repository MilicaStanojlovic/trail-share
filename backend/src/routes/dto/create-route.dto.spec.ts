import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateRouteDto } from './create-route.dto';

async function validateBody(
  body: Record<string, unknown>,
): Promise<{ errors: ValidationError[]; instance: CreateRouteDto }> {
  const instance = plainToInstance(CreateRouteDto, body, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { errors, instance };
}

function failedProps(errors: ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

const validBody: Record<string, unknown> = {
  name: 'Sljeme Summit Climb',
  description: 'Steep but shaded.',
  difficulty: 'Moderate',
  activity: 'Hiking',
  waypoints: [
    [45.9002, 15.9432],
    [45.9068, 15.9508],
  ],
};

describe('CreateRouteDto validation', () => {
  describe('valid body', () => {
    it('produces zero errors', async () => {
      const { errors } = await validateBody(validBody);
      expect(errors).toHaveLength(0);
    });
  });

  describe('name', () => {
    it('fails when trimmed to two characters', async () => {
      const { errors } = await validateBody({ ...validBody, name: '  ab  ' });
      expect(failedProps(errors)).toContain('name');
    });

    it('passes when trimmed to three characters and stores the trimmed value', async () => {
      const { errors, instance } = await validateBody({
        ...validBody,
        name: '  abc  ',
      });
      expect(errors).toHaveLength(0);
      expect(instance.name).toBe('abc');
    });

    it('fails when missing', async () => {
      const { errors } = await validateBody({
        description: validBody.description,
        difficulty: validBody.difficulty,
        activity: validBody.activity,
        waypoints: validBody.waypoints,
      });
      expect(failedProps(errors)).toContain('name');
    });

    it('fails when only whitespace', async () => {
      const { errors } = await validateBody({ ...validBody, name: '   ' });
      expect(failedProps(errors)).toContain('name');
    });

    it('fails at 121 characters', async () => {
      const { errors } = await validateBody({
        ...validBody,
        name: 'a'.repeat(121),
      });
      expect(failedProps(errors)).toContain('name');
    });
  });

  describe('description', () => {
    it('passes when omitted', async () => {
      const body = {
        name: validBody.name,
        difficulty: validBody.difficulty,
        activity: validBody.activity,
        waypoints: validBody.waypoints,
      };
      const { errors } = await validateBody(body);
      expect(errors).toHaveLength(0);
    });
  });

  describe('difficulty', () => {
    it('fails for an unknown value', async () => {
      const { errors } = await validateBody({
        ...validBody,
        difficulty: 'Extreme',
      });
      expect(failedProps(errors)).toContain('difficulty');
    });
  });

  describe('activity', () => {
    it('fails for an unknown value', async () => {
      const { errors } = await validateBody({
        ...validBody,
        activity: 'Running',
      });
      expect(failedProps(errors)).toContain('activity');
    });
  });

  describe('unknown properties', () => {
    it('fails for a non-whitelisted property', async () => {
      const { errors } = await validateBody({
        ...validBody,
        authorId: 'some-author-id',
      });
      expect(failedProps(errors)).toContain('authorId');
    });
  });

  describe('waypoints', () => {
    it('fails with a single pair', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [[45.9, 15.96]],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails with the wrong arity', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [[1], [45.9, 15.96]],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails with three elements in a pair', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [45.9, 15.96, 1],
          [45.91, 15.97],
        ],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails with non-numeric coordinates', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          ['a', 'b'],
          [45.9, 15.96],
        ],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails when latitude is out of range', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [95, 15.96],
          [45.9, 15.96],
        ],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails when longitude is out of range', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [45.9, 195],
          [45.9, 15.96],
        ],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('fails when a coordinate is NaN', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [Number.NaN, 0],
          [45.9, 15.96],
        ],
      });
      expect(failedProps(errors)).toContain('waypoints');
    });

    it('passes at the inclusive bounds', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [-90, -180],
          [90, 180],
        ],
      });
      expect(errors).toHaveLength(0);
    });

    it('reports the expected message for a waypoint violation', async () => {
      const { errors } = await validateBody({
        ...validBody,
        waypoints: [
          [95, 15.96],
          [45.9, 15.96],
        ],
      });
      const waypointsError = errors.find(
        (error) => error.property === 'waypoints',
      );
      expect(waypointsError).toBeDefined();

      const message = findLatLngMessage(waypointsError);
      expect(message).toBe(
        'each waypoint must be a [lat, lng] pair with lat in [-90, 90] and lng in [-180, 180]',
      );
    });
  });
});

function findLatLngMessage(
  error: ValidationError | undefined,
): string | undefined {
  if (error === undefined) {
    return undefined;
  }

  if (error.constraints?.isLatLngPair !== undefined) {
    return error.constraints.isLatLngPair;
  }

  for (const child of error.children ?? []) {
    if (child.constraints?.isLatLngPair !== undefined) {
      return child.constraints.isLatLngPair;
    }
  }

  return undefined;
}
