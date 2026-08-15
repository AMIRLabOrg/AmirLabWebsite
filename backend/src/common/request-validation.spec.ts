import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';
import { ApplicationsController } from '../applications/applications.controller';
import { ApplicationsService } from '../applications/applications.service';
import { ProjectsController } from '../projects/projects.controller';
import { ProjectsService } from '../projects/projects.service';
import { ResearchController } from '../research/research.controller';
import { ResearchRelationshipsService } from '../research/research-relationships.service';
import { ResearchService } from '../research/research.service';
import { SiteContentController } from '../site-content/site-content.controller';
import { DEFAULT_HOME_CONTENT } from '../site-content/site-content.defaults';
import { SiteContentService } from '../site-content/site-content.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';

describe('request validation', () => {
  let app: INestApplication<App>;
  const applications = {
    get: jest.fn(),
    list: jest.fn(),
    submit: jest.fn((body: unknown) => body),
  };
  const relationships = {};
  const projects = {
    create: jest.fn((body: unknown) => body),
  };
  const research = {
    reviewItem: jest.fn(),
    submit: jest.fn((body: unknown) => body),
  };
  const users = {
    create: jest.fn((body: unknown) => body),
    get: jest.fn(),
  };
  const siteContent = {
    updateHome: jest.fn((body: unknown) => body),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        ApplicationsController,
        ProjectsController,
        ResearchController,
        SiteContentController,
        UsersController,
      ],
      providers: [
        { provide: ApplicationsService, useValue: applications },
        { provide: ProjectsService, useValue: projects },
        { provide: ResearchRelationshipsService, useValue: relationships },
        { provide: ResearchService, useValue: research },
        { provide: SiteContentService, useValue: siteContent },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects research fields that do not belong to the selected type', async () => {
    const response = await request(app.getHttpServer())
      .post('/research')
      .send({
        canonicalUrl: 'https://example.org/paper',
        contributors: ['Jane Researcher'],
        license: 'MIT',
        title: 'A verified paper',
        type: 'PAPER',
      })
      .expect(400);

    expect(responseMessages(response)).toContain(
      'license is only allowed for dataset submissions',
    );
    expect(research.submit).not.toHaveBeenCalled();
  });

  it('normalizes contributors and accepts fields for the selected type', async () => {
    await request(app.getHttpServer())
      .post('/research')
      .send({
        canonicalUrl: 'https://example.org/dataset',
        contributors: ['  Jane Researcher  '],
        license: 'CC BY 4.0',
        title: 'A verified dataset',
        type: 'DATASET',
      })
      .expect(201);

    expect(research.submit).toHaveBeenCalledWith(
      expect.objectContaining({ contributors: ['Jane Researcher'] }),
      undefined,
    );
  });

  it('routes internal projects through the dedicated project contract', async () => {
    const personId = '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58';
    await request(app.getHttpServer())
      .post('/projects')
      .send({
        contributorPersonIds: [personId],
        departmentId: '77ed8c95-13f6-41c7-838d-ae1728904893',
        objective: 'Create a validated internal project workspace.',
        status: 'PLANNED',
        title: 'An internal project',
      })
      .expect(201);

    expect(projects.create).toHaveBeenCalledWith(
      expect.objectContaining({ contributorPersonIds: [personId] }),
      undefined,
    );

    const response = await request(app.getHttpServer())
      .post('/research')
      .send({
        canonicalUrl: 'https://example.org/project',
        contributors: ['Jane Researcher'],
        title: 'An internal project through the wrong endpoint',
        type: 'PROJECT',
      })
      .expect(400);

    expect(responseMessages(response)).toContain(
      'type must be one of the following values: PAPER, DATASET',
    );
  });

  it('does not accept browser-parsed resume JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/applications')
      .field('consent', 'true')
      .field('email', 'jane@example.org')
      .field('fullName', 'Jane Researcher')
      .field('parsedResume', JSON.stringify({ profile: { trusted: true } }))
      .field('positionId', '0f52c8f1-1bd0-40c6-9724-6b14c2f6fe58')
      .attach('cv', Buffer.from('%PDF-1.7'), {
        contentType: 'application/pdf',
        filename: 'cv.pdf',
      })
      .expect(400);

    expect(responseMessages(response)).toContain(
      'property parsedResume should not exist',
    );
    expect(applications.submit).not.toHaveBeenCalled();
  });

  it('does not expose transient parsing states as reviewer filters', async () => {
    await request(app.getHttpServer())
      .get('/applications?status=PARSING')
      .expect(400);

    expect(applications.list).not.toHaveBeenCalled();
  });

  it('keeps permission role independent from academic rank', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'admin@example.org',
        fullName: 'Staff Administrator',
        role: 'ADMIN',
      })
      .expect(201);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ADMIN' }),
    );
    expect(users.create.mock.calls[0][0]).toHaveProperty('rank', undefined);
  });

  it('validates administrator-managed site content on the backend', async () => {
    await request(app.getHttpServer())
      .put('/site-content/home')
      .send({ ...DEFAULT_HOME_CONTENT, untrustedMarkup: '<script />' })
      .expect(400);

    expect(siteContent.updateHome).not.toHaveBeenCalled();
  });

  it.each([
    ['/applications/not-a-uuid', applications.get],
    ['/research-review/not-a-uuid', research.reviewItem],
    ['/users/not-a-uuid', users.get],
  ])('rejects an invalid database ID at %s', async (path, handler) => {
    await request(app.getHttpServer()).get(path).expect(400);
    expect(handler).not.toHaveBeenCalled();
  });
});

function responseMessages(response: Response): string[] {
  const body: unknown = response.body;
  if (!body || typeof body !== 'object') return [];
  const message = (body as Record<string, unknown>).message;
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string');
  }
  return typeof message === 'string' ? [message] : [];
}
