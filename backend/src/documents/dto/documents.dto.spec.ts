import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DocumentApprovalDto, IssueDocumentDto } from './documents.dto';

const id = '123e4567-e89b-42d3-a456-426614174000';
const offer = { kind: 'OFFER', templateId: id };

describe('document request validation', () => {
  it.each(['one task', {}, Array(31).fill('Task'), ['   '], ['x'.repeat(501)]])(
    'rejects malformed or excessive responsibilities: %j',
    async (responsibilities) => {
      expect(
        await validate(
          plainToInstance(IssueDocumentDto, { ...offer, responsibilities }),
        ),
      ).not.toEqual([]);
    },
  );

  it('accepts a bounded list of responsibilities', async () => {
    expect(
      await validate(
        plainToInstance(IssueDocumentDto, {
          ...offer,
          responsibilities: ['Prepare datasets', 'Report findings'],
        }),
      ),
    ).toEqual([]);
  });

  it.each(['true', 'false', true, false])(
    'accepts multipart boolean %j',
    async (value) => {
      const dto = plainToInstance(DocumentApprovalDto, {
        approverPersonId: id,
        removeSignature: value,
        removeWatermark: value,
      });
      expect(await validate(dto)).toEqual([]);
      expect(dto.removeSignature).toBe(value === true || value === 'true');
    },
  );

  it.each(['yes', '', 1, {}, []])(
    'rejects invalid approval flags: %j',
    async (value) => {
      expect(
        await validate(
          plainToInstance(DocumentApprovalDto, {
            approverPersonId: id,
            removeSignature: value,
            removeWatermark: value,
          }),
        ),
      ).not.toEqual([]);
    },
  );
});
