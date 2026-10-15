import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePositionDto, UpdatePositionDto } from './position.dto';

describe.each([CreatePositionDto, UpdatePositionDto])(
  '%s list validation',
  (Dto) => {
    it.each(['responsibilities', 'requirements'])(
      'rejects excessive %s item text',
      async (key) => {
        const errors = await validate(
          plainToInstance(Dto, {
            title: 'Research assistant',
            summary: 'Work on machine learning research.',
            requirements: ['Research experience'],
            [key]: ['x'.repeat(501)],
          }),
        );
        expect(errors.some((error) => error.property === key)).toBe(true);
      },
    );
  },
);
