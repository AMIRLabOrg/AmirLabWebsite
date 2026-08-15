import { assessResumeText } from './resume-assessment';

describe('assessResumeText', () => {
  it('accepts a text-based resume with contact and standard sections', () => {
    const text = `Jane Researcher jane@example.org
      Education PhD in Computer Science. Experience in machine learning research.
      Skills Python, statistics, and data engineering. Projects include clinical NLP.
      ${'Published reproducible research and collaborated across teams. '.repeat(8)}`;

    expect(assessResumeText(text)).toMatchObject({
      accepted: true,
      feedback:
        'Readable contact information and standard resume sections detected.',
      resume: {
        profile: {
          email: 'jane@example.org',
          fullName: 'Jane Researcher',
        },
      },
    });
  });

  it('rejects image-like or unstructured extraction with useful feedback', () => {
    const assessment = assessResumeText('Jane Researcher');

    expect(assessment.accepted).toBe(false);
    expect(assessment.feedback).toContain('selectable text');
    expect(assessment.feedback).toContain('email address');
    expect(assessment.feedback).toContain('section headings');
  });

  it('does not mistake a section heading for the applicant name', () => {
    const text = `Md Fuad Hasan
      93 Example Road, Dhaka
      +8801576547976 fuad@example.org
      CAREER OBJECTIVE
      Software engineering student interested in compilers and backend systems.
      EDUCATION
      Bachelor of Science in Computer Science and Engineering
      PROJECTS
      Built a compiler and language server.
      SKILLS
      Go, C, TypeScript, PostgreSQL
      ${'Implemented reliable systems and developer tools. '.repeat(8)}`;

    const assessment = assessResumeText(text, 2);

    expect(assessment.accepted).toBe(true);
    expect(assessment.resume.profile).toEqual({
      email: 'fuad@example.org',
      fullName: 'Md Fuad Hasan',
      phone: '+8801576547976',
    });
    expect(Object.keys(assessment.resume.sections)).toEqual(
      expect.arrayContaining(['summary', 'education', 'projects', 'skills']),
    );
  });

  it('handles common two-column and alternate-heading extraction order', () => {
    const text = `JANE A. DOE
      jane.doe@example.com | (212) 555-0198 | New York, NY
      PROFESSIONAL SUMMARY
      Machine learning engineer focused on reproducible research.
      TECHNICAL SKILLS
      Python, PyTorch, SQL, Docker
      PROFESSIONAL EXPERIENCE
      Research Engineer, Example Institute
      ACADEMIC BACKGROUND
      MSc Computer Science, Example University
      ${'Designed, evaluated, and documented production research systems. '.repeat(8)}`;

    const assessment = assessResumeText(text);

    expect(assessment.accepted).toBe(true);
    expect(assessment.resume.profile.fullName).toBe('JANE A. DOE');
    expect(assessment.resume.profile.phone).toBe('(212) 555-0198');
    expect(assessment.resume.sections).toHaveProperty('experience');
    expect(assessment.resume.sections).toHaveProperty('education');
    expect(assessment.resume.sections).toHaveProperty('skills');
  });
});
